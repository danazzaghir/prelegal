# prelegal
A platform for drafting common legal agreements

> **🚧 Work in progress:** This project is under active development and is expected to be completed within the next 3 hours.

## Running Prelegal

Prelegal runs as a single Docker container: the FastAPI backend serves the API and the statically built frontend at **http://localhost:8000**. Install [Docker](https://docs.docker.com/get-docker/) first, then from the repo root:

| OS | Start | Stop |
|----|-------|------|
| Mac | `scripts/start-mac.sh` | `scripts/stop-mac.sh` |
| Linux | `scripts/start-linux.sh` | `scripts/stop-linux.sh` |
| Windows | `scripts\start-windows.ps1` | `scripts\stop-windows.ps1` |

The start script builds the image, starts the container (passing in `.env` if there is one) and waits until `/api/health` responds. The SQLite database lives inside the container and is created from scratch every time it starts, so stopping Prelegal discards all data.

Sign-in is a placeholder for now: any email and password take you into the platform.

## Project layout

| Path | What it is |
|------|------------|
| `frontend/` | Next.js app, exported as static files (`npm run build` writes `frontend/out/`). See [frontend/README.md](frontend/README.md). |
| `backend/` | FastAPI app (uv project). See [backend/README.md](backend/README.md). |
| `templates/` | Common Paper agreement templates, listed in `catalog.json`. |
| `scripts/` | Start and stop scripts for each OS. |
| `Dockerfile` | Builds the frontend, then the backend image that serves it. |

## Development without Docker

```bash
# Frontend with hot reload at http://localhost:3000
cd frontend && npm install && npm run dev

# Backend at http://localhost:8000, serving the last frontend build
cd frontend && npm run build
cd ../backend && uv run prelegal-backend
```
