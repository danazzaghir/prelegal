import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADA, chatRequests, fakeApi, fakeServer, requestsTo, savedAgreement, type TurnChanges } from "@/test-utils/fakeBackend";
import DocumentCreator from "./DocumentCreator";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/documents/" }));

type User = ReturnType<typeof userEvent.setup>;

/** Renders a new agreement for a signed-in user (unless fetch is already faked) and waits for the chat. */
async function setup({ savedId = null as number | null, fake = true } = {}) {
  if (fake) fakeApi();
  const user = userEvent.setup();
  const onCreated = vi.fn();
  render(<DocumentCreator savedId={savedId} onCreated={onCreated} />);
  await screen.findByLabelText("Message");
  const preview = screen.getByRole("article", { name: "Agreement" });
  return { user, preview, onCreated };
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
    router.push.mockClear();
    router.replace.mockClear();
  });

  describe("before a document is chosen", () => {
    it("shows the chat, an empty agreement and a disabled download", async () => {
      await setup();
      expect(screen.getByRole("heading", { level: 1, name: "New agreement" })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Chat with the Prelegal assistant" })).toBeInTheDocument();
      expect(screen.getByText(/Your agreement will appear here/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Download PDF" })).toBeDisabled();
    });

    it("sends an empty draft with no document", async () => {
      const { user } = await setup();
      const fetchMock = await chat(user, {});
      expect(chatRequests(fetchMock)[0].draft.documentId).toBeNull();
      expect(screen.getByText(/Your agreement will appear here/)).toBeInTheDocument();
    });

    it("shows the CC BY 4.0 attribution", async () => {
      await setup();
      expect(screen.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute(
        "href",
        "https://creativecommons.org/licenses/by/4.0/",
      );
    });
  });

  describe("a document from the catalog", () => {
    it("loads the chosen document and shows its cover page and standard terms", async () => {
      const { user, preview } = await setup();
      const fetchMock = await chat(user, { documentId: "Pilot-Agreement" });
      await coverPage(preview, "Pilot Agreement");
      expect(fetchMock).toHaveBeenCalledWith("/api/documents/Pilot-Agreement", expect.anything());
      // The page title, as well as the agreement's own.
      expect(screen.getAllByRole("heading", { level: 1, name: "Pilot Agreement" })).toHaveLength(2);
      expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
      expect(within(preview).getByRole("heading", { level: 2, name: "Cover Page" })).toBeInTheDocument();
      expect(within(preview).getByText(/During the Pilot Period and subject to the terms/)).toBeInTheDocument();
      expect(preview.innerHTML).not.toContain("orderform_link");
    });

    it("fills in key terms, parties and today's effective date", async () => {
      const { user, preview } = await setup();
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
      const { user, preview } = await setup();
      const fetchMock = await chat(user, { documentId: "Pilot-Agreement", terms: { "Pilot Period": "90 days" } });
      await coverPage(preview, "Pilot Agreement");
      const second = fakeApi({ reply: "Next" });
      await say(user, "more", "Next");
      const { draft } = chatRequests(second)[0];
      expect(draft.documentId).toBe("Pilot-Agreement");
      expect(draft.terms).toEqual({ "Pilot Period": "90 days", "Effective Date": "2026-10-16" });
      // The document was fetched once, not again for the second turn.
      expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/documents/"))).toHaveLength(1);
    });

    it("starts a fresh draft when the AI switches documents", async () => {
      const { user, preview } = await setup();
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
      const { user, preview } = await setup();
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
      expect(await within(preview).findByText("Something went wrong. Please try again.")).toBeInTheDocument();
      await say(user, "Try again", "Reply 2");
      await coverPage(preview, "Service Level Agreement");
    });

    it("explains when the document can't be loaded", async () => {
      const { user, preview } = await setup();
      await chat(user, { documentId: "no-such-document" });
      expect(await within(preview).findByText("Unknown document.")).toBeInTheDocument();
    });
  });

  describe("the Mutual NDA", () => {
    async function startNda(user: User, preview: HTMLElement, changes: TurnChanges = {}) {
      await chat(user, { documentId: "Mutual-NDA", ...changes });
      await coverPage(preview, "Mutual Non-Disclosure Agreement");
    }

    it("keeps its own cover page with defaults and today's date", async () => {
      const { user, preview } = await setup();
      await startNda(user, preview);
      expect(sectionText(preview, "Purpose")).toBe("Evaluating whether to enter into a business relationship with the other party.");
      expect(sectionText(preview, "Effective Date")).toBe("October 16, 2026");
      expect(sectionText(preview, "MNDA Term")).toBe("Expires 1 year from Effective Date.");
      expect(sectionText(preview, "Governing Law & Jurisdiction")).toBe("Governing Law: ________________");
      expect(within(preview).getByRole("heading", { level: 1, name: "Standard Terms" })).toBeInTheDocument();
      expect(within(preview).queryByRole("heading", { name: "Key Terms" })).not.toBeInTheDocument();
    });

    it("fills in NDA fields and both parties", async () => {
      const { user, preview } = await setup();
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
      const { user, preview } = await setup();
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
      const { user, preview } = await setup();
      await chat(user, { documentId: "sla" });
      await coverPage(preview, "Service Level Agreement");
      await user.click(screen.getByRole("button", { name: "Download PDF" }));
      expect(print).toHaveBeenCalledTimes(1);
      print.mockRestore();
    });
  });
  describe("signing in", () => {
    it("sends signed-out visitors to the sign-in screen", async () => {
      fakeServer({ user: null, agreements: [] });
      render(<DocumentCreator savedId={null} onCreated={vi.fn()} />);
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
      expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
    });

    it("shows who is signed in", async () => {
      await setup();
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "My agreements" })).toHaveAttribute("href", expect.stringMatching(/^\/dashboard\/?$/));
    });
  });

  describe("the draft disclaimer", () => {
    it("is shown above the agreement and printed at the top of it", async () => {
      const { user, preview } = await setup();
      expect(screen.getByRole("note")).toHaveTextContent(/This is a draft.*qualified lawyer review it before anyone signs/);
      await chat(user, { documentId: "sla" });
      await coverPage(preview, "Service Level Agreement");
      const notice = within(preview).getByText(/Draft for legal review/);
      expect(notice.tagName).toBe("EM");
      expect(notice).toHaveTextContent("Have a qualified lawyer review it before anyone signs it. It is not legal advice.");
    });

    it("is in the Mutual NDA too", async () => {
      const { user, preview } = await setup();
      await chat(user, { documentId: "Mutual-NDA" });
      await coverPage(preview, "Mutual Non-Disclosure Agreement");
      expect(within(preview).getByText(/Draft for legal review/)).toBeInTheDocument();
    });
  });

  describe("saving", () => {
    it("doesn't save before a document is chosen", async () => {
      const { user } = await setup();
      const fetchMock = await chat(user, {});
      expect(requestsTo(fetchMock, "/api/agreements")).toEqual([]);
      expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    });

    it("saves a new agreement after the first reply that chooses a document, then updates it", async () => {
      const { user, preview, onCreated } = await setup();
      const fetchMock = await chat(
        user,
        { documentId: "sla", terms: { "Target Uptime": "99.9%" } },
        { terms: { "Support Channel": "Email" } },
      );
      await coverPage(preview, "Service Level Agreement");
      await waitFor(() => expect(requestsTo(fetchMock, "/api/agreements/1", "PUT")).toHaveLength(1));

      const [created] = requestsTo(fetchMock, "/api/agreements");
      expect(created.draft.documentId).toBe("sla");
      expect(created.draft.terms).toEqual({ "Target Uptime": "99.9%" });
      expect(created.messages.map((m: { content: string }) => m.content)).toEqual([
        expect.stringMatching(/What kind of agreement/),
        "Message 1",
        "Reply 1",
      ]);
      expect(onCreated).toHaveBeenCalledWith(1);

      const [updated] = requestsTo(fetchMock, "/api/agreements/1", "PUT");
      expect(updated.draft.terms).toEqual({ "Target Uptime": "99.9%", "Support Channel": "Email" });
      expect(updated.messages).toHaveLength(5);
      expect(requestsTo(fetchMock, "/api/agreements")).toHaveLength(1);
      expect(await screen.findByText("Saved")).toBeInTheDocument();
    });

    it("says when saving failed", async () => {
      const { user, preview } = await setup();
      const api = fakeApi({ documentId: "sla", reply: "Reply 1" });
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>(async (input, init) =>
          String(input) === "/api/agreements" ? new Response("{}", { status: 500 }) : api(input, init),
        ),
      );
      await say(user, "An SLA", "Reply 1");
      await coverPage(preview, "Service Level Agreement");
      expect(await screen.findByText(/Not saved\. It will try again after your next message\./)).toBeInTheDocument();
    });
  });

  describe("reopening a saved agreement", () => {
    it("restores the conversation and the agreement, and keeps saving to it", async () => {
      const fetchMock = fakeServer(
        { user: ADA, agreements: [savedAgreement(7)] },
        { reply: "Noted.", terms: { "Uptime Credit": "10%" } },
      );
      const { user, preview, onCreated } = await setup({ savedId: 7, fake: false });
      expect(screen.getByText("Great. What uptime?")).toBeInTheDocument();
      await coverPage(preview, "Service Level Agreement");
      expect(row(preview, "Target Uptime")).toEqual(["Target Uptime", "99.9%"]);

      await say(user, "10% credit", "Noted.");
      await waitFor(() => expect(requestsTo(fetchMock, "/api/agreements/7", "PUT")).toHaveLength(1));
      const [saved] = requestsTo(fetchMock, "/api/agreements/7", "PUT");
      expect(saved.draft.terms).toEqual({ "Target Uptime": "99.9%", "Uptime Credit": "10%" });
      expect(saved.messages).toHaveLength(5);
      expect(onCreated).not.toHaveBeenCalled();
      expect(requestsTo(fetchMock, "/api/agreements")).toEqual([]);
    });

    it("explains when the agreement can't be opened", async () => {
      fakeServer({ user: ADA, agreements: [] });
      render(<DocumentCreator savedId={99} onCreated={vi.fn()} />);
      expect(await screen.findByRole("alert")).toHaveTextContent("Agreement not found.");
    });
  });
});
