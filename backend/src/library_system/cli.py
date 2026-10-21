from getpass import getpass

from sqlmodel import Session

from library_system.config import Settings
from library_system.database import init_database, make_engine
from library_system.models import Member
from library_system.services import accounts, catalogue, circulation
from library_system.services.errors import LibraryError


# --------------------------------------------------
# COMMAND-LINE PROGRAM FOR MEMBERS
# --------------------------------------------------

# Uses the same SQLite database and the same rules as
# the web API. Members sign in with their library card
# number and password; new members sign up on the website.
#
# Each step opens its own short database session and
# closes it before asking for input, so the program
# never holds the database while waiting for the user.


# --------------------------------------------------
# HELPER: READ A NUMBER
# --------------------------------------------------

# Reads whole-number input. If the user types
# anything else (letters, decimals, blank), a clear
# ValueError is raised instead of Python's default
# "invalid literal for int()" message.


def read_number(prompt):

    text = input(prompt).strip()

    try:
        return int(text)

    except ValueError:
        raise ValueError(
            "Please enter a valid whole number."
        ) from None


# --------------------------------------------------
# HELPER: CHOOSE A LIBRARY
# --------------------------------------------------

# Lists every branch and returns the name the user picks.


def choose_library(branch_names):

    print("\nSelect Library:")

    for number, name in enumerate(branch_names, start=1):
        print(f"{number}. {name}")

    library_choice = read_number("Enter library number: ")

    if not 1 <= library_choice <= len(branch_names):

        raise ValueError(
            "Invalid library selection."
        )

    return branch_names[library_choice - 1]


# --------------------------------------------------
# HELPER: SIGN IN
# --------------------------------------------------

# Asks until the card number and password match.
# Returns the card number.


def sign_in(engine):

    while True:

        card_number = input("Library card number: ")
        password = getpass("Password: ")

        with Session(engine) as session:
            found = accounts.authenticate_member(
                session, card_number, password
            )

        if found is not None:
            return found

        print("Those sign-in details were not recognised. Try again.\n")


# --------------------------------------------------
# MENU ACTIONS
# --------------------------------------------------


def show_books(engine, branch_names):

    with Session(engine) as session:
        copies = catalogue.list_copies(session)

    for branch in branch_names:

        print(f"\n{branch} Library")

        on_shelf = [
            book for book, available in copies
            if available and book.branch == branch
        ]

        if not on_shelf:
            print("No books available.")

        for book in on_shelf:
            print(f"  {book.id} - {book.title}")


def show_card(engine, card_number):

    with Session(engine) as session:
        member = session.get(Member, card_number)
        loans = circulation.member_loans(session, card_number, True)

        print(f"\nLibrary Card: {member.name} ({card_number})")
        print(f"Books: {len(loans)}/{circulation.MAX_ACTIVE_LOANS}")

        if not loans:
            print("No books currently borrowed.")

        for loan, book in loans:
            print(
                f"  {book.id} - {book.title} "
                f"(borrowed from {loan.borrow_branch})"
            )


# --------------------------------------------------
# PROGRAM ENTRY POINT
# --------------------------------------------------

# main() is called by `python -m library_system`
# and by the `library-system` command.


def main():

    settings = Settings()
    engine = make_engine(settings.database_file)
    init_database(engine)

    with Session(engine) as session:
        branch_names = [
            branch.name for branch in catalogue.list_branches(session)
        ]

    # ----------------------------------------------
    # SIGN IN
    # ----------------------------------------------

    try:
        card_number = sign_in(engine)

    except (EOFError, KeyboardInterrupt):
        print("\nExiting.")
        return

    with Session(engine) as session:
        name = session.get(Member, card_number).name

    print(f"\nWelcome back, {name}!")

    # ----------------------------------------------
    # MAIN MENU
    # ----------------------------------------------

    while True:

        print("\n================================")
        print(" Welcome to Anmol's Library ")
        print("================================")

        print("1. Show available books")
        print("2. Borrow a book")
        print("3. Return a book")
        print("4. Show my library card")
        print("5. Exit")

        try:

            choice = read_number("\nEnter your choice: ")

            # --------------------------------------
            # SHOW AVAILABLE BOOKS
            # --------------------------------------

            if choice == 1:

                show_books(engine, branch_names)

            # --------------------------------------
            # BORROW BOOK
            # --------------------------------------

            elif choice == 2:

                branch = choose_library(branch_names)
                show_books(engine, [branch])

                title = input(
                    "\nEnter the book title: "
                ).strip()

                with Session(engine) as session:
                    book = circulation.find_available_copy(
                        session, branch, title
                    )
                    circulation.borrow(session, card_number, book.id)

                    print(f"\n{name} borrowed '{book.title}' from {branch}.")

            # --------------------------------------
            # RETURN BOOK
            # --------------------------------------

            elif choice == 3:

                branch = choose_library(branch_names)

                title = input(
                    "Enter the book title to return: "
                ).strip()

                with Session(engine) as session:
                    loan = circulation.find_active_loan(
                        session, card_number, title
                    )
                    circulation.return_book(
                        session, card_number, loan.id, branch
                    )

                print(f"\n{name} returned '{title}' to {branch}.")

            # --------------------------------------
            # SHOW LIBRARY CARD
            # --------------------------------------

            elif choice == 4:

                show_card(engine, card_number)

            # --------------------------------------
            # EXIT
            # --------------------------------------

            elif choice == 5:

                print(f"\nGoodbye, {name}!")
                break

            else:

                raise ValueError(
                    "Please enter a number between 1 and 5."
                )

        # ------------------------------------------
        # EXCEPTION HANDLING
        # ------------------------------------------

        except ValueError as e:

            print(f"\nInput error: {e}")

        except LibraryError as e:

            print(f"\nLibrary error: {e}")

        except (EOFError, KeyboardInterrupt):

            print("\nExiting.")
            break
