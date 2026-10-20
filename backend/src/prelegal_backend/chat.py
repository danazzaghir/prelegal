"""AI chat that fills in the Mutual NDA.

The browser keeps the conversation and the current fields, and sends both on
every turn. The AI answers with a reply and updates to any fields it learned.
"""

import json
import logging
import os
from collections.abc import Callable
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

logger = logging.getLogger(__name__)

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
# Seconds to wait for the AI before giving up; replies usually take a few.
TIMEOUT = 60

ISO_DATE = r"^\d{4}-\d{2}-\d{2}$"
ISO_DATE_OR_EMPTY = r"^(\d{4}-\d{2}-\d{2})?$"


class CamelModel(BaseModel):
    """Uses the frontend's camelCase field names in JSON."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


ShortText = Annotated[str, Field(max_length=500)]
LongText = Annotated[str, Field(max_length=4000)]


# What the browser sends. Field names must match NdaData in
# frontend/src/lib/nda.ts and NdaUpdates below (a test checks the latter).


class Party(CamelModel):
    name: ShortText
    title: ShortText
    company: ShortText
    notice_address: ShortText


class NdaFields(CamelModel):
    purpose: LongText
    effective_date: str = Field(pattern=ISO_DATE_OR_EMPTY)
    mnda_term_type: Literal["expires", "untilTerminated"]
    mnda_term_years: int
    confidentiality_term_type: Literal["years", "perpetuity"]
    confidentiality_term_years: int
    governing_law: ShortText
    jurisdiction: ShortText
    modifications: LongText
    party1: Party
    party2: Party


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: LongText


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=100)
    fields: NdaFields
    today: str = Field(pattern=ISO_DATE, description="The user's date, YYYY-MM-DD")


# What the AI returns, via Structured Outputs. Every field is required but
# nullable: null means "no change", so the AI can't wipe out a field by leaving it out.


class PartyUpdates(CamelModel):
    name: str | None
    title: str | None
    company: str | None
    notice_address: str | None


class NdaUpdates(CamelModel):
    purpose: str | None
    effective_date: str | None = Field(description="YYYY-MM-DD")
    mnda_term_type: Literal["expires", "untilTerminated"] | None
    mnda_term_years: int | None
    confidentiality_term_type: Literal["years", "perpetuity"] | None
    confidentiality_term_years: int | None
    governing_law: str | None
    jurisdiction: str | None
    modifications: str | None
    party1: PartyUpdates
    party2: PartyUpdates


class ChatTurn(CamelModel):
    reply: str
    updates: NdaUpdates


SYSTEM_PROMPT = """You are Prelegal's assistant. You help the user fill in a Mutual Non-Disclosure Agreement (MNDA) based on the Common Paper Mutual NDA standard terms. The user sees the agreement update live next to this chat.

The cover page fields are:
- purpose: how the parties may use each other's Confidential Information.
- effectiveDate: the date the MNDA starts, as YYYY-MM-DD.
- mndaTermType: "expires" (ends a number of years after the Effective Date) or "untilTerminated" (continues until a party terminates it).
- mndaTermYears: the number of years, when mndaTermType is "expires".
- confidentialityTermType: "years" (protected for a number of years after the Effective Date) or "perpetuity".
- confidentialityTermYears: the number of years, when confidentialityTermType is "years".
- governingLaw: the US state whose law governs, e.g. "Delaware".
- jurisdiction: the city or county and state whose courts hear disputes, e.g. "New Castle, DE".
- modifications: optional changes to the standard terms. Leave empty unless the user asks for changes.
- party1 and party2: for each party, the signer's name, their title, the company, and a notice address (an email or postal address).

How to behave:
- Be friendly, brief and plain-spoken. Ask at most two questions per reply, about the most important missing fields first: the parties, then governing law and jurisdiction.
- Some fields start with sensible defaults (the purpose, a 1-year MNDA term and 1-year confidentiality term). Near the end, mention the defaults in one sentence and ask if they are fine, rather than asking about each one.
- Whenever the user gives information, put it in "updates". Use null for every field that should not change.
- Never make up names, companies, addresses or dates. If something is unclear, ask.
- Convert dates the user gives into YYYY-MM-DD. Today is {today}; the effective date defaults to today.
- If the user asks to change a field, update it. If they ask about the agreement, answer briefly; you are not a lawyer and the document is a draft for legal review.
- When every field is filled in, say the agreement is ready and that they can download it with the "Download PDF" button.

The current values of the fields are:
{fields}
"""


def build_messages(request: ChatRequest) -> list[dict[str, str]]:
    fields = json.dumps(request.fields.model_dump(by_alias=True), indent=2)
    system = SYSTEM_PROMPT.format(today=request.today, fields=fields)
    return [{"role": "system", "content": system}] + [m.model_dump() for m in request.messages]


LlmCall = Callable[[list[dict[str, str]]], ChatTurn]


def call_llm(messages: list[dict[str, str]]) -> ChatTurn:
    from litellm import completion  # Slow to import, so only when first used.

    response = completion(
        model=MODEL,
        messages=messages,
        response_format=ChatTurn,
        reasoning_effort="low",
        extra_body=EXTRA_BODY,
        timeout=TIMEOUT,
    )
    return ChatTurn.model_validate_json(response.choices[0].message.content)


def get_llm() -> LlmCall:
    """The AI call, as a dependency so tests can replace it."""
    if not os.environ.get("OPENROUTER_API_KEY"):
        raise HTTPException(status_code=503, detail="AI chat is not set up: OPENROUTER_API_KEY is missing.")
    return call_llm


router = APIRouter(prefix="/api")


@router.post("/chat", response_model=ChatTurn, response_model_by_alias=True)
def chat(request: ChatRequest, llm: LlmCall = Depends(get_llm)) -> ChatTurn:
    if request.messages[-1].role != "user":
        raise HTTPException(status_code=422, detail="The last message must be from the user.")
    try:
        return llm(build_messages(request))
    except Exception:
        logger.exception("AI chat call failed")
        raise HTTPException(status_code=502, detail="The AI assistant didn't respond. Please try again.")
