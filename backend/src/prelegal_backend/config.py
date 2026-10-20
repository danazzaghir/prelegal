import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BACKEND_DIR.parent


@dataclass(frozen=True)
class Settings:
    database_path: Path
    # The statically exported frontend (`npm run build` in frontend/).
    static_dir: Path
    host: str = "127.0.0.1"
    port: int = 8000

    @classmethod
    def from_env(cls) -> "Settings":
        # Outside Docker, pick up secrets such as OPENROUTER_API_KEY from the repo's .env.
        load_dotenv(REPO_DIR / ".env", override=False)
        return cls(
            database_path=Path(os.environ.get("DATABASE_PATH", BACKEND_DIR / "data" / "prelegal.db")),
            static_dir=Path(os.environ.get("STATIC_DIR", REPO_DIR / "frontend" / "out")),
            host=os.environ.get("HOST", "127.0.0.1"),
            port=int(os.environ.get("PORT", "8000")),
        )
