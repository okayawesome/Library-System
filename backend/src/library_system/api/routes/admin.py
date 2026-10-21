"""Admin endpoints: see the inventory, add and remove books and libraries.

Admins never see who has borrowed a copy, and they cannot borrow.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from library_system.api.dependencies import SessionDep, SettingsDep
from library_system.api.errors import library_errors
from library_system.api.schemas import (
    AdminOut,
    BookCreate,
    BookOut,
    BranchCreate,
    BranchOut,
    Token,
)
from library_system.api.security import CurrentAdmin, create_access_token
from library_system.services import accounts, catalogue

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/token")
def sign_in(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDep,
    settings: SettingsDep,
) -> Token:
    username = accounts.authenticate_admin(
        session, form_data.username, form_data.password
    )

    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return Token(
        access_token=create_access_token(username, "admin", settings),
        token_type="bearer",
    )


@router.get("/me")
def read_me(admin: CurrentAdmin) -> AdminOut:
    return AdminOut.model_validate(admin)


@router.get("/books")
def list_books(admin: CurrentAdmin, session: SessionDep) -> list[BookOut]:
    """The whole inventory, with which copies are on the shelf."""
    return [
        BookOut.from_copy(book, available)
        for book, available in catalogue.list_copies(session)
    ]


@router.post("/books", status_code=status.HTTP_201_CREATED)
def add_book(
    body: BookCreate, admin: CurrentAdmin, session: SessionDep
) -> BookOut:
    """Add one physical copy to a branch. Its ID is assigned here."""
    with library_errors():
        book = catalogue.add_book(
            session, body.title, body.author, body.category, body.branch
        )

    return BookOut.from_copy(book, available=True)


@router.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_book(
    book_id: str, admin: CurrentAdmin, session: SessionDep
) -> None:
    """Take a copy out of the catalogue. Refused while it is on loan."""
    with library_errors():
        catalogue.remove_book(session, book_id)


@router.post("/branches", status_code=status.HTTP_201_CREATED)
def add_branch(
    body: BranchCreate, admin: CurrentAdmin, session: SessionDep
) -> BranchOut:
    """Add a library to the network, or reopen a removed one."""
    with library_errors():
        branch = catalogue.add_branch(session, body.name, body.city)

    return BranchOut.model_validate(branch)


@router.delete("/branches/{name}", status_code=status.HTTP_204_NO_CONTENT)
def remove_branch(
    name: str, admin: CurrentAdmin, session: SessionDep
) -> None:
    """Remove a library. Refused while it still has books."""
    with library_errors():
        catalogue.remove_branch(session, name)
