export type Party = {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
};

export type NdaData = {
  purpose: string;
  effectiveDate: string; // YYYY-MM-DD
  mndaTermType: "expires" | "untilTerminated";
  mndaTermYears: number; // 0 when not filled in
  confidentialityTermType: "years" | "perpetuity";
  confidentialityTermYears: number; // 0 when not filled in
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: Party;
  party2: Party;
};

const emptyParty: Party = { name: "", title: "", company: "", noticeAddress: "" };

export function defaultNdaData(today: string): NdaData {
  return {
    purpose: "Evaluating whether to enter into a business relationship with the other party.",
    effectiveDate: today,
    mndaTermType: "expires",
    mndaTermYears: 1,
    confidentialityTermType: "years",
    confidentialityTermYears: 1,
    governingLaw: "",
    jurisdiction: "",
    modifications: "",
    party1: { ...emptyParty },
    party2: { ...emptyParty },
  };
}

/** Today's date in the browser's time zone, as YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Underscores are escaped: a line of bare underscores is a Markdown horizontal rule.
const BLANK = "\\_".repeat(16);
const SHORT_BLANK = "\\_".repeat(4);

function years(n: number): string {
  if (n < 1) return `${SHORT_BLANK} year(s)`;
  return `${n} year${n === 1 ? "" : "s"}`;
}

export function mndaTermText(data: NdaData): string {
  return data.mndaTermType === "expires"
    ? `Expires ${years(data.mndaTermYears)} from Effective Date.`
    : "Continues until terminated in accordance with the terms of the MNDA.";
}

export function confidentialityTermText(data: NdaData): string {
  return data.confidentialityTermType === "years"
    ? `${years(data.confidentialityTermYears)} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`
    : "In perpetuity.";
}

/** Replaces the template's HTML variable markers with their plain text. */
export function stripTemplateMarkup(markdown: string): string {
  return markdown.replace(/<span[^>]*>(.*?)<\/span>/g, "$1");
}

const blank = (value: string) => value.trim() || BLANK;

// Keeps user input from breaking the markdown table it is placed in.
const cell = (value: string) =>
  value
    .trim()
    .replace(/\|/g, "\\|")
    .replace(/\s*\r?\n\s*/g, ", ");

export function buildNdaMarkdown(data: NdaData, standardTerms: string): string {
  const { party1: p1, party2: p2 } = data;
  return `# Mutual Non-Disclosure Agreement

## Cover Page

This Mutual Non-Disclosure Agreement (the "MNDA") consists of: (1) this Cover Page ("**Cover Page**") and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 ("**Standard Terms**") identical to those posted at [commonpaper.com/standards/mutual-nda/1.0](https://commonpaper.com/standards/mutual-nda/1.0). Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.

### Purpose
${blank(data.purpose)}

### Effective Date
${blank(formatDate(data.effectiveDate))}

### MNDA Term
${mndaTermText(data)}

### Term of Confidentiality
${confidentialityTermText(data)}

### Governing Law & Jurisdiction
Governing Law: ${blank(data.governingLaw)}

Jurisdiction: ${blank(data.jurisdiction)}

### MNDA Modifications
${data.modifications.trim() || "None."}

By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.

| | PARTY 1 | PARTY 2 |
|:--- | :---: | :---: |
| Signature | | |
| Print Name | ${cell(p1.name)} | ${cell(p2.name)} |
| Title | ${cell(p1.title)} | ${cell(p2.title)} |
| Company | ${cell(p1.company)} | ${cell(p2.company)} |
| Notice Address | ${cell(p1.noticeAddress)} | ${cell(p2.noticeAddress)} |
| Date | | |

---

${stripTemplateMarkup(standardTerms).trim()}
`;
}
