import { expect, test, type Page } from "@playwright/test";

const preview = (page: Page) => page.getByRole("article", { name: "Agreement" });
const conversation = (page: Page) => page.getByRole("list", { name: "Conversation" });
const assistantMessages = (page: Page) => conversation(page).locator('[data-role="assistant"]');
// Scoped to the chat: Next.js adds its own (empty) alert for route announcements.
const chatError = (page: Page) =>
  page.getByRole("region", { name: "Chat with the Prelegal assistant" }).getByRole("alert");

/** The paragraph right after a cover page heading in the preview. */
const section = (page: Page, heading: string) =>
  preview(page).getByRole("heading", { level: 3, name: heading }).locator("xpath=following-sibling::*[1]");

const tableRow = (page: Page, label: string) =>
  preview(page).getByRole("row").filter({ has: page.getByRole("cell", { name: label, exact: true }) });

// The live AI can take a while, and the backend retries a stuck call once (2 x 30s).
const AI_TIMEOUT = 75_000;

/** Sends a chat message and waits for the AI's reply. */
async function say(page: Page, text: string) {
  const replies = await assistantMessages(page).count();
  await page.getByLabel("Message").fill(text);
  await page.getByLabel("Message").press("Enter");
  // Stop at whichever comes first: the reply, or an error (e.g. the AI account is out of credit).
  await expect(assistantMessages(page).nth(replies).or(chatError(page))).toBeVisible({ timeout: AI_TIMEOUT });
  await expect(chatError(page)).toHaveCount(0);
}

const NO_PARTY = { name: null, title: null, company: null, noticeAddress: null };

/** Makes /api/chat answer with a fixed turn instead of calling the AI. */
async function fakeAiTurn(page: Page, changes: { reply?: string; documentId?: string; terms?: Record<string, string> }) {
  await page.route("/api/chat", (route) =>
    route.fulfill({
      json: {
        reply: changes.reply ?? "Who is the customer?",
        question: "Who is the customer?",
        documentId: changes.documentId ?? null,
        party1: { ...NO_PARTY, company: "Analytical Ltd" },
        party2: { ...NO_PARTY, company: "Enigma Inc" },
        nda: null,
        terms: Object.entries(changes.terms ?? {}).map(([term, value]) => ({ term, value })),
      },
    }),
  );
}

