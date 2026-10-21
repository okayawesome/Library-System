import os
import tempfile
import unittest

from fastapi.testclient import TestClient

from library_system.api.main import create_app
from library_system.config import Settings

SECRET_KEY = "test-secret-key-that-is-at-least-32-characters"


class ApiTestCase(unittest.TestCase):

    # Each test gets its own database, seeded with the demo data.

    def setUp(self):

        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)

        self.database_file = os.path.join(folder.name, "library.db")
        self.client = self.start_server()

    def start_server(self):

        settings = Settings(
            database_file=self.database_file, secret_key=SECRET_KEY
        )
        client = TestClient(create_app(settings))

        # Entering the client runs the app's startup (lifespan).
        client.__enter__()
        self.addCleanup(client.__exit__, None, None, None)

        return client

    def sign_in(self, role, username, password):

        response = self.client.post(
            f"/api/{role}/token",
            data={"username": username, "password": password},
        )
        self.assertEqual(response.status_code, 200, response.text)

        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def member(self, card_number="LM-1001"):
        return self.sign_in("member", card_number, "member123")

    def admin(self):
        return self.sign_in("admin", "admin", "admin123")

    def borrow(self, book_id, headers=None):

        return self.client.post(
            "/api/member/loans",
            headers=headers or self.member(),
            json={"bookId": book_id},
        )

    def book(self, book_id):

        books = self.client.get("/api/member/books", headers=self.member())
        return next(book for book in books.json() if book["id"] == book_id)


class TestSignIn(ApiTestCase):

    def test_each_role_signs_in_at_its_own_endpoint(self):

        member = self.client.get("/api/member/me", headers=self.member())
        admin = self.client.get("/api/admin/me", headers=self.admin())

        self.assertEqual(member.json()["cardNumber"], "LM-1001")
        self.assertEqual(admin.json()["username"], "admin")

    def test_wrong_password_is_rejected(self):

        for role, username in [("member", "LM-1001"), ("admin", "admin")]:

            response = self.client.post(
                f"/api/{role}/token",
                data={"username": username, "password": "wrong"},
            )
            self.assertEqual(response.status_code, 401)

    def test_requests_need_a_valid_token(self):

        for headers in [{}, {"Authorization": "Bearer not-a-token"}]:

            response = self.client.get("/api/member/books", headers=headers)
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.headers["WWW-Authenticate"], "Bearer")


class TestSeparationOfRoles(ApiTestCase):

    def test_member_cannot_use_admin_endpoints(self):

        response = self.client.post(
            "/api/admin/branches",
            headers=self.member(),
            json={"name": "Pune", "city": "Koregaon Park"},
        )
        self.assertEqual(response.status_code, 403)

    def test_member_cannot_remove_books_or_libraries(self):

        for path in ["/api/admin/books/B001", "/api/admin/branches/Delhi"]:

            response = self.client.delete(path, headers=self.member())
            self.assertEqual(response.status_code, 403)

    def test_admin_cannot_borrow(self):

        response = self.borrow("B001", headers=self.admin())
        self.assertEqual(response.status_code, 403)

    def test_member_sees_only_their_own_loans(self):

        self.borrow("B001")
        self.borrow("B002", headers=self.member("LM-1002"))

        loans = self.client.get("/api/member/loans", headers=self.member())

        self.assertEqual([loan["bookId"] for loan in loans.json()], ["B001"])

    def test_member_cannot_return_another_members_loan(self):

        loan_id = self.borrow("B001").json()["id"]

        response = self.client.post(
            f"/api/member/loans/{loan_id}/return",
            headers=self.member("LM-1002"),
            json={"branch": "Delhi"},
        )
        self.assertEqual(response.status_code, 404)


class TestSignUp(ApiTestCase):

    def sign_up(self, **changes):

        body = {
            "name": "Riya",
            "email": "riya@example.com",
            "homeBranch": "Kolkata",
            "password": "riya-pass-1",
        }
        body.update(changes)
        return self.client.post("/api/member/signup", json=body)

    def test_new_member_can_sign_in(self):

        response = self.sign_up()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["cardNumber"], "LM-1006")
        self.sign_in("member", "LM-1006", "riya-pass-1")

    def test_invalid_details_are_rejected(self):

        self.assertEqual(self.sign_up(password="short").status_code, 422)
        self.assertEqual(self.sign_up(email="not-an-email").status_code, 422)
        self.assertEqual(self.sign_up(homeBranch="Atlantis").status_code, 404)
        self.assertEqual(
            self.sign_up(email="anmol@example.com").status_code, 409
        )

    def test_branches_are_public(self):

        response = self.client.get("/api/branches")

        self.assertEqual(response.status_code, 200)
        self.assertIn("Delhi", [branch["name"] for branch in response.json()])


