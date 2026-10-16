import fs from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NdaCreator from "./NdaCreator";

const standardTerms = fs.readFileSync(
  path.join(__dirname, "..", "..", "..", "templates", "Mutual-NDA.md"),
  "utf-8",
);

function setup() {
  const user = userEvent.setup();
  render(<NdaCreator standardTerms={standardTerms} />);
  const preview = screen.getByRole("article");
  return { user, preview };
}

/** Text of the paragraph that follows a cover page heading in the preview. */
function sectionText(preview: HTMLElement, heading: string): string {
  const h = within(preview).getByRole("heading", { level: 3, name: heading });
  return h.nextElementSibling?.textContent ?? "";
}

function signatureRow(preview: HTMLElement, label: string): string[] {
  const row = within(preview).getByRole("row", { name: new RegExp(`^${label}`) });
  return within(row)
    .getAllByRole("cell")
    .map((c) => c.textContent ?? "");
}

const party = (n: 1 | 2) => within(screen.getByRole("group", { name: `Party ${n}` }));

describe("NdaCreator", () => {
  beforeEach(() => {
    // Only fake Date so userEvent's timers still run.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("shows the title and a single download button", () => {
      setup();
      expect(screen.getByRole("heading", { level: 1, name: /Mutual NDA Creator/ })).toBeInTheDocument();
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveTextContent("Download PDF");
    });

    it("does not offer a Markdown download", () => {
      setup();
      expect(screen.queryByRole("button", { name: /markdown/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/download markdown/i)).not.toBeInTheDocument();
    });

    it("pre-fills the form with the defaults", () => {
      setup();
      expect(screen.getByLabelText(/^Purpose/)).toHaveValue(
        "Evaluating whether to enter into a business relationship with the other party.",
      );
      expect(screen.getByLabelText("Effective date")).toHaveValue("2026-10-16");
      expect(screen.getByLabelText("Expires after a number of years")).toBeChecked();
      expect(screen.getByLabelText("MNDA term in years")).toHaveValue(1);
      expect(screen.getByLabelText("Protected for a number of years")).toBeChecked();
      expect(screen.getByLabelText("Term of confidentiality in years")).toHaveValue(1);
      expect(screen.getByLabelText(/^Governing law/)).toHaveValue("");
      expect(screen.getByLabelText(/^Jurisdiction/)).toHaveValue("");
    });

    it("previews the cover page with defaults and blanks", () => {
      const { preview } = setup();
      expect(within(preview).getByRole("heading", { level: 1, name: "Mutual Non-Disclosure Agreement" })).toBeInTheDocument();
      expect(sectionText(preview, "Purpose")).toBe(
        "Evaluating whether to enter into a business relationship with the other party.",
      );
      expect(sectionText(preview, "Effective Date")).toBe("October 16, 2026");
      expect(sectionText(preview, "MNDA Term")).toBe("Expires 1 year from Effective Date.");
      expect(sectionText(preview, "Term of Confidentiality")).toMatch(/^1 year from Effective Date/);
      expect(sectionText(preview, "Governing Law & Jurisdiction")).toBe("Governing Law: ________________");
      expect(sectionText(preview, "MNDA Modifications")).toBe("None.");
    });

    it("previews the full standard terms with no template markup", () => {
      const { preview } = setup();
      expect(within(preview).getByRole("heading", { level: 1, name: "Standard Terms" })).toBeInTheDocument();
      expect(within(preview).getByText("Equitable Relief")).toBeInTheDocument();
      expect(within(preview).getAllByRole("listitem")).toHaveLength(11);
      expect(preview.innerHTML).not.toContain("coverpage_link");
      expect(preview.textContent).not.toContain("<span");
    });

    it("shows the CC BY 4.0 attribution", () => {
      setup();
      const links = screen.getAllByRole("link", { name: "CC BY 4.0" });
      expect(links.length).toBeGreaterThanOrEqual(1);
      for (const link of links) {
        expect(link).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
      }
    });
  });

  describe("live preview", () => {
    it("updates the purpose as the user types", async () => {
      const { user, preview } = setup();
      const purpose = screen.getByLabelText(/^Purpose/);
      await user.clear(purpose);
      await user.type(purpose, "Discussing an acquisition.");
      expect(sectionText(preview, "Purpose")).toBe("Discussing an acquisition.");
    });

    it("shows a blank when the purpose is cleared", async () => {
      const { user, preview } = setup();
      await user.clear(screen.getByLabelText(/^Purpose/));
      expect(sectionText(preview, "Purpose")).toBe("________________");
    });

    it("updates the effective date", async () => {
      const { user, preview } = setup();
      const date = screen.getByLabelText("Effective date");
      await user.clear(date);
      await user.type(date, "2027-03-05");
      expect(sectionText(preview, "Effective Date")).toBe("March 5, 2027");
    });

    it("leaves the effective date blank when the user clears it", async () => {
      const { user, preview } = setup();
      const date = screen.getByLabelText("Effective date");
      await user.clear(date);
      expect(date).toHaveValue("");
      expect(sectionText(preview, "Effective Date")).toBe("________________");
    });

    it("fills in governing law and jurisdiction", async () => {
      const { user, preview } = setup();
      await user.type(screen.getByLabelText(/^Governing law/), "Delaware");
      await user.type(screen.getByLabelText(/^Jurisdiction/), "New Castle, DE");
      expect(within(preview).getByText("Governing Law: Delaware")).toBeInTheDocument();
      expect(within(preview).getByText("Jurisdiction: New Castle, DE")).toBeInTheDocument();
    });

    it("shows modifications", async () => {
      const { user, preview } = setup();
      await user.type(screen.getByLabelText(/^MNDA modifications/), "Section 10 does not apply.");
      expect(sectionText(preview, "MNDA Modifications")).toBe("Section 10 does not apply.");
    });

    it("fills in both parties in the signature table", async () => {
      const { user, preview } = setup();
      await user.type(party(1).getByLabelText("Print name"), "Ada Lovelace");
      await user.type(party(1).getByLabelText("Title"), "CEO");
      await user.type(party(1).getByLabelText("Company"), "Analytical Ltd");
      await user.type(party(1).getByLabelText(/^Notice address/), "ada@analytical.example");
      await user.type(party(2).getByLabelText("Print name"), "Alan Turing");
      await user.type(party(2).getByLabelText("Title"), "CTO");
      await user.type(party(2).getByLabelText("Company"), "Enigma Inc");
      await user.type(party(2).getByLabelText(/^Notice address/), "alan@enigma.example");

      expect(signatureRow(preview, "Print Name")).toEqual(["Print Name", "Ada Lovelace", "Alan Turing"]);
      expect(signatureRow(preview, "Title")).toEqual(["Title", "CEO", "CTO"]);
      expect(signatureRow(preview, "Company")).toEqual(["Company", "Analytical Ltd", "Enigma Inc"]);
      expect(signatureRow(preview, "Notice Address")).toEqual([
        "Notice Address",
        "ada@analytical.example",
        "alan@enigma.example",
      ]);
    });

    it("keeps the two parties independent", async () => {
      const { user, preview } = setup();
      await user.type(party(2).getByLabelText("Company"), "Only Party Two");
      expect(party(1).getByLabelText("Company")).toHaveValue("");
      expect(signatureRow(preview, "Company")).toEqual(["Company", "", "Only Party Two"]);
    });

    it("puts a multi-line address on one row", async () => {
      const { user, preview } = setup();
      await user.type(party(1).getByLabelText(/^Notice address/), "1 Main St{Enter}Springfield, IL");
      expect(signatureRow(preview, "Notice Address")[1]).toBe("1 Main St, Springfield, IL");
    });

    it("shows email addresses as plain text, not links", async () => {
      const { user, preview } = setup();
      await user.type(party(1).getByLabelText(/^Notice address/), "ada@analytical.example");
      expect(signatureRow(preview, "Notice Address")[1]).toBe("ada@analytical.example");
      expect(within(preview).queryByRole("link", { name: "ada@analytical.example" })).not.toBeInTheDocument();
      expect(preview.querySelector('a[href^="mailto:"]')).toBeNull();
    });

    it("keeps the link to the Common Paper standard", () => {
      const { preview } = setup();
      expect(within(preview).getByRole("link", { name: "commonpaper.com/standards/mutual-nda/1.0" })).toHaveAttribute(
        "href",
        "https://commonpaper.com/standards/mutual-nda/1.0",
      );
    });

    it("does not let a pipe character break the signature table", async () => {
      const { user, preview } = setup();
      await user.type(party(1).getByLabelText("Print name"), "A | B");
      expect(signatureRow(preview, "Print Name")).toEqual(["Print Name", "A | B", ""]);
    });
  });

  describe("term options", () => {
    it("changes the MNDA term length", async () => {
      const { user, preview } = setup();
      const years = screen.getByLabelText("MNDA term in years");
      await user.clear(years);
      await user.type(years, "3");
      expect(years).toHaveValue(3);
      expect(sectionText(preview, "MNDA Term")).toBe("Expires 3 years from Effective Date.");
    });

    it("lets the user clear the years before typing a new number", async () => {
      const { user, preview } = setup();
      const years = screen.getByLabelText("MNDA term in years");
      await user.clear(years);
      expect(years).toHaveValue(null);
      expect(sectionText(preview, "MNDA Term")).toBe("Expires ____ year(s) from Effective Date.");
      await user.type(years, "2");
      expect(years).toHaveValue(2);
    });

    it("switches the MNDA to continue until terminated and disables the years", async () => {
      const { user, preview } = setup();
      await user.click(screen.getByLabelText("Continues until terminated"));
      expect(screen.getByLabelText("Continues until terminated")).toBeChecked();
      expect(screen.getByLabelText("Expires after a number of years")).not.toBeChecked();
      expect(screen.getByLabelText("MNDA term in years")).toBeDisabled();
      expect(sectionText(preview, "MNDA Term")).toBe(
        "Continues until terminated in accordance with the terms of the MNDA.",
      );
    });

    it("switches back to a fixed MNDA term and keeps the years", async () => {
      const { user, preview } = setup();
      const years = screen.getByLabelText("MNDA term in years");
      await user.clear(years);
      await user.type(years, "4");
      await user.click(screen.getByLabelText("Continues until terminated"));
      await user.click(screen.getByLabelText("Expires after a number of years"));
      expect(years).toBeEnabled();
      expect(sectionText(preview, "MNDA Term")).toBe("Expires 4 years from Effective Date.");
    });

    it("changes the confidentiality term length", async () => {
      const { user, preview } = setup();
      const years = screen.getByLabelText("Term of confidentiality in years");
      await user.clear(years);
      await user.type(years, "5");
      expect(sectionText(preview, "Term of Confidentiality")).toMatch(/^5 years from Effective Date, but in the case of trade secrets/);
    });

    it("switches confidentiality to perpetuity and disables the years", async () => {
      const { user, preview } = setup();
      await user.click(screen.getByLabelText("In perpetuity"));
      expect(screen.getByLabelText("Term of confidentiality in years")).toBeDisabled();
      expect(sectionText(preview, "Term of Confidentiality")).toBe("In perpetuity.");
    });

    it("keeps the two term settings independent", async () => {
      const { user, preview } = setup();
      await user.click(screen.getByLabelText("In perpetuity"));
      expect(screen.getByLabelText("Expires after a number of years")).toBeChecked();
      expect(sectionText(preview, "MNDA Term")).toBe("Expires 1 year from Effective Date.");
    });
  });

  describe("safety", () => {
    it("shows HTML typed into the form as text instead of rendering it", async () => {
      const { user, preview } = setup();
      const purpose = screen.getByLabelText(/^Purpose/);
      await user.clear(purpose);
      await user.type(purpose, '<img src=x onerror="alert(1)"><b>bold</b>');
      expect(preview.querySelector("img")).toBeNull();
      expect(preview.querySelector("b")).toBeNull();
    });

    it("does not render javascript: links typed into the form", async () => {
      const { user, preview } = setup();
      await user.type(screen.getByLabelText(/^MNDA modifications/), "[click](javascript:alert(1))");
      for (const link of within(preview).queryAllByRole("link")) {
        expect(link.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
      }
    });
  });

  describe("download", () => {
    it("opens the print dialog to save a PDF", async () => {
      const print = vi.spyOn(window, "print").mockImplementation(() => {});
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Download PDF" }));
      expect(print).toHaveBeenCalledTimes(1);
      print.mockRestore();
    });

    it("does not submit the form when Enter is pressed in a field", async () => {
      const { user, preview } = setup();
      await user.type(screen.getByLabelText(/^Governing law/), "Texas{Enter}");
      expect(within(preview).getByText("Governing Law: Texas")).toBeInTheDocument();
    });
  });
});
