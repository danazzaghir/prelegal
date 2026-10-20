"""Claude as a fallback for the AI chat, used when OpenRouter can't answer
(for example when the OpenRouter account is out of credit).

Needs ANTHROPIC_API_KEY. It takes the same messages as the OpenRouter call and
returns the same ChatTurn, using Claude's structured outputs.
"""

import os

import anthropic

from prelegal_backend.models import ChatTurn

CLAUDE_MODEL = "claude-haiku-5-5"
# A reply is a few hundred tokens; Haiku also thinks before answering.
CLAUDE_MAX_TOKENS = 16000
CLAUDE_TIMEOUT = 60


class ClaudeUnusable(Exception):
    """Claude answered, but not with a turn the chat can use (e.g. it declined)."""


def claude_available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def to_claude_messages(messages: list[dict[str, str]]) -> tuple[str, list[dict[str, str]]]:
    """Splits OpenAI-style messages into Claude's system prompt and conversation."""
    system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
    conversation = [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] != "system"]
    # The chat opens with the assistant's greeting, but Claude's conversation starts with the user.
    if conversation and conversation[0]["role"] == "assistant":
        conversation.insert(0, {"role": "user", "content": "Hello."})
    return system, conversation


def call_claude(messages: list[dict[str, str]]) -> ChatTurn:
    system, conversation = to_claude_messages(messages)
    client = anthropic.Anthropic(timeout=CLAUDE_TIMEOUT, max_retries=1)
    response = client.messages.parse(
        model=CLAUDE_MODEL,
        max_tokens=CLAUDE_MAX_TOKENS,
        system=system,
        messages=conversation,
        output_format=ChatTurn,
    )
    if response.stop_reason == "refusal" or response.parsed_output is None:
        raise ClaudeUnusable(f"Claude stopped with {response.stop_reason!r}")
    return response.parsed_output
