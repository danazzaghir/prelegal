# Manual test plan: Prelegal frontend

Run these before releasing changes to the NDA creator. The automated tests (`npm test`, `npm run test:e2e`) cover the logic and main flows; these checks focus on what a person needs to look at: layout, print output and real browser behaviour.

Start the app with `npm run dev` and open http://localhost:3000, or run the production setup with the start script for your OS in `scripts/` and open http://localhost:8000.

### Login (PL-4)

| # | Area | Steps | Expected result |
|---|------|-------|-----------------|
| L1 | Login screen | Open the site | Prelegal login screen with Email, Password and a purple **Sign in** button, and a note that any email and password will do. |
| L2 | Sign in | Enter any email and password, press **Sign in** (and once with Enter) | You land on the Mutual NDA Creator at `/nda/`; your email shows in the header. |
| L3 | Validation | Press **Sign in** with empty fields, then with `abc` as the email | The browser asks you to fill in the fields / enter a valid email; you stay on the login screen. |
| L4 | Sign out | Press **Sign out** | Back on the login screen. Opening `/nda/` again shows no email in the header. |
| L5 | Docker | Run the start script for your OS, then the stop script | Start prints "Prelegal is running at http://localhost:8000" and the site works there; stop prints "Prelegal stopped." and the site is gone. |

### Mutual NDA Creator with AI chat (PL-3, PL-5)

Open `/nda/` (sign in first, or go there directly). The chat needs `OPENROUTER_API_KEY` in the repo's `.env`.

| # | Area | Steps | Expected result |
|---|------|-------|-----------------|
| 1 | First load | Open the page | Chat on the left, agreement on the right (stacked on phones). The assistant's greeting asks who the two parties are. Effective date is today. Buttons: **Sign out**, **Download PDF** and a purple **Send**. No Markdown download. |
| 2 | Parties | Give both parties in one message: company, signer, title and email for each | After the reply, the values appear in the correct columns of the signature table, and the assistant asks about what is still missing. |
| 3 | Step by step | Answer the assistant's questions one at a time (governing law, jurisdiction, terms) | Each answer shows up in the agreement. Earlier answers stay. The assistant asks at most two questions at a time and does not invent names, companies or addresses. |
| 4 | Changes | Ask it to "make the NDA continue until terminated", "protect confidential information forever" and "start on March 5 next year" | MNDA Term reads "Continues until terminated…", Term of Confidentiality reads "In perpetuity.", Effective Date reads March 5 of next year. |
| 5 | Defaults | Before the end, check what the assistant says about the purpose and 1-year terms | It mentions the defaults once and asks if they are fine, instead of asking about each. When everything is filled in, it says the agreement is ready and points to **Download PDF**. |
| 6 | Chat controls | Press Enter to send; Shift+Enter for a new line; try to send an empty message | Enter sends and clears the box; Shift+Enter adds a line; an empty message is not sent (Send is disabled). While waiting, "Thinking…" shows and Send is disabled. |
| 7 | AI unavailable | Stop the app's internet access, or remove `OPENROUTER_API_KEY` and restart, then send a message | A red error message appears in the chat; your message goes back into the box so you can resend it; the agreement does not change. |
| 8 | Replies | Look at a reply that has a list | Lists and bold text are formatted; your own messages show exactly as typed. |
| 9 | Unsafe input | Ask the assistant to set the purpose to `<b>bold</b>` and the modifications to `[x](javascript:alert(1))` | Shown as text in the agreement; nothing is bolded and no clickable javascript link appears. |
| 10 | Emails and addresses | Give an email and a two-line postal address as notice addresses | The email shows as plain text, not a blue link. The two-line address shows on one row, separated by a comma. |
| 11 | Download PDF | Click **Download PDF**, choose "Save as PDF", open the file | Only the agreement is included (no chat, header or footer). Cover page first; Standard Terms start on a new page; the signature table is not split across pages. All 11 sections and the CC BY 4.0 attribution are present. |
| 12 | Phone layout | Open on a phone or a 375px-wide window | No sideways scrolling. The chat is a fixed-height box above the agreement and scrolls to the newest message. |
| 13 | Keyboard | Tab through the page | The message box, Send, Sign out and Download PDF can be reached and have a visible focus ring. |
| 14 | Console | Open browser dev tools while chatting in `npm run dev` | No errors or hydration warnings. |

## Last run (PL-5)

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
