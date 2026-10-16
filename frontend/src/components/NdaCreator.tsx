"use client";

import { useState, useSyncExternalStore } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import UserMenu from "@/components/UserMenu";
import { buildNdaMarkdown, defaultNdaData, parseYears, type NdaData, type Party } from "@/lib/nda";

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</legend>
      {children}
    </fieldset>
  );
}

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const noopSubscribe = () => () => {};

// Email addresses typed into the form are auto-linked by GFM; in an agreement
// they should read as plain text.
function DocumentLink({ href, children }: React.ComponentProps<"a">) {
  if (!href || href.startsWith("mailto:")) return <>{children}</>;
  return <a href={href}>{children}</a>;
}

export default function NdaCreator({ standardTerms }: { standardTerms: string }) {
  const [formData, setData] = useState<NdaData>(() => defaultNdaData(""));
  // null until the user edits the date; an empty string means they cleared it.
  const [chosenDate, setChosenDate] = useState<string | null>(null);

  // The page is prerendered, so today's date is only known in the browser.
  // Until the user picks a date, the effective date defaults to today.
  const today = useSyncExternalStore(noopSubscribe, todayIso, () => "");
  const data = { ...formData, effectiveDate: chosenDate ?? today };

  const markdown = buildNdaMarkdown(data, standardTerms);

  const update = <K extends keyof NdaData>(key: K, value: NdaData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const updateParty = (which: "party1" | "party2", key: keyof Party, value: string) =>
    setData((d) => ({ ...d, [which]: { ...d[which], [key]: value } }));

  const partyFields = (which: "party1" | "party2", title: string) => (
    <Section title={title}>
      <Field label="Print name">
        <input className={inputClass} value={data[which].name} onChange={(e) => updateParty(which, "name", e.target.value)} />
      </Field>
      <Field label="Title">
        <input className={inputClass} value={data[which].title} onChange={(e) => updateParty(which, "title", e.target.value)} />
      </Field>
      <Field label="Company">
        <input className={inputClass} value={data[which].company} onChange={(e) => updateParty(which, "company", e.target.value)} />
      </Field>
      <Field label="Notice address" hint="Use either email or postal address">
        <textarea
          className={inputClass}
          rows={2}
          value={data[which].noticeAddress}
          onChange={(e) => updateParty(which, "noticeAddress", e.target.value)}
        />
      </Field>
    </Section>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-[#032147]">Prelegal · Mutual NDA Creator</h1>
            <p className="text-sm text-slate-500">Fill in the key terms, review the agreement, then download it.</p>
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
        <form className="space-y-4 print:hidden" onSubmit={(e) => e.preventDefault()}>
          <Section title="Agreement">
            <Field label="Purpose" hint="How Confidential Information may be used">
              <textarea className={inputClass} rows={3} value={data.purpose} onChange={(e) => update("purpose", e.target.value)} />
            </Field>
            <Field label="Effective date">
              <input type="date" className={inputClass} value={data.effectiveDate} onChange={(e) => setChosenDate(e.target.value)} />
            </Field>
          </Section>

          <Section title="MNDA term">
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="mndaTerm"
                aria-label="Expires after a number of years"
                checked={data.mndaTermType === "expires"}
                onChange={() => update("mndaTermType", "expires")}
              />
              Expires
              <input
                type="number"
                min={1}
                className={`${inputClass} !w-20 shrink-0`}
                aria-label="MNDA term in years"
                value={data.mndaTermYears || ""}
                disabled={data.mndaTermType !== "expires"}
                onChange={(e) => update("mndaTermYears", parseYears(e.target.value))}
              />
              year(s) from Effective Date
            </label>
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="mndaTerm"
                aria-label="Continues until terminated"
                checked={data.mndaTermType === "untilTerminated"}
                onChange={() => update("mndaTermType", "untilTerminated")}
              />
              Continues until terminated
            </label>
          </Section>

          <Section title="Term of confidentiality">
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="confidentialityTerm"
                aria-label="Protected for a number of years"
                checked={data.confidentialityTermType === "years"}
                onChange={() => update("confidentialityTermType", "years")}
              />
              <input
                type="number"
                min={1}
                className={`${inputClass} !w-20 shrink-0`}
                aria-label="Term of confidentiality in years"
                value={data.confidentialityTermYears || ""}
                disabled={data.confidentialityTermType !== "years"}
                onChange={(e) => update("confidentialityTermYears", parseYears(e.target.value))}
              />
              year(s) from Effective Date
            </label>
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="confidentialityTerm"
                aria-label="In perpetuity"
                checked={data.confidentialityTermType === "perpetuity"}
                onChange={() => update("confidentialityTermType", "perpetuity")}
              />
              In perpetuity
            </label>
          </Section>

          <Section title="Governing law & jurisdiction">
            <Field label="Governing law" hint="State, e.g. Delaware">
              <input className={inputClass} value={data.governingLaw} onChange={(e) => update("governingLaw", e.target.value)} />
            </Field>
            <Field label="Jurisdiction" hint='City or county and state, e.g. "New Castle, DE"'>
              <input className={inputClass} value={data.jurisdiction} onChange={(e) => update("jurisdiction", e.target.value)} />
            </Field>
          </Section>

          <Section title="Modifications">
            <Field label="MNDA modifications" hint="Optional changes to the Standard Terms">
              <textarea className={inputClass} rows={3} value={data.modifications} onChange={(e) => update("modifications", e.target.value)} />
            </Field>
          </Section>

          {partyFields("party1", "Party 1")}
          {partyFields("party2", "Party 2")}
        </form>

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
