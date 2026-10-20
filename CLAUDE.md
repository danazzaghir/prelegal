# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation supports all 11 documents in the catalog via AI chat, behind a placeholder login. Real user authentication and document persistence are still to come (see Implementation Status).

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
- PL-4: Docker multi-stage build (Node frontend + Python backend); FastAPI backend with SQLite (fresh DB each container start, `users` table not yet used); Next.js static export served by FastAPI at localhost:8000; start/stop scripts for Mac, Linux, Windows; placeholder login screen (any email and password, kept in the browser only)
- PL-5: AI chat replaces the NDA form. `POST /api/chat` calls gpt-oss-120b via LiteLLM/OpenRouter (Cerebras) with Structured Outputs and returns a reply plus field updates; the conversation lives in the browser only
- PL-6: all 11 documents. The backend reads parties and key terms from the template markup (`documents.py`, `GET /api/documents/{id}`); the AI picks the document (or suggests the closest one), always asks a follow-on question, and fills in key terms; the page is `/documents/`. The NDA keeps its own cover page; other documents get a key terms table

### Not yet built
- PL-7: real sign up / sign in (no `/api/auth` routes exist yet), saved documents, UI polish, and a "draft, subject to legal review" disclaimer