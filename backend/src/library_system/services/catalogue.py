"""Branches and the book catalogue. Everyone can read it; admins change it.

Removing a book or a library only marks it removed (``removed_at``), so
the loans and members that point at it keep working. Removed rows are
left out of every list.
"""

from datetime import datetime, timezone

from sqlmodel import Session, col, func, select

from library_system.models import Book, Branch, Loan
from library_system.services.errors import NotFoundError, RuleError


def list_branches(session: Session) -> list[Branch]:
    return list(
        session.exec(
            select(Branch)
            .where(col(Branch.removed_at).is_(None))
            .order_by(Branch.name)
        )
    )


def get_branch(session: Session, name: str) -> Branch:
    branch = session.get(Branch, name)

    if branch is None or branch.removed_at is not None:
        raise NotFoundError(f"There is no {name} branch.")

    return branch


def add_branch(session: Session, name: str, city: str) -> Branch:
    clash = session.exec(
        select(Branch).where(func.lower(Branch.name) == name.lower())
    ).first()

    if clash is not None and clash.removed_at is None:
        raise RuleError(f"There is already a {clash.name} branch.")

    if clash is not None:
        # A removed library with this name: open it again.
        branch = clash
        branch.city = city
        branch.removed_at = None
    else:
        branch = Branch(name=name, city=city)

    session.add(branch)
    session.commit()
    session.refresh(branch)

    return branch


def remove_branch(session: Session, name: str) -> Branch:
    branch = get_branch(session, name)

    # Copies on loan from this library count too: their branch is
    # still this one until they are returned somewhere.
    stock = session.exec(
        select(func.count())
        .select_from(Book)
        .where(Book.branch == branch.name, col(Book.removed_at).is_(None))
    ).one()

    if stock:
        raise RuleError(
            f"{branch.name} still has {stock} "
            f"{'book' if stock == 1 else 'books'}. Remove them first."
        )

    branch.removed_at = datetime.now(timezone.utc)
    session.add(branch)
    session.commit()

    return branch


def list_copies(session: Session) -> list[tuple[Book, bool]]:
    """Every copy, paired with True when it is on the shelf."""
    on_loan = set(
        session.exec(
            select(Loan.book_id).where(col(Loan.returned_at).is_(None))
        )
    )
    books = session.exec(
        select(Book)
        .where(col(Book.removed_at).is_(None))
        .order_by(Book.id)
    )

    return [(book, book.id not in on_loan) for book in books]


def get_book(session: Session, book_id: str) -> Book:
    book = session.get(Book, book_id)

    if book is None or book.removed_at is not None:
        raise NotFoundError(f"There is no book {book_id}.")

    return book


def add_book(
    session: Session, title: str, author: str, category: str, branch: str
) -> Book:
    get_branch(session, branch)

    # Copies are never deleted (only marked removed), so counting them
    # gives the next free ID.
    count = session.exec(select(func.count()).select_from(Book)).one()

    book = Book(
        id=f"B{count + 1:03d}",
        title=title,
        author=author,
        category=category,
        branch=branch,
    )
    session.add(book)
    session.commit()
    session.refresh(book)

    return book


def remove_book(session: Session, book_id: str) -> Book:
    book = get_book(session, book_id)

    on_loan = session.exec(
        select(Loan).where(
            Loan.book_id == book.id, col(Loan.returned_at).is_(None)
        )
    ).first()

    if on_loan is not None:
        raise RuleError(
            f"'{book.title}' ({book.id}) is on loan. "
            "It can be removed once it has been returned."
        )

    book.removed_at = datetime.now(timezone.utc)
    session.add(book)
    session.commit()

    return book
