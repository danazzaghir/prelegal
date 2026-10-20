import { expect, test, type Page } from "@playwright/test";
import { newAccount, signUpViaApi } from "./helpers";

const NO_PARTY = { name: null, title: null, company: null, noticeAddress: null };

/** Makes /api/chat choose a Service Level Agreement instead of calling the AI. */
async function fakeAiChoosesSla(page: Page) {
  await page.route("/api/chat", (route) =>
    route.fulfill({
      json: {
        reply: "A Service Level Agreement fits.\n\nWhat uptime do you promise?",
        question: "What uptime do you promise?",
        documentId: "sla",
        party1: { ...NO_PARTY, company: "Acme Inc" },
        party2: NO_PARTY,
        nda: null,
        terms: [{ term: "Target Uptime", value: "99.9%" }],
      },
    }),
  );
}

// Next.js adds its own empty alert for route announcements, so look for one with text.
const alertWithText = (page: Page) => page.getByRole("alert").filter({ hasText: /\S/ });

test.describe("Accounts", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on("console", (msg) => {
      // Signed-out visitors get a 401 from /api/auth/me, which the browser logs.
      if (msg.type() === "error" && !msg.text().includes("status of 401")) consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
  });

  test.afterEach(() => {
    expect(consoleErrors).toEqual([]);
  });

  test("shows the sign-in screen first", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Sign in · Prelegal");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toHaveCSS("background-color", "rgb(117, 57, 145)");
    await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
  });

  test("signs up, lands on an empty dashboard, signs out and back in", async ({ page }) => {
    const account = newAccount();
    await page.goto("/");
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(/\/signup\/$/);
    await page.getByLabel("Name").fill(account.name);
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel(/^Password/).fill(account.password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/dashboard\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "My agreements" })).toBeVisible();
    await expect(page.getByText("You haven't drafted anything yet")).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/dashboard/");
    await expect(page).toHaveURL(/\/$/);

    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByLabel("Password").press("Enter");
    await expect(page).toHaveURL(/\/dashboard\/$/);
  });

  test("explains a wrong password and an email that's already registered", async ({ page }) => {
    const account = await signUpViaApi(page);
    await page.request.post("/api/auth/signout");
    await page.goto("/");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill("wrong password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(alertWithText(page)).toHaveText("Wrong email or password.");

    await page.goto("/signup/");
    await page.getByLabel("Name").fill("Someone");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel(/^Password/).fill("another password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(alertWithText(page)).toContainText("already exists");
    // The browser logs the rejected duplicate sign-up as a failed request.
    consoleErrors = consoleErrors.filter((e) => !e.includes("status of 409"));
  });

  test("sends signed-out visitors to sign in", async ({ page }) => {
    for (const path of ["/dashboard/", "/documents/", "/documents/?id=1"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$/);
    }
  });

  test("an agreement is saved as you chat and can be reopened and deleted", async ({ page }) => {
    await signUpViaApi(page);
    await fakeAiChoosesSla(page);
    await page.goto("/documents/");
    await page.getByLabel("Message").fill("We need an uptime agreement with Acme");
    await page.getByLabel("Message").press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await expect(page).toHaveURL(/\/documents\/\?id=\d+$/);

    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "My agreements" }).click();
    await expect(page).toHaveURL(/\/dashboard\/$/);
    const row = page.getByRole("listitem").filter({ hasText: "Service Level Agreement · Acme Inc" });
    await expect(row).toContainText("Draft, last edited just now");

    await row.getByRole("link", { name: "Open" }).click();
    await expect(page).toHaveURL(/\/documents\/\?id=\d+$/);
    await expect(page.getByText("We need an uptime agreement with Acme")).toBeVisible();
    const agreement = page.getByRole("article", { name: "Agreement" });
    await expect(agreement.getByRole("row").filter({ hasText: "Target Uptime" })).toContainText("99.9%");

    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "New agreement" }).click();
    await expect(page).toHaveURL(/\/documents\/$/);
    await expect(page.getByText("We need an uptime agreement with Acme")).toHaveCount(0);

    await page.goto("/dashboard/");
    await page.getByRole("button", { name: /^Delete / }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("You haven't drafted anything yet")).toBeVisible();
  });

  test("users don't see each other's agreements", async ({ browser }) => {
    const adaContext = await browser.newContext();
    const ada = await adaContext.newPage();
    await signUpViaApi(ada);
    await fakeAiChoosesSla(ada);
    await ada.goto("/documents/");
    await ada.getByLabel("Message").fill("An SLA");
    await ada.getByLabel("Message").press("Enter");
    await expect(ada).toHaveURL(/\?id=\d+$/);
    const adaUrl = ada.url();

    const alanContext = await browser.newContext();
    const alan = await alanContext.newPage();
    await signUpViaApi(alan);
    await alan.goto("/dashboard/");
    await expect(alan.getByText("You haven't drafted anything yet")).toBeVisible();
    await alan.goto(adaUrl);
    await expect(alertWithText(alan)).toHaveText("Agreement not found.");
    await adaContext.close();
    await alanContext.close();
  });
});

test.describe("Backend", () => {
  test("reports healthy, with the database up", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({ status: "ok", database: "ok" });
  });

  test("requires sign-in for the API", async ({ request }) => {
    expect((await request.get("/api/agreements")).status()).toBe(401);
    expect((await request.post("/api/chat", { data: {} })).status()).toBe(401);
  });

  test("redirects /documents to /documents/", async ({ page }) => {
    await signUpViaApi(page);
    await page.goto("/documents");
    await expect(page).toHaveURL(/\/documents\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "New agreement" })).toBeVisible();
  });

  test("serves the frontend 404 page for unknown pages", async ({ page }) => {
    const response = await page.goto("/no-such-page/");
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
  });
});
