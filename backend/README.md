# Prelegal backend

FastAPI app, managed with [uv](https://docs.astral.sh/uv/). It serves the API under `/api` and the statically exported frontend (`../frontend/out`) at every other path.

```bash
uv sync
uv run prelegal-backend   # http://localhost:8000
uv run pytest
```

On startup it creates the SQLite database from scratch (any previous file is deleted), with a `users` table ready for sign up and sign in.

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | `{"status": "ok", "database": "ok"}` when the API and database are up |

## Configuration

| Variable | Default | In Docker |
|----------|---------|-----------|
| `DATABASE_PATH` | `backend/data/prelegal.db` | `/app/data/prelegal.db` |
| `STATIC_DIR` | `frontend/out` | `/app/static` |
| `HOST` | `127.0.0.1` | `0.0.0.0` |
| `PORT` | `8000` | `8000` |
