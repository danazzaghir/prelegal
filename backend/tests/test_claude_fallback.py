from types import SimpleNamespace

import pytest

from prelegal_backend import chat as chat_module
from prelegal_backend import claude_fallback
from prelegal_backend.claude_fallback import ClaudeUnusable, call_claude, to_claude_messages
from prelegal_backend.models import ChatTurn

from .test_chat import turn

MESSAGES = [
    {"role": "system", "content": "You are Prelegal's assistant."},
    {"role": "assistant", "content": "What do you need?"},
    {"role": "user", "content": "An NDA"},
]


class FakeAnthropic:
    """Stands in for anthropic.Anthropic, recording what messages.parse was given."""

    calls: list[dict] = []
    result = SimpleNamespace(stop_reason="end_turn", parsed_output=ChatTurn.model_validate(turn("From Claude")))

    def __init__(self, **options):
        self.options = options
        self.messages = SimpleNamespace(parse=self.parse)

    def parse(self, **kwargs):
        FakeAnthropic.calls.append({**kwargs, "client_options": self.options})
        return FakeAnthropic.result


@pytest.fixture
def fake_claude(monkeypatch):
    FakeAnthropic.calls = []
    FakeAnthropic.result = SimpleNamespace(stop_reason="end_turn", parsed_output=ChatTurn.model_validate(turn("From Claude")))
    monkeypatch.setattr(claude_fallback.anthropic, "Anthropic", FakeAnthropic)
    return FakeAnthropic


class OutOfCredit(Exception):
    status_code = 402


def test_splits_the_system_prompt_and_starts_the_conversation_with_the_user():
    system, conversation = to_claude_messages(MESSAGES)
    assert system == "You are Prelegal's assistant."
    assert conversation == [
        {"role": "user", "content": "Hello."},
        {"role": "assistant", "content": "What do you need?"},
        {"role": "user", "content": "An NDA"},
    ]


def test_calls_claude_haiku_with_structured_outputs(fake_claude):
    result = call_claude(MESSAGES)
    assert result.reply == "From Claude"
    [call] = fake_claude.calls
    assert call["model"] == "claude-haiku-5-5"
    assert call["output_format"] is ChatTurn
    assert call["system"] == "You are Prelegal's assistant."
    assert call["messages"][0] == {"role": "user", "content": "Hello."}
    assert call["max_tokens"] == 16000


def test_a_refusal_is_not_used(fake_claude):
    fake_claude.result = SimpleNamespace(stop_reason="refusal", parsed_output=None)
    with pytest.raises(ClaudeUnusable):
        call_claude(MESSAGES)


def test_falls_back_to_claude_when_openrouter_is_out_of_credit(monkeypatch, fake_claude):
    monkeypatch.setenv("OPENROUTER_API_KEY", "or-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-key")
    monkeypatch.setattr(chat_module, "call_llm", lambda messages: (_ for _ in ()).throw(OutOfCredit("402")))
    assert chat_module.call_with_fallback(MESSAGES).reply == "From Claude"


def test_uses_openrouter_when_it_works(monkeypatch, fake_claude):
    monkeypatch.setenv("OPENROUTER_API_KEY", "or-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-key")
    monkeypatch.setattr(chat_module, "call_llm", lambda messages: ChatTurn.model_validate(turn("From OpenRouter")))
    assert chat_module.call_with_fallback(MESSAGES).reply == "From OpenRouter"
    assert fake_claude.calls == []


def test_without_an_anthropic_key_the_openrouter_error_stands(monkeypatch, fake_claude):
    monkeypatch.setenv("OPENROUTER_API_KEY", "or-key")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(chat_module, "call_llm", lambda messages: (_ for _ in ()).throw(OutOfCredit("402")))
    with pytest.raises(OutOfCredit):
        chat_module.call_with_fallback(MESSAGES)
    assert fake_claude.calls == []


def test_uses_claude_alone_when_there_is_no_openrouter_key(monkeypatch, fake_claude):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-key")
    assert chat_module.call_with_fallback(MESSAGES).reply == "From Claude"


def test_the_chat_works_end_to_end_through_the_fallback(client, monkeypatch, fake_claude):
    monkeypatch.setenv("OPENROUTER_API_KEY", "or-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-key")
    monkeypatch.setattr(chat_module, "call_llm", lambda messages: (_ for _ in ()).throw(OutOfCredit("402")))
    from .test_chat import chat_body

    response = client.post("/api/chat", json=chat_body(("user", "hi")))
    assert response.status_code == 200
    assert response.json()["reply"] == "From Claude"
