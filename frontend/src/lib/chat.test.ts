import { describe, expect, it } from "vitest";
import { updates } from "@/test-utils/fakeChat";
import { applyUpdates } from "./chat";
import { defaultNdaData } from "./nda";

const base = defaultNdaData("2026-10-16");

describe("applyUpdates", () => {
  it("changes nothing when every update is null", () => {
    expect(applyUpdates(base, updates())).toEqual(base);
  });

  it("does not modify the original data", () => {
    const copy = structuredClone(base);
    applyUpdates(base, updates({ governingLaw: "Delaware", party1: { name: "Ada" } }));
    expect(base).toEqual(copy);
  });

  it("sets text fields, trimmed", () => {
    const next = applyUpdates(
      base,
      updates({ purpose: "  An acquisition. ", governingLaw: "Delaware", jurisdiction: "New Castle, DE", modifications: "None of 10." }),
    );
    expect(next).toMatchObject({
      purpose: "An acquisition.",
      governingLaw: "Delaware",
      jurisdiction: "New Castle, DE",
      modifications: "None of 10.",
    });
  });

  it("treats an empty string as no change, so filled-in fields can't be wiped by mistake", () => {
    const filled = applyUpdates(base, updates({ governingLaw: "Delaware", party1: { name: "Ada" } }));
    const next = applyUpdates(filled, updates({ purpose: "", governingLaw: "  ", party1: { name: "" } }));
    expect(next.purpose).toBe(base.purpose);
    expect(next.governingLaw).toBe("Delaware");
    expect(next.party1.name).toBe("Ada");
  });

  it("lets the AI remove modifications with an empty string", () => {
    const withMods = applyUpdates(base, updates({ modifications: "Section 10 does not apply." }));
    expect(applyUpdates(withMods, updates({ modifications: "" })).modifications).toBe("");
  });

  it("updates only the party fields that were given", () => {
    const filled = applyUpdates(base, updates({ party1: { name: "Ada", company: "Analytical" } }));
    const next = applyUpdates(filled, updates({ party1: { title: "CEO" }, party2: { company: "Enigma" } }));
    expect(next.party1).toEqual({ name: "Ada", title: "CEO", company: "Analytical", noticeAddress: "" });
    expect(next.party2).toEqual({ name: "", title: "", company: "Enigma", noticeAddress: "" });
  });

  it("sets the term options", () => {
    const next = applyUpdates(
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

  it("accepts a YYYY-MM-DD effective date", () => {
    expect(applyUpdates(base, updates({ effectiveDate: "2027-03-05" })).effectiveDate).toBe("2027-03-05");
  });

  it.each(["March 5, 2027", "2027-3-5", "", "2026-02-30", "2026-13-01", "2026-04-31"])(
    "ignores the effective date %j, which isn't a real YYYY-MM-DD date",
    (date) => {
      expect(applyUpdates(base, updates({ effectiveDate: date })).effectiveDate).toBe("2026-10-16");
    },
  );

  it("accepts 29 February in a leap year", () => {
    expect(applyUpdates(base, updates({ effectiveDate: "2028-02-29" })).effectiveDate).toBe("2028-02-29");
  });

  it.each([0, -2, 1.5])("ignores %j as a number of years", (years) => {
    const next = applyUpdates(base, updates({ mndaTermYears: years, confidentialityTermYears: years }));
    expect(next.mndaTermYears).toBe(1);
    expect(next.confidentialityTermYears).toBe(1);
  });

  it("ignores term types the document doesn't support", () => {
    const bad = updates({ mndaTermType: "forever" as never, confidentialityTermType: "months" as never });
    const next = applyUpdates(base, bad);
    expect(next.mndaTermType).toBe("expires");
    expect(next.confidentialityTermType).toBe("years");
  });
});
