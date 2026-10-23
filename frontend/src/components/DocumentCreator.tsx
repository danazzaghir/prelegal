"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AppHeader from "@/components/AppHeader";
import Chat from "@/components/Chat";
import ManualForm from "@/components/ManualForm";
import { primaryButtonClass } from "@/components/ui";
import { buildDocumentMarkdown } from "@/lib/agreement";
import { createAgreement, getAgreement, updateAgreement } from "@/lib/agreements";
import { useRequiredUser } from "@/lib/auth";
import { GREETING, type ChatMessage, type ChatTurn } from "@/lib/chat";
import { DOCUMENT_CHOICES, fetchDocument, NDA_ID, type DocumentDetail } from "@/lib/documents";
import { applyTurn, chooseDocument, emptyDraft, hasDetails, ndaData, withDefaults, type Draft } from "@/lib/draft";
import { buildNdaMarkdown, todayIso } from "@/lib/nda";

const noopSubscribe = () => () => {};

// Values in the agreement come from the chat or the form, so an image URL in one could send
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

type SaveStatus = "idle" | "saving" | "saved" | "failed";

const SAVE_LABELS: Record<SaveStatus, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  failed: "Not saved. It will try again after your next change.",
};

// Manual edits are saved this long after the last one, not on every keystroke.
const EDIT_SAVE_DELAY_MS = 800;

type Mode = "chat" | "manual";

const MODES: { mode: Mode; label: string }[] = [
  { mode: "chat", label: "Chat" },
  { mode: "manual", label: "Edit manually" },
];

type Props = {
  // The saved agreement to continue, or null for a new one.
  savedId: number | null;
  // Called when a new agreement is saved for the first time.
  onCreated: (id: number) => void;
};

/**
 * The chat (or a form to fill it in by hand) and the live agreement. Once a
 * document is chosen, the agreement is saved after every reply and shortly
 * after each manual edit.
 */
