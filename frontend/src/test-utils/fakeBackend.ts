import fs from "node:fs";
import path from "node:path";
import { vi } from "vitest";
import type { ChatTurn, NdaUpdates, PartyUpdates } from "@/lib/chat";
import type { Agreement } from "@/lib/agreements";
import type { User } from "@/lib/auth";
import type { DocumentDetail } from "@/lib/documents";
import { emptyDraft } from "@/lib/draft";

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

const json = (body: unknown, status = 200) =>
  status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body), { status });

export const ADA: User = { id: 1, name: "Ada Lovelace", email: "ada@example.com" };

/** What the fake backend holds: the signed-in user (null = signed out) and their agreements. */
export type FakeServer = {
  user: User | null;
  agreements: Agreement[];
};

export function savedAgreement(id: number, changes: Partial<Agreement> = {}): Agreement {
  const stamp = "2026-10-16T09:00:00.000Z";
  return {
    id,
    documentId: "sla",
    title: "Service Level Agreement",
    createdAt: stamp,
    updatedAt: stamp,
    draft: { ...emptyDraft("sla"), terms: { "Target Uptime": "99.9%" } },
    messages: [
      { role: "assistant", content: "What do you need?" },
      { role: "user", content: "An SLA" },
      { role: "assistant", content: "Great. What uptime?" },
    ],
    ...changes,
  };
}

/**
 * Replaces fetch with a small in-memory Prelegal backend:
 * - /api/chat answers with each reply in turn;
 * - /api/documents/{id} serves DOCUMENTS;
 * - /api/auth/* and /api/agreements work against `server`.
 */
export function fakeApi(...replies: FakeReply[]) {
  return fakeServer({ user: ADA, agreements: [] }, ...replies);
}

export function fakeServer(server: FakeServer, ...replies: FakeReply[]) {
  const queue = [...replies];
  let nextId = Math.max(0, ...server.agreements.map((a) => a.id)) + 1;
  const signedOut = () => json({ detail: "Please sign in." }, 401);

  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body as string) : undefined;

    if (url === "/api/auth/me") return server.user ? json(server.user) : signedOut();
    if (url === "/api/auth/signout") {
      server.user = null;
      return json(null, 204);
    }
    if (!server.user) return signedOut();

    const docMatch = url.match(/^\/api\/documents\/(.+)$/);
    if (docMatch) {
      const doc = DOCUMENTS[decodeURIComponent(docMatch[1])];
      return doc ? json(doc) : json({ detail: "Unknown document." }, 404);
    }

    if (url === "/api/agreements" && method === "GET") {
      return json(
        server.agreements.map(({ id, documentId, title, createdAt, updatedAt }) => ({ id, documentId, title, createdAt, updatedAt })),
      );
    }
    if (url === "/api/agreements" && method === "POST") {
      const created = savedAgreement(nextId++, { ...body, documentId: body.draft.documentId, title: "Saved" });
      server.agreements.unshift(created);
      return json(created, 201);
    }
    const agreementMatch = url.match(/^\/api\/agreements\/(\d+)$/);
    if (agreementMatch) {
      const index = server.agreements.findIndex((a) => a.id === Number(agreementMatch[1]));
      if (index < 0) return json({ detail: "Agreement not found." }, 404);
      if (method === "DELETE") {
        server.agreements.splice(index, 1);
        return json(null, 204);
      }
      if (method === "PUT") server.agreements[index] = { ...server.agreements[index], ...body };
      return json(server.agreements[index]);
    }

    if (url !== "/api/chat") throw new Error(`Unexpected request: ${method} ${url}`);
    const next = queue.shift();
    if (!next) throw new Error("No more fake replies");
    if (next instanceof Error) throw next;
    if ("status" in next) return json(next.detail ? { detail: next.detail } : {}, next.status);
    return json(turn(next));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The parsed JSON bodies of the requests made so far to one endpoint. */
export function requestsTo(fetchMock: ReturnType<typeof fakeApi>, url: string, method = "POST") {
  return fetchMock.mock.calls
    .filter(([input, init]) => String(input) === url && (init?.method ?? "GET") === method)
    .map(([, init]) => JSON.parse(init?.body as string));
}

/** The parsed JSON bodies of the /api/chat requests made so far. */
export const chatRequests = (fetchMock: ReturnType<typeof fakeApi>) => requestsTo(fetchMock, "/api/chat");
