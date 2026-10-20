"""AI chat that works out which document the user needs and fills it in.

The browser keeps the conversation and the draft, and sends both on every turn.
The AI answers with a reply, a follow-on question, the document being drafted,
and updates to any fields it learned.
"""

import logging
import os
from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException, Request

from prelegal_backend.documents import NDA_ID, Document
from prelegal_backend.models import ChatRequest, ChatTurn, Draft, Party
from prelegal_backend.prompts import build_messages

logger = logging.getLogger(__name__)

MODEL = "openrouter/openai/gpt-oss-120b"
# Cerebras first. If it can't take the request (for example when the account is
# low on credit), OpenRouter may use another provider, which can be slower.
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
# Replies use a few hundred tokens. Without a cap, OpenRouter reserves credit for
# the model maximum (about 41k tokens) and skips Cerebras when credit is low; the
# cap also stops a fallback provider that rambles without finishing its answer.
MAX_TOKENS = 2000
# Replies usually take under 10 seconds. A stuck call is retried once rather
# than left waiting, so the user hears back within about a minute either way.
TIMEOUT = 30
RETRIES = 1


def append_question(turn: ChatTurn) -> ChatTurn:
    """Puts the follow-on question at the end of the reply, so every reply asks one."""
    question = turn.question.strip()
    reply = turn.reply.strip()
    if question and question not in reply:
        reply = f"{reply}\n\n{question}" if reply else question
    return turn.model_copy(update={"reply": reply, "question": question})


def clean_turn(turn: ChatTurn, current_id: str | None, documents: dict[str, Document]) -> ChatTurn:
    """Drops anything the AI returned that doesn't fit the document being drafted."""
    document_id = turn.document_id if turn.document_id in documents else None
    doc = documents.get(document_id or current_id or "")
    is_nda = doc is not None and doc.id == NDA_ID
    # The AI sometimes lists every term with "" for the ones it doesn't know yet.
    terms = [] if doc is None or is_nda else [u for u in turn.terms if u.term in doc.terms and u.value.strip()]
    return turn.model_copy(update={"document_id": document_id, "nda": turn.nda if is_nda else None, "terms": terms})


def draft_after_choosing(draft: Draft, document_id: str) -> Draft:
    """The draft as the browser will hold it once the AI chooses document_id."""
    if draft.document_id is None:
        return draft.model_copy(update={"document_id": document_id})
    # Switching starts a fresh draft (the browser does the same).
    empty = Party(name="", title="", company="", notice_address="")
    return draft.model_copy(update={"document_id": document_id, "party1": empty, "party2": empty, "terms": {}})


LlmCall = Callable[[list[dict[str, str]]], ChatTurn]


def call_llm(messages: list[dict[str, str]]) -> ChatTurn:
    from litellm import completion  # Slow to import, so only when first used.

    # A plain loop: LiteLLM's own num_retries needs the tenacity package.
    for attempt in range(RETRIES + 1):
        try:
            response = completion(
                model=MODEL,
                messages=messages,
                response_format=ChatTurn,
                reasoning_effort="low",
                max_tokens=MAX_TOKENS,
                extra_body=EXTRA_BODY,
                timeout=TIMEOUT,
            )
            return ChatTurn.model_validate_json(response.choices[0].message.content)
        except Exception as e:
            if attempt == RETRIES or is_out_of_credit(e):
                raise
            logger.warning("AI chat call failed; retrying", exc_info=True)
    raise AssertionError("unreachable")


def is_out_of_credit(error: Exception) -> bool:
    """OpenRouter answers 402 Payment Required when the account can't pay for a request."""
    return getattr(error, "status_code", None) == 402


def get_llm() -> LlmCall:
    """The AI call, as a dependency so tests can replace it."""
    if not os.environ.get("OPENROUTER_API_KEY"):
        raise HTTPException(status_code=503, detail="AI chat is not set up: OPENROUTER_API_KEY is missing.")
    return call_llm


def run_turn(body: ChatRequest, documents: dict[str, Document], llm: LlmCall) -> ChatTurn:
    current_id = body.draft.document_id
    turn = clean_turn(llm(build_messages(body, documents)), current_id, documents)
    new_id = turn.document_id
    if new_id is None or new_id == current_id:
        return append_question(turn)
    # The AI has just chosen a document without seeing its terms. Ask again with
    # them in the prompt, so the details the user already gave are filled in.
    body = body.model_copy(update={"draft": draft_after_choosing(body.draft, new_id)})
    try:
        retry = clean_turn(llm(build_messages(body, documents)), new_id, documents)
    except Exception:
        logger.exception("AI chat call with the chosen document failed; using the first answer")
        return append_question(turn)
    return append_question(retry.model_copy(update={"document_id": new_id}))


router = APIRouter(prefix="/api")


@router.post("/chat", response_model=ChatTurn, response_model_by_alias=True)
def chat(body: ChatRequest, request: Request, llm: LlmCall = Depends(get_llm)) -> ChatTurn:
    documents: dict[str, Document] = request.app.state.documents
    if body.messages[-1].role != "user":
        raise HTTPException(status_code=422, detail="The last message must be from the user.")
    if body.draft.document_id is not None and body.draft.document_id not in documents:
        raise HTTPException(status_code=422, detail="Unknown document.")
    try:
        return run_turn(body, documents, llm)
    except Exception as e:
        logger.exception("AI chat call failed")
        if is_out_of_credit(e):
            raise HTTPException(
                status_code=503, detail="The AI assistant is unavailable: the OpenRouter account is out of credit."
            )
        raise HTTPException(status_code=502, detail="The AI assistant didn't respond. Please try again.")
