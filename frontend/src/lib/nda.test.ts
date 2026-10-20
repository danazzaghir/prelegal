import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildNdaMarkdown,
  confidentialityTermText,
  defaultNdaData,
  formatDate,
  mndaTermText,
  stripTemplateMarkup,
  type NdaData,
} from "./nda";

const standardTerms = fs.readFileSync(
  path.join(__dirname, "..", "..", "..", "templates", "Mutual-NDA.md"),
  "utf-8",
);

// Escaped underscores, as a bare line of underscores renders as a horizontal rule.
const BLANK = "\\_".repeat(16);

function filledData(overrides: Partial<NdaData> = {}): NdaData {
  return {
    ...defaultNdaData("2026-10-16"),
    governingLaw: "Delaware",
    jurisdiction: "New Castle, DE",
    party1: { name: "Ada Lovelace", title: "CEO", company: "Analytical Ltd", noticeAddress: "ada@analytical.example" },
    party2: { name: "Alan Turing", title: "CTO", company: "Enigma Inc", noticeAddress: "alan@enigma.example" },
    ...overrides,
  };
}

describe("defaultNdaData", () => {
  it("uses the given date and Common Paper's suggested defaults", () => {
    const data = defaultNdaData("2026-01-02");
    expect(data.effectiveDate).toBe("2026-01-02");
    expect(data.purpose).toBe("Evaluating whether to enter into a business relationship with the other party.");
    expect(data.mndaTermType).toBe("expires");
    expect(data.mndaTermYears).toBe(1);
    expect(data.confidentialityTermType).toBe("years");
    expect(data.confidentialityTermYears).toBe(1);
    expect(data.governingLaw).toBe("");
    expect(data.jurisdiction).toBe("");
    expect(data.modifications).toBe("");
  });

  it("starts both parties empty", () => {
    const data = defaultNdaData("");
    for (const party of [data.party1, data.party2]) {
      expect(party).toEqual({ name: "", title: "", company: "", noticeAddress: "" });
    }
  });

  it("returns independent party objects on each call", () => {
    const a = defaultNdaData("");
    const b = defaultNdaData("");
    a.party1.name = "Changed";
    expect(a.party2.name).toBe("");
    expect(b.party1.name).toBe("");
  });
});

describe("formatDate", () => {
  it("formats an ISO date as a long US date", () => {
    expect(formatDate("2026-10-16")).toBe("October 16, 2026");
  });

  it("does not shift the day because of time zones", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
    expect(formatDate("2026-12-31")).toBe("December 31, 2026");
  });

  it("handles leap days", () => {
    expect(formatDate("2028-02-29")).toBe("February 29, 2028");
  });

  it("returns an empty string for an empty date", () => {
    expect(formatDate("")).toBe("");
  });
});

describe("mndaTermText", () => {
  it("uses the singular for one year", () => {
    expect(mndaTermText(filledData({ mndaTermYears: 1 }))).toBe("Expires 1 year from Effective Date.");
  });

  it("uses the plural for several years", () => {
    expect(mndaTermText(filledData({ mndaTermYears: 3 }))).toBe("Expires 3 years from Effective Date.");
  });

  it("shows a blank when the years are not filled in", () => {
    expect(mndaTermText(filledData({ mndaTermYears: 0 }))).toBe("Expires \\_\\_\\_\\_ year(s) from Effective Date.");
  });

  it("ignores the years when the MNDA continues until terminated", () => {
    expect(mndaTermText(filledData({ mndaTermType: "untilTerminated", mndaTermYears: 5 }))).toBe(
      "Continues until terminated in accordance with the terms of the MNDA.",
    );
  });
});

describe("confidentialityTermText", () => {
  it("includes the trade secret carve-out for a fixed term", () => {
    expect(confidentialityTermText(filledData({ confidentialityTermYears: 2 }))).toBe(
      "2 years from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.",
    );
  });

  it("uses the singular for one year", () => {
    expect(confidentialityTermText(filledData({ confidentialityTermYears: 1 }))).toMatch(/^1 year from/);
  });

  it("shows a blank when the years are not filled in", () => {
    expect(confidentialityTermText(filledData({ confidentialityTermYears: 0 }))).toMatch(/^(\\_){4} year\(s\) from/);
  });

  it("supports perpetuity", () => {
    expect(confidentialityTermText(filledData({ confidentialityTermType: "perpetuity" }))).toBe("In perpetuity.");
  });
});

describe("stripTemplateMarkup", () => {
  it("replaces variable spans with their text", () => {
    expect(stripTemplateMarkup('the <span class="coverpage_link">Purpose</span> of')).toBe("the Purpose of");
  });

  it("handles several spans on one line", () => {
    expect(
      stripTemplateMarkup('<span class="a">One</span> and <span class="b" id="2">Two</span>'),
    ).toBe("One and Two");
  });

  it("leaves text without spans unchanged", () => {
    expect(stripTemplateMarkup("**Bold** text")).toBe("**Bold** text");
  });

  it("removes every span from the real Mutual NDA template", () => {
    expect(standardTerms).toContain("<span");
    expect(stripTemplateMarkup(standardTerms)).not.toMatch(/<\/?span/);
  });
});

