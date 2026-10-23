import { describe, expect, it } from "vitest";
import { DOCUMENT_CHOICES } from "./documents";

describe("DOCUMENT_CHOICES", () => {
  it("lists the 11 catalog documents by template file name, without the NDA cover page", () => {
    expect(DOCUMENT_CHOICES).toHaveLength(11);
    expect(DOCUMENT_CHOICES).toContainEqual({ id: "Mutual-NDA", name: "Mutual Non-Disclosure Agreement" });
    expect(DOCUMENT_CHOICES).toContainEqual({ id: "sla", name: "Service Level Agreement" });
    expect(DOCUMENT_CHOICES).toContainEqual({ id: "design-partner-agreement", name: "Design Partner Agreement" });
    expect(DOCUMENT_CHOICES.map((d) => d.id)).not.toContain("Mutual-NDA-coverpage");
  });
});
