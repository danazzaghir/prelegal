import type { ChatTurn, NdaUpdates, PartyUpdates } from "@/lib/chat";
import { EFFECTIVE_DATE, NDA_ID, type DocumentDetail } from "@/lib/documents";
import { defaultNdaData, isIsoDate, looksLikeIsoDate, type NdaData, type Party } from "@/lib/nda";

export type NdaTerms = Omit<NdaData, "party1" | "party2">;

/** Everything the chat has filled in so far, for whichever document is chosen. */
export type Draft = {
  documentId: string | null;
  party1: Party;
  party2: Party;
  // The Mutual NDA's cover page fields.
  nda: NdaTerms;
  // Key term values for every other document, by term name.
  terms: Record<string, string>;
};

export function emptyDraft(documentId: string | null = null): Draft {
  // An empty effective date means none was given yet; it then defaults to today.
  const { party1, party2, ...nda } = defaultNdaData("");
  return { documentId, party1, party2, nda, terms: {} };
}

/** The draft with today's date filled in for any effective date not given yet. */
export function withDefaults(draft: Draft, doc: DocumentDetail | undefined, today: string): Draft {
  const nda = { ...draft.nda, effectiveDate: draft.nda.effectiveDate || today };
  const terms =
    doc?.terms.includes(EFFECTIVE_DATE) && !draft.terms[EFFECTIVE_DATE]
      ? { ...draft.terms, [EFFECTIVE_DATE]: today }
      : draft.terms;
  return { ...draft, nda, terms };
}

/** The Mutual NDA's fields in the shape its cover page expects. */
export function ndaData(draft: Draft): NdaData {
  return { ...draft.nda, party1: draft.party1, party2: draft.party2 };
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

/** Applies the AI's NDA updates, ignoring nulls and values the document can't use. */
export function applyNdaUpdates(nda: NdaTerms, updates: NdaUpdates): NdaTerms {
  const next = { ...nda };
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
  return next;
}

/**
 * Applies one AI turn. Switching from one document to another starts a fresh
 * draft, then that turn's updates are applied to it. Choosing the first
 * document keeps any details given before it.
 */
export function applyTurn(draft: Draft, turn: ChatTurn): Draft {
  const chosen = turn.documentId ?? draft.documentId;
  const switching = draft.documentId !== null && chosen !== draft.documentId;
  const base = switching ? emptyDraft(chosen) : { ...draft, documentId: chosen };
  const terms = { ...base.terms };
  for (const { term, value } of turn.terms) {
    const text = value.trim();
    // A value shaped like a date must be a real one; other text is kept as written.
    const impossibleDate = looksLikeIsoDate(text) && !isIsoDate(text);
    if (text && !impossibleDate) terms[term] = text;
  }
  return {
    documentId: base.documentId,
    party1: mergeParty(base.party1, turn.party1),
    party2: mergeParty(base.party2, turn.party2),
    nda: turn.nda && base.documentId === NDA_ID ? applyNdaUpdates(base.nda, turn.nda) : base.nda,
    terms,
  };
}

// Manual edits. Unlike the AI's updates, these can clear a field.

/** Whether anything has been filled in beyond a fresh draft's defaults. */
export function hasDetails(draft: Draft): boolean {
  const { party1, party2, nda, terms } = emptyDraft();
  return (
    JSON.stringify([draft.party1, draft.party2, draft.nda, draft.terms]) !== JSON.stringify([party1, party2, nda, terms])
  );
}

/** Chooses a document by hand. The first choice keeps any details given; switching starts afresh, as with the AI. */
export function chooseDocument(draft: Draft, documentId: string): Draft {
  if (documentId === draft.documentId) return draft;
  return draft.documentId === null ? { ...draft, documentId } : emptyDraft(documentId);
}

export type PartyKey = "party1" | "party2";

export const setPartyField = (draft: Draft, party: PartyKey, field: keyof Party, value: string): Draft => ({
  ...draft,
  [party]: { ...draft[party], [field]: value },
});

export const setNdaField = <K extends keyof NdaTerms>(draft: Draft, field: K, value: NdaTerms[K]): Draft => ({
  ...draft,
  nda: { ...draft.nda, [field]: value },
});

/** Sets a key term; an empty value removes it, so the agreement shows a blank line again. */
export function setTerm(draft: Draft, term: string, value: string): Draft {
  const terms = { ...draft.terms };
  if (value) terms[term] = value;
  else delete terms[term];
  return { ...draft, terms };
}
