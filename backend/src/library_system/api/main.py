"""Creates the FastAPI app: the JSON API under /api, the website at /.

Run it with ``uv run fastapi dev`` from the backend folder (see
``[tool.fastapi]`` in pyproject.toml), then open http://127.0.0.1:8000.
API docs are at http://127.0.0.1:8000/docs.
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.staticfiles import StaticFiles

from library_system.api.routes import admin, member, public
from library_system.config import Settings
from library_system.database import init_database, make_engine

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    engine = make_engine(settings.database_file)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if "secret_key" not in settings.model_fields_set:
            logger.warning(
                "LIBRARY_SECRET_KEY is not set. Using a random key, so "
                "everyone is signed out when the server restarts."
            )

        init_database(engine)
        yield
        engine.dispose()

    app = FastAPI(
        title="Library Network API",
        summary="Members borrow and return books; admins add books "
        "and libraries.",
        version="0.2.0",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.engine = engine

    api = APIRouter(prefix="/api")
    api.include_router(public.router)
    api.include_router(member.router)
    api.include_router(admin.router)
    app.include_router(api)

    # Everything outside /api is the website. The page and the API share
    # one origin, so the browser needs no CORS settings.
    if settings.frontend_dir.is_dir():
        app.mount(
            "/",
            StaticFiles(directory=settings.frontend_dir, html=True),
            name="frontend",
        )

    return app


app = create_app()
