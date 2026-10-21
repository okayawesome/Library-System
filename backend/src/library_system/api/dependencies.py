"""Shared FastAPI dependencies: settings and a database session."""

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlmodel import Session

from library_system.config import Settings


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_session(request: Request) -> Iterator[Session]:
    # One session (and so one transaction at a time) per request.
    with Session(request.app.state.engine) as session:
        yield session


SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[Session, Depends(get_session)]
