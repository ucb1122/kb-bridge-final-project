-- Provenance-first baseline, not an imported Seoul dataset.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS area (
    area_code TEXT PRIMARY KEY,
    area_name TEXT NOT NULL,
    area_kind TEXT NOT NULL CHECK (area_kind IN ('district', 'dong', 'market')),
    parent_area_code TEXT REFERENCES area(area_code)
);

CREATE TABLE IF NOT EXISTS source_dataset (
    source_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    dataset_name TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    reference_url TEXT,
    note TEXT
);

CREATE TABLE IF NOT EXISTS metric_observation (
    area_code TEXT NOT NULL REFERENCES area(area_code),
    period TEXT NOT NULL,
    metric_code TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    derivation TEXT NOT NULL CHECK (derivation IN ('source', 'calculated', 'verified_display')),
    source_id TEXT NOT NULL REFERENCES source_dataset(source_id),
    PRIMARY KEY (area_code, period, metric_code, source_id, derivation)
);

CREATE INDEX IF NOT EXISTS idx_metric_lookup
ON metric_observation(metric_code, period, area_code);
