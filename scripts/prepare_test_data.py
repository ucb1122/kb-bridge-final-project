"""Copy the test project's generated, read-only commerce snapshot for local migration."""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAMES = (
    "commerce.sqlite",
    "commerce-dong.geojson",
    "commerce.geojson",
    "official-rankings-20262.json",
    "official-report-sales-20262.json",
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Directory containing the test project's data files")
    args = parser.parse_args()
    destination = ROOT / "data" / "local"
    destination.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        source = args.source / name
        if not source.is_file():
            raise SystemExit(f"Missing source file: {source}")
        target = destination / name
        shutil.copy2(source, target)
        print(f"Copied {name} ({target.stat().st_size:,} bytes)")
    owner_source = args.source.parent / "pages" / "owner" / "assets"
    for source_name, target_name in (("regional-data.json", "owner-regional-data.json"), ("businesses.json", "owner-businesses.json"), ("additional-businesses.json", "owner-additional-businesses.json"), ("kb-branches.json", "kb-branches.json")):
        source = owner_source / source_name
        if not source.is_file():
            raise SystemExit(f"Missing owner file: {source}")
        target = destination / target_name
        shutil.copy2(source, target)
        print(f"Copied {target_name} ({target.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
