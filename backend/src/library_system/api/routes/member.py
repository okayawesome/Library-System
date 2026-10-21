"""Member endpoints: sign up, browse the inventory, borrow and return."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from library_system.api.dependencies import SessionDep, SettingsDep
from library_system.api.errors import library_errors
from library_system.api.schemas import (
    BookOut,
    LoanCreate,
    LoanOut,
    MemberOut,
    ReturnRequest,
    SignUp,
    Token,
)
from library_system.api.security import CurrentMember, create_access_token
from library_system.models import Book
from library_system.services import accounts, catalogue, circulation

router = APIRouter(prefix="/member", tags=["member"])


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def sign_up(body: SignUp, session: SessionDep) -> MemberOut:
    """Create an account. The library card number is issued here."""
    with library_errors():
        member = accounts.sign_up(
            session, body.name, body.email, body.home_branch, body.password
        )

    return MemberOut.model_validate(member)


@router.post("/token")
def sign_in(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDep,
    settings: SettingsDep,
) -> Token:
    """Sign in with a library card number (as username) and password."""
    card_number = accounts.authenticate_member(
        session, form_data.username, form_data.password
    )

    if card_number is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect card number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return Token(
        access_token=create_access_token(card_number, "member", settings),
        token_type="bearer",
    )


@router.get("/me")
def read_me(member: CurrentMember) -> MemberOut:
    return MemberOut.model_validate(member)


@router.get("/books")
def list_books(member: CurrentMember, session: SessionDep) -> list[BookOut]:
    """The whole inventory, with which copies are on the shelf."""
    return [
        BookOut.from_copy(book, available)
        for book, available in catalogue.list_copies(session)
    ]


@router.get("/loans")
def list_loans(member: CurrentMember, session: SessionDep) -> list[LoanOut]:
    """Your loans, active and returned, oldest first."""
    return [
        LoanOut.from_loan(loan, book)
        for loan, book in circulation.member_loans(
            session, member.card_number
        )
    ]


@router.post("/loans", status_code=status.HTTP_201_CREATED)
def borrow(
    body: LoanCreate, member: CurrentMember, session: SessionDep
) -> LoanOut:
    """Borrow a copy from the branch that holds it."""
    with library_errors():
        loan = circulation.borrow(session, member.card_number, body.book_id)

    return LoanOut.from_loan(loan, session.get(Book, loan.book_id))


@router.post("/loans/{loan_id}/return")
def return_book(
    loan_id: int,
    body: ReturnRequest,
    member: CurrentMember,
    session: SessionDep,
) -> LoanOut:
    """Return one of your loans at any branch."""
    with library_errors():
        loan = circulation.return_book(
            session, member.card_number, loan_id, body.branch
        )

    return LoanOut.from_loan(loan, session.get(Book, loan.book_id))
