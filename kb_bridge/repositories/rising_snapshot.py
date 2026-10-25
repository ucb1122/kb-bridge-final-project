"""Read-only adapter for the test project's commerce snapshot.

This stays separate from the final normalized schema until raw-source ingestion is ready.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

SNAPSHOT_DIR = Path(__file__).resolve().parents[2] / "data" / "local"
DB_PATH = SNAPSHOT_DIR / "commerce.sqlite"
METRICS = {"stores", "sales", "footfall", "residents"}
KINDS = {"dong", "area"}
CRITERIA = {"growth", "highest", "absolute"}
INDUSTRIES = {"all", "CS1", "CS2", "CS3"}


def available() -> bool:
    return DB_PATH.is_file()


def _connect() -> sqlite3.Connection:
    if not available():
        raise FileNotFoundError("테스트 프로젝트의 상권 DB를 준비해 주세요.")
    db = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    return db


def _snapshot(quarter: str, prefix: str) -> dict:
    path = SNAPSHOT_DIR / f"{prefix}-{quarter}.json"
    if not path.is_file():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if str(data.get("quarter")) == quarter else {}


def filters() -> dict:
    with _connect() as db:
        quarters = [r[0] for r in db.execute("SELECT quarter FROM observations GROUP BY quarter HAVING COUNT(DISTINCT kind || ':' || metric)=8 ORDER BY quarter DESC")]
        districts = [r[0] for r in db.execute("SELECT DISTINCT district FROM observations WHERE district != '' ORDER BY district")]
    return {"quarters": quarters, "districts": districts}



def locations(*, kind: str, quarter: str) -> list[dict]:
    """Regions available for the map selector in a given quarter."""
    if kind not in KINDS or len(quarter) != 5 or not quarter.isdigit():
        raise ValueError("잘못된 지역 또는 분기입니다.")
    with _connect() as db:
        rows = db.execute("""SELECT DISTINCT region_code AS code, region_name AS name,
            district, lat, lng FROM observations
            WHERE kind=? AND metric='stores' AND quarter=?
            ORDER BY district, region_name""", (kind, quarter)).fetchall()
    return [{"code": str(row["code"]), "name": row["name"].replace("?", "·"),
             "district": row["district"], "lat": row["lat"], "lng": row["lng"]}
            for row in rows]


def _previous_quarter(quarter: str) -> str:
    year, part = int(quarter[:4]), int(quarter[4])
    return f"{year - 1}4" if part == 1 else f"{year}{part - 1}"


def _values(db: sqlite3.Connection, *, kind: str, metric: str, quarters: list[str], industry: str) -> dict[str, float]:
    if not quarters:
        return {}
    marks = ",".join("?" for _ in quarters)
    if industry == "all":
        sql = f"SELECT region_code, SUM(value) FROM observations WHERE kind=? AND metric=? AND quarter IN ({marks}) GROUP BY region_code"
        params = [kind, metric, *quarters]
    else:
        column = "stores" if metric == "stores" else "sales"
        sql = f"SELECT region_code, SUM({column}) FROM report_industries WHERE kind=? AND substr(industry_code,1,3)=? AND quarter IN ({marks}) GROUP BY region_code"
        params = [kind, industry, *quarters]
    return {str(code): float(value) for code, value in db.execute(sql, params) if value is not None}


def rankings(*, kind: str = "dong", metric: str = "stores", quarter: str | None = None,
             district: str = "", criterion: str = "growth", comparison: str = "previous",
             industry: str = "all", period: str = "quarter", year: str | None = None) -> dict:
    if kind not in KINDS or metric not in METRICS or criterion not in CRITERIA or industry not in INDUSTRIES:
        raise ValueError("잘못된 조회 조건입니다.")
    if comparison not in {"previous", "same"} or period not in {"quarter", "year"}:
        raise ValueError("잘못된 비교 조건입니다.")
    if industry != "all" and metric not in {"stores", "sales"}:
        raise ValueError("업종 조건은 점포수와 매출에만 적용됩니다.")
    with _connect() as db:
        quarter = quarter or db.execute("SELECT MAX(quarter) FROM observations").fetchone()[0]
        if not quarter or len(quarter) != 5 or not quarter.isdigit() or quarter[-1] not in "1234":
            raise ValueError("유효하지 않은 분기입니다.")
        year = year or quarter[:4]
        if len(year) != 4 or not year.isdigit():
            raise ValueError("유효하지 않은 연도입니다.")
        if period == "year":
            current_quarters = [r[0] for r in db.execute("SELECT DISTINCT quarter FROM observations WHERE substr(quarter,1,4)=? ORDER BY quarter", (year,))]
            if metric in {"stores", "residents"}:
                current_quarters = current_quarters[-1:]
            if industry != "all" and criterion != "highest":
                detailed = {r[0] for r in db.execute("SELECT DISTINCT quarter FROM report_industries")}
                current_quarters = [q for q in current_quarters if q in detailed and f"{int(q[:4])-1}{q[4]}" in detailed]
            reference_quarters = [f"{int(q[:4])-1}{q[4]}" for q in current_quarters]
        else:
            current_quarters = [quarter]
            reference_quarters = [f"{int(quarter[:4])-1}{quarter[4]}" if comparison == "same" else _previous_quarter(quarter)]
        current = _values(db, kind=kind, metric=metric, quarters=current_quarters, industry=industry)
        previous = _values(db, kind=kind, metric=metric, quarters=reference_quarters, industry=industry)
        metadata_quarter = current_quarters[-1] if current_quarters else quarter
        metadata = db.execute("""SELECT region_code,region_name,district,lat,lng FROM observations
            WHERE kind=? AND metric='stores' AND quarter=? AND (?='' OR district=?)""",
            (kind, metadata_quarter, district, district)).fetchall()
        rows = []
        for item in metadata:
            code = str(item["region_code"])
            value, prior = current.get(code), previous.get(code)
            if value is None or (criterion != "highest" and prior is None):
                continue
            delta = value - prior if prior is not None else None
            change = delta / prior if prior and prior > 0 else None
            rows.append({"code": code, "name": item["region_name"].replace("?", "·"),
                         "district": item["district"], "lat": item["lat"], "lng": item["lng"],
                         "value": value, "previous": prior, "delta": delta, "change": change,
                         "value_source": "public_raw", "change_source": "public_raw",
                         "rank_source": "calculated"})
        source = "calculated"
        if criterion == "growth" and comparison == "previous" and industry == "all" and period == "quarter":
            snapshot = _snapshot(quarter, "official-rankings")
            codes = snapshot.get("entries", {}).get(f"{kind}:{metric}:{district}")
            lookup = {row["code"]: row for row in rows}
            if codes and all(code in lookup for code in codes):
                source = "official"
                ordered = [lookup[code] for code in codes]
                rows = ordered + [row for row in rows if row["code"] not in set(codes)]
                for row in ordered:
                    row["rank_source"] = "official"
                    key = f"{kind}:{metric}:{row['code']}"
                    if metric == "sales" and key in snapshot.get("values", {}):
                        row["value"] = round(snapshot["values"][key] * 100_000_000)
                        row["value_source"] = "official_rank"
                    if key in snapshot.get("rates", {}):
                        row["change"] = snapshot["rates"][key] / 100
                        row["change_source"] = "official_rank"
        if source == "calculated":
            key = {"growth": "change", "highest": "value", "absolute": "delta"}[criterion]
            rows.sort(key=lambda row: (row[key] if row[key] is not None else float("-inf"), row["value"], row["code"]), reverse=True)
        return {"quarter": metadata_quarter, "period": period, "rows": rows[:10], "ranking_source": source}


def report(*, kind: str, code: str, quarter: str, industry: str = "all") -> dict | None:
    if kind not in KINDS or industry not in INDUSTRIES or not code or not code.isdigit() or len(quarter) != 5 or not quarter.isdigit():
        raise ValueError("잘못된 지역 또는 분기입니다.")
    with _connect() as db:
        observations = db.execute("SELECT metric,value,region_name,district FROM observations WHERE quarter=? AND kind=? AND region_code=?", (quarter, kind, code)).fetchall()
        if not observations:
            return None
        history = [dict(row) for row in db.execute("SELECT quarter,metric,value FROM observations WHERE kind=? AND region_code=? AND quarter<=? AND quarter>=? ORDER BY quarter", (kind, code, quarter, f"{int(quarter[:4])-1}{quarter[4]}"))]
        detail_rows = db.execute("SELECT quarter,category,key,value FROM report_details WHERE kind=? AND region_code=? AND quarter<=? AND quarter>=?", (kind, code, quarter, f"{int(quarter[:4])-1}{quarter[4]}"))
        details: dict = {}
        for q, category, key, value in detail_rows:
            details.setdefault(q, {}).setdefault(category, {})[key] = value
        industries = [dict(row) for row in db.execute("SELECT industry_code AS code,name,stores,regular,franchise,opened,closed,sales,transactions FROM report_industries WHERE kind=? AND region_code=? AND quarter=? ORDER BY stores DESC", (kind, code, quarter))]
        benchmarks = {r["metric"]: {"district": r["district_value"], "city": r["city_value"]} for r in db.execute("SELECT metric, SUM(CASE WHEN district=? THEN value ELSE 0 END) AS district_value, SUM(value) AS city_value FROM observations WHERE quarter=? AND kind=? GROUP BY metric", (observations[0]["district"], quarter, kind))}
        industry_history = {}
        if industry != "all":
            industry_history = {q: {"stores": stores, "sales": sales} for q, stores, sales in db.execute(
                "SELECT quarter, SUM(stores), SUM(sales) FROM report_industries "
                "WHERE kind=? AND region_code=? AND substr(industry_code,1,3)=? "
                "AND quarter<=? AND quarter>=? GROUP BY quarter",
                (kind, code, industry, quarter, f"{int(quarter[:4])-1}{quarter[4]}"))}
        prior = _previous_quarter(quarter)
        previous = {m: v for m, v in db.execute("SELECT metric,value FROM observations WHERE quarter=? AND kind=? AND region_code=?", (prior, kind, code))}
    snapshot = _snapshot(quarter, "official-rankings")
    sales_snapshot = _snapshot(quarter, "official-report-sales")
    verified_path = Path(__file__).resolve().parents[2] / "data" / "verified" / f"report-sales-{quarter}.json"
    verified = json.loads(verified_path.read_text(encoding="utf-8")) if verified_path.is_file() else {}
    verified_values = verified.get("values", {}) if verified.get("quarter") == quarter else {}
    existing_values = sales_snapshot.get("values", {})
    if any(key in existing_values and existing_values[key] != value for key, value in verified_values.items()):
        raise ValueError("공식 보고서 확인값이 서로 다릅니다.")
    report_sales = existing_values | verified_values
    metrics = {row["metric"]: {"value": row["value"], "change": (row["value"] - previous[row["metric"]]) / previous[row["metric"]] if previous.get(row["metric"], 0) > 0 else None} for row in observations}
    if industry != "all":
        history = [row for row in history if row["metric"] not in {"stores", "sales"}]
        for q, values in industry_history.items():
            for metric in ("stores", "sales"):
                if values[metric] is not None:
                    history.append({"quarter": q, "metric": metric, "value": values[metric]})
        for metric in ("stores", "sales"):
            current_value = industry_history.get(quarter, {}).get(metric)
            previous_value = industry_history.get(prior, {}).get(metric)
            metrics[metric] = {"value": current_value,
                               "change": (current_value - previous_value) / previous_value
                               if current_value is not None and previous_value is not None and previous_value > 0 else None}
    return {"code": code, "kind": kind, "quarter": quarter, "name": observations[0]["region_name"].replace("?", "·"),
            "district": observations[0]["district"], "industry": industry, "metrics": metrics, "history": history,
            "details": details, "industries": industries, "benchmarks": benchmarks,
            "area_m2": snapshot.get("areas", {}).get(f"{kind}:{code}"),
            "official_sales_eok": snapshot.get("values", {}).get(f"{kind}:sales:{code}"),
            "official_report_sales": report_sales.get(f"{kind}:{code}") if industry == "all" else None}
