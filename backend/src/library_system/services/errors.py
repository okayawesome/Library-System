class LibraryError(Exception):
    """Something the library cannot do. The message is shown to users."""


class NotFoundError(LibraryError):
    """No such book, branch or loan."""


class RuleError(LibraryError):
    """The request breaks a library rule or clashes with existing data."""
