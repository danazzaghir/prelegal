# Manual test plan: Prelegal frontend

Run these before releasing changes to the document creator. The automated tests (`npm test`, `npm run test:e2e`) cover the logic and main flows; these checks focus on what a person needs to look at: layout, print output and real browser behaviour.

Start the app with `npm run dev` and open http://localhost:3000, or run the production setup with the start script for your OS in `scripts/` and open http://localhost:8000.

### Login (PL-4)

| # | Area | Steps | Expected result |
|---|------|-------|-----------------|
| L1 | Login screen | Open the site | Prelegal login screen with Email, Password and a purple **Sign in** button, and a note that any email and password will do. |
| L2 | Sign in | Enter any email and password, press **Sign in** (and once with Enter) | You land on the document creator at `/documents/`; your email shows in the header. |
| L3 | Validation | Press **Sign in** with empty fields, then with `abc` as the email | The browser asks you to fill in the fields / enter a valid email; you stay on the login screen. |
| L4 | Sign out | Press **Sign out** | Back on the login screen. Opening `/documents/` again shows no email in the header. |
| L5 | Docker | Run the start script for your OS, then the stop script | Start prints "Prelegal is running at http://localhost:8000" and the site works there; stop prints "Prelegal stopped." and the site is gone. |

### Document creator with AI chat (PL-3, PL-5, PL-6)

Open `/documents/` (sign in first, or go there directly). The chat needs `OPENROUTER_API_KEY` in the repo's `.env` and credit on the OpenRouter account.

| # | Area | Steps | Expected result |
|---|------|-------|-----------------|
| 1 | First load | Open the page | Chat on the left, an empty agreement panel on the right ("Your agreement will appear here…"), stacked on phones. The greeting asks what agreement you need. **Download PDF** is disabled; **Send** is purple. |
| 2 | Choosing | Describe a need without naming a document, e.g. "we sell SaaS to businesses" | The assistant picks a fitting agreement (here the Cloud Service Agreement); the header and agreement panel show it, with a cover page, key terms table, signature table and standard terms. |
| 3 | Unsupported | Ask for an employment contract, a lease or a will | The assistant says it can't draft that, suggests the closest agreement and asks if you want it. Nothing is chosen until you agree. |
| 4 | Every document | Over several sessions, ask for each of the 11 agreements by name | Each loads with the right parties (e.g. Customer/Provider, Company/Partner) and key terms; no template markup is visible. |
| 5 | Filling in | Give both parties (company, signer, title, email) and some key terms in one message | Values appear in the right places: company names under Parties and in the signature table, the signer's name (not the company) under Print Name, key terms in the table. Fields not given show a blank line. |
| 6 | Follow-on questions | Answer the assistant's questions one at a time until the agreement is complete | Every reply ends with a question about what is still missing, at most two things at a time. When everything is filled in, it says the agreement is ready and asks if you want to change anything. It never invents names, companies, addresses or amounts. |
| 7 | Focus | Send a message with Enter, then another by clicking **Send** | After each reply, the cursor is back in the message box, so you can type straight away. |
| 8 | Switching | Part-way through, ask for a different agreement | The new agreement replaces the old one with a fresh draft; the assistant re-uses details from the conversation that still apply. |
| 9 | Mutual NDA | Ask for a mutual NDA and go through it | It keeps its own cover page (Purpose, MNDA Term, Term of Confidentiality, Governing Law & Jurisdiction) rather than a key terms table. Asking to "continue until terminated" or "protect forever" updates the term wording. |
| 10 | Chat controls | Shift+Enter for a new line; try to send an empty message | Shift+Enter adds a line; an empty message is not sent. While waiting, "Thinking…" shows and Send is disabled. |
| 11 | AI unavailable | Remove `OPENROUTER_API_KEY` (or use an account with no credit) and restart, then send a message | A red error explains the problem; your message goes back into the box; the agreement does not change. |
| 12 | Unsafe input | Ask the assistant to set a key term to `<b>bold</b>` and another to `[x](javascript:alert(1))` | Shown as text; nothing is bolded and no clickable javascript link appears. |
| 13 | Download PDF | For an NDA and for a long agreement (e.g. the Software License Agreement), click **Download PDF**, choose "Save as PDF", open the file | Only the agreement is included (no chat, header or footer). Cover page first; Standard Terms start on a new page; tables are not split across pages. The CC BY 4.0 attribution is present. |
| 14 | Phone layout | Open on a phone or a 375px-wide window with a long agreement chosen | No sideways scrolling. The chat is a fixed-height box above the agreement and scrolls to the newest message. |
| 15 | Console | Open browser dev tools while chatting in `npm run dev` | No errors or hydration warnings. |

