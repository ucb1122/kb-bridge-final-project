"""Charts for the rising-market report, based only on loaded snapshot values."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from kb_bridge.services.rising_analysis import LABELS


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
