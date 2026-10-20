import type { Metadata } from "next";
import DocumentCreator from "@/components/DocumentCreator";

export const metadata: Metadata = {
  title: "Document Creator · Prelegal",
  description: "Draft a legal agreement from Common Paper's standard templates by chatting with an AI assistant.",
};

export default function DocumentsPage() {
  return <DocumentCreator />;
}
