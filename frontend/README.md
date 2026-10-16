# Prelegal frontend

Next.js app for Prelegal. It has two pages:

- `/`: a placeholder login screen (Jira PL-4). There is no authentication yet: any email and password bring the user into the platform.
- `/nda/`: the **Mutual NDA Creator** (Jira PL-3): fill in the key terms in a form, see the Common Paper Mutual NDA with those terms filled in, and download it as a PDF.

The app is built as a static export (`output: "export"` in `next.config.ts`): `npm run build` writes plain HTML, CSS and JS to `out/`, which the FastAPI backend in `../backend` serves in production.

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
| `npm test` | Unit tests for `src/lib` and component tests for the login screen, user menu, form and preview (Vitest + Testing Library, jsdom) |
| `npm run test:e2e` | Browser tests against the static build served by the FastAPI backend, on desktop and mobile Chromium (Playwright). Needs [uv](https://docs.astral.sh/uv/); set `UV="python -m uv"` if uv is installed as a Python package rather than on PATH. Run `npx playwright install chromium` once first. |
| `npm run lint` | ESLint |

[`MANUAL_TESTS.md`](MANUAL_TESTS.md) is the manual test checklist, with the results of the last run.

## How it works

- `src/app/page.tsx` is the login screen. `src/lib/session.ts` keeps the signed-in email in session storage, and `src/components/UserMenu.tsx` shows it with a **Sign out** button.
- `src/app/nda/page.tsx` reads the Mutual NDA standard terms from `../templates/Mutual-NDA.md` (the repo-level templates directory) when the page is built.
- `src/lib/nda.ts` holds the form data model and builds the completed agreement (cover page + standard terms) as Markdown.
- `src/components/NdaCreator.tsx` renders the form and a live preview of that Markdown. **Download PDF** opens the browser's print dialog with a print layout showing only the agreement; choose "Save as PDF".

The agreement text is the Common Paper Mutual NDA, free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Output is not legal advice.
