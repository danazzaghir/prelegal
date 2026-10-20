"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Chat from "@/components/Chat";
import UserMenu from "@/components/UserMenu";
import type { ChatTurn } from "@/lib/chat";
import { buildDocumentMarkdown } from "@/lib/agreement";
import { fetchDocument, NDA_ID, type DocumentDetail } from "@/lib/documents";
import { applyTurn, emptyDraft, ndaData, withDefaults, type Draft } from "@/lib/draft";
import { buildNdaMarkdown, todayIso } from "@/lib/nda";

const noopSubscribe = () => () => {};

// Values in the agreement come from the chat, so an image URL in one could send
// its contents elsewhere when rendered.
const NO_IMAGES = ["img"];

// Email addresses in the agreement are auto-linked by GFM; in an agreement
// they should read as plain text.
function DocumentLink({ href, children }: React.ComponentProps<"a">) {
  if (!href || href.startsWith("mailto:")) return <>{children}</>;
  return <a href={href}>{children}</a>;
}

function agreementMarkdown(doc: DocumentDetail, draft: Draft): string {
  return doc.id === NDA_ID ? buildNdaMarkdown(ndaData(draft), doc.standardTerms) : buildDocumentMarkdown(doc, draft);
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-center font-sans text-sm text-[#888888]">{children}</p>;
}

export default function DocumentCreator() {
  const [answers, setAnswers] = useState<Draft>(() => emptyDraft());
  // Documents fetched so far, by id; switching back to one needs no new request.
  const [documents, setDocuments] = useState<Record<string, DocumentDetail>>({});
  // Why a document couldn't be loaded, by id. Cleared on the next chat turn, which retries.
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});

  const documentId = answers.documentId;
  const doc = documentId ? documents[documentId] : undefined;
  const loadError = documentId ? loadErrors[documentId] : undefined;

  useEffect(() => {
    if (!documentId || documents[documentId] || loadErrors[documentId]) return;
    let cancelled = false;
    fetchDocument(documentId)
      .then((detail) => {
        if (!cancelled) setDocuments((loaded) => ({ ...loaded, [documentId]: detail }));
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Couldn't load the document.";
        if (!cancelled) setLoadErrors((errors) => ({ ...errors, [documentId]: message }));
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, documents, loadErrors]);

  // The page is prerendered, so today's date is only known in the browser.
  // Until the user gives a date, effective dates default to today.
  const today = useSyncExternalStore(noopSubscribe, todayIso, () => "");
  const draft = withDefaults(answers, doc, today);

  const onTurn = (turn: ChatTurn) => {
    setLoadErrors({});
    setAnswers((current) => applyTurn(current, turn));
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-[#032147]">Prelegal · {doc?.name ?? "New agreement"}</h1>
            <p className="text-sm text-slate-500">Chat with the assistant to choose and fill in an agreement, then download it.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <UserMenu />
            <button
              onClick={() => window.print()}
              disabled={!doc}
              className="rounded-md bg-[#209dd7] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1a86b8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download PDF
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] print:block print:p-0">
        <Chat draft={draft} onTurn={onTurn} />

        <article
          aria-label="Agreement"
          className="agreement rounded-lg border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-8 sm:py-10 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto print:static print:max-h-none print:overflow-visible print:border-0 print:p-0 print:shadow-none"
        >
          {doc ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: DocumentLink }} disallowedElements={NO_IMAGES}>
              {agreementMarkdown(doc, draft)}
            </ReactMarkdown>
          ) : loadError ? (
            <Placeholder>{loadError}</Placeholder>
          ) : documentId ? (
            <Placeholder>Loading the agreement…</Placeholder>
          ) : (
            <Placeholder>Your agreement will appear here once you and the assistant have chosen one.</Placeholder>
          )}
        </article>
      </main>

      <footer className="pb-6 text-center text-xs text-slate-500 print:hidden">
        Based on Common Paper standard agreements, free to use under{" "}
        <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Not legal advice.
      </footer>
    </div>
  );
}
