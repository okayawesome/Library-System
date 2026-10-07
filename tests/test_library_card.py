import unittest

from library_system import Book, Library, User


class TestLibraryCard(unittest.TestCase):

    def setUp(self):

        self.delhi = Library("Delhi")
        self.mumbai = Library("Mumbai")

        self.delhi.add_book(Book("B001", "Harry Potter"))
        self.delhi.add_book(Book("B002", "The Chronicles of Narnia"))
        self.mumbai.add_book(Book("B003", "Harry Potter"))

        self.user = User("Anmol")
        self.card = self.user.library_card

    def test_borrow_moves_book_from_library_to_card(self):

        self.card.borrow(self.delhi, "Harry Potter")

        self.assertEqual(
            [book.book_id for book in self.card.borrowed_books],
            ["B001"]
        )
        self.assertIsNone(self.delhi.find_book("Harry Potter"))

    def test_cannot_borrow_same_title_from_another_library(self):

        self.card.borrow(self.delhi, "Harry Potter")

        with self.assertRaises(ValueError):
            self.card.borrow(self.mumbai, "harry potter")

    def test_borrowing_limit(self):

        card = User("Test").library_card
        card.limit = 1
        card.borrow(self.delhi, "Harry Potter")

        with self.assertRaises(RuntimeError):
            card.borrow(self.delhi, "The Chronicles of Narnia")

    def test_return_puts_book_back(self):

        self.card.borrow(self.delhi, "Harry Potter")
        self.card.return_book(self.mumbai, "Harry Potter")

        self.assertEqual(self.card.borrowed_books, [])
        self.assertIsNotNone(self.mumbai.find_book("Harry Potter"))

    def test_return_book_not_borrowed(self):

        with self.assertRaises(LookupError):
            self.card.return_book(self.delhi, "Harry Potter")


if __name__ == "__main__":
    unittest.main()