## Last run (PL-6)

20 October 2026, by Claude Code on the `feature/PL-6-all-documents` branch:

- Covered by automated tests: 1, 2, 3, 5, 6, 7, 8, 9 (live AI browser tests for choosing the CSA, an unsupported request, the NDA and switching, plus faked-AI component and browser tests); 10, 11, 12, 13, 14 (component and browser tests, a generated PDF, no sideways scrolling with the longest document).
- 4 (every document): all 11 templates are parsed in backend tests (parties and key terms checked); not yet opened one by one in the app by a person.
- The live AI tests passed whenever the AI answered, but several runs failed because the OpenRouter account ran out of credit, and with provider fallback allowed some replies came from slower providers (up to 2 minutes). Re-run them once the account has credit.
- Not yet done by a person: 4, 6 (judging the wording of the assistant's questions), 13 (open the saved PDFs), and testing in Safari and Firefox.

## Previous run (PL-5)

20 October 2026, by Claude Code on the `feature/PL-5-ai-chat` branch:

- Done by inspecting screenshots after a live AI conversation, on the build served by FastAPI (Chromium, desktop 1400px and Pixel 7): 1, 2, 12 (no sideways scrolling on either).
- Covered by automated tests: 2, 3 (no invented details), 4 (live AI browser tests, passed 12 of 12 repeated runs); 6, 7, 8, 9, 10 (component and browser tests); 11 (print layout and a generated PDF).
- Checked by hand: `npm run dev` sends `/api/chat` to the backend; the Docker image builds and the chat works inside it with `.env` passed in.
- Not yet done by a person: 5 (the assistant's wording about defaults), 11 (open the saved PDF and look at it), 13 (keyboard), and testing in Safari and Firefox.

## Previous run (PL-4)

16 October 2026, by Claude Code on the `feature/PL-4-v1-foundation` branch:

- Done by inspecting screenshots of the build served by FastAPI (Chromium, desktop 1400px and Pixel 7): L1, L2, 1.
- Covered by automated tests: L2, L3, L4 (Playwright and component tests).
- L5 not run: Docker is not installed on the machine used. The start and stop scripts were run against a stub `docker` command and the real backend, which checked their argument handling, health polling and failure path, but not the image build itself.

## Previous run (PL-3)

16 October 2026, by Claude Code on the `feature/PL-3-mnda-creator` branch:

- Done by inspecting screenshots of the real app (Chromium, desktop 1400px, Pixel 7, iPhone SE): 1, 2, 3, 4, 5, 6, 7, 9, 11.
- Done with scripted browser checks: 8 (component tests), 10 (print layout and a generated PDF; page count checked, PDF not opened visually), 13 (dev server console clean).
- Not yet done by a person: 10 (open the saved PDF and look at it), 12 (keyboard), and testing in Safari and Firefox.

Issues found and fixed during this run:
- A blank Purpose or Effective date rendered as a horizontal rule instead of a blank line.
- The page scrolled sideways on phones (127px on a Pixel 7).
- Signature table labels broke mid-word on phones, and the party columns had uneven widths.
- Email addresses showed as blue mailto links.
