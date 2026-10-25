"""Display calculations for source-aware rising-area reports."""
from __future__ import annotations

LABELS = {"stores": "점포수", "sales": "추정매출액", "footfall": "유동인구", "residents": "상주인구"}
UNITS = {"stores": "개", "sales": "원", "footfall": "명", "residents": "명"}
OVERVIEW_CARDS_VERSION = 2


def human_value(metric: str, value: float | None) -> str:
    if value is None:
        return "자료 없음"
    if metric == "sales" and abs(value) >= 100_000_000:
        return f"{value / 100_000_000:,.1f}억 원"
    return f"{value:,.0f}{UNITS[metric]}"


def percent(value: float | None) -> str:
    return "비교 자료 없음" if value is None else f"{value * 100:+.1f}%"


def ranking_change_label(metric: str, row: dict, criterion: str) -> str:
    """Show absolute sorting in metric units; other rankings show rates."""
    if criterion == "absolute":
        delta = row.get("delta")
        if delta is None:
            return "비교 자료 없음"
        sign = "+" if delta > 0 else "−" if delta < 0 else ""
        return f"{sign}{human_value(metric, abs(delta))}"
    return percent(row.get("change"))


def monthly_sales_from_totals(sales: float | None, stores: float | None) -> float | None:
    """Return 만 원/점포/월 from one quarter's matching raw observations."""
    if sales is None or stores is None or stores <= 0:
        return None
    return sales / 3 / stores / 10_000


def sales_per_store_month(report: dict) -> tuple[float | None, str]:
    official = report.get("official_report_sales")
    if official and official.get("current") is not None:
        return official["current"], "공식 보고서 확인값"
    sales = report["metrics"].get("sales", {}).get("value")
    stores = report["metrics"].get("stores", {}).get("value")
    value = monthly_sales_from_totals(sales, stores)
    return (value, "공개 원본 계산값") if value is not None else (None, "자료 없음")


def _history_value(report: dict, metric: str, quarter: str) -> float | None:
    return next((item["value"] for item in report.get("history", [])
                 if item["metric"] == metric and item["quarter"] == quarter), None)


def _comparison_quarters(quarter: str) -> tuple[str, str]:
    year, part = int(quarter[:4]), int(quarter[4])
    previous = f"{year - 1}4" if part == 1 else f"{year}{part - 1}"
    return previous, f"{year - 1}{part}"


def overview_cards(report: dict) -> list[dict]:
    """Three cards with explicit units and provenance; unavailable comparisons stay null."""
    quarter = report["quarter"]
    previous, year_ago = _comparison_quarters(quarter)
    cards = []

    stores = report["metrics"].get("stores", {}).get("value")
    cards.append({
        "key": "stores", "title": "점포수", "unit": "개", "current": stores,
        "previous_delta": stores - _history_value(report, "stores", previous)
            if stores is not None and _history_value(report, "stores", previous) is not None else None,
        "year_delta": stores - _history_value(report, "stores", year_ago)
            if stores is not None and _history_value(report, "stores", year_ago) is not None else None,
        "source": "공개 원본", "rank": None,
    })

    official = report.get("official_report_sales") or {}
    raw_sales = report["metrics"].get("sales", {}).get("value")
    current_monthly = monthly_sales_from_totals(raw_sales, stores)
    verified = official.get("current") is not None
    if verified:
        current_monthly = official["current"]
    def monthly_at(q: str) -> float | None:
        return monthly_sales_from_totals(_history_value(report, "sales", q),
                                         _history_value(report, "stores", q))
    previous_monthly, year_monthly = monthly_at(previous), monthly_at(year_ago)
    cards.append({
        "key": "sales", "title": "매출액 (점포당 월평균)", "unit": "만 원/점포/월",
        "current": current_monthly,
        "previous_delta": official.get("previousChange") if verified and official.get("previousChange") is not None
            else current_monthly - previous_monthly if not verified and current_monthly is not None and previous_monthly is not None else None,
        "year_delta": official.get("yearAgoChange") if verified and official.get("yearAgoChange") is not None
            else current_monthly - year_monthly if not verified and current_monthly is not None and year_monthly is not None else None,
        "source": "공식 보고서 확인값" if verified else "공개 원본 계산값", "rank": None,
    })

    footfall = report["metrics"].get("footfall", {}).get("value")
    area = report.get("area_m2")
    area_ha = area / 10_000 if area and area > 0 else None
    density = footfall / area_ha if footfall is not None and area_ha else None
    previous_footfall = _history_value(report, "footfall", previous)
    year_footfall = _history_value(report, "footfall", year_ago)
    # Historical population observations use the same verified analysis area as the
    # current quarter, so each comparison has the same 명/ha denominator.
    divisor = area_ha or 1
    cards.append({
        "key": "footfall",
        "title": "유동인구 밀도" if density is not None else "유동인구 (분기 총량)",
        "unit": "명/ha" if density is not None else "명",
        "current": density if density is not None else footfall,
        "previous_delta": (footfall - previous_footfall) / divisor
            if footfall is not None and previous_footfall is not None else None,
        "year_delta": (footfall - year_footfall) / divisor
            if footfall is not None and year_footfall is not None else None,
        "source": f"3개월·1ha당 · 공개 원본 / {quarter[:4]}년 {quarter[-1]}분기 분석 면적" if density is not None else "공개 원본",
        "rank": None,
    })
    return cards


def footfall_per_ha(report: dict) -> tuple[float | None, str]:
    area = report.get("area_m2")
    footfall = report["metrics"].get("footfall", {}).get("value")
    if not area or footfall is None:
        return None, "면적 정보 없음"
    return footfall / (area / 10_000), "분석 면적 기준 계산값"


def overview_lines(report: dict) -> list[str]:
    lines = []
    for metric, label in LABELS.items():
        item = report["metrics"].get(metric)
        if not item:
            continue
        change = item.get("change")
        trend = "전분기 비교 자료가 없습니다" if change is None else ("전분기와 같습니다" if change == 0 else f"전분기보다 {abs(change) * 100:.1f}% {'증가' if change > 0 else '감소'}했습니다")
        lines.append(f"{label}은 {human_value(metric, item['value'])}이며 {trend}.")
    stores = report.get("details", {}).get(report["quarter"], {}).get("stores", {})
    if stores and report.get("industry", "all") == "all":
        opened, closed = stores.get("opened"), stores.get("closed")
        if opened is not None and closed is not None:
            lines.append(f"이번 분기 개업 점포 {opened:,.0f}개, 폐업 점포 {closed:,.0f}개가 기록됐습니다.")
    return lines
