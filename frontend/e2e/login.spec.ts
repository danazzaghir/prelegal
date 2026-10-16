import { expect, test } from "@playwright/test";

test.describe("Fake login", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    await page.goto("/");
  });

  test.afterEach(() => {
    expect(consoleErrors).toEqual([]);
  });

  test("shows the login screen first", async ({ page }) => {
    await expect(page).toHaveTitle("Sign in · Prelegal");
    await expect(page.getByRole("heading", { level: 1, name: "Prelegal" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toHaveCSS("background-color", "rgb(117, 57, 145)");
  });

  test("any email and password bring the user to the NDA creator", async ({ page }) => {
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("anything");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/nda\/$/);
    await expect(page.getByRole("heading", { level: 1, name: /Mutual NDA Creator/ })).toBeVisible();
    await expect(page.getByText("ada@example.com")).toBeVisible();
  });

  test("stays signed in after a reload", async ({ page }) => {
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("x");
    await page.getByLabel("Password").press("Enter");
    await expect(page).toHaveURL(/\/nda\/$/);
    await page.reload();
    await expect(page.getByText("ada@example.com")).toBeVisible();
  });

  test("the browser blocks an empty or invalid email", async ({ page }) => {
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("x");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel("Email")).toHaveJSProperty("validity.valid", false);
  });

  test("signing out returns to the login screen", async ({ page }) => {
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("x");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await page.goto("/nda/");
    await expect(page.getByText("ada@example.com")).toHaveCount(0);
  });
});

test.describe("Backend", () => {
  test("reports healthy, with the database up", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({ status: "ok", database: "ok" });
  });

  test("redirects /nda to /nda/", async ({ page }) => {
    await page.goto("/nda");
    await expect(page).toHaveURL(/\/nda\/$/);
    await expect(page.getByRole("heading", { level: 1, name: /Mutual NDA Creator/ })).toBeVisible();
  });

  test("serves the frontend 404 page for unknown pages", async ({ page }) => {
    const response = await page.goto("/no-such-page/");
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
  });
});
