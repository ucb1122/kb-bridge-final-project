"""Display calculations for source-aware rising-area reports."""
from __future__ import annotations

LABELS = {"stores": "점포수", "sales": "추정매출액", "footfall": "유동인구", "residents": "상주인구"}
UNITS = {"stores": "개", "sales": "원", "footfall": "명", "residents": "명"}


def human_value(metric: str, value: float | None) -> str:
    if value is None:
        return "자료 없음"
    if metric == "sales" and abs(value) >= 100_000_000:
        return f"{value / 100_000_000:,.1f}억 원"
    return f"{value:,.0f}{UNITS[metric]}"


def percent(value: float | None) -> str:
    return "비교 자료 없음" if value is None else f"{value * 100:+.1f}%"


def sales_per_store_month(report: dict) -> tuple[float | None, str]:
    official = report.get("official_report_sales")
    if official and official.get("current") is not None:
        return official["current"], "공식 화면 확인값"
    official_total = report.get("official_sales_eok")
    sales = official_total * 100_000_000 if official_total is not None else report["metrics"].get("sales", {}).get("value")
    stores = report["metrics"].get("stores", {}).get("value")
    if sales is None or not stores:
        return None, "자료 없음"
    return sales / 3 / stores / 10_000, "공식 순위 표시값 환산" if official_total is not None else "공개 원본 계산값"


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
    if stores:
        lines.append(f"이번 분기 개업 점포 {stores.get('opened', 0):,.0f}개, 폐업 점포 {stores.get('closed', 0):,.0f}개가 기록됐습니다.")
    return lines
