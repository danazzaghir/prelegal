"use client";

import { useId } from "react";

import { inputClass, TextAreaField, TextField } from "@/components/ui";
import { DOCUMENT_CHOICES, NDA_ID, type DocumentDetail } from "@/lib/documents";
import { setNdaField, setPartyField, setTerm, type Draft, type NdaTerms, type PartyKey } from "@/lib/draft";
import type { Party } from "@/lib/nda";

type Props = {
  // The draft as shown in the agreement, with defaults filled in.
  draft: Draft;
  // The chosen document, once loaded.
  doc: DocumentDetail | undefined;
  // Applies a change to the draft.
  onEdit: (change: (draft: Draft) => Draft) => void;
  // The user picked a document from the list.
  onChooseDocument: (documentId: string) => void;
};

const PARTY_FIELDS: { field: keyof Party; label: string }[] = [
  { field: "name", label: "Signer's name" },
  { field: "title", label: "Title" },
  { field: "company", label: "Company" },
  { field: "noticeAddress", label: "Notice address" },
];

/** A whole number of years, or 0 (shown as a blank) for anything else. */
const toYears = (value: string) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 0;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t border-slate-200 pt-4">
      <legend className="pr-2 text-sm font-semibold text-[#032147]">{title}</legend>
      {children}
    </fieldset>
  );
}

function Radio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-800">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="accent-[#209dd7]" />
      {children}
    </label>
  );
}

function YearsInput({ label, value, onChange }: { label: string; value: number; onChange: (years: number) => void }) {
  return (
    <input
      type="number"
      min={1}
      step={1}
      aria-label={label}
      className={`${inputClass} !w-20`}
      value={value || ""}
      onChange={(e) => onChange(toYears(e.target.value))}
    />
  );
}

function NdaFields({ nda, onEdit }: { nda: NdaTerms; onEdit: Props["onEdit"] }) {
  const set =
    <K extends keyof NdaTerms>(field: K) =>
    (value: NdaTerms[K]) =>
      onEdit((d) => setNdaField(d, field, value));

  return (
    <Section title="Key terms">
      <TextAreaField label="Purpose" hint="How the confidential information may be used." value={nda.purpose} onChange={set("purpose")} />
      <TextField label="Effective date" type="date" value={nda.effectiveDate} onChange={set("effectiveDate")} />

      <div role="radiogroup" aria-label="MNDA term" className="space-y-2">
        <span className="text-sm font-medium text-slate-800">MNDA term</span>
        <Radio name="mndaTerm" checked={nda.mndaTermType === "expires"} onChange={() => set("mndaTermType")("expires")}>
          Expires after
          <YearsInput label="MNDA term in years" value={nda.mndaTermYears} onChange={set("mndaTermYears")} />
          year(s)
        </Radio>
        <Radio name="mndaTerm" checked={nda.mndaTermType === "untilTerminated"} onChange={() => set("mndaTermType")("untilTerminated")}>
          Continues until terminated
        </Radio>
      </div>

      <div role="radiogroup" aria-label="Term of confidentiality" className="space-y-2">
        <span className="text-sm font-medium text-slate-800">Term of confidentiality</span>
        <Radio
          name="confidentialityTerm"
          checked={nda.confidentialityTermType === "years"}
          onChange={() => set("confidentialityTermType")("years")}
        >
          <YearsInput
            label="Term of confidentiality in years"
            value={nda.confidentialityTermYears}
            onChange={set("confidentialityTermYears")}
          />
          year(s)
        </Radio>
        <Radio
          name="confidentialityTerm"
          checked={nda.confidentialityTermType === "perpetuity"}
          onChange={() => set("confidentialityTermType")("perpetuity")}
        >
          In perpetuity
        </Radio>
      </div>

      <TextField label="Governing law" hint="A US state, for example Delaware." value={nda.governingLaw} onChange={set("governingLaw")} />
      <TextField
        label="Jurisdiction"
        hint="Where disputes are heard, for example courts in New Castle, DE."
        value={nda.jurisdiction}
        onChange={set("jurisdiction")}
      />
      <TextAreaField label="Modifications" hint="Optional changes to the standard terms." value={nda.modifications} onChange={set("modifications")} />
    </Section>
  );
}

/** Fills in the agreement by hand, for when the AI assistant can't help. */
export default function ManualForm({ draft, doc, onEdit, onChooseDocument }: Props) {
  const selectId = useId();
  return (
    <section
      aria-label="Fill in the agreement yourself"
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
    >
      <div className="space-y-1">
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-800">
          Agreement type
        </label>
        <select
          id={selectId}
          className={inputClass}
          value={draft.documentId ?? ""}
          onChange={(e) => onChooseDocument(e.target.value)}
        >
          <option value="" disabled>
            Choose an agreement…
          </option>
          {DOCUMENT_CHOICES.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.name}
            </option>
          ))}
        </select>
      </div>

      {doc && (
        <>
          {(["party1", "party2"] as PartyKey[]).map((party, i) => (
            <Section key={party} title={doc.parties[i]}>
              {PARTY_FIELDS.map(({ field, label }) =>
                field === "noticeAddress" ? (
                  <TextAreaField
                    key={field}
                    label={label}
                    hint="Email or postal address for legal notices."
                    value={draft[party][field]}
                    onChange={(value) => onEdit((d) => setPartyField(d, party, field, value))}
                  />
                ) : (
                  <TextField
                    key={field}
                    label={label}
                    value={draft[party][field]}
                    onChange={(value) => onEdit((d) => setPartyField(d, party, field, value))}
                  />
                ),
              )}
            </Section>
          ))}

          {doc.id === NDA_ID ? (
            <NdaFields nda={draft.nda} onEdit={onEdit} />
          ) : (
            <Section title="Key terms">
              {doc.terms.map((term) => (
                <TextField
                  key={term}
                  label={term}
                  value={draft.terms[term] ?? ""}
                  onChange={(value) => onEdit((d) => setTerm(d, term, value))}
                />
              ))}
            </Section>
          )}
        </>
      )}
    </section>
  );
}
