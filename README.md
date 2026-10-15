# Library System

A command-line library system. Users can borrow books from the
libraries, return them, and see their
library card. Data is saved to `library_data.json` in the folder the
program is run from.

## Project layout

```
library-system/
├── .python-version           # Python version uv uses
├── pyproject.toml
├── uv.lock                   # exact versions, created by uv
├── README.md
├── src/
│   └── library_system/
│       ├── __init__.py       # package exports
│       ├── __main__.py       # enables `python -m library_system`
│       ├── book.py           # Book
│       ├── library.py        # Library
│       ├── library_card.py   # LibraryCard (borrowing rules)
│       ├── user.py           # User
│       ├── storage.py        # save/load library_data.json
│       └── cli.py            # menu and main()
└── tests/
    └── test_library_card.py
```

## Setup

This project uses [uv](https://docs.astral.sh/uv/).

```
uv sync
```

## Run

```
uv run library-system
```

or

```
uv run python -m library_system
```

## Test

```
uv run python -m unittest discover tests
```
