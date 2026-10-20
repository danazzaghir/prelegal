import { describe, expect, it } from "vitest";
import { DOCUMENTS } from "@/test-utils/fakeChat";
import { buildDocumentMarkdown } from "./agreement";
import { emptyDraft, type Draft } from "./draft";

const pilot = DOCUMENTS["Pilot-Agreement"];

function draft(changes: Partial<Draft> = {}): Draft {
  return { ...emptyDraft("Pilot-Agreement"), ...changes };
}

describe("buildDocumentMarkdown", () => {
  it("starts with the document's title and a cover page", () => {
    const md = buildDocumentMarkdown(pilot, draft());
    expect(md.startsWith("# Pilot Agreement\n\n## Cover Page\n")).toBe(true);
  });

  it("lists every key term with its value, or a blank line", () => {
    const md = buildDocumentMarkdown(pilot, draft({ terms: { "Pilot Period": "90 days", "Governing Law": "Delaware" } }));
    expect(md).toContain("| Pilot Period | 90 days |");
    expect(md).toContain("| Governing Law | Delaware |");
    expect(md).toContain("| General Cap Amount | \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_ |");
  });

  it("spells out real dates and leaves other text as given", () => {
    const md = buildDocumentMarkdown(pilot, draft({ terms: { "Effective Date": "2027-03-05", "Pilot Period": "2026-02-30" } }));
    expect(md).toContain("| Effective Date | March 5, 2027 |");
    expect(md).toContain("| Pilot Period | 2026-02-30 |");
  });

  it("names the parties by their roles", () => {
    const md = buildDocumentMarkdown(pilot, draft({ party1: { name: "Ada", title: "CEO", company: "Acme Inc", noticeAddress: "ada@acme.example" } }));
    expect(md).toContain("Customer: Acme Inc");
    expect(md).toMatch(/Provider: (\\_){16}/);
    expect(md).toContain("| | CUSTOMER | PROVIDER |");
    expect(md).toContain("| Print Name | Ada |  |");
    expect(md).toContain("| Notice Address | ada@acme.example |  |");
  });

  it("keeps values from breaking the tables", () => {
    const md = buildDocumentMarkdown(pilot, draft({ terms: { "Pilot Period": "A | B\nC" } }));
    expect(md).toContain("| Pilot Period | A \\| B, C |");
  });

  it("ends with the standard terms, without template markup", () => {
    const md = buildDocumentMarkdown(pilot, draft());
    const [, terms] = md.split("\n---\n\n");
    expect(terms.startsWith("# Standard Terms\n")).toBe(true);
    expect(md.match(/^# Pilot Agreement$/gm)).toHaveLength(1);
    expect(terms).toContain("During the Pilot Period and subject to the terms of this Agreement, Customer may");
    expect(md).not.toContain("<span");
  });
});
