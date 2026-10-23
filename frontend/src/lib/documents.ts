import { api } from "@/lib/api";
import catalog from "../../../catalog.json";

/** A Common Paper document, as served by GET /api/documents/{id}. */
export type DocumentDetail = {
  id: string;
  name: string;
  description: string;
  parties: [string, string];
  terms: string[];
  standardTerms: string;
};

export const NDA_ID = "Mutual-NDA";
export const EFFECTIVE_DATE = "Effective Date";

export const fetchDocument = (id: string) => api<DocumentDetail>(`/api/documents/${encodeURIComponent(id)}`);

/**
 * The documents users can draft, in catalog order. Ids are the template file
 * names, as the backend uses them; the NDA cover page is part of the NDA.
 */
export const DOCUMENT_CHOICES: { id: string; name: string }[] = catalog.templates
  .map((t) => ({ id: t.filename.replace(/^.*\//, "").replace(/\.md$/, ""), name: t.name }))
  .filter((d) => d.id !== "Mutual-NDA-coverpage");
