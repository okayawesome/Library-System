# --------------------------------------------------
# PASSWORD HASHING
# --------------------------------------------------

# Passwords are never stored. Only their hashes are.
#
# pwdlib picks the currently recommended algorithm
# (Argon2), as the FastAPI security tutorial does.

from pwdlib import PasswordHash

_password_hash = PasswordHash.recommended()


def hash_password(password):
    return _password_hash.hash(password)


def verify_password(password, hashed_password):
    return _password_hash.verify(password, hashed_password)
