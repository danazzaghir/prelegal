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
| `GET /api/documents/{id}` | One of the documents in `catalog.json`: id, name, description, the two party roles, the key terms, and its template as `standardTerms`; 404 for an unknown id |
| `POST /api/chat` | One turn of the AI chat. Send `{messages, draft, today}`, where `draft` holds the chosen `documentId` (or `null`), both parties, the NDA fields and other documents' key terms. Get back the `reply` (ending with a follow-on question), the `documentId` being drafted (`null` = no change), and party, NDA and key term updates (`null` = no change). Returns 503 if `OPENROUTER_API_KEY` is missing or the OpenRouter account is out of credit, and 502 if the AI call fails. |

## Configuration

| Variable | Default | In Docker |
|----------|---------|-----------|
| `DATABASE_PATH` | `backend/data/prelegal.db` | `/app/data/prelegal.db` |
| `STATIC_DIR` | `frontend/out` | `/app/static` |
| `HOST` | `127.0.0.1` | `0.0.0.0` |
| `PORT` | `8000` | `8000` |
| `TEMPLATES_DIR` | `templates` | `/app/templates` |
| `CATALOG_PATH` | `catalog.json` | `/app/catalog.json` |
| `OPENROUTER_API_KEY` | read from the repo's `.env` | passed in with `--env-file .env` |

## Documents

`src/prelegal_backend/documents.py` reads `catalog.json` and the templates at startup. "Mutual NDA Cover Page" is left out because it is part of the Mutual NDA. Each template marks its fill-in terms with spans such as `<span class="orderform_link">Subscription Period</span>`; their text, without possessives or plural duplicates, gives the document's terms. Customer, Company, Partner and Provider become the two parties, and the rest become key terms. Adding a template to the catalog needs no code changes.

## AI chat

`src/prelegal_backend/chat.py` uses LiteLLM to call `openai/gpt-oss-120b` through OpenRouter, with Cerebras as the preferred provider (OpenRouter may fall back to another one if Cerebras can't take a request), and Structured Outputs for the field updates.

- The prompt lists every document. Once one is chosen, it adds that document's party roles, key terms, current values and standard terms.
- When the AI chooses or switches document, the backend asks again straight away with that document in the prompt, so details the user already gave are filled in.
- Every response includes a follow-on question, which is appended to the reply.
- Updates for other documents' terms, unknown term names and empty values are dropped.
- Each call has a 30 second time limit and is retried once, except when the account is out of credit. Replies are capped at 2,000 tokens (a reply needs a few hundred).
