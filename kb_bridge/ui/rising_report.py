"""Charts for the rising-market report, based only on loaded snapshot values."""
from __future__ import annotations

from html import escape

import pandas as pd
import streamlit as st

from kb_bridge.services.rising_analysis import LABELS, overview_cards


def history_chart(report: dict, metric: str) -> bool:
    rows = sorted((row for row in report["history"] if row["metric"] == metric and row["value"] is not None),
                  key=lambda row: row["quarter"])
    if not rows:
        return False
    divisor = 100_000_000 if metric == "sales" else 1
    unit = "억 원" if metric == "sales" else "개" if metric == "stores" else "명"
    frame = pd.DataFrame({"분기": [f"{row['quarter'][:4]}년 {row['quarter'][-1]}분기" for row in rows],
                          "값": [row["value"] / divisor for row in rows]})
    st.subheader(f"{LABELS[metric]} 추이")
    st.line_chart(frame, x="분기", y="값", color="#E5A900",
                  alt=f"{report['name']}의 분기별 {LABELS[metric]} 추이")
    st.caption(f"단위: {unit} · 공개 원본의 분기별 지역 집계값")
    return True


def breakdown_chart(report: dict, *, category: str, title: str,
                    keys: list[str], names: list[str], unit: str) -> bool:
    details = report.get("details", {}).get(report["quarter"], {}).get(category, {})
    values = [details.get(key) for key in keys]
    if not any(value is not None for value in values):
        st.info(f"{title} 원본 자료가 없습니다.")
        return False
    frame = pd.DataFrame({"구분": names, "값": [value or 0 for value in values]})
    st.subheader(title)
    st.bar_chart(frame, x="구분", y="값", color="#E5A900", alt=f"{report['name']}의 {title}")
    st.caption(f"단위: {unit} · 공개 원본의 {report['quarter'][:4]}년 {report['quarter'][-1]}분기 집계값")
    return True


def industry_chart(report: dict) -> bool:
    groups = {"외식업": 0.0, "서비스업": 0.0, "소매업": 0.0}
    for item in report["industries"]:
        group = {"CS1": "외식업", "CS2": "서비스업", "CS3": "소매업"}.get(item["code"][:3])
        if group and item["stores"] is not None:
            groups[group] += item["stores"]
    if not any(groups.values()):
        st.info("업종별 점포 원본 자료가 없습니다.")
        return False
    st.subheader("업종분포")
    st.bar_chart(pd.DataFrame({"업종군": list(groups), "점포수": list(groups.values())}),
                 x="업종군", y="점포수", color="#E5A900", alt=f"{report['name']}의 업종군별 점포수")
    st.caption("서비스 업종 코드를 외식업·서비스업·소매업으로 묶은 공개 원본 집계값입니다.")
    return True


def history_table(report: dict) -> None:
    values: dict[str, dict] = {}
    for row in report["history"]:
        values.setdefault(row["quarter"], {})[row["metric"]] = row["value"]
    if values:
        st.subheader("분기별 원본 수치")
        st.dataframe([{"분기": f"{quarter[:4]}년 {quarter[-1]}분기",
                       **{LABELS[metric]: round(metrics[metric]) if metric in metrics else None for metric in LABELS}}
                      for quarter, metrics in sorted(values.items(), reverse=True)],
                     hide_index=True, alt=f"{report['name']}의 분기별 지역 지표 원본 수치")
        st.caption("매출은 분기 추정매출 합계(원)이며 점포당 월평균 매출과 다릅니다.")


def overview_card_grid(report: dict, *, selected_rank: int | None = None) -> None:
    """Source-labeled cards matching the three-column reference report."""
    cards = overview_cards(report)
    columns = st.columns(3, gap="small")
    for column, card in zip(columns, cards):
        def formatted(value: float | None, *, signed: bool = False) -> str:
            if value is None:
                return "비교 자료 없음" if signed else "자료 없음"
            magnitude = f"{abs(value):,.0f}" if card["key"] != "sales" else f"{abs(value):,.0f}"
            prefix = "+" if signed and value > 0 else "−" if signed and value < 0 else ""
            return f"{prefix}{magnitude}{card['unit']}"
        def delta_class(value: float | None) -> str:
            return "unknown" if value is None else "up" if value > 0 else "down" if value < 0 else "flat"
        rank_text = f"{selected_rank}위" if selected_rank is not None else "순위 미확인"
        with column:
            st.html(f"""<article class="kb-overview-card">
              <h4>{escape(card['title'])}</h4>
              <div class="kb-overview-delta {delta_class(card['previous_delta'])}"><small>전분기 대비</small><strong>{escape(formatted(card['previous_delta'], signed=True))}</strong></div>
              <div class="kb-overview-current"><small>{report['quarter'][:4]}년 {report['quarter'][-1]}분기</small><strong>{escape(formatted(card['current']))}</strong></div>
              <div class="kb-overview-delta {delta_class(card['year_delta'])}"><small>전년 동분기 대비</small><strong>{escape(formatted(card['year_delta'], signed=True))}</strong></div>
              <div class="kb-overview-rank"><small>나의 등수</small><strong>{rank_text if card['key'] == 'stores' else '확인 자료 없음'}</strong></div>
              <p>{escape(card['source'])}</p>
            </article>""")
