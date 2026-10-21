"""Database tables (SQLModel). Times are stored in UTC."""

from datetime import datetime

from sqlalchemy import Index, text
from sqlmodel import Field, SQLModel


class Branch(SQLModel, table=True):
    """A library in the network."""

    name: str = Field(primary_key=True)
    city: str
    # Set when an admin removes the library. The row stays so that old
    # loans and members' home branches still point at something.
    removed_at: datetime | None = None


class Book(SQLModel, table=True):
    """One physical copy of a title."""

    id: str = Field(primary_key=True)  # "B001"
    title: str
    author: str
    category: str
    # Where the copy is shelved. While it is on loan this is the branch
    # it was borrowed from. A return moves it to the branch that took
    # it back.
    branch: str = Field(foreign_key="branch.name", index=True)
    # Set when an admin removes the copy. The row stays so that members'
    # loan history still points at it.
    removed_at: datetime | None = None


class Member(SQLModel, table=True):
    """A library-card holder. Members borrow and return books."""

    card_number: str = Field(primary_key=True)  # "LM-1001"
    name: str
    email: str = Field(unique=True)
    home_branch: str = Field(foreign_key="branch.name")
    password_hash: str


class Admin(SQLModel, table=True):
    """Library staff. Admins add books and branches. They do not borrow."""

    username: str = Field(primary_key=True)
    password_hash: str


class Loan(SQLModel, table=True):
    """One borrowing of one copy. Active until ``returned_at`` is set."""

    __table_args__ = (
        # The database itself refuses a second active loan of one copy.
        Index(
            "ix_loan_one_active_per_book",
            "book_id",
            unique=True,
            sqlite_where=text("returned_at IS NULL"),
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    book_id: str = Field(foreign_key="book.id")
    card_number: str = Field(foreign_key="member.card_number", index=True)
    borrow_branch: str = Field(foreign_key="branch.name")
    borrowed_at: datetime
    return_branch: str | None = Field(default=None, foreign_key="branch.name")
    returned_at: datetime | None = None
