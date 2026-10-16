"""Prelegal backend: the FastAPI API, which also serves the built frontend."""


def main() -> None:
    import uvicorn

    from prelegal_backend.config import Settings

    settings = Settings.from_env()
    uvicorn.run("prelegal_backend.main:app", host=settings.host, port=settings.port)
