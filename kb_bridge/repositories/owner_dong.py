"""Administrative-dong owner analysis from the project's read-only commerce snapshot."""
from __future__ import annotations

from . import rising_snapshot

OWNER_REGION_VERSION = 2

METRICS = {"stores": "stores", "sales": "sales", "floating": "footfall", "resident": "residents"}
SCOPES = {None: None, "food": "CS1", "service": "CS2", "retail": "CS3"}


def available() -> bool:
    return rising_snapshot.available()


def quarters() -> list[str]:
    """Quarters with an immediately preceding quarter for ranking comparisons."""
    available = rising_snapshot.filters()["quarters"]
    return [quarter for quarter in available
            if rising_snapshot._previous_quarter(quarter) in available]


def quarter() -> str:
    return quarters()[0]


def regions(*, quarter: str, district: str = "", query: str = "", kind: str = "dong") -> list[dict]:
    term = query.strip().casefold()
    return [{**row, "dong": row["name"] if kind == "dong" else None,
             "type": "행정동 전체" if kind == "dong" else "공식 상권 전체"}
            for row in rising_snapshot.locations(kind=kind, quarter=quarter)
            if (not district or row["district"] == district)
            and (not term or term in f"{row['district']} {row['name']}".casefold())]


def _scope(code: str | None) -> str | None:
    return SCOPES.get(code, code)


def _metric_values(db, *, quarter: str, metric: str, industry: str | None,
                   kind: str) -> dict[str, float]:
    if metric in {"floating", "resident"} or industry is None:
        rows = db.execute("SELECT region_code,value FROM observations WHERE kind=? AND quarter=? AND metric=?",
                          (kind, quarter, METRICS[metric]))
    elif industry == "unmapped":
        return {}
    elif industry in {"CS1", "CS2", "CS3"}:
        column = "stores" if metric == "stores" else "sales"
        rows = db.execute(f"SELECT region_code,SUM({column}) FROM report_industries "
                          "WHERE kind=? AND quarter=? AND substr(industry_code,1,3)=? GROUP BY region_code",
                          (kind, quarter, industry))
    else:
        column = "stores" if metric == "stores" else "sales"
        rows = db.execute(f"SELECT region_code,{column} FROM report_industries "
                          "WHERE kind=? AND quarter=? AND industry_code=?", (kind, quarter, industry))
    return {str(code): float(value) for code, value in rows if value is not None}


def rankings(*, quarter: str, metric: str, industry_code: str | None,
             district: str = "", kind: str = "dong") -> list[dict]:
    industry = _scope(industry_code)
    prior = rising_snapshot._previous_quarter(quarter)
    locations = regions(quarter=quarter, district=district, kind=kind)
    with rising_snapshot._connect() as db:
        current = _metric_values(db, quarter=quarter, metric=metric, industry=industry, kind=kind)
        previous = _metric_values(db, quarter=prior, metric=metric, industry=industry, kind=kind)
    result = []
    for area in locations:
        value, old = current.get(area["code"]), previous.get(area["code"])
        if value is None or old is None or old <= 0:
            continue
        result.append({**area, "value": value, "previous": old,
                       "change": (value - old) / old * 100})
    return sorted(result, key=lambda item: (-item["change"], -item["value"], item["code"]))


def _industry_stats(db, *, code: str, quarter: str, industry: str | None,
                    kind: str) -> dict:
    if industry == "unmapped":
        rows = []
    elif industry in {"CS1", "CS2", "CS3"}:
        rows = db.execute("SELECT stores,opened,closed,sales,transactions FROM report_industries "
                          "WHERE kind=? AND region_code=? AND quarter=? AND substr(industry_code,1,3)=?",
                          (kind, code, quarter, industry)).fetchall()
    elif industry:
        rows = db.execute("SELECT stores,opened,closed,sales,transactions FROM report_industries "
                          "WHERE kind=? AND region_code=? AND quarter=? AND industry_code=?",
                          (kind, code, quarter, industry)).fetchall()
    else:
        rows = db.execute("SELECT stores,opened,closed,sales,transactions FROM report_industries "
                          "WHERE kind=? AND region_code=? AND quarter=?", (kind, code, quarter)).fetchall()
    def total(field):
        values = [row[field] for row in rows if row[field] is not None]
        return sum(values) if values else None
    return {**{field: total(field) for field in ("stores", "opened", "closed", "sales", "transactions")},
            "weekday": None, "weekend": None,
            "store_codes": sum(row["stores"] is not None for row in rows),
            "sales_codes": sum(row["sales"] is not None for row in rows)}


def report(code: str, industry_code: str | None, quarter: str,
           kind: str = "dong") -> dict | None:
    raw = rising_snapshot.report(kind=kind, code=code, quarter=quarter)
    if raw is None:
        return None
    industry = _scope(industry_code)
    previous_quarter = rising_snapshot._previous_quarter(quarter)
    with rising_snapshot._connect() as db:
        current = _industry_stats(db, code=code, quarter=quarter, industry=industry, kind=kind)
        prior = _industry_stats(db, code=code, quarter=previous_quarter, industry=industry, kind=kind)
    if industry is None:
        for stats, period in ((current, quarter), (prior, previous_quarter)):
            values = {row["metric"]: row["value"] for row in raw["history"] if row["quarter"] == period}
            stats["stores"], stats["sales"] = values.get("stores"), values.get("sales")
    history = raw["history"]
    def previous(metric):
        return next((row["value"] for row in history
                     if row["quarter"] == previous_quarter and row["metric"] == metric), None)
    location = next(item for item in regions(quarter=quarter, kind=kind) if item["code"] == code)
    return {"area": {**location, "area": raw.get("area_m2")},
            "quarter": quarter, "previous": previous_quarter,
            "current": current, "prior": prior,
            "floating": raw["metrics"].get("footfall", {}).get("value"),
            "resident": raw["metrics"].get("residents", {}).get("value"), "worker": None,
            "population_prior": {"floating": previous("footfall"),
                                 "resident": previous("residents"), "worker": None},
            "industry_breakdown": raw["industries"], "industry_code": industry_code,
            "industry_name": industry_code or "전체 업종", "history": history,
            "scope": "행정동 전체" if kind == "dong" else "공식 상권 전체"}
