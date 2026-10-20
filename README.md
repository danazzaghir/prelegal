# Prelegal

A platform for drafting common legal agreements from standard templates.

Prelegal fills in [Common Paper](https://commonpaper.com) standard agreements with your details and gives you a finished document to review, sign and share. The goal is a SaaS product where you describe what you need in an AI chat and Prelegal works out which agreement you want and fills in its fields.

## Status

Early development. Today Prelegal has:

- **AI document creator**: tell the assistant what you need. It picks the right Common Paper agreement (or suggests the closest one if it can't draft what you asked for), asks about the parties and terms, fills in the agreement as you answer, and you download it as a PDF. All 11 agreements below are supported.
- **Accounts**: sign up with your name, email and password, and sign in again later. Everything except the sign-in and sign-up pages needs an account.
- **My agreements**: every agreement is saved as you chat. Come back to it from the dashboard to keep chatting or download it again.
- **Draft notice**: each agreement says it is a draft for a qualified lawyer to review, on screen and in the PDF.
- **Foundation**: FastAPI backend, SQLite database, Docker packaging and start/stop scripts.

The database starts empty every time Prelegal starts, so accounts and saved agreements last until it is restarted.

## Supported agreements

The templates are in [`templates/`](templates/) and listed in [`catalog.json`](catalog.json):

| Agreement | Available in the app |
|-----------|----------------------|
| Mutual Non-Disclosure Agreement (with its own cover page) | Yes |
| AI Addendum | Yes |
| Business Associate Agreement (BAA) | Yes |
| Cloud Service Agreement (CSA) | Yes |
| Data Processing Agreement (DPA) | Yes |
| Design Partner Agreement | Yes |
| Partnership Agreement | Yes |
| Pilot Agreement | Yes |
| Professional Services Agreement (PSA) | Yes |
| Service Level Agreement (SLA) | Yes |
| Software License Agreement | Yes |

## Installation

Prelegal runs as a single Docker container: the FastAPI backend serves the API and the statically built frontend at **http://localhost:8000**.

1. Install [Docker](https://docs.docker.com/get-docker/) and start it.
2. Clone this repository.
3. Create a `.env` file in the repo root containing `OPENROUTER_API_KEY=<your key>`. The AI chat needs it ([get a key from OpenRouter](https://openrouter.ai/keys)). The file is passed into the container and never committed.
4. From the repo root, run the start script for your OS:

| OS | Start | Stop |
|----|-------|------|
| Mac | `scripts/start-mac.sh` | `scripts/stop-mac.sh` |
| Linux | `scripts/start-linux.sh` | `scripts/stop-linux.sh` |
| Windows (PowerShell) | `scripts\start-windows.ps1` | `scripts\stop-windows.ps1` |

The start script builds the image, starts the container and waits until it is ready. The SQLite database lives inside the container and is created from scratch every time it starts, so stopping Prelegal discards all data.

## Usage

1. Open http://localhost:8000 and create an account (or sign in).
2. On **My agreements**, click **New agreement**. In the document creator, chat with the assistant: say what agreement you need and who it's between, then answer its questions. The agreement on the right updates after each answer; fields still blank show a line to fill in by hand. You can ask for a different agreement at any time, which starts a fresh draft. Press Enter to send, Shift+Enter for a new line.
3. Click **Download PDF** and choose "Save as PDF" in the print dialog. The PDF has only the agreement: the cover page (key terms and signatures), then the Standard Terms on a new page.
4. Your agreement is saved after every reply (the header shows "Saved"). It appears on **My agreements**, where you can open it to keep chatting, or delete it.
5. Click **Sign out** when you are done.

## Project layout

| Path | What it is |
|------|------------|
| `frontend/` | Next.js app, exported as static files (`npm run build` writes `frontend/out/`). See [frontend/README.md](frontend/README.md). |
| `backend/` | FastAPI app (uv project). See [backend/README.md](backend/README.md). |
| `templates/` | Common Paper agreement templates, listed in `catalog.json`. |
| `scripts/` | Start and stop scripts for each OS. |
| `Dockerfile` | Builds the frontend, then the backend image that serves it. |

## Development without Docker

You need Node.js 24 and [uv](https://docs.astral.sh/uv/).

```bash
# Frontend with hot reload at http://localhost:3000
cd frontend && npm install && npm run dev

# Backend at http://localhost:8000, serving the last frontend build.
# It reads OPENROUTER_API_KEY from the repo's .env. `npm run dev` sends /api calls
# here; set BACKEND_URL to use another address.
cd frontend && npm run build
cd ../backend && uv run prelegal-backend
```

Tests:

```bash
cd backend && uv run pytest        # backend
cd frontend && npm test            # frontend unit and component tests
cd frontend && npm run test:e2e    # browser tests (run `npx playwright install chromium` once)
```

The browser tests include a few conversations with the real AI model, so they need `OPENROUTER_API_KEY` in `.env` and use a small amount of API credit.

## Contributing

1. Work from a Jira ticket in the PL project, on a branch named after it (for example `feature/PL-5-short-name`).
2. Add unit tests and browser tests for your change, and run all the test suites above. Update the manual test plan in [`frontend/MANUAL_TESTS.md`](frontend/MANUAL_TESTS.md) if the change affects the UI.
3. Open a pull request against `main` that describes the change and how it was tested.

Project conventions, including the technical design and colour scheme, are in [CLAUDE.md](CLAUDE.md).

## License

The Prelegal code is released under the [MIT License](LICENSE).

The agreement templates in `templates/` are by Common Paper and are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); see [`templates/LICENSE.txt`](templates/LICENSE.txt).

## Disclaimer

Prelegal is not a law firm and does not provide legal advice. Documents it produces are based on standard templates and may not suit your situation. Have a qualified lawyer review any agreement before you sign it.
