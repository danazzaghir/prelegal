"use client";

import { useState, useSyncExternalStore } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import NdaChat from "@/components/NdaChat";
import UserMenu from "@/components/UserMenu";
import { applyUpdates, type NdaUpdates } from "@/lib/chat";
import { buildNdaMarkdown, defaultNdaData, todayIso, type NdaData } from "@/lib/nda";

const noopSubscribe = () => () => {};

// Email addresses in the agreement are auto-linked by GFM; in an agreement
// they should read as plain text.
function DocumentLink({ href, children }: React.ComponentProps<"a">) {
  if (!href || href.startsWith("mailto:")) return <>{children}</>;
  return <a href={href}>{children}</a>;
}

export default function NdaCreator({ standardTerms }: { standardTerms: string }) {
  // What the chat has filled in. An empty effective date means none was given yet.
  const [answers, setAnswers] = useState<NdaData>(() => defaultNdaData(""));

  // The page is prerendered, so today's date is only known in the browser.
  // Until the user gives a date, the effective date defaults to today.
  const today = useSyncExternalStore(noopSubscribe, todayIso, () => "");
  const data = { ...answers, effectiveDate: answers.effectiveDate || today };

  const markdown = buildNdaMarkdown(data, standardTerms);

  const onUpdates = (updates: NdaUpdates) => setAnswers((current) => applyUpdates(current, updates));

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-[#032147]">Prelegal · Mutual NDA Creator</h1>
            <p className="text-sm text-slate-500">Chat with the assistant to fill in the agreement, then download it.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <UserMenu />
            <button
              onClick={() => window.print()}
              className="rounded-md bg-[#209dd7] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1a86b8]"
            >
              Download PDF
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] print:block print:p-0">
        <NdaChat fields={data} onUpdates={onUpdates} />

        <article className="nda-document rounded-lg border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-8 sm:py-10 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto print:static print:max-h-none print:overflow-visible print:border-0 print:p-0 print:shadow-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: DocumentLink }}>
            {markdown}
          </ReactMarkdown>
        </article>
      </main>

      <footer className="pb-6 text-center text-xs text-slate-500 print:hidden">
        Based on the Common Paper Mutual NDA, free to use under{" "}
        <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Not legal advice.
      </footer>
    </div>
  );
}
