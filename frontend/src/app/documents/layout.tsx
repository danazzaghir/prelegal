import type { Metadata } from "next";
import { Suspense } from "react";
import DocumentsRoute from "@/components/DocumentsRoute";

export const metadata: Metadata = {
  title: "Document Creator · Prelegal",
  description: "Draft a legal agreement from Common Paper's standard templates by chatting with an AI assistant.",
};

/**
 * The creator lives in the layout rather than the page: Next.js remounts a page
 * whenever its query string changes, which would rebuild the creator
 * mid-conversation when it adds ?id= after the first save. DocumentsRoute
 * decides itself when to start afresh. (It reads ?id=, which needs a Suspense
 * boundary in a static export.)
 */
export default function DocumentsLayout({ children }: LayoutProps<"/documents">) {
  return (
    <>
      <Suspense>
        <DocumentsRoute />
      </Suspense>
      {children}
    </>
  );
}
