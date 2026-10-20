import { describe, expect, it } from "vitest";
import type { NdaUpdates } from "@/lib/chat";
import { DOCUMENTS, noNdaUpdates, turn } from "@/test-utils/fakeBackend";
import { applyNdaUpdates, applyTurn, emptyDraft, ndaData, withDefaults, type Draft } from "./draft";
import { defaultNdaData } from "./nda";

const nda = emptyDraft("Mutual-NDA");
const sla = emptyDraft("sla");

describe("emptyDraft", () => {
  it("starts with no document, empty parties, NDA defaults and no key terms", () => {
    const draft = emptyDraft();
    expect(draft.documentId).toBeNull();
    expect(draft.party1).toEqual({ name: "", title: "", company: "", noticeAddress: "" });
    expect(ndaData(draft)).toEqual(defaultNdaData(""));
    expect(draft.terms).toEqual({});
  });
});

describe("applyTurn", () => {
  it("changes nothing when the turn has no updates", () => {
    expect(applyTurn(sla, turn())).toEqual(sla);
  });

  it("does not modify the original draft", () => {
    const copy = structuredClone(sla);
    applyTurn(sla, turn({ party1: { name: "Ada" }, terms: { "Target Uptime": "99.9%" } }));
    expect(sla).toEqual(copy);
  });

  it("chooses a document", () => {
    expect(applyTurn(emptyDraft(), turn({ documentId: "sla" })).documentId).toBe("sla");
  });

  it("keeps details given before a document was chosen", () => {
    const before = applyTurn(emptyDraft(), turn({ party1: { company: "Acme" } }));
    const after = applyTurn(before, turn({ documentId: "sla" }));
    expect(after.party1.company).toBe("Acme");
  });

  it("starts a fresh draft when switching documents, then applies that turn's updates", () => {
    const filled = applyTurn(sla, turn({ party1: { company: "Acme" }, terms: { "Target Uptime": "99.9%" } }));
    const switched = applyTurn(
      filled,
      turn({ documentId: "Pilot-Agreement", party2: { company: "CloudCo" }, terms: { "Pilot Period": "90 days" } }),
    );
    expect(switched.documentId).toBe("Pilot-Agreement");
    expect(switched.party1.company).toBe("");
    expect(switched.party2.company).toBe("CloudCo");
    expect(switched.terms).toEqual({ "Pilot Period": "90 days" });
  });

  it("does not reset when the AI repeats the current document", () => {
    const filled = applyTurn(sla, turn({ terms: { "Target Uptime": "99.9%" } }));
    expect(applyTurn(filled, turn({ documentId: "sla" })).terms).toEqual({ "Target Uptime": "99.9%" });
  });

  it("sets key terms, trimmed, and keeps earlier ones", () => {
    const first = applyTurn(sla, turn({ terms: { "Target Uptime": " 99.9% " } }));
    const second = applyTurn(first, turn({ terms: { "Support Channel": "Email" } }));
    expect(second.terms).toEqual({ "Target Uptime": "99.9%", "Support Channel": "Email" });
  });

  it("ignores empty key terms and impossible dates", () => {
    const filled = applyTurn(sla, turn({ terms: { "Target Uptime": "99.9%" } }));
    const next = applyTurn(filled, turn({ terms: { "Target Uptime": " ", "Effective Date": "2026-02-30" } }));
    expect(next.terms).toEqual({ "Target Uptime": "99.9%" });
  });

  it("keeps dates and other wording as given", () => {
    const next = applyTurn(sla, turn({ terms: { "Effective Date": "2027-03-05", "Subscription Period": "12 months" } }));
    expect(next.terms).toEqual({ "Effective Date": "2027-03-05", "Subscription Period": "12 months" });
  });

  it("updates only the party fields that were given, ignoring empty strings", () => {
    const filled = applyTurn(sla, turn({ party1: { name: "Ada", company: "Analytical" } }));
    const next = applyTurn(filled, turn({ party1: { title: "CEO", name: "" }, party2: { company: "Enigma" } }));
    expect(next.party1).toEqual({ name: "Ada", title: "CEO", company: "Analytical", noticeAddress: "" });
    expect(next.party2).toEqual({ name: "", title: "", company: "Enigma", noticeAddress: "" });
  });

  it("applies NDA updates only to the Mutual NDA", () => {
    expect(applyTurn(nda, turn({ nda: { governingLaw: "Delaware" } })).nda.governingLaw).toBe("Delaware");
    expect(applyTurn(sla, turn({ nda: { governingLaw: "Delaware" } })).nda.governingLaw).toBe("");
  });

  it("applies NDA updates in the turn that chooses the NDA", () => {
    const next = applyTurn(emptyDraft(), turn({ documentId: "Mutual-NDA", nda: { governingLaw: "Delaware" } }));
    expect(next.nda.governingLaw).toBe("Delaware");
  });
});

