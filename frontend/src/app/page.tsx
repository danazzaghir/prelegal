import fs from "node:fs";
import path from "node:path";
import NdaCreator from "@/components/NdaCreator";

// The templates live at the repo root, one level above this app.
const standardTerms = fs.readFileSync(
  path.join(process.cwd(), "..", "templates", "Mutual-NDA.md"),
  "utf-8",
);

export default function Home() {
  return <NdaCreator standardTerms={standardTerms} />;
}
