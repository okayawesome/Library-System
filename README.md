# Library System

A network of branch libraries. **Members** sign up, browse the
inventory, and borrow and return books at any branch. **Administrators**
add books and add new libraries. One FastAPI server runs the JSON API
and serves the website, and all data lives in a SQLite database.

## Who can do what

|                                        | Member | Admin |
| -------------------------------------- | :----: | :---: |
| Create an account (sign up)            |   ✓    |       |
| View the catalogue and branch stock    |   ✓    |   ✓   |
| Borrow and return books                |   ✓    |       |
| See their own loan history             |   ✓    |       |
| Add books (one physical copy at a time)|        |   ✓   |
| Remove books (not while on loan)       |        |   ✓   |
| Add libraries                          |        |   ✓   |
| Remove libraries (only when empty)     |        |   ✓   |

Members never see other members' loans. Admins see which copies are on
loan but not who has them, and cannot borrow.

Removing a book or a library hides it rather than deleting it, so
members' loan history keeps working. Adding a library with the name of
a removed one opens it again.

## Borrowing rules

- A member can have at most 3 books at a time.
- A member cannot have two copies of the same title at once, even from
  different branches.
- A book can be returned to any branch, and stays at the branch that
  received it. Every loan records both branches.

## Folder structure

```
library-system/
├── README.md
├── backend/                       Python: web API, database, CLI
│   ├── pyproject.toml             dependencies; FastAPI entrypoint
│   ├── uv.lock
│   ├── library.db                 SQLite database (created on first run, not committed)
│   ├── src/library_system/
│   │   ├── config.py              settings from LIBRARY_* environment variables
│   │   ├── database.py            SQLite engine, transactions, first-run setup
│   │   ├── models.py              tables: Branch, Book, Member, Admin, Loan
│   │   ├── seed.py                demo libraries, books and accounts
│   │   ├── passwords.py           Argon2 password hashing
│   │   ├── services/              the rules, shared by the API and the CLI
│   │   │   ├── catalogue.py       libraries and books (admins add)
│   │   │   ├── circulation.py     borrowing and returning (members)
│   │   │   ├── accounts.py        sign-up and sign-in checks
│   │   │   └── errors.py
│   │   ├── api/
│   │   │   ├── main.py            create_app(): /api plus the website at /
│   │   │   ├── security.py        sign-in tokens; keeps the roles apart
│   │   │   ├── dependencies.py    database session and settings
│   │   │   ├── schemas.py         request and response bodies
│   │   │   ├── errors.py
│   │   │   └── routes/
│   │   │       ├── public.py      /api/branches
│   │   │       ├── member.py      /api/member/...
│   │   │       └── admin.py       /api/admin/...
│   │   ├── cli.py                 command-line program for members
│   │   └── __main__.py
│   └── tests/
│       ├── test_services.py       the rules, against a real SQLite file
│       └── test_api.py            the HTTP API, including role separation
└── frontend/                      the website: HTML, CSS, JavaScript modules
    ├── index.html
    ├── css/styles.css
    └── js/
        ├── main.js                sign-in and sign-up; starts the member or admin side
        ├── member.js              member screens and actions
        ├── admin.js               admin screens and actions
        ├── inventory.js           catalogue and branch screens both roles share
        ├── api.js                 calls to the backend
        └── ui.js                  dialogs, messages, formatting
```

## Setup

This project uses [uv](https://docs.astral.sh/uv/). Run everything from
the `backend` folder:

```
cd backend
uv sync
```

## Run the website

```
uv run fastapi dev
```

Open http://127.0.0.1:8000. The API documentation is at
http://127.0.0.1:8000/docs.

The first run creates `backend/library.db` with five libraries, 13 books
and these demo accounts:

| Role          | Sign in with | Password    |
| ------------- | ------------ | ----------- |
| Administrator | `admin`      | `admin123`  |
| Member        | `LM-1001`    | `member123` |

Members LM-1001 to LM-1005 all use `member123`. Change these passwords
before using real data.

## Run the command-line program

Members can also borrow and return from the terminal. It uses the same
database and rules as the website.

```
uv run library-system
```

## Test

```
uv run python -m unittest discover tests
```

## Settings

Set these environment variables to change the defaults:

| Variable                | Default                                     |
| ----------------------- | ------------------------------------------- |
| `LIBRARY_DATABASE_FILE` | `backend/library.db`                        |
| `LIBRARY_SECRET_KEY`    | random on every start (signs everyone out)  |
| `LIBRARY_FRONTEND_DIR`  | `frontend/`                                 |

Generate a secret key with `openssl rand -hex 32`.

## API

Members and admins sign in at separate endpoints. A member token is
refused on admin endpoints (403), and the other way round.

| Method | Path                               | Who      | What                          |
| ------ | ---------------------------------- | -------- | ----------------------------- |
| GET    | `/api/branches`                    | anyone   | every library                 |
| POST   | `/api/member/signup`               | anyone   | create a member account       |
| POST   | `/api/member/token`                | anyone   | member sign-in (card number)  |
| GET    | `/api/member/me`                   | member   | your account                  |
| GET    | `/api/member/books`                | member   | the inventory                 |
| GET    | `/api/member/loans`                | member   | your loans                    |
| POST   | `/api/member/loans`                | member   | borrow a copy                 |
| POST   | `/api/member/loans/{id}/return`    | member   | return at any branch          |
| POST   | `/api/admin/token`                 | anyone   | admin sign-in                 |
| GET    | `/api/admin/me`                    | admin    | your account                  |
| GET    | `/api/admin/books`                 | admin    | the inventory                 |
| POST   | `/api/admin/books`                 | admin    | add a copy                    |
| DELETE | `/api/admin/books/{id}`            | admin    | remove a copy                 |
| POST   | `/api/admin/branches`              | admin    | add (or reopen) a library     |
| DELETE | `/api/admin/branches/{name}`       | admin    | remove an empty library       |

Breaking a borrowing rule returns `409 Conflict` with the same message
the command-line program shows; so does removing a copy that is on loan
or a library that still has books. Unknown books, libraries and loans
return `404`. A successful removal returns `204 No Content`.
