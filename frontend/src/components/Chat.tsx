"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { submitClass } from "@/components/ui";
import { GREETING, sendChat, type ChatMessage, type ChatTurn } from "@/lib/chat";
import type { Draft } from "@/lib/draft";
import { todayIso } from "@/lib/nda";

// A reply steered by pasted text could use an image URL to send chat content elsewhere.
const NO_IMAGES = ["img"];

type Props = {
  // The draft as the AI should see it, with defaults filled in.
  draft: Draft;
  // A saved conversation to continue; a new chat starts with the greeting.
  initialMessages?: ChatMessage[];
  // Called with the AI's turn and the whole conversation, including its reply.
  onTurn: (turn: ChatTurn, messages: ChatMessage[]) => void;
};

/** Freeform chat with the AI, which picks the document and fills it in as the user answers. */
export default function Chat({ draft, initialMessages, onTurn }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => initialMessages ?? [{ role: "assistant", content: GREETING }],
  );
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, pending]);

  const send = async () => {
    const text = input.trim();
    if (!text || pending) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setError(null);
    setPending(true);
    try {
      const turn = await sendChat(history, draft, todayIso());
      const conversation: ChatMessage[] = [...history, { role: "assistant", content: turn.reply }];
      setMessages(conversation);
      onTurn(turn, conversation);
    } catch (e) {
      // Put the message back so the user can send it again.
      setMessages(messages);
      // Keep anything typed while waiting; otherwise restore the failed message.
      setInput((current) => current || text);
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
      // Ready for the next answer, even if Send was clicked rather than Enter pressed.
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <section
      aria-label="Chat with the Prelegal assistant"
      className="flex h-[32rem] flex-col rounded-lg border border-slate-200 bg-white shadow-sm lg:h-auto lg:min-h-0 print:hidden"
    >
      <ol ref={listRef} aria-label="Conversation" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message, i) => (
          <li key={i} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              data-role={message.role}
              className={
                message.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-lg bg-[#209dd7] px-3 py-2 text-sm text-white"
                  : "chat-markdown max-w-[85%] rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-900"
              }
            >
              {message.role === "user" ? (
                message.content
              ) : (
                <ReactMarkdown disallowedElements={NO_IMAGES}>{message.content}</ReactMarkdown>
              )}
            </div>
          </li>
        ))}
        {pending && (
          <li className="flex justify-start">
            <div role="status" className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-[#888888]">
              Thinking…
            </div>
          </li>
        )}
      </ol>

      {error && (
        <p role="alert" className="mx-4 mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form
        className="flex items-end gap-2 border-t border-slate-200 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          ref={inputRef}
          aria-label="Message"
          rows={2}
          placeholder="Type your answer…"
          className="min-w-0 flex-1 resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#209dd7] focus:outline-none focus:ring-1 focus:ring-[#209dd7]"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className={submitClass}
        >
          Send
        </button>
      </form>
    </section>
  );
}
