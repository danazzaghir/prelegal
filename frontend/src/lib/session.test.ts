import { afterEach, describe, expect, it, vi } from "vitest";
import { getSignedInEmail, signIn, signOut, subscribe } from "./session";

describe("session", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("has no user before signing in", () => {
    expect(getSignedInEmail()).toBeNull();
  });

  it("remembers the email after signing in", () => {
    signIn("ada@example.com");
    expect(getSignedInEmail()).toBe("ada@example.com");
  });

  it("trims the email", () => {
    signIn("  ada@example.com ");
    expect(getSignedInEmail()).toBe("ada@example.com");
  });

  it("keeps the user in session storage only", () => {
    signIn("ada@example.com");
    expect(JSON.parse(window.sessionStorage.getItem("prelegal.user")!)).toEqual({ email: "ada@example.com" });
    expect(window.localStorage.getItem("prelegal.user")).toBeNull();
  });

  it("forgets the user after signing out", () => {
    signIn("ada@example.com");
    signOut();
    expect(getSignedInEmail()).toBeNull();
    expect(window.sessionStorage.getItem("prelegal.user")).toBeNull();
  });

  it("notifies subscribers on sign in and sign out until they unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    signIn("ada@example.com");
    signOut();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    signIn("ada@example.com");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["not JSON", "{oops"],
    ["no email", "{}"],
    ["an empty email", '{"email":""}'],
    ["a non-string email", '{"email":42}'],
  ])("ignores stored data with %s", (_, raw) => {
    window.sessionStorage.setItem("prelegal.user", raw);
    expect(getSignedInEmail()).toBeNull();
  });

  it("works when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    expect(() => signIn("ada@example.com")).not.toThrow();
    expect(getSignedInEmail()).toBeNull();
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});
