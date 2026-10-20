import type { DocumentDetail } from "@/lib/documents";
import type { Draft } from "@/lib/draft";
import { blank, cell, DRAFT_NOTICE, formatDate, isIsoDate, stripTemplateMarkup } from "@/lib/nda";

/** A key term's value as it reads on the cover page; real dates are spelled out. */
function termValue(value: string): string {
  return isIsoDate(value) ? formatDate(value) : value;
}

/**
 * The agreement for any document except the Mutual NDA: a cover page with a key
 * terms table and signatures, then the standard terms.
 */
export function buildDocumentMarkdown(doc: DocumentDetail, draft: Draft): string {
  const { party1: p1, party2: p2 } = draft;
  const [role1, role2] = doc.parties;
  const keyTerms = doc.terms.map((term) => `| ${term} | ${blank(cell(termValue(draft.terms[term] ?? "")))} |`).join("\n");

  return `# ${doc.name}

${DRAFT_NOTICE}

## Cover Page

This Cover Page sets out the Key Terms of this ${doc.name}. Together with the Common Paper ${doc.name} standard terms that follow, it forms the agreement between the parties. Capitalized terms used in the standard terms have the meanings given below.

### Parties

${role1}: ${blank(cell(p1.company))}

${role2}: ${blank(cell(p2.company))}

### Key Terms

| Key Term | Value |
|:--- | :--- |
${keyTerms}

By signing this Cover Page, each party agrees to enter into this ${doc.name}.

| | ${role1.toUpperCase()} | ${role2.toUpperCase()} |
|:--- | :---: | :---: |
| Signature | | |
| Print Name | ${cell(p1.name)} | ${cell(p2.name)} |
| Title | ${cell(p1.title)} | ${cell(p2.title)} |
| Company | ${cell(p1.company)} | ${cell(p2.company)} |
| Notice Address | ${cell(p1.noticeAddress)} | ${cell(p2.noticeAddress)} |
| Date | | |

---

${standardTermsMarkdown(doc.standardTerms)}
`;
}

/** The template's text, retitled "Standard Terms" since the cover page already names the document. */
function standardTermsMarkdown(template: string): string {
  return stripTemplateMarkup(template).replace(/\r\n/g, "\n").trim().replace(/^# .*/, "# Standard Terms");
}
