"""Member sign-up, and password checks for members and admins."""

from sqlmodel import Session, func, select

from library_system.models import Admin, Member
from library_system.passwords import hash_password, verify_password
from library_system.services.catalogue import get_branch
from library_system.services.errors import RuleError

# Checked when the account does not exist, so an unknown name takes as
# long as a wrong password and account names cannot be found by timing.
DUMMY_HASH = hash_password("dummypassword")


def sign_up(
    session: Session, name: str, email: str, home_branch: str, password: str
) -> Member:
    # Hashing is slow on purpose, so do it before touching the database.
    password_hash = hash_password(password)
    email = email.lower()

    get_branch(session, home_branch)

    taken = session.exec(select(Member).where(Member.email == email)).first()

    if taken is not None:
        raise RuleError("An account with this email address already exists.")

    # Members are never removed, so counting them gives the next card.
    count = session.exec(select(func.count()).select_from(Member)).one()

    member = Member(
        card_number=f"LM-{1001 + count}",
        name=name,
        email=email,
        home_branch=home_branch,
        password_hash=password_hash,
    )
    session.add(member)
    session.commit()
    session.refresh(member)

    return member


def authenticate_member(
    session: Session, card_number: str, password: str
) -> str | None:
    """Return the card number if the password is right, else None."""
    member = session.get(Member, card_number.strip().upper())

    if member is None:
        return _check(session, None, None, password)

    return _check(session, member.card_number, member.password_hash, password)


def authenticate_admin(
    session: Session, username: str, password: str
) -> str | None:
    """Return the username if the password is right, else None."""
    admin = session.get(Admin, username.strip().lower())

    if admin is None:
        return _check(session, None, None, password)

    return _check(session, admin.username, admin.password_hash, password)


def _check(session, account_id, password_hash, password):
    # End the read before the slow hash check, so other requests can use
    # the database in the meantime.
    session.rollback()

    if not verify_password(password, password_hash or DUMMY_HASH):
        return None

    return account_id
