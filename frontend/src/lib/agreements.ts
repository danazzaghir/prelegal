import { api } from "@/lib/api";
import type { ChatMessage } from "@/lib/chat";
import type { Draft } from "@/lib/draft";

/** A saved agreement as listed on the dashboard. */
export type AgreementSummary = {
  id: number;
  documentId: string | null;
  title: string;
  createdAt: string; // ISO 8601, UTC
  updatedAt: string;
};

export type Agreement = AgreementSummary & { draft: Draft; messages: ChatMessage[] };

export const listAgreements = () => api<AgreementSummary[]>("/api/agreements");

export const getAgreement = (id: number) => api<Agreement>(`/api/agreements/${id}`);

export const createAgreement = (draft: Draft, messages: ChatMessage[]) =>
  api<Agreement>("/api/agreements", { method: "POST", body: { draft, messages } });

export const updateAgreement = (id: number, draft: Draft, messages: ChatMessage[]) =>
  api<Agreement>(`/api/agreements/${id}`, { method: "PUT", body: { draft, messages } });

export const deleteAgreement = (id: number) => api<void>(`/api/agreements/${id}`, { method: "DELETE" });

/** "just now", "5 minutes ago", "yesterday", or a date, for when an agreement was last edited. */
export function editedAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.round((now.getTime() - then.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