describe("buildNdaMarkdown", () => {
  it("fills in every cover page value", () => {
    const md = buildNdaMarkdown(
      filledData({ purpose: "Exploring a joint venture.", modifications: "Section 9 is deleted." }),
      standardTerms,
    );
    expect(md).toContain("### Purpose\nExploring a joint venture.");
    expect(md).toContain("### Effective Date\nOctober 16, 2026");
    expect(md).toContain("### MNDA Term\nExpires 1 year from Effective Date.");
    expect(md).toContain("### Term of Confidentiality\n1 year from Effective Date");
    expect(md).toContain("Governing Law: Delaware");
    expect(md).toContain("Jurisdiction: New Castle, DE");
    expect(md).toContain("### MNDA Modifications\nSection 9 is deleted.");
  });

  it("puts both parties in the signature table", () => {
    const md = buildNdaMarkdown(filledData(), standardTerms);
    expect(md).toContain("| Print Name | Ada Lovelace | Alan Turing |");
    expect(md).toContain("| Title | CEO | CTO |");
    expect(md).toContain("| Company | Analytical Ltd | Enigma Inc |");
    expect(md).toContain("| Notice Address | ada@analytical.example | alan@enigma.example |");
    expect(md).toContain("| Signature | | |");
    expect(md).toContain("| Date | | |");
  });

  it("shows blanks for missing required values", () => {
    const md = buildNdaMarkdown({ ...defaultNdaData(""), purpose: "  " }, standardTerms);
    expect(md).toContain(`### Purpose\n${BLANK}`);
    expect(md).toContain(`### Effective Date\n${BLANK}`);
    expect(md).toContain(`Governing Law: ${BLANK}`);
    expect(md).toContain(`Jurisdiction: ${BLANK}`);
  });

  it('says "None." when there are no modifications', () => {
    expect(buildNdaMarkdown(filledData({ modifications: "   " }), standardTerms)).toContain(
      "### MNDA Modifications\nNone.",
    );
  });

  it("trims surrounding whitespace from values", () => {
    const md = buildNdaMarkdown(filledData({ governingLaw: "  California  " }), standardTerms);
    expect(md).toContain("Governing Law: California\n");
  });

  it("escapes pipes so party details cannot break the table", () => {
    const md = buildNdaMarkdown(
      filledData({ party1: { name: "A | B", title: "", company: "", noticeAddress: "" } }),
      standardTerms,
    );
    expect(md).toContain("| Print Name | A \\| B | Alan Turing |");
  });

  it("joins multi-line addresses onto one table row", () => {
    const md = buildNdaMarkdown(
      filledData({
        party1: { name: "", title: "", company: "", noticeAddress: "1 Main St\r\nSpringfield\n  IL 62701" },
      }),
      standardTerms,
    );
    expect(md).toContain("| Notice Address | 1 Main St, Springfield, IL 62701 | alan@enigma.example |");
  });

  it("includes the full standard terms without template markup", () => {
    const md = buildNdaMarkdown(filledData(), standardTerms);
    expect(md).toContain("# Standard Terms");
    for (const heading of [
      "Introduction",
      "Use and Protection of Confidential Information",
      "Exceptions",
      "Disclosures Required by Law",
      "Term and Termination",
      "Return or Destruction of Confidential Information",
      "Proprietary Rights",
      "Disclaimer",
      "Governing Law and Jurisdiction",
      "Equitable Relief",
      "General",
    ]) {
      expect(md).toContain(`**${heading}**`);
    }
    expect(md).not.toMatch(/<\/?span/);
  });

  it("puts the cover page before the standard terms, separated by a rule", () => {
    const md = buildNdaMarkdown(filledData(), standardTerms);
    const cover = md.indexOf("## Cover Page");
    const rule = md.indexOf("\n---\n");
    const terms = md.indexOf("# Standard Terms");
    expect(cover).toBeGreaterThan(-1);
    expect(rule).toBeGreaterThan(cover);
    expect(terms).toBeGreaterThan(rule);
  });

  it("keeps the CC BY 4.0 attribution from the template", () => {
    expect(buildNdaMarkdown(filledData(), standardTerms)).toContain(
      "[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)",
    );
  });

  it("reflects the chosen term options", () => {
    const md = buildNdaMarkdown(
      filledData({ mndaTermType: "untilTerminated", confidentialityTermType: "perpetuity" }),
      standardTerms,
    );
    expect(md).toContain("### MNDA Term\nContinues until terminated in accordance with the terms of the MNDA.");
    expect(md).toContain("### Term of Confidentiality\nIn perpetuity.");
  });
});
