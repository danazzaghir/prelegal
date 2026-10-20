import os
from contextlib import asynccontextmanager, closing

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles

from prelegal_backend.agreements import router as agreements_router
from prelegal_backend.auth import router as auth_router
from prelegal_backend.chat import router as chat_router
from prelegal_backend.config import Settings
from prelegal_backend.database import connect, init_db
from prelegal_backend.documents import load_documents
from prelegal_backend.documents import router as documents_router


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db(settings.database_path)
        yield

    app = FastAPI(title="Prelegal", lifespan=lifespan)
    app.state.settings = settings
    app.state.documents = load_documents(settings.catalog_path, settings.templates_dir)

    @app.get("/api/health")
    def health(request: Request) -> dict[str, str]:
        with closing(connect(request.app.state.settings.database_path)) as conn:
            conn.execute("SELECT COUNT(*) FROM users").fetchone()
        return {"status": "ok", "database": "ok"}

    app.include_router(auth_router)
    app.include_router(agreements_router)
    app.include_router(chat_router)
    app.include_router(documents_router)

    # Unknown API paths get a JSON 404 rather than the frontend's 404 page.
    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
    def api_not_found(path: str) -> None:
        raise HTTPException(status_code=404, detail="Not Found")

    # Mounted last so the API routes above take precedence.
    if settings.static_dir.is_dir():
        app.mount("/", FrontendFiles(directory=settings.static_dir, html=True), name="frontend")

    return app


class FrontendFiles(StaticFiles):
    """
    The exported frontend. When a link is shown, Next.js prefetches the page's
    data as `__next.<segment>.__PAGE__.txt`, but the export writes it as
    `__next.<segment>/__PAGE__.txt`; this serves the second for the first.
    """

    def lookup_path(self, path: str) -> tuple[str, os.stat_result | None]:
        found = super().lookup_path(path)
        name = os.path.basename(path)
        if found[1] is not None or not (name.startswith("__next.") and name.endswith(".txt")):
            return found
        parts = name.removesuffix(".txt").split(".")
        if len(parts) < 3:
            return found
        folder = ".".join(parts[:2])
        return super().lookup_path(os.path.join(os.path.dirname(path), folder, *parts[2:]) + ".txt")


app = create_app()
