/** An error from the Prelegal API, with the message the backend gave. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * What happens when the API says the user isn't signed in, for example after
 * Prelegal restarts mid-session: a full page load of sign-in, which also clears
 * any state from the old session. Replaceable in tests.
 */
export const session = {
  onSignedOut: () => window.location.assign(new URL("/", window.location.origin)),
};

/**
 * Calls the API and returns its JSON (or undefined for an empty reply). Errors
 * carry the backend's message, or a plain one when the server can't be reached.
 */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "Couldn't reach Prelegal. Check your connection and try again.");
  }
  // The sign-in endpoints answer 401 for a wrong password or to say "nobody is signed in".
  if (response.status === 401 && !path.startsWith("/api/auth/")) session.onSignedOut();
  if (!response.ok) {
    const detail = await response
      .json()
      .then((body) => (typeof body?.detail === "string" ? body.detail : null))
      .catch(() => null);
    throw new ApiError(response.status, detail ?? "Something went wrong. Please try again.");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