test.describe("Document creator", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    await page.goto("/documents/");
  });

  test.afterEach(() => {
    // Catches hydration mismatches and runtime errors.
    expect(consoleErrors).toEqual([]);
  });

  test("opens with the chat asking what agreement is needed", async ({ page }) => {
    await expect(page).toHaveTitle("Document Creator · Prelegal");
    await expect(page.getByRole("heading", { level: 1, name: "Prelegal · New agreement" })).toBeVisible();
    await expect(assistantMessages(page)).toHaveText([/What kind of agreement do you need/]);
    await expect(preview(page)).toContainText("Your agreement will appear here");
    await expect(page.getByRole("button", { name: "Send" })).toHaveCSS("background-color", "rgb(117, 57, 145)");
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeDisabled();
    await expect(page.getByText(/markdown/i)).toHaveCount(0);
  });

  test("shows the chosen document's cover page and standard terms", async ({ page }) => {
    await fakeAiTurn(page, { documentId: "CSA", terms: { "Subscription Period": "12 months" } });
    await say(page, "We sell SaaS");
    await expect(page.getByRole("heading", { level: 1, name: "Prelegal · Cloud Service Agreement" })).toBeVisible();
    await expect(preview(page).getByRole("heading", { level: 1, name: "Cloud Service Agreement" })).toBeVisible();
    await expect(tableRow(page, "Subscription Period")).toContainText("12 months");
    await expect(preview(page).getByRole("columnheader", { name: "CUSTOMER" })).toBeVisible();
    await expect(preview(page).getByRole("heading", { level: 1, name: "Standard Terms" })).toBeAttached();
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  });

  test("puts the cursor back in the message box after a reply", async ({ page }) => {
    await fakeAiTurn(page, {});
    await page.getByLabel("Message").fill("hello");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(assistantMessages(page)).toHaveCount(2);
    await expect(page.getByLabel("Message")).toBeFocused();
  });

  test("shows the error and keeps the message when the AI is unavailable", async ({ page }) => {
    await page.route("/api/chat", (route) =>
      route.fulfill({ status: 502, json: { detail: "The AI assistant didn't respond. Please try again." } }),
    );
    await page.getByLabel("Message").fill("I need an NDA");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(chatError(page)).toHaveText("The AI assistant didn't respond. Please try again.");
    await expect(page.getByLabel("Message")).toHaveValue("I need an NDA");
    // The browser logs the failed request itself; that is expected here.
    consoleErrors = consoleErrors.filter((e) => !e.includes("status of 502"));
  });

  test("print layout shows only the agreement", async ({ page }) => {
    await fakeAiTurn(page, { documentId: "sla" });
    await say(page, "An SLA please");
    await expect(preview(page).getByRole("heading", { level: 1, name: "Service Level Agreement" })).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeHidden();
    await expect(page.getByLabel("Message")).toBeHidden();
    await expect(page.getByText(/Not legal advice/)).toBeHidden();
    await expect(preview(page).getByText("Target Uptime").first()).toBeVisible();
  });

  test("saved PDF contains the cover page and standard terms over several pages", async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== "chromium" || testInfo.project.name !== "desktop", "PDF output is Chromium desktop only");
    await fakeAiTurn(page, { documentId: "Pilot-Agreement" });
    await say(page, "A pilot");
    await expect(preview(page).getByRole("heading", { level: 1, name: "Pilot Agreement" })).toBeVisible();
    const pdf = await page.pdf({ format: "Letter" });
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pageCount).toBeGreaterThanOrEqual(3);
  });

  test("has no horizontal scrolling with the longest document", async ({ page }) => {
    await fakeAiTurn(page, { documentId: "Software-License-Agreement", terms: { "Permitted Uses": "x".repeat(200) } });
    await say(page, "A software license");
    await expect(preview(page).getByRole("heading", { level: 1, name: "Software License Agreement" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

// These talk to the real AI model through the backend, so they need
// OPENROUTER_API_KEY in the repo's .env. They only run in the desktop project
// to keep API usage down.
test.describe("Document creator with the live AI", () => {
  // One at a time, so parallel requests don't slow each other down at the AI provider.
  test.describe.configure({ mode: "default", timeout: 240_000 });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Live AI tests run on desktop only");
    await page.goto("/documents/");
  });

  /** The last reply asks a follow-on question. */
  async function expectFollowOnQuestion(page: Page) {
    await expect(assistantMessages(page).last()).toContainText("?");
  }

  test("chooses a Cloud Service Agreement and fills in the parties", async ({ page }) => {
    await say(page, "We sell a SaaS product and need a contract with our customers.");
    await expect(preview(page).getByRole("heading", { level: 1, name: "Cloud Service Agreement" })).toBeVisible();
    await expectFollowOnQuestion(page);

    await say(
      page,
      "The customer is Analytical Ltd, signed by Ada Lovelace (CEO, ada@analytical.example). " +
        "We are Enigma Inc, signed by Alan Turing (CTO, alan@enigma.example). The subscription is 12 months.",
    );
    await expect(tableRow(page, "Company")).toContainText(/Analytical Ltd\.?\s*Enigma Inc\.?/);
    await expect(tableRow(page, "Print Name")).toContainText(/Ada Lovelace\s*Alan Turing/);
    await expect(tableRow(page, "Subscription Period")).toContainText(/12 months/i);
    await expectFollowOnQuestion(page);
  });

  test("offers the closest document when asked for one it can't draft", async ({ page }) => {
    await say(page, "I need an employment contract for a new hire.");
    await expect(assistantMessages(page).last()).toContainText(/can.?t|cannot|don.?t|not able|unable/i);
    await expectFollowOnQuestion(page);
    // Nothing is chosen until the user agrees.
    await expect(preview(page)).toContainText("Your agreement will appear here");
  });

  test("still drafts the Mutual NDA with its own cover page", async ({ page }) => {
    await say(
      page,
      "I need a mutual NDA between Analytical Ltd (Ada Lovelace, CEO, ada@analytical.example) and " +
        "Enigma Inc (Alan Turing, CTO, alan@enigma.example). Delaware law applies.",
    );
    await expect(preview(page).getByRole("heading", { level: 1, name: "Mutual Non-Disclosure Agreement" })).toBeVisible();
    await expect(preview(page).getByText(/Governing Law: Delaware/)).toBeVisible();
    await expect(tableRow(page, "Company")).toContainText(/Analytical Ltd\.?\s*Enigma Inc\.?/);
    await expect(section(page, "MNDA Term")).toHaveText("Expires 1 year from Effective Date.");
    await expectFollowOnQuestion(page);
  });

  test("switches documents when asked", async ({ page }) => {
    await say(page, "I'd like a pilot agreement for a 90 day trial of our product.");
    await expect(preview(page).getByRole("heading", { level: 1, name: "Pilot Agreement" })).toBeVisible();
    await say(page, "Actually, make it a Service Level Agreement instead.");
    await expect(preview(page).getByRole("heading", { level: 1, name: "Service Level Agreement" })).toBeVisible();
    await expectFollowOnQuestion(page);
  });
});
