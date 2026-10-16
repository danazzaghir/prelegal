import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import NdaCreator from "@/components/NdaCreator";

export const metadata: Metadata = {
  title: "Mutual NDA Creator · Prelegal",
  description: "Create a Mutual Non-Disclosure Agreement from the Common Paper standard terms.",
};

// The templates live at the repo root, one level above this app.
const standardTerms = fs.readFileSync(
  path.join(process.cwd(), "..", "templates", "Mutual-NDA.md"),
  "utf-8",
);

export default function NdaPage() {
  return <NdaCreator standardTerms={standardTerms} />;
}
