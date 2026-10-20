import type { Draft, NdaTerms } from "@/lib/draft";
import type { Party } from "@/lib/nda";

export type ChatMessage = { role: "user" | "assistant"; content: string };

// The AI's changes: null means "leave this field as it is".
export type PartyUpdates = { [K in keyof Party]: string | null };
export type NdaUpdates = { [K in keyof NdaTerms]: NdaTerms[K] | null };
export type TermUpdate = { term: string; value: string };

export type ChatTurn = {
  // Already ends with the follow-on question.
  reply: string;
  // The follow-on question on its own.
  question: string;
  // The document being drafted, or null for no change.
  documentId: string | null;
  party1: PartyUpdates;
  party2: PartyUpdates;
  // Only for the Mutual NDA.
  nda: NdaUpdates | null;
  // Key terms of every other document.
  terms: TermUpdate[];
};

export const GREETING =
  "Hi! I'm Prelegal's assistant. I can draft common business agreements from Common Paper's standard templates, " +
  "such as NDAs, cloud service, data processing, pilot and partnership agreements. " +
  "What kind of agreement do you need, and who is it between?";

/** Sends the conversation and current draft; resolves to the AI's reply and updates. */
export async function sendChat(messages: ChatMessage[], draft: Draft, today: string): Promise<ChatTurn> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, draft, today }),
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
