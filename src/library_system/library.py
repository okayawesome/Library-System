from library_system.book import Book


# --------------------------------------------------
# LIBRARY CLASS
# --------------------------------------------------

# The Library class manages the physical availability
# of books in one library.
#
# It can:
# 1. Add a book
# 2. Find a book by title
# 3. Remove a book when it is borrowed
# 4. Add a book back when it is returned
# 5. Show currently available books
#
# Each Library manages its own collection.
#
# The Library does NOT know which user has borrowed
# a book. That responsibility belongs to LibraryCard.


class Library:

    def __init__(self, name):
        self.name = name
        self.books = []

    def add_book(self, book):

        if not isinstance(book, Book):
            raise TypeError(
                "Only Book objects can be added to a library."
            )

        self.books.append(book)

    def show_books(self):

        print(f"\n{self.name} Library")

        if not self.books:
            print("No books available.")
            return

        for book in self.books:
            print(f"  {book.book_id} - {book.title}")

    def find_book(self, title):

        for book in self.books:

            if book.title.lower() == title.lower():
                return book

        return None

    def remove_book(self, book):

        if book not in self.books:
            raise ValueError(
                f"'{book.title}' is not available in {self.name}."
            )

        self.books.remove(book)
