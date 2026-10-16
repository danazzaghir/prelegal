import { expect, test, type Page } from "@playwright/test";

const preview = (page: Page) => page.getByRole("article");
const party = (page: Page, n: 1 | 2) => page.getByRole("group", { name: `Party ${n}` });

/** The paragraph right after a cover page heading in the preview. */
const section = (page: Page, heading: string) =>
  preview(page).getByRole("heading", { level: 3, name: heading }).locator("xpath=following-sibling::*[1]");

async function fillAgreement(page: Page) {
  await page.getByLabel(/^Purpose/).fill("Exploring a joint venture.");
  await page.getByLabel("Effective date").fill("2027-03-05");
  await page.getByLabel("MNDA term in years").fill("2");
  await page.getByLabel("In perpetuity").check();
  await page.getByLabel(/^Governing law/).fill("Delaware");
  await page.getByLabel(/^Jurisdiction/).fill("New Castle, DE");
  await page.getByLabel(/^MNDA modifications/).fill("Section 10 does not apply.");
  for (const [n, p] of [
    [1, { name: "Ada Lovelace", title: "CEO", company: "Analytical Ltd", address: "ada@analytical.example" }],
    [2, { name: "Alan Turing", title: "CTO", company: "Enigma Inc", address: "alan@enigma.example" }],
  ] as const) {
    await party(page, n).getByLabel("Print name").fill(p.name);
    await party(page, n).getByLabel("Title").fill(p.title);
    await party(page, n).getByLabel("Company").fill(p.company);
    await party(page, n).getByLabel(/^Notice address/).fill(p.address);
  }
}

test.describe("Mutual NDA creator", () => {
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
    // Catches hydration mismatches and runtime errors.
    expect(consoleErrors).toEqual([]);
  });

  test("loads with defaults and today's date", async ({ page }) => {
    await expect(page).toHaveTitle("Mutual NDA Creator · Prelegal");
    await expect(page.getByRole("heading", { level: 1, name: /Mutual NDA Creator/ })).toBeVisible();
    const today = await page.evaluate(() =>
      new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    );
    await expect(section(page, "Effective Date")).toHaveText(today);
    await expect(section(page, "MNDA Term")).toHaveText("Expires 1 year from Effective Date.");
    await expect(preview(page).getByRole("heading", { level: 1, name: "Standard Terms" })).toBeAttached();
  });

  test("offers only a PDF download", async ({ page }) => {
    await expect(page.getByRole("button")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
    await expect(page.getByText(/markdown/i)).toHaveCount(0);
  });

  test("fills the whole agreement from the form", async ({ page }) => {
    await fillAgreement(page);

    await expect(section(page, "Purpose")).toHaveText("Exploring a joint venture.");
    await expect(section(page, "Effective Date")).toHaveText("March 5, 2027");
    await expect(section(page, "MNDA Term")).toHaveText("Expires 2 years from Effective Date.");
    await expect(section(page, "Term of Confidentiality")).toHaveText("In perpetuity.");
    await expect(preview(page).getByText("Governing Law: Delaware")).toBeVisible();
    await expect(preview(page).getByText("Jurisdiction: New Castle, DE")).toBeVisible();
    await expect(section(page, "MNDA Modifications")).toHaveText("Section 10 does not apply.");

    const rows = preview(page).getByRole("row");
    await expect(rows.filter({ hasText: "Print Name" })).toHaveText(/Ada Lovelace\s*Alan Turing/);
    await expect(rows.filter({ hasText: "Company" })).toHaveText(/Analytical Ltd\s*Enigma Inc/);
    await expect(rows.filter({ hasText: "Notice Address" })).toHaveText(/ada@analytical\.example\s*alan@enigma\.example/);
  });

  test("disables the years when a term option does not use them", async ({ page }) => {
    await page.getByLabel("Continues until terminated").check();
    await expect(page.getByLabel("MNDA term in years")).toBeDisabled();
    await expect(section(page, "MNDA Term")).toHaveText(
      "Continues until terminated in accordance with the terms of the MNDA.",
    );
    await page.getByLabel("Expires after a number of years").check();
    await expect(page.getByLabel("MNDA term in years")).toBeEnabled();
  });

  test("shows blanks for cleared fields, not horizontal rules", async ({ page }) => {
    await page.getByLabel(/^Purpose/).fill("");
    await page.getByLabel("Effective date").fill("");
    await expect(section(page, "Purpose")).toHaveText("________________");
    await expect(section(page, "Effective Date")).toHaveText("________________");
    // Only the rule between the cover page and the standard terms.
    await expect(preview(page).locator("hr")).toHaveCount(1);
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
    await fillAgreement(page);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeHidden();
    await expect(page.getByLabel(/^Purpose/)).toBeHidden();
    await expect(page.getByText(/Not legal advice/)).toBeHidden();
    await expect(preview(page)).toBeVisible();
    await expect(preview(page).getByText("Equitable Relief")).toBeVisible();
  });

  test("saved PDF contains the full agreement over several pages", async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== "chromium" || testInfo.project.name !== "desktop", "PDF output is Chromium desktop only");
    await fillAgreement(page);
    const pdf = await page.pdf({ format: "Letter" });
    expect(pdf.byteLength).toBeGreaterThan(10_000);
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    // Cover page, then the standard terms starting on a new page.
    expect(pageCount).toBeGreaterThanOrEqual(3);
  });

  test("has no horizontal scrolling", async ({ page }) => {
    await fillAgreement(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
