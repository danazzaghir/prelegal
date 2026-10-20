import { describe, expect, it } from "vitest";
import { editedAgo } from "./agreements";

const now = new Date("2026-10-20T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const MINUTE = 60_000;

describe("editedAgo", () => {
  it.each([
    [10_000, "just now"],
    [MINUTE, "1 minute ago"],
    [5 * MINUTE, "5 minutes ago"],
    [60 * MINUTE, "1 hour ago"],
    [3 * 60 * MINUTE, "3 hours ago"],
    [24 * 60 * MINUTE, "yesterday"],
    [3 * 24 * 60 * MINUTE, "3 days ago"],
  ])("describes %i ms ago as %j", (ms, expected) => {
    expect(editedAgo(ago(ms), now)).toBe(expected);
  });

  it("gives the date for anything older than a week", () => {
    expect(editedAgo("2026-09-01T12:00:00Z", now)).toBe("Sep 1, 2026");
  });
});
