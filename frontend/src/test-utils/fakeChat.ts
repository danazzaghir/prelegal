import { vi } from "vitest";
import type { NdaUpdates, PartyUpdates } from "@/lib/chat";

const noPartyUpdates = (): PartyUpdates => ({ name: null, title: null, company: null, noticeAddress: null });

export type UpdateChanges = Partial<Omit<NdaUpdates, "party1" | "party2">> & {
  party1?: Partial<PartyUpdates>;
  party2?: Partial<PartyUpdates>;
};

/** AI updates that change nothing, with the given changes applied. */
export function updates(changes: UpdateChanges = {}): NdaUpdates {
  return {
    purpose: null,
    effectiveDate: null,
    mndaTermType: null,
    mndaTermYears: null,
    confidentialityTermType: null,
    confidentialityTermYears: null,
    governingLaw: null,
    jurisdiction: null,
    modifications: null,
    ...changes,
    party1: { ...noPartyUpdates(), ...changes.party1 },
    party2: { ...noPartyUpdates(), ...changes.party2 },
  };
}

type FakeReply = { reply: string; updates?: UpdateChanges } | { status: number; detail?: string } | Error;

/** Replaces fetch so /api/chat answers with each reply in turn. */
export function fakeChatApi(...replies: FakeReply[]) {
  const queue = [...replies];
  const fetchMock = vi.fn<typeof fetch>(async () => {
    const next = queue.shift();
    if (!next) throw new Error("No more fake replies");
    if (next instanceof Error) throw next;
    if ("status" in next) {
      return new Response(JSON.stringify(next.detail ? { detail: next.detail } : {}), { status: next.status });
    }
    return new Response(JSON.stringify({ reply: next.reply, updates: updates(next.updates) }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The parsed JSON body of a fetch call made by sendChat. */
export function requestBody(fetchMock: ReturnType<typeof fakeChatApi>, call = 0) {
  const init = fetchMock.mock.calls[call][1] as RequestInit;
  return JSON.parse(init.body as string);
}
