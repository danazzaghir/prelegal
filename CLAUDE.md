# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation supports all 11 documents in the catalog via AI chat, with real accounts and saved agreements (reset when the server restarts). All planned Jira tickets (PL-2 to PL-7) are built.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENROUTER_API_KEY in the .env file in the project root.

## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
Consider statically building the frontend and serving it via FastAPI, if that will work.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

## Implementation Status

### Completed
- PL-2: Common Paper templates in `templates/` and `catalog.json`
- PL-3: Mutual NDA creator with live preview and PDF download
- PL-4: Docker multi-stage build (Node frontend + Python backend); FastAPI backend with SQLite (fresh DB each container start); Next.js static export served by FastAPI at localhost:8000; start/stop scripts for Mac, Linux, Windows; placeholder login screen (replaced in PL-7)
- PL-5: AI chat replaces the NDA form. `POST /api/chat` calls gpt-oss-120b via LiteLLM/OpenRouter (Cerebras) with Structured Outputs and returns a reply plus field updates; the conversation lives in the browser only
- PL-6: all 11 documents. The backend reads parties and key terms from the template markup (`documents.py`, `GET /api/documents/{id}`); the AI picks the document (or suggests the closest one), always asks a follow-on question, and fills in key terms; the page is `/documents/`. The NDA keeps its own cover page; other documents get a key terms table
- PL-7: real accounts (`auth.py`: scrypt-hashed passwords, an HttpOnly session cookie; `/api/auth/signup`, `signin`, `signout`, `me`), sign-in required for every API except health; saved agreements (`agreements.py`, `/api/agreements`), auto-saved after each chat reply and listed on `/dashboard/`, reopened at `/documents/?id=N`; a draft notice above the agreement and at the top of every cover page (so in every PDF); polished sign-in, sign-up, dashboard and creator screens with a shared header

### How the AI chat works (backend)
- `models.py` holds the request/response models, `prompts.py` the system prompt, `chat.py` the LLM call and `POST /api/chat`.
- The response has a required `question` field, appended to the reply, so every reply ends with a follow-on question (prompt instructions alone were not reliable).
- When the AI chooses or switches document, the backend calls it a second time with that document's terms in the prompt.
- LLM call: Cerebras is the preferred OpenRouter provider, with fallback to other providers allowed (the user's choice); `max_tokens` 2000; timeout 30s with one retry (a plain loop: LiteLLM's `num_retries` needs `tenacity`); a 402 from OpenRouter is not retried and shows an "out of credit" message.

### Frontend notes
- Next.js remounts a page when its query string changes, so the creator lives in `app/documents/layout.tsx`; `DocumentsRoute.tsx` decides when to start a fresh creator and adds `?id=` after the first save.
- Next.js prefetches page data as `__next.<segment>.__PAGE__.txt` but the static export writes `__next.<segment>/__PAGE__.txt`; `FrontendFiles` in `main.py` maps one to the other.

### Known issues
- The OpenRouter account is low on credit. OpenRouter then skips Cerebras and falls back to slower providers, which can take minutes or return unusable output, and it can refuse requests outright (402). The live AI browser tests (`npm run test:e2e`) fail until it is topped up.
- `/api/chat` requires sign-in, but there is no rate limit: any signed-up user can use the OpenRouter credit.
- The old `/nda/` page no longer exists; the app lives at `/documents/`.