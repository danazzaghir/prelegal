from contextlib import asynccontextmanager, closing

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles

from prelegal_backend.chat import router as chat_router
from prelegal_backend.config import Settings
from prelegal_backend.database import connect, init_db


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db(settings.database_path)
        yield

    app = FastAPI(title="Prelegal", lifespan=lifespan)
    app.state.settings = settings

    @app.get("/api/health")
    def health(request: Request) -> dict[str, str]:
        with closing(connect(request.app.state.settings.database_path)) as conn:
            conn.execute("SELECT COUNT(*) FROM users").fetchone()
        return {"status": "ok", "database": "ok"}

    app.include_router(chat_router)

    # Unknown API paths get a JSON 404 rather than the frontend's 404 page.
    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
    def api_not_found(path: str) -> None:
        raise HTTPException(status_code=404, detail="Not Found")

    # Mounted last so the API routes above take precedence.
    if settings.static_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="frontend")

    return app


app = create_app()
