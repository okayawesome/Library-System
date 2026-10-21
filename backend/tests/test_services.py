import os
import tempfile
import unittest
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from library_system.database import init_database, make_engine
from library_system.models import Book, Loan
from library_system.services import accounts, catalogue, circulation
from library_system.services.errors import NotFoundError, RuleError


class ServiceTestCase(unittest.TestCase):

    # Each test gets a fresh database with the demo data.

    def setUp(self):

        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)

        engine = make_engine(os.path.join(folder.name, "library.db"))
        self.addCleanup(engine.dispose)
        init_database(engine)

        self.session = Session(engine)
        self.addCleanup(self.session.close)


class TestBorrowing(ServiceTestCase):

    def test_borrow_puts_copy_on_loan(self):

        loan = circulation.borrow(self.session, "LM-1001", "B004")

        self.assertEqual(loan.borrow_branch, "Mumbai")
        available = dict(
            (book.id, free)
            for book, free in catalogue.list_copies(self.session)
        )
        self.assertFalse(available["B004"])

    def test_cannot_borrow_same_title_from_another_branch(self):

        circulation.borrow(self.session, "LM-1001", "B001")

        with self.assertRaises(RuleError):
            circulation.borrow(self.session, "LM-1001", "B003")

    def test_borrowing_limit(self):

        for book_id in ["B002", "B004", "B006"]:
            circulation.borrow(self.session, "LM-1001", book_id)

        with self.assertRaises(RuleError):
            circulation.borrow(self.session, "LM-1001", "B009")

    def test_copy_on_loan_cannot_be_borrowed(self):

        circulation.borrow(self.session, "LM-1001", "B004")

        with self.assertRaises(RuleError):
            circulation.borrow(self.session, "LM-1002", "B004")

    def test_unknown_book(self):

        with self.assertRaises(NotFoundError):
            circulation.borrow(self.session, "LM-1001", "B999")


class TestReturning(ServiceTestCase):

    def test_return_moves_copy_to_receiving_branch(self):

        loan = circulation.borrow(self.session, "LM-1001", "B004")
        loan = circulation.return_book(
            self.session, "LM-1001", loan.id, "Delhi"
        )

        self.assertEqual(loan.return_branch, "Delhi")
        self.assertIsNotNone(loan.returned_at)
        self.assertEqual(self.session.get(Book, "B004").branch, "Delhi")

    def test_cannot_return_another_members_loan(self):

        loan = circulation.borrow(self.session, "LM-1001", "B004")

        with self.assertRaises(NotFoundError):
            circulation.return_book(self.session, "LM-1002", loan.id, "Delhi")

    def test_cannot_return_twice(self):

        loan = circulation.borrow(self.session, "LM-1001", "B004")
        circulation.return_book(self.session, "LM-1001", loan.id, "Delhi")

        with self.assertRaises(RuleError):
            circulation.return_book(self.session, "LM-1001", loan.id, "Delhi")

    def test_unknown_branch(self):

        loan = circulation.borrow(self.session, "LM-1001", "B004")

        with self.assertRaises(NotFoundError):
            circulation.return_book(
                self.session, "LM-1001", loan.id, "Atlantis"
            )


class TestCatalogue(ServiceTestCase):

    def test_add_branch_then_book(self):

        catalogue.add_branch(self.session, "Pune", "Koregaon Park")
        book = catalogue.add_book(
            self.session, "Dune", "Frank Herbert", "Science", "Pune"
        )

        self.assertEqual(book.id, "B014")
        self.assertEqual(book.branch, "Pune")

    def test_branch_names_are_unique_ignoring_case(self):

        with self.assertRaises(RuleError):
            catalogue.add_branch(self.session, "delhi", "Somewhere")

    def test_book_needs_an_existing_branch(self):

        with self.assertRaises(NotFoundError):
            catalogue.add_book(self.session, "Dune", "F. H.", "Sci", "Pune")

    def test_removed_book_is_hidden_and_cannot_be_borrowed(self):

        catalogue.remove_book(self.session, "B004")

        ids = [book.id for book, _ in catalogue.list_copies(self.session)]
        self.assertNotIn("B004", ids)

        with self.assertRaises(NotFoundError):
            circulation.borrow(self.session, "LM-1001", "B004")

    def test_book_on_loan_cannot_be_removed(self):

        circulation.borrow(self.session, "LM-1001", "B004")

        with self.assertRaises(RuleError):
            catalogue.remove_book(self.session, "B004")

    def test_loan_history_survives_removing_the_book(self):

        loan = circulation.borrow(self.session, "LM-1001", "B004")
        circulation.return_book(self.session, "LM-1001", loan.id, "Delhi")
        catalogue.remove_book(self.session, "B004")

        history = circulation.member_loans(self.session, "LM-1001")

        self.assertEqual([book.id for _, book in history], ["B004"])

    def test_new_ids_skip_removed_books(self):

        catalogue.remove_book(self.session, "B013")
        book = catalogue.add_book(
            self.session, "Dune", "Frank Herbert", "Science", "Kolkata"
        )

        self.assertEqual(book.id, "B014")

    def test_library_with_books_cannot_be_removed(self):

        with self.assertRaises(RuleError):
            catalogue.remove_branch(self.session, "Chennai")

    def test_empty_library_can_be_removed_and_reopened(self):

        catalogue.remove_book(self.session, "B012")
        catalogue.remove_branch(self.session, "Chennai")

        names = [b.name for b in catalogue.list_branches(self.session)]
        self.assertNotIn("Chennai", names)

        with self.assertRaises(NotFoundError):
            catalogue.add_book(self.session, "Dune", "F. H.", "Sci", "Chennai")

        branch = catalogue.add_branch(self.session, "chennai", "T. Nagar")

        self.assertEqual((branch.name, branch.city), ("Chennai", "T. Nagar"))
        self.assertIsNone(branch.removed_at)


class TestAccounts(ServiceTestCase):

    def test_sign_up_issues_next_card(self):

        member = accounts.sign_up(
            self.session, "Riya", "Riya@Example.com", "Delhi", "secret-1"
        )

        self.assertEqual(member.card_number, "LM-1006")
        self.assertEqual(member.email, "riya@example.com")
        self.assertEqual(
            accounts.authenticate_member(self.session, "lm-1006", "secret-1"),
            "LM-1006",
        )

    def test_email_can_only_be_used_once(self):

        with self.assertRaises(RuleError):
            accounts.sign_up(
                self.session, "Copy", "ANMOL@example.com", "Delhi", "secret-1"
            )

    def test_wrong_password_or_unknown_account(self):

        self.assertIsNone(
            accounts.authenticate_member(self.session, "LM-1001", "wrong")
        )
        self.assertIsNone(
            accounts.authenticate_admin(self.session, "nobody", "admin123")
        )
        self.assertEqual(
            accounts.authenticate_admin(self.session, "Admin", "admin123"),
            "admin",
        )


class TestDatabaseRules(ServiceTestCase):

    # These hold even if a bug skipped the service checks.

    def test_one_active_loan_per_copy(self):

        circulation.borrow(self.session, "LM-1001", "B004")
        self.session.add(
            Loan(
                book_id="B004",
                card_number="LM-1002",
                borrow_branch="Mumbai",
                borrowed_at=datetime.now(timezone.utc),
            )
        )

        with self.assertRaises(IntegrityError):
            self.session.commit()

    def test_foreign_keys_are_enforced(self):

        self.session.add(
            Book(id="B900", title="X", author="Y", category="Z",
                 branch="Atlantis")
        )

        with self.assertRaises(IntegrityError):
            self.session.commit()


if __name__ == "__main__":
    unittest.main()
