import { expect, test, type Page } from "@playwright/test";

const preview = (page: Page) => page.getByRole("article");
const conversation = (page: Page) => page.getByRole("list", { name: "Conversation" });
const assistantMessages = (page: Page) => conversation(page).locator('[data-role="assistant"]');
// Scoped to the chat: Next.js adds its own (empty) alert for route announcements.
const chatError = (page: Page) =>
  page.getByRole("region", { name: "Chat with the Prelegal assistant" }).getByRole("alert");

/** The paragraph right after a cover page heading in the preview. */
const section = (page: Page, heading: string) =>
  preview(page).getByRole("heading", { level: 3, name: heading }).locator("xpath=following-sibling::*[1]");

const signatureRow = (page: Page, label: string) => preview(page).getByRole("row").filter({ hasText: label });

// The live AI can take a while to answer.
const AI_TIMEOUT = 60_000;

/** Sends a chat message and waits for the AI's reply. */
async function say(page: Page, text: string) {
  const replies = await assistantMessages(page).count();
  await page.getByLabel("Message").fill(text);
  await page.getByLabel("Message").press("Enter");
  await expect(assistantMessages(page)).toHaveCount(replies + 1, { timeout: AI_TIMEOUT });
  await expect(chatError(page)).toHaveCount(0);
}

const PARTIES_AND_LAW =
  "The parties are Analytical Ltd, signed by Ada Lovelace (CEO, ada@analytical.example), " +
  "and Enigma Inc, signed by Alan Turing (CTO, alan@enigma.example). " +
  "Delaware law applies, and disputes go to the courts of New Castle, DE.";

test.describe("Mutual NDA creator", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    await page.goto("/nda/");
  });

  test.afterEach(() => {
    // Catches hydration mismatches and runtime errors.
    expect(consoleErrors).toEqual([]);
  });

  test("loads with the chat, defaults and today's date", async ({ page }) => {
    await expect(page).toHaveTitle("Mutual NDA Creator · Prelegal");
    await expect(page.getByRole("heading", { level: 1, name: /Mutual NDA Creator/ })).toBeVisible();
    await expect(assistantMessages(page)).toHaveText([/who are the two parties/i]);
    await expect(page.getByLabel("Message")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send" })).toHaveCSS("background-color", "rgb(117, 57, 145)");
    const today = await page.evaluate(() =>
      new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    );
    await expect(section(page, "Effective Date")).toHaveText(today);
    await expect(section(page, "MNDA Term")).toHaveText("Expires 1 year from Effective Date.");
    await expect(preview(page).getByRole("heading", { level: 1, name: "Standard Terms" })).toBeAttached();
  });

  test("offers only a PDF download", async ({ page }) => {
    await expect(page.getByRole("button")).toHaveText(["Sign out", "Download PDF", "Send"]);
    await expect(page.getByText(/markdown/i)).toHaveCount(0);
  });

  test("shows the error and keeps the message when the AI is unavailable", async ({ page }) => {
    await page.route("/api/chat", (route) =>
      route.fulfill({ status: 502, json: { detail: "The AI assistant didn't respond. Please try again." } }),
    );
    await page.getByLabel("Message").fill("Acme Inc and Globex LLC");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(chatError(page)).toHaveText("The AI assistant didn't respond. Please try again.");
    await expect(page.getByLabel("Message")).toHaveValue("Acme Inc and Globex LLC");
    // The browser logs the failed request itself; that is expected here.
    consoleErrors = consoleErrors.filter((e) => !e.includes("status of 502"));
  });

  test("Download PDF opens the print dialog", async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { printCalls: number }).printCalls = 0;
      window.print = () => {
        (window as unknown as { printCalls: number }).printCalls++;
      };
    });
    await page.getByRole("button", { name: "Download PDF" }).click();
    expect(await page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(1);
  });

  test("print layout shows only the agreement", async ({ page }) => {
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeHidden();
    await expect(page.getByLabel("Message")).toBeHidden();
    await expect(page.getByText(/Not legal advice/)).toBeHidden();
    await expect(preview(page)).toBeVisible();
    await expect(preview(page).getByText("Equitable Relief")).toBeVisible();
  });

  test("saved PDF contains the full agreement over several pages", async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== "chromium" || testInfo.project.name !== "desktop", "PDF output is Chromium desktop only");
    const pdf = await page.pdf({ format: "Letter" });
    expect(pdf.byteLength).toBeGreaterThan(10_000);
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    // Cover page, then the standard terms starting on a new page.
    expect(pageCount).toBeGreaterThanOrEqual(3);
  });

  test("has no horizontal scrolling", async ({ page }) => {
    await page.getByLabel("Message").fill("A long message ".repeat(40));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

// These talk to the real AI model through the backend, so they need
// OPENROUTER_API_KEY in the repo's .env. They only run in the desktop project
// to keep API usage down.
test.describe("Mutual NDA creator with the live AI", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Live AI tests run on desktop only");
    await page.goto("/nda/");
  });

  test("fills in the parties and governing law from a conversation", async ({ page }) => {
    await say(page, PARTIES_AND_LAW);

    await expect(signatureRow(page, "Print Name")).toHaveText(/Ada Lovelace\s*Alan Turing/);
    await expect(signatureRow(page, "Title")).toHaveText(/CEO\s*CTO/);
    await expect(signatureRow(page, "Company")).toHaveText(/Analytical Ltd\.?\s*Enigma Inc\.?/);
    await expect(signatureRow(page, "Notice Address")).toHaveText(/ada@analytical\.example\s*alan@enigma\.example/);
    await expect(preview(page).getByText(/Governing Law: Delaware/)).toBeVisible();
    await expect(preview(page).getByText(/Jurisdiction: New Castle/)).toBeVisible();
    // The AI keeps the conversation going.
    await expect(assistantMessages(page).last()).not.toBeEmpty();
  });

  test("changes terms and dates when asked, keeping earlier answers", async ({ page }) => {
    await say(page, PARTIES_AND_LAW);
    await expect(signatureRow(page, "Company")).toHaveText(/Analytical Ltd\.?\s*Enigma Inc\.?/);

    await say(
      page,
      "The NDA should continue until terminated, confidential information should be protected in perpetuity, " +
        "and the effective date is March 5, 2027.",
    );

    await expect(section(page, "MNDA Term")).toHaveText("Continues until terminated in accordance with the terms of the MNDA.");
    await expect(section(page, "Term of Confidentiality")).toHaveText("In perpetuity.");
    await expect(section(page, "Effective Date")).toHaveText("March 5, 2027");
    await expect(signatureRow(page, "Company")).toHaveText(/Analytical Ltd\.?\s*Enigma Inc\.?/);
  });

  test("asks for details instead of making them up", async ({ page }) => {
    await say(page, "Hi, I need an NDA with Globex.");

    // Party names and addresses were not given, so they stay blank.
    await expect(signatureRow(page, "Print Name")).toHaveText(/^Print Name\s*$/);
    await expect(signatureRow(page, "Notice Address")).toHaveText(/^Notice Address\s*$/);
    // It asks for them (wording varies: sometimes a question, sometimes a list).
    await expect(assistantMessages(page).last()).toContainText(/name|address/i);
  });
});
