"""The library's rules, shared by the web API and the command line.

- ``catalogue``: branches and books. Everyone reads; admins add and remove.
- ``circulation``: borrowing and returning. Members only.
- ``accounts``: member sign-up, and sign-in checks for both roles.

Functions that change data commit their own transaction.
"""