class TestBorrowAndReturn(ApiTestCase):

    def test_borrow_puts_copy_on_loan(self):

        response = self.borrow("B004")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["borrowBranch"], "Mumbai")
        self.assertTrue(response.json()["borrowedAt"].endswith("Z"))
        self.assertFalse(self.book("B004")["available"])

    def test_rules_are_enforced(self):

        self.borrow("B001")
        duplicate = self.borrow("B003")

        self.assertEqual(duplicate.status_code, 409)
        self.assertIn("already have", duplicate.json()["detail"])

        self.borrow("B002")
        self.borrow("B004")
        over_limit = self.borrow("B009")

        self.assertEqual(over_limit.status_code, 409)
        self.assertIn("limit", over_limit.json()["detail"])

        taken = self.borrow("B004", headers=self.member("LM-1002"))
        self.assertEqual(taken.status_code, 409)

    def test_return_at_another_branch(self):

        loan_id = self.borrow("B004").json()["id"]

        response = self.client.post(
            f"/api/member/loans/{loan_id}/return",
            headers=self.member(),
            json={"branch": "Delhi"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["returnBranch"], "Delhi")
        self.assertEqual(self.book("B004")["branch"], "Delhi")
        self.assertTrue(self.book("B004")["available"])

    def test_unknown_book_is_not_found(self):
        self.assertEqual(self.borrow("B999").status_code, 404)


class TestAdmin(ApiTestCase):

    def test_add_library_then_book(self):

        branch = self.client.post(
            "/api/admin/branches",
            headers=self.admin(),
            json={"name": " Pune ", "city": "Koregaon Park"},
        )
        book = self.client.post(
            "/api/admin/books",
            headers=self.admin(),
            json={
                "title": "Dune",
                "author": "Frank Herbert",
                "category": "Science",
                "branch": "Pune",
            },
        )

        self.assertEqual(branch.status_code, 201)
        self.assertEqual(branch.json()["name"], "Pune")
        self.assertEqual(book.status_code, 201)
        self.assertEqual(book.json()["id"], "B014")
        self.assertTrue(self.book("B014")["available"])

    def test_duplicate_library_is_rejected(self):

        response = self.client.post(
            "/api/admin/branches",
            headers=self.admin(),
            json={"name": "delhi", "city": "Elsewhere"},
        )
        self.assertEqual(response.status_code, 409)

    def test_remove_book(self):

        response = self.client.delete(
            "/api/admin/books/B004", headers=self.admin()
        )
        books = self.client.get("/api/admin/books", headers=self.admin())

        self.assertEqual(response.status_code, 204)
        self.assertNotIn("B004", [book["id"] for book in books.json()])
        self.assertEqual(self.borrow("B004").status_code, 404)

        again = self.client.delete(
            "/api/admin/books/B004", headers=self.admin()
        )
        self.assertEqual(again.status_code, 404)

    def test_history_keeps_the_title_of_a_removed_copy(self):

        loan_id = self.borrow("B004").json()["id"]
        self.client.post(
            f"/api/member/loans/{loan_id}/return",
            headers=self.member(),
            json={"branch": "Mumbai"},
        )
        self.client.delete("/api/admin/books/B004", headers=self.admin())

        loans = self.client.get("/api/member/loans", headers=self.member())

        self.assertEqual(
            loans.json()[0]["bookTitle"], "The Lord of the Rings"
        )

    def test_book_on_loan_cannot_be_removed(self):

        self.borrow("B004")

        response = self.client.delete(
            "/api/admin/books/B004", headers=self.admin()
        )

        self.assertEqual(response.status_code, 409)
        self.assertIn("on loan", response.json()["detail"])

    def test_remove_library(self):

        full = self.client.delete(
            "/api/admin/branches/Kolkata", headers=self.admin()
        )
        self.assertEqual(full.status_code, 409)

        self.client.delete("/api/admin/books/B013", headers=self.admin())
        empty = self.client.delete(
            "/api/admin/branches/Kolkata", headers=self.admin()
        )
        branches = self.client.get("/api/branches").json()

        self.assertEqual(empty.status_code, 204)
        self.assertNotIn("Kolkata", [branch["name"] for branch in branches])

    def test_admin_sees_inventory_but_not_borrowers(self):

        self.borrow("B004")
        books = self.client.get("/api/admin/books", headers=self.admin())
        b004 = next(book for book in books.json() if book["id"] == "B004")

        self.assertFalse(b004["available"])
        self.assertNotIn("cardNumber", b004)


class TestServer(ApiTestCase):

    def test_website_is_served_at_root(self):

        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("LibraMind", response.text)

    def test_data_survives_a_restart(self):

        self.borrow("B004")

        self.client = self.start_server()

        self.assertFalse(self.book("B004")["available"])


if __name__ == "__main__":
    unittest.main()
