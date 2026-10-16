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

### Mutual NDA Creator (PL-3)

Open `/nda/` (sign in first, or go there directly).

| # | Area | Steps | Expected result |
|---|------|-------|-----------------|
| 1 | First load | Open the page | Form on the left, agreement on the right (stacked on phones). Effective date is today. Buttons: **Sign out** and **Download PDF**. No Markdown download. |
| 2 | Live preview | Type in each field of the form | The matching part of the agreement updates as you type. |
| 3 | Parties | Fill in all four fields for Party 1 and Party 2 | Values appear in the correct column of the signature table. A two-line notice address shows on one line, separated by a comma. |
| 4 | Blanks | Clear Purpose, Effective date, Governing law and Jurisdiction | Each shows a blank line `________________` to fill in by hand, not a horizontal rule. The date stays blank (does not jump back to today). |
| 5 | MNDA term | Change years to 3; clear the box and type 2; select "Continues until terminated"; switch back | "Expires 3 years…", then "Expires 2 years…" (no "12"). The years box is disabled while "Continues until terminated" is selected and keeps its value when switching back. |
| 6 | Confidentiality term | Set years to 5, then select "In perpetuity" | "5 years from Effective Date, but in the case of trade secrets…", then "In perpetuity." with the years box disabled. |
| 7 | Modifications | Leave empty, then type a modification | "None." when empty; the typed text otherwise. |
| 8 | Unsafe input | Type `<b>bold</b>` and `[x](javascript:alert(1))` into Purpose and Modifications | Shown as text; nothing is bolded and no clickable javascript link appears. |
| 9 | Emails | Enter an email as a notice address | Shown as plain text in the table, not as a blue link. |
| 10 | Download PDF | Click **Download PDF**, choose "Save as PDF", open the file | Only the agreement is included (no form, header or footer). Cover page first; Standard Terms start on a new page; the signature table is not split across pages. All 11 sections and the CC BY 4.0 attribution are present. |
| 11 | Phone layout | Open on a phone or a 375px-wide window | No sideways scrolling. Form fields are full width. Signature table labels ("Signature", "Company") do not break mid-word. |
| 12 | Keyboard | Tab through the form; use arrow keys on the radio buttons | Every control can be reached and has a visible focus ring; radio groups switch with arrow keys. |
| 13 | Console | Open browser dev tools while using the page in `npm run dev` | No errors or hydration warnings. |

## Last run (PL-4)

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
