"""Request and response bodies.

Python attributes are snake_case (PEP 8). JSON keys are camelCase, the
JavaScript convention the frontend uses, so ``card_number`` is sent as
``cardNumber``. Database rows are converted with ``from_attributes``.
"""

from datetime import datetime, timezone
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
)
from pydantic.alias_generators import to_camel

from library_system.models import Book, Loan

# Non-blank text with surrounding spaces removed.
Text = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]


def _as_utc(value: datetime) -> datetime:
    # SQLite gives back times without a time zone; they are UTC.
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


UtcDatetime = Annotated[datetime, AfterValidator(_as_utc)]


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, validate_by_name=True, from_attributes=True
    )


class Token(BaseModel):
    # OAuth2 fixes these names, so they stay snake_case.
    access_token: str
    token_type: str


# --------------------------------------------------
# CATALOGUE
# --------------------------------------------------


class BranchOut(ApiModel):
    name: str
    city: str


class BranchCreate(ApiModel):
    name: Text
    city: Text


class BookOut(ApiModel):
    id: str
    title: str
    author: str
    category: str
    # Where the copy is shelved, or where it was borrowed from.
    branch: str
    available: bool

    @classmethod
    def from_copy(cls, book: Book, available: bool) -> "BookOut":
        return cls(
            id=book.id,
            title=book.title,
            author=book.author,
            category=book.category,
            branch=book.branch,
            available=available,
        )


class BookCreate(ApiModel):
    title: Text
    author: Text
    category: Text
    branch: Text


# --------------------------------------------------
# ACCOUNTS
# --------------------------------------------------


class MemberOut(ApiModel):
    card_number: str
    name: str
    email: str
    home_branch: str


class SignUp(ApiModel):
    name: Text
    email: EmailStr
    home_branch: Text
    # Not stripped: spaces in a password count.
    password: str = Field(min_length=8, max_length=128)


class AdminOut(ApiModel):
    username: str


# --------------------------------------------------
# LOANS
# --------------------------------------------------


class LoanOut(ApiModel):
    id: int
    book_id: str
    # Sent with the loan so history still reads well after the copy
    # has been removed from the catalogue.
    book_title: str
    borrow_branch: str
    borrowed_at: UtcDatetime
    return_branch: str | None
    returned_at: UtcDatetime | None

    @classmethod
    def from_loan(cls, loan: Loan, book: Book) -> "LoanOut":
        return cls(
            id=loan.id,
            book_id=loan.book_id,
            book_title=book.title,
            borrow_branch=loan.borrow_branch,
            borrowed_at=loan.borrowed_at,
            return_branch=loan.return_branch,
            returned_at=loan.returned_at,
        )


class LoanCreate(ApiModel):
    book_id: Text


class ReturnRequest(ApiModel):
    branch: Text
