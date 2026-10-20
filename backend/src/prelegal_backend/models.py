"""Request and response models for the API."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Uses the frontend's camelCase field names in JSON."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class DocumentOut(CamelModel):
    """A document as GET /api/documents/{id} serves it."""

    id: str
    name: str
    description: str
    parties: tuple[str, str]
    terms: list[str]
    standard_terms: str


# --- AI chat -------------------------------------------------------------------

ISO_DATE = r"^\d{4}-\d{2}-\d{2}$"
ISO_DATE_OR_EMPTY = r"^(\d{4}-\d{2}-\d{2})?$"

ShortText = Annotated[str, Field(max_length=500)]
LongText = Annotated[str, Field(max_length=4000)]


# What the browser sends. Field names match Draft in frontend/src/lib/draft.ts,
# and every field here has a matching update below (tests check this).


class Party(CamelModel):
    name: ShortText
    title: ShortText
    company: ShortText
    notice_address: ShortText


class NdaTerms(CamelModel):
    purpose: LongText
    effective_date: str = Field(pattern=ISO_DATE_OR_EMPTY)
    mnda_term_type: Literal["expires", "untilTerminated"]
    mnda_term_years: int
    confidentiality_term_type: Literal["years", "perpetuity"]
    confidentiality_term_years: int
    governing_law: ShortText
    jurisdiction: ShortText
    modifications: LongText


class Draft(CamelModel):
    document_id: str | None
    party1: Party
    party2: Party
    nda: NdaTerms
    terms: dict[ShortText, LongText] = Field(max_length=100)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    # Roomier than LongText: an AI reply plus its question can be long, and a
    # rejected history would block the rest of the conversation.
    content: str = Field(max_length=8000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=100)
    draft: Draft
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


class TermUpdate(CamelModel):
    term: str = Field(description="Exactly one of the key term names listed for the document")
    value: str


class ChatTurn(CamelModel):
    reply: str = Field(description="Your answer to the user, without the follow-on question")
    question: str = Field(
        description="The follow-on question, ending in a question mark: what you need to know next, "
        "or, if everything is filled in, whether they want to change anything"
    )
    document_id: str | None = Field(description="The id of the document being drafted, or null for no change")
    party1: PartyUpdates
    party2: PartyUpdates
    nda: NdaUpdates | None = Field(description="Only for the Mutual NDA; otherwise null")
    terms: list[TermUpdate] = Field(description="Key term updates for documents other than the Mutual NDA")
