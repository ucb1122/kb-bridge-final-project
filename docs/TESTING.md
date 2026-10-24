# Test strategy

## In issue #1

Run python -m unittest discover -s tests -v and python -m compileall -q app.py app_pages kb_bridge. The current tests verify configuration path resolution and SQLite schema behavior. Navigation can be checked by starting Streamlit and opening all three pages; the pages intentionally show scaffolding text.

## Issue #3 snapshot parity

With prepared local snapshots, `tests/test_snapshot_parity.py` checks official Gangnam ordering, Gangdong sales value/rate, detail filters, Jamsil report sales override, the team owner Jamsil beauty example, nearest-branch distance order, and the provided rent/loan arithmetic example. Without local snapshots these checks skip. Streamlit AppTest smoke checks both owner modes, the finance form, and rising selection. Browser Kakao interaction could not be visually checked in this environment and needs manual confirmation.

## Next slices

- Domain unit tests: quarterly-to-monthly conversion, per-store and per-hectare units, period comparisons, ranking ties and missing values.
- Repository tests: source-aware upsert, foreign keys, idempotent re-import, and queries by area/period/industry.
- Integration tests: one fixture from a real Seoul dataset through normalize → SQLite → service → report payload. Check region codes, units, provenance and counts.
- UI smoke tests: menu routing, matching list/map/report area and period, missing-data messages, and hidden warning results while the model is unvalidated.
- External adapters: mock Kakao/Seoul API responses in routine tests; run live checks only when keys and network access are available.
- Financial scenarios: known input/output examples and boundary cases; never test against actual approval outcomes.

Record the source snapshot and expected values for each official comparison. A matching example does not prove all Seoul regions or periods match.
