# Prelegal

A platform for drafting common legal agreements from standard templates.

Prelegal fills in [Common Paper](https://commonpaper.com) standard agreements with your details and gives you a finished document to review, sign and share. The goal is a SaaS product where you describe what you need in an AI chat and Prelegal works out which agreement you want and fills in its fields.

## Status

Early development. Today Prelegal has:

- **Mutual NDA Creator**: fill in the key terms in a form, see the Common Paper Mutual NDA update live, and download it as a PDF.
- **Sign-in screen (placeholder)**: any email and password take you into the platform. Real accounts are planned.
- **Foundation for v1**: FastAPI backend, SQLite database, Docker packaging and start/stop scripts.

Planned: AI chat to choose and fill in agreements, the rest of the templates, real sign up and sign in, and saved documents.

## Supported agreements

The templates are in [`templates/`](templates/) and listed in [`catalog.json`](catalog.json):

| Agreement | Available in the app |
|-----------|----------------------|
| Mutual Non-Disclosure Agreement (with cover page) | Yes |
| AI Addendum | Planned |
| Business Associate Agreement (BAA) | Planned |
| Cloud Service Agreement (CSA) | Planned |
| Data Processing Agreement (DPA) | Planned |
| Design Partner Agreement | Planned |
| Partnership Agreement | Planned |
| Pilot Agreement | Planned |
| Professional Services Agreement (PSA) | Planned |
| Service Level Agreement (SLA) | Planned |
| Software License Agreement | Planned |

## Installation

Prelegal runs as a single Docker container: the FastAPI backend serves the API and the statically built frontend at **http://localhost:8000**.

1. Install [Docker](https://docs.docker.com/get-docker/) and start it.
2. Clone this repository.
3. Optional: create a `.env` file in the repo root for secrets (for example `OPENROUTER_API_KEY`, needed by the upcoming AI features). It is passed into the container and never committed.
4. From the repo root, run the start script for your OS:

| OS | Start | Stop |
|----|-------|------|
| Mac | `scripts/start-mac.sh` | `scripts/stop-mac.sh` |
| Linux | `scripts/start-linux.sh` | `scripts/stop-linux.sh` |
| Windows (PowerShell) | `scripts\start-windows.ps1` | `scripts\stop-windows.ps1` |

The start script builds the image, starts the container and waits until it is ready. The SQLite database lives inside the container and is created from scratch every time it starts, so stopping Prelegal discards all data.

## Usage

1. Open http://localhost:8000 and sign in with any email and password.
2. In the Mutual NDA Creator, fill in the purpose, effective date, terms, governing law and both parties. The agreement on the right updates as you type; blank fields show a line to fill in by hand.
3. Click **Download PDF** and choose "Save as PDF" in the print dialog. The PDF has only the agreement: the cover page, then the Standard Terms on a new page.
4. Click **Sign out** when you are done.

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

# Backend at http://localhost:8000, serving the last frontend build
cd frontend && npm run build
cd ../backend && uv run prelegal-backend
```

Tests:

```bash
cd backend && uv run pytest        # backend
cd frontend && npm test            # frontend unit and component tests
cd frontend && npm run test:e2e    # browser tests (run `npx playwright install chromium` once)
```

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
