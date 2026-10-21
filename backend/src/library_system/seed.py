"""Demo data, added the first time the database is created.

The demo passwords are shown on the web sign-in screen. Change them
before using real data.
"""

from sqlmodel import Session, select

from library_system.models import Admin, Book, Branch, Member
from library_system.passwords import hash_password

BRANCHES = [
    # (name, city)
    ("Delhi", "Connaught Place"),
    ("Mumbai", "Fort"),
    ("Bangalore", "Indiranagar"),
    ("Chennai", "Anna Nagar"),
    ("Kolkata", "Park Street"),
]

BOOKS = [
    # (id, title, author, category, branch)
    ("B001", "Harry Potter and the Philosopher's Stone",
     "J. K. Rowling", "Fantasy", "Delhi"),
    ("B002", "The Chronicles of Narnia",
     "C. S. Lewis", "Fantasy", "Delhi"),
    ("B003", "Harry Potter and the Philosopher's Stone",
     "J. K. Rowling", "Fantasy", "Mumbai"),
    ("B004", "The Lord of the Rings",
     "J. R. R. Tolkien", "Fantasy", "Mumbai"),
    ("B005", "Harry Potter and the Philosopher's Stone",
     "J. K. Rowling", "Fantasy", "Bangalore"),
    ("B006", "Percy Jackson and the Olympians",
     "Rick Riordan", "Fantasy", "Bangalore"),
    ("B007", "The Hobbit",
     "J. R. R. Tolkien", "Fantasy", "Delhi"),
    ("B008", "To Kill a Mockingbird",
     "Harper Lee", "Classic", "Mumbai"),
    ("B009", "1984",
     "George Orwell", "Classic", "Bangalore"),
    ("B010", "Pride and Prejudice",
     "Jane Austen", "Classic", "Delhi"),
    ("B011", "The Alchemist",
     "Paulo Coelho", "Fiction", "Mumbai"),
    ("B012", "A Song of Ice and Fire",
     "George R. R. Martin", "Fantasy", "Chennai"),
    ("B013", "Harry Potter and the Philosopher's Stone",
     "J. K. Rowling", "Fantasy", "Kolkata"),
]

MEMBERS = [
    # (card_number, name, email, home_branch)
    ("LM-1001", "Anmol", "anmol@example.com", "Delhi"),
    ("LM-1002", "Vishesh", "vishesh@example.com", "Mumbai"),
    ("LM-1003", "Annie", "annie@example.com", "Bangalore"),
    ("LM-1004", "Ab", "ab@example.com", "Chennai"),
    ("LM-1005", "Hey", "hey@example.com", "Kolkata"),
]

DEMO_ADMIN_USERNAME = "admin"
DEMO_ADMIN_PASSWORD = "admin123"
DEMO_MEMBER_PASSWORD = "member123"


def seed_if_empty(session: Session) -> None:

    if session.exec(select(Branch)).first() is not None:
        return

    session.add_all(Branch(name=name, city=city) for name, city in BRANCHES)
    session.flush()

    session.add_all(
        Book(id=book_id, title=title, author=author, category=category,
             branch=branch)
        for book_id, title, author, category, branch in BOOKS
    )

    member_hash = hash_password(DEMO_MEMBER_PASSWORD)
    session.add_all(
        Member(card_number=card_number, name=name, email=email,
               home_branch=home_branch, password_hash=member_hash)
        for card_number, name, email, home_branch in MEMBERS
    )

    session.add(
        Admin(username=DEMO_ADMIN_USERNAME,
              password_hash=hash_password(DEMO_ADMIN_PASSWORD))
    )

    session.commit()
