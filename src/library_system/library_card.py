# --------------------------------------------------
# LIBRARY CARD CLASS
# --------------------------------------------------

# The LibraryCard class manages the user's borrowing
# information.
#
# It stores:
# 1. Which User owns the LibraryCard
# 2. Maximum number of books the User can borrow
# 3. Books currently borrowed by the User
#
# The LibraryCard keeps track of borrowed books
# regardless of which Library they came from.
#
# rules:
#
# 1. A User can borrow a maximum of 3 books.
#
# 2. A User cannot borrow two copies of the same
#    book title at the same time.
#
# 3. The second copy cannot be borrowed even if
#    it is available in another Library.
#
# 4. The User can borrow the same title again
#    after returning the copy they already have.


class LibraryCard:

    def __init__(self, user, limit=3):

        if limit <= 0:
            raise ValueError(
                "Borrowing limit must be greater than zero."
            )

        self.user = user
        self.limit = limit
        self.borrowed_books = []

    def borrow(self, library, title):

        # Borrow limit Check
        if len(self.borrowed_books) >= self.limit:

            raise RuntimeError(
                "Borrowing limit reached. "
                f"You can borrow a maximum of {self.limit} books."
            )

        # Check for Duplicate Title
        for book in self.borrowed_books:

            if book.title.lower() == title.lower():

                raise ValueError(
                    f"You already have '{book.title}'. "
                    "You cannot borrow another copy "
                    "until you return the one you have."
                )

        # Finding a book in the library
        book = library.find_book(title)

        if book is None:

            raise LookupError(
                f"'{title}' is not available in "
                f"{library.name} Library."
            )

        # Remove the physical book from the Library.
        library.remove_book(book)

        # Add the physical book to the User's LibraryCard.
        self.borrowed_books.append(book)

        print(
            f"{self.user.name} borrowed "
            f"'{book.title}' from {library.name}."
        )

    def return_book(self, library, title):

        # Search through the books currently
        # borrowed by the User.

        for book in self.borrowed_books:

            if book.title.lower() == title.lower():

                # Remove the book from the User's card.
                self.borrowed_books.remove(book)

                # Add the physical book back to the Library.
                library.add_book(book)

                print(
                    f"{self.user.name} returned "
                    f"'{book.title}' to {library.name}."
                )

                return

        # The User does not currently have this book.

        raise LookupError(
            f"You don't have '{title}'."
        )

    def show_card(self):

        print(
            f"\nLibrary Card: {self.user.name}"
        )

        print(
            f"Books: "
            f"{len(self.borrowed_books)}/"
            f"{self.limit}"
        )

        if not self.borrowed_books:

            print("No books currently borrowed.")
            return

        for book in self.borrowed_books:

            print(f"  {book.book_id} - {book.title}")
