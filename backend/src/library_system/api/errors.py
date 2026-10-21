"""Turning the library's errors into HTTP errors."""

from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import HTTPException, status

from library_system.services.errors import NotFoundError, RuleError


@contextmanager
def library_errors() -> Iterator[None]:
    """NotFoundError becomes 404 and RuleError becomes 409 Conflict.

    The message is the same one the command-line program shows.
    """
    try:
        yield
    except NotFoundError as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from None
    except RuleError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from None
