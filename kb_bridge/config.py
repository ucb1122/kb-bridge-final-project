"""Runtime configuration. Keys are supplied outside version control."""

from dataclasses import dataclass
from pathlib import Path
import os

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    db_path: Path
    kakao_map_javascript_key: str | None
    kakao_rest_api_key: str | None
    ollama_base_url: str
    ollama_model: str


def load_settings(project_root: Path | None = None) -> Settings:
    root = (project_root or Path(__file__).resolve().parent.parent).resolve()
    load_dotenv(root / ".env", override=False)
    db_value = os.getenv("KB_BRIDGE_DB_PATH", "data/local/kb_bridge.sqlite3")
    db_path = Path(db_value)
    if not db_path.is_absolute():
        db_path = root / db_path
    return Settings(
        db_path=db_path.resolve(),
        kakao_map_javascript_key=os.getenv("KAKAO_MAP_JAVASCRIPT_KEY") or None,
        kakao_rest_api_key=os.getenv("KAKAO_REST_API_KEY") or None,
        ollama_base_url=os.getenv("OLLAMA_BASE_URL") or "http://127.0.0.1:11434",
        ollama_model=os.getenv("OLLAMA_MODEL") or "gemma4:e2b",
    )
