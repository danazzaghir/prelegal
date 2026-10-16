# Prelegal frontend

Next.js app for Prelegal. It currently contains the **Mutual NDA Creator** prototype (Jira PL-3): fill in the key terms in a form, see the Common Paper Mutual NDA with those terms filled in, and download it as a PDF.

## Running locally

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000.

## Testing

| Command | What it runs |
|---------|--------------|
| `npm test` | Unit tests for `src/lib/nda.ts` and component tests for the form and preview (Vitest + Testing Library, jsdom) |
| `npm run test:e2e` | Browser tests against a production build, on desktop and mobile Chromium (Playwright). Run `npx playwright install chromium` once first. |
| `npm run lint` | ESLint |

[`MANUAL_TESTS.md`](MANUAL_TESTS.md) is the manual test checklist, with the results of the last run.

## How it works

- `src/app/page.tsx` reads the Mutual NDA standard terms from `../templates/Mutual-NDA.md` (the repo-level templates directory) when the page is built.
- `src/lib/nda.ts` holds the form data model and builds the completed agreement (cover page + standard terms) as Markdown.
- `src/components/NdaCreator.tsx` renders the form and a live preview of that Markdown. **Download PDF** opens the browser's print dialog with a print layout showing only the agreement; choose "Save as PDF".

The agreement text is the Common Paper Mutual NDA, free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Output is not legal advice.
