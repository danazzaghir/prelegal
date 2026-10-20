import fs from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeChatApi, requestBody, type UpdateChanges } from "@/test-utils/fakeChat";
import NdaCreator from "./NdaCreator";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const standardTerms = fs.readFileSync(
  path.join(__dirname, "..", "..", "..", "templates", "Mutual-NDA.md"),
  "utf-8",
);

function setup() {
  const user = userEvent.setup();
  render(<NdaCreator standardTerms={standardTerms} />);
  const preview = screen.getByRole("article");
  return { user, preview };
}

/** Sends a chat message and waits for the AI's (fake) reply. */
async function say(user: ReturnType<typeof userEvent.setup>, text: string, reply = "Got it.") {
  await user.type(screen.getByLabelText("Message"), `${text}{Enter}`);
  await screen.findByText(reply);
}

/** Sends one message whose fake AI reply makes the given updates. */
async function chatUpdates(user: ReturnType<typeof userEvent.setup>, changes: UpdateChanges) {
  fakeChatApi({ reply: "Got it.", updates: changes });
  await say(user, "Here are the details");
}

/** Text of the paragraph that follows a cover page heading in the preview. */
function sectionText(preview: HTMLElement, heading: string): string {
  const h = within(preview).getByRole("heading", { level: 3, name: heading });
  return h.nextElementSibling?.textContent ?? "";
}

function signatureRow(preview: HTMLElement, label: string): string[] {
  const row = within(preview).getByRole("row", { name: new RegExp(`^${label}`) });
  return within(row)
    .getAllByRole("cell")
    .map((c) => c.textContent ?? "");
}

