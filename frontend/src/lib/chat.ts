import type { NdaData, Party } from "@/lib/nda";

export type ChatMessage = { role: "user" | "assistant"; content: string };

// The AI's changes: null means "leave this field as it is".
export type PartyUpdates = { [K in keyof Party]: string | null };
export type NdaUpdates = {
  [K in Exclude<keyof NdaData, "party1" | "party2">]: NdaData[K] | null;
} & { party1: PartyUpdates; party2: PartyUpdates };

export type ChatTurn = { reply: string; updates: NdaUpdates };

export const GREETING =
  "Hi! I'll help you put together a Mutual Non-Disclosure Agreement. To start, who are the two parties? " +
  "For each one, tell me the company, the person signing, their title and an email or postal address for notices.";

/** Sends the conversation and current fields; resolves to the AI's reply and field updates. */
export async function sendChat(messages: ChatMessage[], fields: NdaData, today: string): Promise<ChatTurn> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, fields, today }),
    });
  } catch {
    throw new Error("Couldn't reach Prelegal. Check your connection and try again.");
  }
  if (!response.ok) {
    const detail = await response
      .json()
      .then((body) => (typeof body?.detail === "string" ? body.detail : null))
      .catch(() => null);
    throw new Error(detail ?? "Something went wrong. Please try again.");
  }
  return (await response.json()) as ChatTurn;
}

/** A real calendar date as YYYY-MM-DD (rejects shapes like 2026-02-30). */
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
const isYears = (value: number) => Number.isInteger(value) && value >= 1;

// The AI should send null for "no change"; an empty string is treated the same
// so a slip can't wipe out a field that's already filled in.
const nonEmpty = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim() !== "";

function mergeParty(party: Party, updates: PartyUpdates | undefined): Party {
  const next = { ...party };
  for (const key of Object.keys(party) as (keyof Party)[]) {
    const value = updates?.[key];
    if (nonEmpty(value)) next[key] = value.trim();
  }
  return next;
}

/** Applies the AI's updates, ignoring nulls and values the document can't use. */
export function applyUpdates(data: NdaData, updates: NdaUpdates): NdaData {
  const next = { ...data };
  for (const key of ["purpose", "governingLaw", "jurisdiction"] as const) {
    const value = updates[key];
    if (nonEmpty(value)) next[key] = value.trim();
  }
  // Modifications are optional, so the user can ask to remove them.
  if (typeof updates.modifications === "string") next.modifications = updates.modifications.trim();
  if (typeof updates.effectiveDate === "string" && isIsoDate(updates.effectiveDate)) {
    next.effectiveDate = updates.effectiveDate;
  }
  if (updates.mndaTermType === "expires" || updates.mndaTermType === "untilTerminated") {
    next.mndaTermType = updates.mndaTermType;
  }
  if (typeof updates.mndaTermYears === "number" && isYears(updates.mndaTermYears)) {
    next.mndaTermYears = updates.mndaTermYears;
  }
  if (updates.confidentialityTermType === "years" || updates.confidentialityTermType === "perpetuity") {
    next.confidentialityTermType = updates.confidentialityTermType;
  }
  if (typeof updates.confidentialityTermYears === "number" && isYears(updates.confidentialityTermYears)) {
    next.confidentialityTermYears = updates.confidentialityTermYears;
  }
  next.party1 = mergeParty(data.party1, updates.party1);
  next.party2 = mergeParty(data.party2, updates.party2);
  return next;
}
