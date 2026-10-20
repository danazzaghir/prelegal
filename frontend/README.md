# Prelegal frontend

Next.js app for Prelegal. It has two pages:

- `/`: a placeholder login screen (Jira PL-4). There is no authentication yet: any email and password bring the user into the platform.
- `/documents/`: the **document creator** (Jira PL-3, PL-5, PL-6): chat with an AI assistant, which picks one of the 11 Common Paper agreements (or suggests the closest one) and fills it in as you answer. The agreement updates live next to the chat and downloads as a PDF.

The app is built as a static export (`output: "export"` in `next.config.ts`): `npm run build` writes plain HTML, CSS and JS to `out/`, which the FastAPI backend in `../backend` serves in production.

## Running locally

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000. The chat needs the backend: run `uv run prelegal-backend` in `../backend` (port 8000, or set `BACKEND_URL`); `npm run dev` sends `/api` calls to it.

## Testing

| Command | What it runs |
|---------|--------------|
| `npm test` | Unit tests for `src/lib` and component tests for the login screen, user menu, chat and document creator, with the API faked (Vitest + Testing Library, jsdom) |
| `npm run test:e2e` | Browser tests against the static build served by the FastAPI backend, on desktop and mobile Chromium (Playwright). Needs [uv](https://docs.astral.sh/uv/); set `UV="python -m uv"` if uv is installed as a Python package rather than on PATH. Run `npx playwright install chromium` once first. A few tests talk to the real AI, so they need `OPENROUTER_API_KEY` in the repo's `.env` and credit on the OpenRouter account. |
| `npm run lint` | ESLint |

[`MANUAL_TESTS.md`](MANUAL_TESTS.md) is the manual test checklist, with the results of the last run.

## How it works

- `src/app/page.tsx` is the login screen. `src/lib/session.ts` keeps the signed-in email in session storage, and `src/components/UserMenu.tsx` shows it with a **Sign out** button.
- `src/app/documents/page.tsx` renders `src/components/DocumentCreator.tsx`: the chat (`Chat.tsx`) on one side and a live preview of the agreement on the other.
- Each chat turn sends the conversation and the current draft to `POST /api/chat` (`src/lib/chat.ts`). `src/lib/draft.ts` applies the AI's answer: the chosen document, party details and field values. Switching documents starts a fresh draft.
- When a document is chosen, its template comes from `GET /api/documents/{id}` (`src/lib/documents.ts`). The Mutual NDA keeps its own cover page (`src/lib/nda.ts`); other documents get a key terms cover page (`src/lib/agreement.ts`). Both are followed by the standard terms.
- **Download PDF** opens the browser's print dialog with a print layout showing only the agreement; choose "Save as PDF".

The agreement texts are Common Paper standard agreements, free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Output is not legal advice.