describe("applyNdaUpdates", () => {
  const base = emptyDraft().nda;
  const updates = (changes: Partial<NdaUpdates>) => ({ ...noNdaUpdates(), ...changes });

  it("sets text fields, trimmed, and ignores empty strings except for modifications", () => {
    const next = applyNdaUpdates(base, updates({ purpose: "  An acquisition. ", governingLaw: "Delaware" }));
    expect(next).toMatchObject({ purpose: "An acquisition.", governingLaw: "Delaware" });
    expect(applyNdaUpdates(next, updates({ purpose: "", governingLaw: " " }))).toMatchObject({
      purpose: "An acquisition.",
      governingLaw: "Delaware",
    });
    const withMods = applyNdaUpdates(base, updates({ modifications: "Section 10 does not apply." }));
    expect(applyNdaUpdates(withMods, updates({ modifications: "" })).modifications).toBe("");
  });

  it("sets the term options", () => {
    const next = applyNdaUpdates(
      base,
      updates({ mndaTermType: "untilTerminated", mndaTermYears: 3, confidentialityTermType: "perpetuity", confidentialityTermYears: 5 }),
    );
    expect(next).toMatchObject({
      mndaTermType: "untilTerminated",
      mndaTermYears: 3,
      confidentialityTermType: "perpetuity",
      confidentialityTermYears: 5,
    });
  });

  it("accepts real YYYY-MM-DD dates, including 29 February in a leap year", () => {
    expect(applyNdaUpdates(base, updates({ effectiveDate: "2027-03-05" })).effectiveDate).toBe("2027-03-05");
    expect(applyNdaUpdates(base, updates({ effectiveDate: "2028-02-29" })).effectiveDate).toBe("2028-02-29");
  });

  it.each(["March 5, 2027", "2027-3-5", "", "2026-02-30", "2026-13-01", "2026-04-31"])(
    "ignores the effective date %j, which isn't a real YYYY-MM-DD date",
    (date) => {
      expect(applyNdaUpdates(base, updates({ effectiveDate: date })).effectiveDate).toBe("");
    },
  );

  it.each([0, -2, 1.5])("ignores %j as a number of years", (years) => {
    const next = applyNdaUpdates(base, updates({ mndaTermYears: years, confidentialityTermYears: years }));
    expect(next.mndaTermYears).toBe(1);
    expect(next.confidentialityTermYears).toBe(1);
  });

  it("ignores term types the document doesn't support", () => {
    const next = applyNdaUpdates(base, updates({ mndaTermType: "forever" as never, confidentialityTermType: "months" as never }));
    expect(next.mndaTermType).toBe("expires");
    expect(next.confidentialityTermType).toBe("years");
  });
});

describe("withDefaults", () => {
  const today = "2026-10-16";

  it("fills in today's date for the NDA and for documents with an Effective Date", () => {
    const pilot = withDefaults(emptyDraft("Pilot-Agreement"), DOCUMENTS["Pilot-Agreement"], today);
    expect(pilot.nda.effectiveDate).toBe(today);
    expect(pilot.terms["Effective Date"]).toBe(today);
  });

  it("keeps dates the user gave", () => {
    const draft: Draft = { ...emptyDraft("Pilot-Agreement"), terms: { "Effective Date": "2027-01-01" } };
    expect(withDefaults(draft, DOCUMENTS["Pilot-Agreement"], today).terms["Effective Date"]).toBe("2027-01-01");
  });

  it("adds no Effective Date to documents without one", () => {
    expect(withDefaults(sla, DOCUMENTS.sla, today).terms).toEqual({});
  });
});