describe("NdaCreator", () => {
  beforeEach(() => {
    // Only fake Date so userEvent's timers still run.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("initial state", () => {
    it("shows the title, sign out, download and the chat's send button", () => {
      setup();
      expect(screen.getByRole("heading", { level: 1, name: /Mutual NDA Creator/ })).toBeInTheDocument();
      const buttons = screen.getAllByRole("button").map((b) => b.textContent);
      expect(buttons).toEqual(["Sign out", "Download PDF", "Send"]);
    });

    it("replaces the old form with the chat", () => {
      setup();
      expect(screen.getByRole("region", { name: "Chat with the Prelegal assistant" })).toBeInTheDocument();
      expect(screen.queryByLabelText(/^Purpose/)).not.toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Party 1" })).not.toBeInTheDocument();
    });

    it("previews the cover page with defaults and blanks", () => {
      const { preview } = setup();
      expect(within(preview).getByRole("heading", { level: 1, name: "Mutual Non-Disclosure Agreement" })).toBeInTheDocument();
      expect(sectionText(preview, "Purpose")).toBe(
        "Evaluating whether to enter into a business relationship with the other party.",
      );
      expect(sectionText(preview, "Effective Date")).toBe("October 16, 2026");
      expect(sectionText(preview, "MNDA Term")).toBe("Expires 1 year from Effective Date.");
      expect(sectionText(preview, "Term of Confidentiality")).toMatch(/^1 year from Effective Date/);
      expect(sectionText(preview, "Governing Law & Jurisdiction")).toBe("Governing Law: ________________");
      expect(sectionText(preview, "MNDA Modifications")).toBe("None.");
    });

    it("previews the full standard terms with no template markup", () => {
      const { preview } = setup();
      expect(within(preview).getByRole("heading", { level: 1, name: "Standard Terms" })).toBeInTheDocument();
      expect(within(preview).getByText("Equitable Relief")).toBeInTheDocument();
      expect(within(preview).getAllByRole("listitem")).toHaveLength(11);
      expect(preview.innerHTML).not.toContain("coverpage_link");
      expect(preview.textContent).not.toContain("<span");
    });

    it("shows the CC BY 4.0 attribution", () => {
      setup();
      const links = screen.getAllByRole("link", { name: "CC BY 4.0" });
      expect(links.length).toBeGreaterThanOrEqual(1);
      for (const link of links) {
        expect(link).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
      }
    });

    it("keeps the link to the Common Paper standard", () => {
      const { preview } = setup();
      expect(within(preview).getByRole("link", { name: "commonpaper.com/standards/mutual-nda/1.0" })).toHaveAttribute(
        "href",
        "https://commonpaper.com/standards/mutual-nda/1.0",
      );
    });
  });

  describe("chat fills in the document", () => {
    it("sends the current fields and today's date with the conversation", async () => {
      const fetchMock = fakeChatApi({ reply: "Got it." });
      const { user } = setup();
      await say(user, "Acme and Globex");
      const body = requestBody(fetchMock);
      expect(body.today).toBe("2026-10-16");
      expect(body.fields.effectiveDate).toBe("2026-10-16");
      expect(body.fields.purpose).toMatch(/^Evaluating whether/);
      expect(body.messages.at(-1)).toEqual({ role: "user", content: "Acme and Globex" });
    });

    it("fills in both parties in the signature table", async () => {
      const { user, preview } = setup();
      await chatUpdates(user, {
        party1: { name: "Ada Lovelace", title: "CEO", company: "Analytical Ltd", noticeAddress: "ada@analytical.example" },
        party2: { name: "Alan Turing", title: "CTO", company: "Enigma Inc", noticeAddress: "alan@enigma.example" },
      });
      expect(signatureRow(preview, "Print Name")).toEqual(["Print Name", "Ada Lovelace", "Alan Turing"]);
      expect(signatureRow(preview, "Title")).toEqual(["Title", "CEO", "CTO"]);
      expect(signatureRow(preview, "Company")).toEqual(["Company", "Analytical Ltd", "Enigma Inc"]);
      expect(signatureRow(preview, "Notice Address")).toEqual([
        "Notice Address",
        "ada@analytical.example",
        "alan@enigma.example",
      ]);
    });

    it("fills in purpose, date, law, jurisdiction and modifications", async () => {
      const { user, preview } = setup();
      await chatUpdates(user, {
        purpose: "Discussing an acquisition.",
        effectiveDate: "2027-03-05",
        governingLaw: "Delaware",
        jurisdiction: "New Castle, DE",
        modifications: "Section 10 does not apply.",
      });
      expect(sectionText(preview, "Purpose")).toBe("Discussing an acquisition.");
      expect(sectionText(preview, "Effective Date")).toBe("March 5, 2027");
      expect(within(preview).getByText("Governing Law: Delaware")).toBeInTheDocument();
      expect(within(preview).getByText("Jurisdiction: New Castle, DE")).toBeInTheDocument();
      expect(sectionText(preview, "MNDA Modifications")).toBe("Section 10 does not apply.");
    });

    it("changes the term options", async () => {
      const { user, preview } = setup();
      await chatUpdates(user, { mndaTermType: "untilTerminated", confidentialityTermYears: 5 });
      expect(sectionText(preview, "MNDA Term")).toBe("Continues until terminated in accordance with the terms of the MNDA.");
      expect(sectionText(preview, "Term of Confidentiality")).toMatch(/^5 years from Effective Date, but in the case of trade secrets/);
    });

    it("keeps earlier answers when later replies change other fields", async () => {
      const { user, preview } = setup();
      fakeChatApi(
        { reply: "Who is the other party?", updates: { party1: { company: "Acme Inc" } } },
        { reply: "Which state's law?", updates: { party2: { company: "Globex LLC" } } },
      );
      await say(user, "Acme Inc", "Who is the other party?");
      await say(user, "Globex LLC", "Which state's law?");
      expect(signatureRow(preview, "Company")).toEqual(["Company", "Acme Inc", "Globex LLC"]);
    });

    it("leaves the document unchanged when the AI call fails", async () => {
      fakeChatApi({ status: 502, detail: "The AI assistant didn't respond. Please try again." });
      const { user, preview } = setup();
      const before = preview.textContent;
      await user.type(screen.getByLabelText("Message"), "Acme Inc{Enter}");
      expect(await screen.findByRole("alert")).toHaveTextContent("didn't respond");
      expect(preview.textContent).toBe(before);
    });
  });

  describe("document formatting", () => {
    it("puts a multi-line address on one row", async () => {
      const { user, preview } = setup();
      await chatUpdates(user, { party1: { noticeAddress: "1 Main St\nSpringfield, IL" } });
      expect(signatureRow(preview, "Notice Address")[1]).toBe("1 Main St, Springfield, IL");
    });

    it("shows email addresses as plain text, not links", async () => {
      const { user, preview } = setup();
      await chatUpdates(user, { party1: { noticeAddress: "ada@analytical.example" } });
      expect(signatureRow(preview, "Notice Address")[1]).toBe("ada@analytical.example");
      expect(preview.querySelector('a[href^="mailto:"]')).toBeNull();
    });

    it("does not let a pipe character break the signature table", async () => {
      const { user, preview } = setup();
      await chatUpdates(user, { party1: { name: "A | B" } });
      expect(signatureRow(preview, "Print Name")).toEqual(["Print Name", "A | B", ""]);
    });

    it("keeps a filled-in field when the AI sends an empty value", async () => {
      const { user, preview } = setup();
      await chatUpdates(user, { purpose: "" });
      expect(sectionText(preview, "Purpose")).toBe(
        "Evaluating whether to enter into a business relationship with the other party.",
      );
    });
  });

  describe("safety", () => {
    it("shows HTML from the AI's field values as text instead of rendering it", async () => {
      const { user, preview } = setup();
      await chatUpdates(user, { purpose: '<img src=x onerror="alert(1)"><b>bold</b>' });
      expect(preview.querySelector("img")).toBeNull();
      expect(preview.querySelector("b")).toBeNull();
    });

    it("does not render javascript: links from the AI's field values", async () => {
      const { user, preview } = setup();
      await chatUpdates(user, { modifications: "[click](javascript:alert(1))" });
      for (const link of within(preview).queryAllByRole("link")) {
        expect(link.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
      }
    });
  });

  describe("download", () => {
    it("opens the print dialog to save a PDF", async () => {
      const print = vi.spyOn(window, "print").mockImplementation(() => {});
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Download PDF" }));
      expect(print).toHaveBeenCalledTimes(1);
      print.mockRestore();
    });
  });
});
