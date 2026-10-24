# Data model and ERD

The SQLite schema in kb_bridge/repositories/schema.sql is a small baseline for source-aware observations. It contains no real observations yet.

~~~mermaid
erDiagram
  AREA ||--o{ METRIC_OBSERVATION : measures
  SOURCE_DATASET ||--o{ METRIC_OBSERVATION : provides
  AREA {
    text area_code PK
    text area_name
    text area_kind
    text parent_area_code FK
  }
  SOURCE_DATASET {
    text source_id PK
    text provider
    text dataset_name
    text retrieved_at
    text reference_url
  }
  METRIC_OBSERVATION {
    text area_code PK,FK
    text period PK
    text metric_code PK
    real value
    text unit
    text derivation PK
    text source_id PK,FK
  }
~~~

## Grain and keys

- One observation means one area × period × metric × source × derivation. Re-importing the same identity must update or reject it deliberately, never silently duplicate it.
- area_code must include the source/code-system context when administrative dong and commercial-area codes can overlap. area_kind distinguishes district, dong and market.
- period uses YYYYQn in the application contract. An ingestion adapter converts source-specific values such as 20262.
- metric_code and unit must be defined together in the domain catalog before importing data. Do not mix quarterly totals, monthly per-store values and per-hectare density under one metric code.
- derivation distinguishes source data, calculated data and manually verified official display values. The selection priority for a report belongs in a service and must be shown to the user.
- source_dataset records provider, retrieval date and reference so old snapshots remain traceable. No fake source or date should be inserted to satisfy the schema.

## Next schema decisions

- Define normalized industry codes and their source mappings before adding an industry dimension.
- Decide whether an owner's private inputs are stored at all. If stored, make retention, consent and access controls explicit.
- Model financial scenarios separately from public area observations. A scenario result is not a loan recommendation.
- Define risk-model version, training period, validation result and explanation before adding warning tables.

The current notebook reproduces historical 2021/2022 analysis and estimates some area labels. It is research input, not a validated forecast. A future warning must show its observation date, model version, scope and uncertainty.
