"""Borrowing and returning: the library's rules for members.

1. A member can have at most 3 books at a time.
2. A member cannot have two copies of the same title at once, even
   from different branches.
3. A copy can be returned to any branch, and stays at the branch that
   took it back. Every loan records both branches.
"""

from datetime import datetime, timezone

from sqlmodel import Session, col, select

from library_system.models import Book, Loan
from library_system.services.catalogue import (
    get_book,
    get_branch,
    list_copies,
)
from library_system.services.errors import NotFoundError, RuleError

MAX_ACTIVE_LOANS = 3


def member_loans(
    session: Session, card_number: str, active_only: bool = False
) -> list[tuple[Loan, Book]]:
    statement = (
        select(Loan, Book)
        .join(Book, col(Loan.book_id) == col(Book.id))
        .where(Loan.card_number == card_number)
        .order_by(col(Loan.id))
    )

    if active_only:
        statement = statement.where(col(Loan.returned_at).is_(None))

    return list(session.exec(statement))


def borrow(session: Session, card_number: str, book_id: str) -> Loan:
    book = get_book(session, book_id)

    held = [
        held_book
        for _, held_book in member_loans(session, card_number, True)
    ]

    if len(held) >= MAX_ACTIVE_LOANS:
        raise RuleError(
            "Borrowing limit reached. "
            f"You can borrow a maximum of {MAX_ACTIVE_LOANS} books."
        )

    for held_book in held:

        if held_book.title.casefold() == book.title.casefold():
            raise RuleError(
                f"You already have '{held_book.title}'. "
                "You cannot borrow another copy "
                "until you return the one you have."
            )

    on_loan = session.exec(
        select(Loan).where(
            Loan.book_id == book.id, col(Loan.returned_at).is_(None)
        )
    ).first()

    if on_loan is not None:
        raise RuleError(f"'{book.title}' ({book.id}) is already on loan.")

    loan = Loan(
        book_id=book.id,
        card_number=card_number,
        borrow_branch=book.branch,
        borrowed_at=datetime.now(timezone.utc),
    )
    session.add(loan)
    session.commit()
    session.refresh(loan)

    return loan


def return_book(
    session: Session, card_number: str, loan_id: int, branch: str
) -> Loan:
    loan = session.get(Loan, loan_id)

    # Another member's loan is reported as missing, so members cannot
    # find out about each other's loans.
    if loan is None or loan.card_number != card_number:
        raise NotFoundError(f"You have no loan {loan_id}.")

    if loan.returned_at is not None:
        raise RuleError("You have already returned this book.")

    get_branch(session, branch)
    book = session.get(Book, loan.book_id)

    loan.return_branch = branch
    loan.returned_at = datetime.now(timezone.utc)
    book.branch = branch

    session.add(loan)
    session.add(book)
    session.commit()
    session.refresh(loan)

    return loan


# --------------------------------------------------
# LOOKUPS BY TITLE (used by the command-line program)
# --------------------------------------------------


def find_available_copy(session: Session, branch: str, title: str) -> Book:

    for book, available in list_copies(session):

        if (available and book.branch == branch
                and book.title.casefold() == title.casefold()):
            return book

    raise NotFoundError(f"'{title}' is not available in {branch} Library.")


def find_active_loan(session: Session, card_number: str, title: str) -> Loan:

    for loan, book in member_loans(session, card_number, True):

        if book.title.casefold() == title.casefold():
            return loan

    raise NotFoundError(f"You don't have '{title}'.")
