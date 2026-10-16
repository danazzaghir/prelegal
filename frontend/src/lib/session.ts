// Fake sign-in for the v1 foundation: there is no authentication yet, so the
// signed-in user is just the email typed on the login screen, kept for the
// browser tab's session.

export type SessionUser = { email: string };

const KEY = "prelegal.user";
const listeners = new Set<() => void>();

// Storage can be unavailable (private windows, blocked site data).
function read(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, value);
  } catch {
    // The session just won't survive a reload.
  }
  listeners.forEach((notify) => notify());
}

/** Snapshot for useSyncExternalStore: the signed-in email, or null. */
export function getSignedInEmail(): string | null {
  const raw = read();
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as Partial<SessionUser>;
    return typeof user.email === "string" && user.email ? user.email : null;
  } catch {
    return null;
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function signIn(email: string) {
  write(JSON.stringify({ email: email.trim() } satisfies SessionUser));
}

export function signOut() {
  write(null);
}
