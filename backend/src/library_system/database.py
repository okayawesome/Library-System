"""The SQLite database: engine, transactions and first-run setup."""

from pathlib import Path

from sqlalchemy import Engine, event
from sqlmodel import Session, SQLModel, create_engine

import library_system.models  # noqa: F401  (registers the tables)
from library_system.seed import seed_if_empty


def make_engine(database_file: str | Path) -> Engine:
    engine = create_engine(
        f"sqlite:///{database_file}",
        # FastAPI may use one session from more than one thread.
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def on_connect(dbapi_connection, connection_record):
        # Let SQLAlchemy start transactions (see on_begin), and make
        # SQLite check foreign keys, which it does not do by default.
        dbapi_connection.isolation_level = None
        dbapi_connection.execute("PRAGMA foreign_keys = ON")

    @event.listens_for(engine, "begin")
    def on_begin(connection):
        # IMMEDIATE takes the write lock at the start of a transaction,
        # so two requests can never both pass the borrowing checks
        # before either of them writes.
        connection.exec_driver_sql("BEGIN IMMEDIATE")

    return engine


def init_database(engine: Engine) -> None:
    """Create any missing tables, and add demo data on the first run."""
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        seed_if_empty(session)
