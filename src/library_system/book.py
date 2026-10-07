# --------------------------------------------------
# BOOK CLASS
# --------------------------------------------------

# The Book class represents the physical copy of a book.
#
# Each physical book has:
# 1. book_id
# 2. title
#
# book_id uniquely identifies the physical copy.


class Book:

    def __init__(self, book_id, title):

        if not book_id:
            raise ValueError("Book ID cannot be empty.")

        if not title:
            raise ValueError("Book title cannot be empty.")

        self.book_id = book_id
        self.title = title
