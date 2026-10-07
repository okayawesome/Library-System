from library_system.book import Book
from library_system.library import Library
from library_system.storage import load_data, save_data
from library_system.user import User


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
# PROGRAM ENTRY POINT
# --------------------------------------------------

# main() is called by `python -m library_system`
# and by the `library-system` command.


def main():

    # ----------------------------------------------
    # CREATE LIBRARIES
    # ----------------------------------------------

    delhi = Library("Delhi")
    mumbai = Library("Mumbai")
    bangalore = Library("Bangalore")

    libraries = [delhi, mumbai, bangalore]

    # ----------------------------------------------
    # LOAD SAVED DATA OR ADD DEFAULT BOOKS
    # ----------------------------------------------

    all_cards = load_data(libraries)

    if all_cards is None:

        all_cards = {}

        # Delhi Library

        delhi.add_book(
            Book("B001", "Harry Potter")
        )

        delhi.add_book(
            Book("B002", "The Chronicles of Narnia")
        )

        # Mumbai Library

        mumbai.add_book(
            Book("B003", "Harry Potter")
        )

        mumbai.add_book(
            Book("B004", "Lord Of The Rings")
        )

        # Bangalore Library

        bangalore.add_book(
            Book("B005", "Harry Potter")
        )

        bangalore.add_book(
            Book("B006", "Percy Jackson and the Olympians")
        )

        save_data(libraries, all_cards)

    # ----------------------------------------------
    # CREATE USER USING USER INPUT
    # ----------------------------------------------

    user = None

    while user is None:

        try:

            name = input("Enter your name: ")

            user = User(name)

            if user.name in all_cards:

                # Returning User: restore their borrowed books.
                user.library_card.borrowed_books = all_cards[user.name]

                print(
                    f"\nWelcome back, {user.name}!"
                )

            else:

                print(
                    f"\nWelcome, {user.name}!"
                )

            # all_cards and the LibraryCard share the same list, so every borrow/return is seen by save_data.
            all_cards[user.name] = user.library_card.borrowed_books

        except ValueError as e:

            # Empty name: show the error and ask again.
            print(f"Error: {e}")

        except (EOFError, KeyboardInterrupt):

            # No user was created, so the menu below is skipped.
            print("\nExiting.")
            break

    # ----------------------------------------------
    # MAIN MENU
    # ----------------------------------------------

    # If the name prompt was cancelled, user is None
    # and the menu never runs.

    while user is not None:

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
            # SHOW LIBRARIES
            # --------------------------------------

            if choice == 1:

                delhi.show_books()
                mumbai.show_books()
                bangalore.show_books()

            # --------------------------------------
            # BORROW BOOK
            # --------------------------------------

            elif choice == 2:

                print("\nSelect Library:")

                print("1. Delhi")
                print("2. Mumbai")
                print("3. Bangalore")

                library_choice = read_number("Enter library number: ")

                if library_choice == 1:

                    library = delhi

                elif library_choice == 2:

                    library = mumbai

                elif library_choice == 3:

                    library = bangalore

                else:

                    raise ValueError(
                        "Invalid library selection."
                    )

                # Show what this library currently has
                if not library.books:

                    print(
                        f"\n{library.name} Library has no books available."
                    )
                    continue

                library.show_books()

                title = input(
                    "\nEnter the book title: "
                ).strip()

                user.library_card.borrow(
                    library,
                    title
                )

                save_data(libraries, all_cards)

            # --------------------------------------
            # RETURN BOOK
            # --------------------------------------

            elif choice == 3:

                print("\nSelect Library:")

                print("1. Delhi")
                print("2. Mumbai")
                print("3. Bangalore")

                library_choice = read_number("Enter library number: ")

                if library_choice == 1:

                    library = delhi

                elif library_choice == 2:

                    library = mumbai

                elif library_choice == 3:

                    library = bangalore

                else:

                    raise ValueError(
                        "Invalid library selection."
                    )

                title = input(
                    "Enter the book title to return: "
                ).strip()

                user.library_card.return_book(
                    library,
                    title
                )

                save_data(libraries, all_cards)

            # --------------------------------------
            # SHOW LIBRARY CARD
            # --------------------------------------

            elif choice == 4:

                user.library_card.show_card()

            # --------------------------------------
            # EXIT
            # --------------------------------------

            elif choice == 5:

                save_data(libraries, all_cards)

                print(
                    f"\nGoodbye, {user.name}!"
                )

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

        except LookupError as e:

            print(f"\nLibrary error: {e}")

        except RuntimeError as e:

            print(f"\nBorrowing error: {e}")

        except TypeError as e:

            print(f"\nType error: {e}")

        except (EOFError, KeyboardInterrupt):

            save_data(libraries, all_cards)

            print("\nExiting.")
            break
