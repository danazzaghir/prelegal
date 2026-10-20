import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, session } from "./api";

const reply = (status: number, body?: unknown) =>
  vi.fn<typeof fetch>(async () =>
    status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body ?? {}), { status }),
  );

describe("api", () => {
  const onSignedOut = vi.spyOn(session, "onSignedOut").mockImplementation(() => {});

  afterEach(() => {
    vi.unstubAllGlobals();
    onSignedOut.mockClear();
  });

  it("sends JSON and returns the reply", async () => {
    const fetchMock = reply(200, { ok: true });
    vi.stubGlobal("fetch", fetchMock);
    expect(await api("/api/x", { method: "POST", body: { a: 1 } })).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"a":1}',
    });
  });

  it("returns nothing for 204 No Content", async () => {
    vi.stubGlobal("fetch", reply(204));
    expect(await api("/api/x", { method: "DELETE" })).toBeUndefined();
  });

  it("throws the backend's message, or a plain one", async () => {
    vi.stubGlobal("fetch", reply(404, { detail: "Agreement not found." }));
    await expect(api("/api/agreements/9")).rejects.toEqual(new ApiError(404, "Agreement not found."));
    vi.stubGlobal("fetch", reply(500, "oops"));
    await expect(api("/api/x")).rejects.toThrow("Something went wrong. Please try again.");
  });

  it("explains when the server can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(api("/api/x")).rejects.toThrow("Couldn't reach Prelegal");
  });

  it("sends the user to sign in when their session has ended", async () => {
    vi.stubGlobal("fetch", reply(401, { detail: "Please sign in." }));
    await expect(api("/api/chat", { method: "POST", body: {} })).rejects.toThrow("Please sign in.");
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });

  it("leaves 401s from the sign-in endpoints to the forms", async () => {
    vi.stubGlobal("fetch", reply(401, { detail: "Wrong email or password." }));
    await expect(api("/api/auth/signin", { method: "POST", body: {} })).rejects.toThrow("Wrong email or password.");
    await expect(api("/api/auth/me")).rejects.toThrow();
    expect(onSignedOut).not.toHaveBeenCalled();
  });
});