export default function DocumentCreator({ savedId, onCreated }: Props) {
  const user = useRequiredUser();
  // The agreement this creator opened (savedId later changes to a new agreement's id).
  const [openedId] = useState(savedId);
  const [opening, setOpening] = useState(openedId !== null);
  const [answers, setAnswers] = useState<Draft>(() => emptyDraft());
  // A saved agreement's conversation; a new one starts with the greeting.
  const [initialMessages, setInitialMessages] = useState<ChatMessage[] | undefined>(undefined);
  const [openError, setOpenError] = useState<string | null>(null);
  // Documents fetched so far, by id; switching back to one needs no new request.
  const [documents, setDocuments] = useState<Record<string, DocumentDetail>>({});
  // Why a document couldn't be loaded, by id. Cleared on the next chat turn or document choice, which retries.
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [mode, setMode] = useState<Mode>("chat");
  const agreementId = useRef(savedId);
  // Saves run one after another, so a quick second reply can't create a duplicate.
  const saves = useRef<Promise<void>>(Promise.resolve());
  // The conversation so far, saved along with manual edits.
  const conversation = useRef<ChatMessage[]>([{ role: "assistant", content: GREETING }]);
  // A manual edit waiting to be saved, and its timer.
  const pendingEdit = useRef<{ draft: Draft; timer: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    if (openedId === null || !user) return;
    let cancelled = false;
    getAgreement(openedId)
      .then((agreement) => {
        if (cancelled) return;
        setAnswers(agreement.draft);
        setInitialMessages(agreement.messages);
        conversation.current = agreement.messages;
        setOpening(false);
      })
      .catch((e: unknown) => {
        if (!cancelled) setOpenError(e instanceof Error ? e.message : "Couldn't open this agreement.");
      });
    return () => {
      cancelled = true;
    };
  }, [openedId, user]);

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

  const save = (toSave: Draft, messages: ChatMessage[]) => {
    // This save includes any manual edit still waiting.
    if (pendingEdit.current) clearTimeout(pendingEdit.current.timer);
    pendingEdit.current = null;
    setSaveStatus("saving");
    saves.current = saves.current.then(async () => {
      try {
        if (agreementId.current === null) {
          const created = await createAgreement(toSave, messages);
          agreementId.current = created.id;
          // The route puts the id in the address.
          onCreated(created.id);
        } else {
          await updateAgreement(agreementId.current, toSave, messages);
        }
        setSaveStatus("saved");
      } catch {
        setSaveStatus("failed");
      }
    });
  };

  const saveEditNow = () => {
    if (pendingEdit.current) save(pendingEdit.current.draft, conversation.current);
  };
  // The timer and the unmount below need the latest saveEditNow.
  const latestSaveEditNow = useRef(saveEditNow);
  useEffect(() => {
    latestSaveEditNow.current = saveEditNow;
  });
  // Leaving the page (for example back to the dashboard) saves a waiting edit at once.
  useEffect(() => () => latestSaveEditNow.current(), []);

  const onTurn = (turn: ChatTurn, messages: ChatMessage[]) => {
    const next = applyTurn(answers, turn);
    conversation.current = messages;
    setLoadErrors({});
    setAnswers(next);
    // Nothing worth keeping until the assistant has chosen a document.
    if (next.documentId) save(next, messages);
  };

  const onEdit = (change: (draft: Draft) => Draft) => {
    const next = change(answers);
    setAnswers(next);
    if (pendingEdit.current) clearTimeout(pendingEdit.current.timer);
    pendingEdit.current = next.documentId
      ? { draft: next, timer: setTimeout(() => latestSaveEditNow.current(), EDIT_SAVE_DELAY_MS) }
      : null;
  };

  const onChooseDocument = (id: string) => {
    if (answers.documentId && id !== answers.documentId && hasDetails(answers)) {
      const name = DOCUMENT_CHOICES.find((choice) => choice.id === id)?.name ?? "this agreement";
      if (!window.confirm(`Switch to the ${name}? The details filled in so far will be cleared.`)) return;
    }
    setLoadErrors({});
    onEdit((d) => chooseDocument(d, id));
  };

  if (!user) return <div className="min-h-screen bg-slate-100" aria-busy="true" />;

  return (
    <div className="min-h-screen bg-slate-100 lg:flex lg:h-screen lg:flex-col print:block print:h-auto">
      <AppHeader user={user}>
        {saveStatus !== "idle" && (
          <span role="status" className={saveStatus === "failed" ? "text-red-700" : "text-[#888888]"}>
            {SAVE_LABELS[saveStatus]}
          </span>
        )}
      </AppHeader>

      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 pt-6 print:hidden">
        <h1 className="text-xl font-semibold text-[#032147]">{doc?.name ?? "New agreement"}</h1>
        <button
          onClick={() => window.print()}
          disabled={!doc}
          className={primaryButtonClass}
        >
          Download PDF
        </button>
      </div>

      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] print:block print:p-0">
        {openError ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 print:hidden">
            {openError}
          </p>
        ) : opening ? (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-[#888888] print:hidden">
            Opening your agreement…
          </p>
        ) : (
          <div className="flex min-w-0 flex-col gap-3 lg:min-h-0 print:hidden">
            <div
              role="group"
              aria-label="How to fill in the agreement"
              className="inline-flex self-start rounded-md border border-slate-200 bg-white p-0.5 shadow-sm"
            >
              {MODES.map((m) => (
                <button
                  key={m.mode}
                  type="button"
                  aria-pressed={mode === m.mode}
                  onClick={() => setMode(m.mode)}
                  className={`rounded px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#209dd7] ${
                    mode === m.mode ? "bg-[#209dd7] text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {/* The chat stays mounted while hidden, so its conversation isn't lost. */}
            <div hidden={mode !== "chat"} className="flex flex-col lg:min-h-0 lg:flex-1">
              <Chat
                draft={draft}
                initialMessages={initialMessages}
                onTurn={onTurn}
                onFillInManually={() => setMode("manual")}
              />
            </div>
            {mode === "manual" && (
              <ManualForm draft={draft} doc={doc} onEdit={onEdit} onChooseDocument={onChooseDocument} />
            )}
          </div>
        )}

        <div className="min-w-0 lg:flex lg:min-h-0 lg:flex-col print:block">
          <p
            role="note"
            className="mb-3 rounded-md border-l-4 border-[#ecad0a] bg-white px-4 py-3 text-sm text-slate-700 shadow-sm print:hidden"
          >
            <strong className="font-semibold text-[#032147]">This is a draft.</strong> Prelegal generates agreements from
            standard templates, so have a qualified lawyer review it before anyone signs.
          </p>
          <article
            aria-label="Agreement"
            className="agreement rounded-lg border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-8 sm:py-10 lg:min-h-0 lg:flex-1 lg:overflow-y-auto print:overflow-visible print:border-0 print:p-0 print:shadow-none"
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
              <Placeholder>Your agreement will appear here once you have chosen one, with the assistant or by hand.</Placeholder>
            )}
          </article>
        </div>
      </main>

      <footer className="pb-4 text-center text-xs text-slate-500 print:hidden">
        Based on Common Paper standard agreements, free to use under{" "}
        <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Not legal advice.
      </footer>
    </div>
  );
}
