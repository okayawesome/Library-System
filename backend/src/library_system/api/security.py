"""Sign-in tokens (OAuth2 password flow with JWT bearer tokens).

Members and admins sign in at separate endpoints and get tokens marked
with their role. A member token is refused on admin endpoints, and an
admin token on member endpoints.
"""

from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError

from library_system.api.dependencies import SessionDep, SettingsDep
from library_system.config import Settings
from library_system.models import Admin, Member

ALGORITHM = "HS256"

Role = Literal["member", "admin"]

member_scheme = OAuth2PasswordBearer(
    tokenUrl="api/member/token", scheme_name="Member"
)
admin_scheme = OAuth2PasswordBearer(
    tokenUrl="api/admin/token", scheme_name="Admin"
)


def create_access_token(subject: str, role: Role, settings: Settings) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": subject, "role": role, "exp": expire},
        settings.secret_key,
        algorithm=ALGORITHM,
    )


def _not_signed_in() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _account_id(token: str, role: Role, settings: Settings) -> str:
    """The account a valid token for ``role`` was issued to."""
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[ALGORITHM]
        )
    except InvalidTokenError:
        raise _not_signed_in() from None

    if payload.get("role") != role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This needs a {role} account.",
        )

    subject = payload.get("sub")

    if not isinstance(subject, str):
        raise _not_signed_in()

    return subject


def get_current_member(
    token: Annotated[str, Depends(member_scheme)],
    session: SessionDep,
    settings: SettingsDep,
) -> Member:
    member = session.get(Member, _account_id(token, "member", settings))

    if member is None:
        raise _not_signed_in()

    return member


def get_current_admin(
    token: Annotated[str, Depends(admin_scheme)],
    session: SessionDep,
    settings: SettingsDep,
) -> Admin:
    admin = session.get(Admin, _account_id(token, "admin", settings))

    if admin is None:
        raise _not_signed_in()

    return admin


CurrentMember = Annotated[Member, Depends(get_current_member)]
CurrentAdmin = Annotated[Admin, Depends(get_current_admin)]
