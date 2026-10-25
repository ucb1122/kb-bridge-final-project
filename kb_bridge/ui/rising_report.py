"""Charts for the rising-market report, based only on loaded snapshot values."""
from __future__ import annotations

from html import escape
import re

import streamlit as st

from kb_bridge.services.rising_analysis import LABELS, overview_cards
from kb_bridge.ui import static_chart

RISING_REPORT_VERSION = 3


_TREND_WORDS = re.compile(r"급증|급감|증가|감소|상승|하락")
_UP_WORDS = {"급증", "증가", "상승"}


def highlight_trends(line: str) -> str:
    """Escape generated text before highlighting trend words."""
    safe = escape(line)
    return _TREND_WORDS.sub(
        lambda match: f'<strong class="kb-ai-trend {"up" if match.group() in _UP_WORDS else "down"}">{match.group()}</strong>',
        safe,
    )


def history_chart(report: dict, metric: str) -> bool:
    rows = sorted((row for row in report["history"] if row["metric"] == metric and row["value"] is not None),
                  key=lambda row: row["quarter"])
    if not rows:
        return False
    divisor = 100_000_000 if metric == "sales" else 1
    unit = "억 원" if metric == "sales" else "개" if metric == "stores" else "명"
    static_chart.bars(f"{LABELS[metric]} 추이",
                      [f"{row['quarter'][:4]}년 {row['quarter'][-1]}분기" for row in rows],
                      [row["value"] / divisor for row in rows], unit)
    st.caption(f"단위: {unit} · 공개 원본의 분기별 지역 집계값")
    return True


def breakdown_chart(report: dict, *, category: str, title: str,
                    keys: list[str], names: list[str], unit: str) -> bool:
    details = report.get("details", {}).get(report["quarter"], {}).get(category, {})
    values = [details.get(key) for key in keys]
    if not any(value is not None for value in values):
        st.info(f"{title} 원본 자료가 없습니다.")
        return False
    static_chart.bars(title, names, values, unit, current_last=False)
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
    static_chart.bars("업종분포", list(groups), list(groups.values()), "개", current_last=False)
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


def overview_card_grid(report: dict, *, ranks: dict[str, tuple[int, int]] | None = None) -> None:
    """Source-labeled cards matching the three-column reference report."""
    cards = overview_cards(report)
    columns = st.columns(3, gap="small")
    ranks = ranks or {}
    for column, card in zip(columns, cards):
        def formatted(value: float | None, *, signed: bool = False) -> str:
            if value is None:
                return "비교 자료 없음" if signed else "자료 없음"
            magnitude = f"{abs(value):,.0f}" if card["key"] != "sales" else f"{abs(value):,.0f}"
            prefix = "+" if signed and value > 0 else "−" if signed and value < 0 else ""
            return f"{prefix}{magnitude}{card['unit']}"
        def delta_class(value: float | None) -> str:
            return "unknown" if value is None else "up" if value > 0 else "down" if value < 0 else "flat"
        rank = ranks.get(card["key"])
        rank_text = f"{rank[0]}/{rank[1]}위" if rank else "비교 자료 없음"
        rank_source = "자치구 내 공식 순위" if card["key"] in (report.get("official_report_ranks") or {}) else "자치구 내 원본 계산 순위"
        with column:
            st.html(f"""<article class="kb-overview-card">
              <h4>{escape(card['title'])}</h4>
              <div class="kb-overview-delta {delta_class(card['previous_delta'])}"><small>전분기 대비</small><strong>{escape(formatted(card['previous_delta'], signed=True))}</strong></div>
              <div class="kb-overview-current"><small>{report['quarter'][:4]}년 {report['quarter'][-1]}분기</small><strong>{escape(formatted(card['current']))}</strong></div>
              <div class="kb-overview-delta {delta_class(card['year_delta'])}"><small>전년 동분기 대비</small><strong>{escape(formatted(card['year_delta'], signed=True))}</strong></div>
              <div class="kb-overview-rank"><small>{rank_source}</small><strong>{escape(rank_text)}</strong></div>
              <p>{escape(card['source'])}</p>
            </article>""")


def _quarter_label(quarter: str) -> str:
    return f"{quarter[:4]}년 {quarter[-1]}분기"


def _change(current: float | None, earlier: float | None, unit: str) -> str:
    if current is None or earlier is None:
        return "비교 자료 없음"
    direction = "증가" if current > earlier else "감소" if current < earlier else "변동 없음"
    return f"{abs(current-earlier):,.0f}{unit} {direction}"


def _detail_trend(report: dict, key: str, title: str) -> None:
    detail = report.get("details", {})
    quarters = sorted(q for q in detail if detail[q].get("stores", {}).get(key) is not None)
    if quarters:
        static_chart.bars(title, [_quarter_label(q) for q in quarters],
                          [detail[q]["stores"][key] for q in quarters], "개")


def industry_insights(report: dict) -> None:
    """팀 보고서의 업종 분석을 공개 원본에서 확인 가능한 항목으로 구성한다."""
    detail = report.get("details", {})
    quarter = report["quarter"]
    stores = detail.get(quarter, {}).get("stores", {})
    previous = f"{int(quarter)-1}" if quarter[-1] != "1" else f"{int(quarter[:4])-1}4"
    year = f"{int(quarter[:4])-1}{quarter[-1]}"
    previous_stores = detail.get(previous, {}).get("stores", {})
    year_stores = detail.get(year, {}).get("stores", {})
    store_metric = report.get("metrics", {}).get("stores", {})
    count = store_metric.get("value")
    if count is not None:
        st.subheader(f"점포수는 {count:,.0f}개입니다.")
        st.caption(f"전분기 대비 {_change(count, next((row['value'] for row in report['history'] if row['metric']=='stores' and row['quarter']==previous), None), '개')} · 서울시 공개 지역 집계")
    regular, franchise = stores.get("regular"), stores.get("franchise")
    if regular is not None or franchise is not None:
        static_chart.shares("일반점포와 프랜차이즈 점포수", {"일반점포": regular, "프랜차이즈": franchise}, "개")
        st.caption("일반점포와 프랜차이즈는 선택 지역·분기의 공개 원본 구분입니다.")
    for key, label in (("opened", "개업수"), ("closed", "폐업수")):
        current = stores.get(key)
        if current is None:
            continue
        st.subheader(f"{label}는 {current:,.0f}개입니다.")
        st.write(f"전분기 대비 {_change(current, previous_stores.get(key), '개')} · 전년 동분기 대비 {_change(current, year_stores.get(key), '개')}")
        _detail_trend(report, key, f"{label} 추이")
    if stores.get("opened") is not None and stores.get("closed") is not None:
        opened, closed = stores["opened"], stores["closed"]
        if opened < previous_stores.get("opened", opened) and closed < previous_stores.get("closed", closed):
            st.info("개업과 폐업이 모두 전분기보다 줄었습니다. 업종별 변화와 집계 기준을 함께 확인해 보세요.")
        st.caption("개업−폐업과 점포수의 분기 변화는 집계 시점과 범위 차이로 일치하지 않을 수 있습니다.")
    st.info("평균 영업기간과 신생기업 3년 생존율은 현재 연결된 원본에 없어 표시하지 않습니다.")
