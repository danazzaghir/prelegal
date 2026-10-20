import fs from "node:fs";
import path from "node:path";
import { vi } from "vitest";
import type { ChatTurn, NdaUpdates, PartyUpdates } from "@/lib/chat";
import type { DocumentDetail } from "@/lib/documents";

const templates = path.join(__dirname, "..", "..", "..", "templates");
const template = (file: string) => fs.readFileSync(path.join(templates, file), "utf-8");

/** Documents as GET /api/documents/{id} serves them, using the real templates. */
export const DOCUMENTS: Record<string, DocumentDetail> = {
  "Mutual-NDA": {
    id: "Mutual-NDA",
    name: "Mutual Non-Disclosure Agreement",
    description: "Standard terms of the Common Paper Mutual NDA.",
    parties: ["Party 1", "Party 2"],
    terms: ["Purpose", "Effective Date", "MNDA Term", "Term of Confidentiality", "Governing Law", "Jurisdiction"],
    standardTerms: template("Mutual-NDA.md"),
  },
  "Pilot-Agreement": {
    id: "Pilot-Agreement",
    name: "Pilot Agreement",
    description: "Common Paper standard Pilot Agreement.",
    parties: ["Customer", "Provider"],
    terms: ["Pilot Period", "Effective Date", "General Cap Amount", "Governing Law", "Chosen Courts"],
    standardTerms: template("Pilot-Agreement.md"),
  },
  sla: {
    id: "sla",
    name: "Service Level Agreement",
    description: "Common Paper Service Level Agreement.",
    parties: ["Customer", "Provider"],
    terms: ["Target Uptime", "Subscription Period", "Target Response Time", "Support Channel", "Uptime Credit"],
    standardTerms: template("sla.md"),
  },
};

const noPartyUpdates = (): PartyUpdates => ({ name: null, title: null, company: null, noticeAddress: null });

export const noNdaUpdates = (): NdaUpdates => ({
  purpose: null,
  effectiveDate: null,
  mndaTermType: null,
  mndaTermYears: null,
  confidentialityTermType: null,
  confidentialityTermYears: null,
  governingLaw: null,
  jurisdiction: null,
  modifications: null,
});

export type TurnChanges = {
  reply?: string;
  documentId?: string | null;
  party1?: Partial<PartyUpdates>;
  party2?: Partial<PartyUpdates>;
  nda?: Partial<NdaUpdates>;
  terms?: Record<string, string>;
};

/** An AI turn that changes nothing, apart from the given changes. */
export function turn(changes: TurnChanges = {}): ChatTurn {
  return {
    reply: changes.reply ?? "Got it.",
    question: "",
    documentId: changes.documentId ?? null,
    party1: { ...noPartyUpdates(), ...changes.party1 },
    party2: { ...noPartyUpdates(), ...changes.party2 },
    nda: changes.nda ? { ...noNdaUpdates(), ...changes.nda } : null,
    terms: Object.entries(changes.terms ?? {}).map(([term, value]) => ({ term, value })),
  };
}

type FakeReply = TurnChanges | { status: number; detail?: string } | Error;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/**
 * Replaces fetch: /api/chat answers with each reply in turn, and
 * /api/documents/{id} serves DOCUMENTS.
 */
export function fakeApi(...replies: FakeReply[]) {
  const queue = [...replies];
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    const docMatch = url.match(/^\/api\/documents\/(.+)$/);
    if (docMatch) {
      const doc = DOCUMENTS[decodeURIComponent(docMatch[1])];
      return doc ? json(doc) : json({ detail: "Unknown document." }, 404);
    }
    const next = queue.shift();
    if (!next) throw new Error("No more fake replies");
    if (next instanceof Error) throw next;
    if ("status" in next) return json(next.detail ? { detail: next.detail } : {}, next.status);
    return json(turn(next));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The parsed JSON bodies of the /api/chat requests made so far. */
export function chatRequests(fetchMock: ReturnType<typeof fakeApi>) {
  return fetchMock.mock.calls
    .filter(([input]) => String(input) === "/api/chat")
    .map(([, init]) => JSON.parse(init?.body as string));
}
