"""Read-only migration adapter for the team owner's local snapshot."""
from __future__ import annotations

import json
from functools import lru_cache
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOCAL = ROOT / "data" / "local"
CATALOG = ROOT / "assets" / "industry-catalog.json"


def available() -> bool:
    return (LOCAL / "owner-regional-data.json").is_file()


@lru_cache(maxsize=1)
def regional() -> dict:
    return json.loads((LOCAL / "owner-regional-data.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def catalog() -> list[dict]:
    return json.loads(CATALOG.read_text(encoding="utf-8"))


def markets(*, district: str = "", query: str = "") -> list[dict]:
    term = query.strip().casefold()
    result = []
    for area in regional()["areas"].values():
        if district and area["district"] != district:
            continue
        if term and term not in (area["name"] + " " + area["district"] + " " + area.get("dong", "")).casefold():
            continue
        result.append({k: area.get(k) for k in ("code", "name", "district", "dong", "type", "lat", "lng")})
    return sorted(result, key=lambda a: (a["district"], a["name"]))


def market_report(code: str, industry_code: str | None = None) -> dict:
    area = regional()["areas"][code]
    quarter = regional()["quarter"]
    previous = regional()["previous"]
    current = area["periods"].get(quarter, {})
    prior = area["periods"].get(previous, {})
    current_industries = current.get("industries", {})
    prior_industries = prior.get("industries", {})
    if industry_code:
        current_stats = current_industries.get(industry_code, {})
        previous_stats = prior_industries.get(industry_code, {})
    else:
        current_stats = {metric: sum(entry.get(metric, 0) or 0 for entry in current_industries.values()) for metric in ("stores", "opened", "closed", "sales")}
        previous_stats = {metric: sum(entry.get(metric, 0) or 0 for entry in prior_industries.values()) for metric in ("stores", "opened", "closed", "sales")}
    return {"area": {k: area.get(k) for k in ("code", "name", "district", "dong", "type", "area", "lat", "lng")},
            "quarter": quarter, "previous": previous, "current": current_stats, "prior": previous_stats,
            "floating": current.get("floating"), "resident": current.get("resident"), "worker": current.get("worker"),
            "industry_code": industry_code, "industry_name": regional()["industries"].get(industry_code) if industry_code else "전체 업종"}


def founder_rankings(industry_code: str, *, district: str = "") -> list[dict]:
    if not industry_code:
        return []
    quarter = regional()["quarter"]
    result = []
    for area in regional()["areas"].values():
        if district and area["district"] != district:
            continue
        stats = area["periods"].get(quarter, {}).get("industries", {}).get(industry_code)
        if not stats or not stats.get("stores"):
            continue
        result.append({"code": area["code"], "name": area["name"], "district": area["district"],
                       "stores": stats.get("stores"), "sales": stats.get("sales"), "lat": area["lat"], "lng": area["lng"]})
    return sorted(result, key=lambda x: (x["sales"] is not None, x["sales"] or 0, x["stores"]), reverse=True)


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth = 6_371_000
    lat1, lng1, lat2, lng2 = map(radians, (lat1, lng1, lat2, lng2))
    dlat, dlng = lat2 - lat1, lng2 - lng1
    return 2 * earth * asin(sqrt(sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2))


@lru_cache(maxsize=1)
def _businesses() -> list[dict]:
    result = []
    for name in ("owner-businesses.json", "owner-additional-businesses.json"):
        path = LOCAL / name
        if not path.is_file():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        columns = payload["columns"]
        result.extend(dict(zip(columns, row)) for row in payload["rows"])
    return result


def _matches_industry(row: dict, group: dict) -> bool:
    industry = row.get("industry") or ""
    if group.get("unavailable"):
        return False
    if group.get("other"):
        return industry.startswith(("일반음식점 ·", "휴게음식점 ·", "제과점영업 ·")) and not any(industry in item.get("types", []) for item in catalog() if item["id"] != group["id"])
    if group.get("otherService"):
        return any(industry.startswith(p) for p in group.get("prefixes", [])) and not any(industry in item.get("types", []) for item in catalog() if item["id"] != group["id"])
    return industry in group.get("types", []) or any(industry.startswith(p) for p in group.get("prefixes", []))


def licence_observations(*, lat: float, lng: float, radius_m: int, group_id: str) -> dict:
    group = next((x for x in catalog() if x["id"] == group_id), None)
    if not group:
        return {"selected": 0, "total": 0, "examples": []}
    selected = total = 0
    examples = []
    for row in _businesses():
        rlat, rlng = row.get("lat"), row.get("lng")
        if not isinstance(rlat, (int, float)) or not isinstance(rlng, (int, float)):
            continue
        if abs(rlat - lat) > .03 or abs(rlng - lng) > .04:
            continue
        if distance_m(lat, lng, rlat, rlng) > radius_m:
            continue
        total += 1
        if _matches_industry(row, group):
            selected += 1
            if len(examples) < 30:
                examples.append({"업소명": row.get("name"), "업태": row.get("industry"), "주소": row.get("address")})
    return {"selected": selected, "total": total, "examples": examples}


@lru_cache(maxsize=1)
def branches() -> dict:
    return json.loads((LOCAL / "kb-branches.json").read_text(encoding="utf-8"))


def nearest_branches(lat: float, lng: float, limit: int = 3) -> list[dict]:
    result = []
    for branch in branches()["branches"]:
        if not isinstance(branch.get("lat"), (float, int)) or not isinstance(branch.get("lng"), (float, int)):
            continue
        result.append({**branch, "meters": distance_m(lat, lng, branch["lat"], branch["lng"])})
    return sorted(result, key=lambda x: x["meters"])[:limit]
