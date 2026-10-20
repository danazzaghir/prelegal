import { api } from "@/lib/api";

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
