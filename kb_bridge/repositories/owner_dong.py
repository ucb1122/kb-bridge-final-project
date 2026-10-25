"""Administrative-dong owner analysis from the project's read-only commerce snapshot."""
from __future__ import annotations

from . import rising_snapshot

METRICS = {"stores": "stores", "sales": "sales", "floating": "footfall", "resident": "residents"}
SCOPES = {None: None, "food": "CS1", "service": "CS2", "retail": "CS3"}


def available() -> bool:
    return rising_snapshot.available()


def quarter() -> str:
    return rising_snapshot.filters()["quarters"][0]


def regions(*, quarter: str, district: str = "", query: str = "") -> list[dict]:
    term = query.strip().casefold()
    return [{**row, "dong": row["name"], "type": "행정동 전체"}
            for row in rising_snapshot.locations(kind="dong", quarter=quarter)
            if (not district or row["district"] == district)
            and (not term or term in f"{row['district']} {row['name']}".casefold())]


def _scope(code: str | None) -> str | None:
    return SCOPES.get(code, code)


def _metric_values(db, *, quarter: str, metric: str, industry: str | None) -> dict[str, float]:
    if metric in {"floating", "resident"} or industry is None:
        rows = db.execute("SELECT region_code,value FROM observations WHERE kind='dong' AND quarter=? AND metric=?",
                          (quarter, METRICS[metric]))
    elif industry == "unmapped":
        return {}
    elif industry in {"CS1", "CS2", "CS3"}:
        column = "stores" if metric == "stores" else "sales"
        rows = db.execute(f"SELECT region_code,SUM({column}) FROM report_industries "
                          "WHERE kind='dong' AND quarter=? AND substr(industry_code,1,3)=? GROUP BY region_code",
                          (quarter, industry))
    else:
        column = "stores" if metric == "stores" else "sales"
        rows = db.execute(f"SELECT region_code,{column} FROM report_industries "
                          "WHERE kind='dong' AND quarter=? AND industry_code=?", (quarter, industry))
    return {str(code): float(value) for code, value in rows if value is not None}


def rankings(*, quarter: str, metric: str, industry_code: str | None, district: str = "") -> list[dict]:
    industry = _scope(industry_code)
    prior = rising_snapshot._previous_quarter(quarter)
    locations = regions(quarter=quarter, district=district)
    with rising_snapshot._connect() as db:
        current = _metric_values(db, quarter=quarter, metric=metric, industry=industry)
        previous = _metric_values(db, quarter=prior, metric=metric, industry=industry)
    result = []
    for area in locations:
        value, old = current.get(area["code"]), previous.get(area["code"])
        if value is None or old is None or old <= 0:
            continue
        result.append({**area, "value": value, "previous": old,
                       "change": (value - old) / old * 100})
    return sorted(result, key=lambda item: (-item["change"], -item["value"], item["code"]))


def _industry_stats(db, *, code: str, quarter: str, industry: str | None) -> dict:
    if industry == "unmapped":
        rows = []
    elif industry in {"CS1", "CS2", "CS3"}:
        rows = db.execute("SELECT stores,opened,closed,sales,transactions FROM report_industries "
                          "WHERE kind='dong' AND region_code=? AND quarter=? AND substr(industry_code,1,3)=?",
                          (code, quarter, industry)).fetchall()
    elif industry:
        rows = db.execute("SELECT stores,opened,closed,sales,transactions FROM report_industries "
                          "WHERE kind='dong' AND region_code=? AND quarter=? AND industry_code=?",
                          (code, quarter, industry)).fetchall()
    else:
        rows = db.execute("SELECT stores,opened,closed,sales,transactions FROM report_industries "
                          "WHERE kind='dong' AND region_code=? AND quarter=?", (code, quarter)).fetchall()
    def total(field):
        values = [row[field] for row in rows if row[field] is not None]
        return sum(values) if values else None
    return {**{field: total(field) for field in ("stores", "opened", "closed", "sales", "transactions")},
            "weekday": None, "weekend": None,
            "store_codes": sum(row["stores"] is not None for row in rows),
            "sales_codes": sum(row["sales"] is not None for row in rows)}


def report(code: str, industry_code: str | None, quarter: str) -> dict | None:
    raw = rising_snapshot.report(kind="dong", code=code, quarter=quarter)
    if raw is None:
        return None
    industry = _scope(industry_code)
    previous_quarter = rising_snapshot._previous_quarter(quarter)
    with rising_snapshot._connect() as db:
        current = _industry_stats(db, code=code, quarter=quarter, industry=industry)
        prior = _industry_stats(db, code=code, quarter=previous_quarter, industry=industry)
    if industry is None:
        for stats, period in ((current, quarter), (prior, previous_quarter)):
            values = {row["metric"]: row["value"] for row in raw["history"] if row["quarter"] == period}
            stats["stores"], stats["sales"] = values.get("stores"), values.get("sales")
    history = raw["history"]
    def previous(metric):
        return next((row["value"] for row in history
                     if row["quarter"] == previous_quarter and row["metric"] == metric), None)
    location = next(item for item in regions(quarter=quarter) if item["code"] == code)
    return {"area": {**location, "area": raw.get("area_m2")},
            "quarter": quarter, "previous": previous_quarter,
            "current": current, "prior": prior,
            "floating": raw["metrics"].get("footfall", {}).get("value"),
            "resident": raw["metrics"].get("residents", {}).get("value"), "worker": None,
            "population_prior": {"floating": previous("footfall"),
                                 "resident": previous("residents"), "worker": None},
            "industry_breakdown": raw["industries"], "industry_code": industry_code,
            "industry_name": industry_code or "전체 업종", "history": history,
            "scope": "행정동 전체"}
