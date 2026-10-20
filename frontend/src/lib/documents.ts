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

export async function fetchDocument(id: string): Promise<DocumentDetail> {
  const response = await fetch(`/api/documents/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(`Couldn't load the document (${response.status}).`);
  return (await response.json()) as DocumentDetail;
}
