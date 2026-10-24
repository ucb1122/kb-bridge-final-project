"""Tests for the initial repository contracts."""

from contextlib import closing
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from kb_bridge.config import load_settings
from kb_bridge.repositories.database import connect_database, initialize_database


class ConfigTests(unittest.TestCase):
    def test_database_path_is_resolved_from_project_root(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.dict("os.environ", {"KB_BRIDGE_DB_PATH": "data/local/test.sqlite3"}, clear=True):
                settings = load_settings(root)
            self.assertEqual(settings.db_path, root / "data/local/test.sqlite3")
            self.assertIsNone(settings.kakao_rest_api_key)

    def test_local_config_uses_kakao_javascript_and_ollama_names(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / ".env").write_text(
                "KAKAO_MAP_JAVASCRIPT_KEY=sample-key\n"
                "OLLAMA_BASE_URL=http://127.0.0.1:11434\n"
                "OLLAMA_MODEL=gemma4:e2b\n",
                encoding="utf-8",
            )
            with patch.dict("os.environ", {}, clear=True):
                settings = load_settings(root)
            self.assertEqual(settings.kakao_map_javascript_key, "sample-key")
            self.assertEqual(settings.ollama_base_url, "http://127.0.0.1:11434")
            self.assertEqual(settings.ollama_model, "gemma4:e2b")


class DatabaseTests(unittest.TestCase):
    def test_schema_is_idempotent_and_rejects_orphan_observation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / "nested" / "test.sqlite3"
            initialize_database(db_path)
            initialize_database(db_path)
            with closing(connect_database(db_path)) as connection:
                self.assertEqual(connection.execute("PRAGMA foreign_keys").fetchone()[0], 1)
                with self.assertRaises(sqlite3.IntegrityError):
                    connection.execute(
                        "INSERT INTO metric_observation VALUES (?, ?, ?, ?, ?, ?, ?)",
                        ("dong:1", "2026Q2", "stores", 12, "store", "source", "missing"),
                    )

    def test_same_metric_from_two_sources_is_kept_separate(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / "test.sqlite3"
            initialize_database(db_path)
            with closing(connect_database(db_path)) as connection:
                with connection:
                    connection.execute(
                        "INSERT INTO area (area_code, area_name, area_kind) VALUES (?, ?, ?)",
                        ("dong:1", "예시동", "dong"),
                    )
                    connection.executemany(
                        "INSERT INTO source_dataset (source_id, provider, dataset_name, retrieved_at) VALUES (?, ?, ?, ?)",
                        [
                            ("raw", "공개자료", "예시 원본", "2026-10-25"),
                            ("official", "공식화면", "검증 예시", "2026-10-25"),
                        ],
                    )
                    connection.executemany(
                        "INSERT INTO metric_observation VALUES (?, ?, ?, ?, ?, ?, ?)",
                        [
                            ("dong:1", "2026Q2", "monthly_sales_per_store", 100, "KRW/store/month", "calculated", "raw"),
                            ("dong:1", "2026Q2", "monthly_sales_per_store", 103, "KRW/store/month", "verified_display", "official"),
                        ],
                    )
                count = connection.execute("SELECT COUNT(*) FROM metric_observation").fetchone()[0]
            self.assertEqual(count, 2)


if __name__ == "__main__":
    unittest.main()
