# Prelegal frontend

Next.js app for Prelegal. It currently contains the **Mutual NDA Creator** prototype (Jira PL-3): fill in the key terms in a form, see the Common Paper Mutual NDA with those terms filled in, and download it.

## Running locally

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000.

## How it works

- `src/app/page.tsx` reads the Mutual NDA standard terms from `../templates/Mutual-NDA.md` (the repo-level templates directory) when the page is built.
- `src/lib/nda.ts` holds the form data model and builds the completed agreement (cover page + standard terms) as Markdown.
- `src/components/NdaCreator.tsx` renders the form, a live preview, and the downloads:
  - **Download Markdown** saves `Mutual-NDA.md`.
  - **Download PDF** opens the browser's print dialog with a print layout showing only the agreement; choose "Save as PDF".

The agreement text is the Common Paper Mutual NDA, free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Output is not legal advice.
