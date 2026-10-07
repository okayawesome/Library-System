import json

from library_system.book import Book


# --------------------------------------------------
# FILE MANAGEMENT
# --------------------------------------------------

# All data is stored in library_data.json, in the
# folder the program is running from. The file looks like:
#
# {
#     "libraries": {
#         "Delhi": [{"book_id": "B001", "title": "Harry Potter"}],
#         ...
#     },
#     "users": {
#         "Anmol": [{"book_id": "B003", "title": "Harry Potter"}],
#         ...
#     }
# }
#
# "libraries" holds the books currently on each shelf.
# "users" holds the books each User currently has.
#
# The data is saved after every borrow, every return,
# and on exit, so nothing is lost between runs.

DATA_FILE = "library_data.json"


def book_to_dict(book):

    return {
        "book_id": book.book_id,
        "title": book.title
    }


def dict_to_book(data):

    return Book(data["book_id"], data["title"])


def save_data(libraries, all_cards):

    data = {
        "libraries": {
            library.name: [
                book_to_dict(book) for book in library.books
            ]
            for library in libraries
        },
        "users": {
            name: [
                book_to_dict(book) for book in books
            ]
            for name, books in all_cards.items()
        }
    }

    try:

        with open(DATA_FILE, "w", encoding="utf-8") as file:
            json.dump(data, file, indent=4)

    except OSError as e:

        # A failed save should not crash the program.
        print(f"\nWarning: could not save data: {e}")


def load_data(libraries):

    # Returns a dictionary of
    #   user name -> list of borrowed Book objects
    #
    # Returns None if there is no saved file yet,
    # or if the file is unreadable. The caller then starts with the default books.

    try:

        with open(DATA_FILE, "r", encoding="utf-8") as file:
            data = json.load(file)

        # Build everything first, so a broken file does
        # not leave the libraries half loaded.

        shelves = {
            library.name: [
                dict_to_book(book)
                for book in data["libraries"].get(library.name, [])
            ]
            for library in libraries
        }

        all_cards = {
            name: [dict_to_book(book) for book in books]
            for name, books in data.get("users", {}).items()
        }

    except FileNotFoundError:

        # First run: no saved file yet.
        return None

    except (OSError, json.JSONDecodeError,
            KeyError, TypeError, ValueError) as e:

        print(
            f"Warning: could not read {DATA_FILE} ({e}). "
            "Starting with the default books."
        )
        return None

    for library in libraries:
        library.books = shelves[library.name]

    return all_cards
