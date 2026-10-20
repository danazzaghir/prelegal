import type { Page } from "@playwright/test";

let count = 0;

/** A fresh account's details; each test gets its own user. */
export function newAccount() {
  count += 1;
  const unique = `${Date.now()}-${process.pid}-${count}`;
  return { name: "Ada Lovelace", email: `ada-${unique}@example.com`, password: "correct horse" };
}

/** Signs up a new user through the API, so the page's session cookie is set. */
export async function signUpViaApi(page: Page) {
  const account = newAccount();
  const response = await page.request.post("/api/auth/signup", { data: account });
  if (!response.ok()) throw new Error(`Sign-up failed: ${response.status()} ${await response.text()}`);
  return account;
}
