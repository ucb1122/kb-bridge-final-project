"""Right-hand owner report sections built from the team's local snapshot."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from kb_bridge.repositories.owner_snapshot import distance_m

OWNER_REPORT_VERSION = 3


def _number(value: float | None, unit: str = "") -> str:
    return "자료 없음" if value is None else f"{value:,.0f}{unit}"


def _amount(value: float | None) -> str:
    return "자료 없음" if value is None else f"{value / 100_000_000:,.1f}억 원"


def _comparison(current: float | None, previous: float | None, unit: str = "") -> str:
    if current is None or previous is None:
        return "비교 자료 없음"
    difference = current - previous
    if previous <= 0:
        return f"{difference:+,.0f}{unit} · 증감률 비교 불가"
    return f"{difference:+,.0f}{unit} · {difference / previous:+.1%}"


def _sales_delta(current: float | None, previous: float | None) -> str | None:
    return None if current is None or previous is None or previous <= 0 else f"{current / previous - 1:+.1%}"

def _delta(current: float | None, previous: float | None, unit: str = "") -> str | None:
    return None if current is None or previous is None else f"{current - previous:+,.0f}{unit}"


def _coverage(stats: dict) -> str:
    return f"매출 제공 {stats['sales_codes']}개 / 점포수 제공 {stats['store_codes']}개 업종"


def _observations(observations: dict | None, *, radius: int, examples: bool = False) -> None:
    if observations is None:
        st.info("상호·주소로 점포 위치를 선택하면 주변 인허가 관측을 볼 수 있습니다.")
        return
    left, right = st.columns(2)
    with left:
        st.metric("선택 업태 인허가 관측", _number(observations["selected"], "건"), border=True)
    with right:
        st.metric("반경 안 확보 인허가 기록", _number(observations["total"], "건"), border=True)
    st.caption(f"점포 위치에서 직선거리 {radius:,}m · 영업 인허가 기록 기준. 중복 허가가 포함될 수 있고, 공식 점포수와 다릅니다.")
    if examples and observations["examples"]:
        st.dataframe(observations["examples"][:20], hide_index=True,
                     alt="선택 반경의 인허가 업소 예시")


def render_section(section: str, *, report: dict, market: dict, mode: str,
                   selected_business: dict | None, radius: int,
                   observations: dict | None, metric: str, ranking: list[dict]) -> None:
    current, previous = report["current"], report["prior"]
    population_previous = report["population_prior"]
    owner = mode == "나는 사장"
    metric_label = {"stores": "점포수", "sales": "매출", "floating": "유동인구", "resident": "거주인구"}[metric]
    dong = report.get("scope") == "행정동 전체"
    scope_label = "행정동" if dong else "공식 상권"
    if section == "한눈에 보기":
        if dong:
            store_change = None if previous["stores"] in (None, 0) or current["stores"] is None else current["stores"] - previous["stores"]
            people_change = None if population_previous["floating"] in (None, 0) or report["floating"] is None else report["floating"] - population_previous["floating"]
            direction = {(True, True): "점포수와 유동인구 집계가 줄었어요",
                         (False, False): "점포수와 유동인구 집계가 늘었어요",
                         (True, False): "점포수는 줄고 유동인구 집계는 늘었어요",
                         (False, True): "점포수는 늘고 유동인구 집계는 줄었어요"}
            headline = (direction.get((store_change < 0, people_change < 0))
                        if store_change not in (None, 0) and people_change not in (None, 0)
                        else "상권의 점포수와 유동인구를 확인해 보세요")
            st.subheader(headline)
        else:
            st.subheader("내 점포 주변과 공식 상권" if selected_business else "공식 상권 한눈에 보기" if owner else "창업 후보 상권 한눈에 보기")
        store_scope_changed = current["store_codes"] != previous["store_codes"]
        sales_scope_changed = current["sales_codes"] != previous["sales_codes"]
        cards = st.columns(3, gap="small")
        with cards[0]:
            st.metric("점포수" if dong else "공식 점포수", _number(current["stores"], "개"),
                      (f"전분기 대비 {_sales_delta(current['stores'], previous['stores'])}"
                       + (" · 업종 범위 변경" if store_scope_changed else "")) if dong
                      else _delta(current["stores"], previous["stores"], "개"), border=True,
                      delta_color="off")
        with cards[1]:
            st.metric("분기 추정매출" if dong else "추정매출 원본 금액", _amount(current["sales"]),
                      (f"전분기 대비 {_sales_delta(current['sales'], previous['sales'])}"
                       + (" · 업종 범위 변경" if sales_scope_changed else "")
                       + f" · 매출 제공 {current['sales_codes']} / 점포 제공 {current['store_codes']}개 업종") if dong
                      else _sales_delta(current["sales"], previous["sales"]), border=True,
                      delta_color="off")
        with cards[2]:
            st.metric("유동인구 집계" if dong else "상권 유동인구 집계", _number(report["floating"], "명"),
                      f"전분기 대비 {_sales_delta(report['floating'], population_previous['floating'])}" if dong
                      else _delta(report["floating"], population_previous["floating"], "명"), border=True,
                      delta_color="off")
        coverage_changed = (current["store_codes"] != previous["store_codes"] or
                            current["sales_codes"] != previous["sales_codes"])
        st.caption(f"전분기 대비 집계입니다. {'업종 범위 변경 · ' if coverage_changed else ''}{_coverage(current)} · 인구는 {scope_label} 전체입니다.")
        with st.expander("집계 기준 확인 · 1건"):
            st.write("점포수와 매출은 서울시 공개 원본의 지역 집계입니다. 유동인구는 업종과 무관한 지역 전체 값입니다.")
        if dong and report.get("history") and report.get("industry_code") is None:
            history = {}
            for row in report["history"]:
                if row["metric"] in {"stores", "sales", "footfall"}:
                    history.setdefault(row["quarter"], {})[row["metric"]] = row["value"]
            quarters = sorted(history)
            if quarters:
                st.markdown("### 점포수 추이")
                st.line_chart(pd.DataFrame({"점포수": [history[q].get("stores") for q in quarters]},
                                           index=[f"{q[:4]}년 {q[-1]}분기" for q in quarters]), height=160)
                st.markdown("### 분기 추정매출 추이")
                st.line_chart(pd.DataFrame({"억 원": [(history[q].get("sales") or 0) / 100_000_000 for q in quarters]},
                                           index=[f"{q[:4]}년 {q[-1]}분기" for q in quarters]), height=160)
            with st.expander("분석 설명·집계 기준"):
                st.write(f"{market['district']} {market['name']} · {scope_label} 전체 · {report['quarter'][:4]}년 {report['quarter'][-1]}분기. 지역 통계와 우리 가게의 실제 실적을 함께 확인해 보세요.")
                st.write("추정매출은 지역·업종 집계값이며 개별 점포의 실매출·이익·대출 가능액을 뜻하지 않습니다.")
                st.write("결측값은 자료 없음으로 표시합니다. 증가율은 (현재−전분기)÷전분기×100이며 전분기 값이 0이면 계산하지 않습니다.")
            with st.expander("원본 수치·계산 근거"):
                st.dataframe([{"분기": f"{q[:4]}년 {q[-1]}분기",
                               "점포수": _number(values.get("stores"), "개"),
                               "분기 추정매출": _number(values.get("sales"), "원"),
                               "유동인구 집계": _number(values.get("footfall"), "명")}
                              for q, values in sorted(history.items())], hide_index=True,
                             alt=f"{market['name']} 최근 분기 원본 수치")
                st.caption("증가율은 (이번 분기−전분기)÷전분기×100입니다. 전분기 값이 0이거나 없으면 표시하지 않습니다.")
        if owner:
            _observations(observations, radius=radius)
        else:
            rank = next((index for index, row in enumerate(ranking, 1) if row["code"] == market["code"]), None)
            if rank is not None:
                st.info(f"{metric_label} 전분기 증가율 순위: {rank}/{len(ranking)}위 · 조건에 맞는 {scope_label} 내 순위")
        st.caption("출처: 서울특별시 서울 열린데이터광장 / 공공데이터포털(data.go.kr)")
        st.caption(f"{scope_label} 집계는 내 가게의 실매출·이익이나 창업 성공 가능성을 뜻하지 않습니다.")
    elif section == "업종·경쟁":
        st.subheader("업종·경쟁")
        a, b, c = st.columns(3, gap="small")
        with a:
            st.metric("선택 업종 점포수", _number(current["stores"], "개"),
                      _delta(current["stores"], previous["stores"], "개"), border=True)
        with b:
            st.metric("이번 분기 개업", _number(current["opened"], "개"), border=True)
        with c:
            st.metric("이번 분기 폐업", _number(current["closed"], "개"), border=True)
        st.caption("개업−폐업과 점포수의 전분기 변화는 집계 시점·범위 차이로 일치하지 않을 수 있습니다.")
        breakdown = sorted((row for row in report["industry_breakdown"] if row["stores"] is not None),
                           key=lambda row: (-row["stores"], row["code"]))
        st.markdown(f"#### {scope_label} 내 점포수 상위 업종")
        if breakdown:
            st.dataframe([{"업종": row["name"], "점포수": _number(row["stores"], "개"),
                           "이번 분기 개업": _number(row["opened"], "개"),
                           "이번 분기 폐업": _number(row["closed"], "개")}
                          for row in breakdown[:10]], hide_index=True,
                         alt="선택 상권의 공식 서비스업종별 점포수 상위 10개")
        else:
            st.info("업종별 점포 자료가 없습니다.")
        if owner:
            st.markdown("#### 내 점포 주변 인허가 관측")
            _observations(observations, radius=radius, examples=True)
        st.caption("인허가 업태와 공식 서비스업종의 정의가 달라 두 건수를 직접 경쟁 점포수로 비교하지 않습니다.")
    elif section == "매출":
        st.subheader(f"{scope_label} 추정매출")
        st.metric("분기 추정매출" if dong else "추정매출 원본 금액",
                  _number(current["sales"], "원"), border=True)
        st.caption(f"{_coverage(current)} · 미제공 업종의 매출은 0원으로 채우지 않습니다.")
        if current["sales"] is not None:
            st.dataframe([
                {"항목": "전분기 추정매출", "값": _number(previous["sales"], "원")},
                {"항목": "전분기 대비", "값": _comparison(current["sales"], previous["sales"], "원")},
                {"항목": "매출 건수", "값": _number(current["transactions"], "건")},
                {"항목": "주중 추정매출", "값": _number(current["weekday"], "원")},
                {"항목": "주말 추정매출", "값": _number(current["weekend"], "원")},
            ], hide_index=True, alt="선택 상권과 업종의 매출 원본과 전분기 비교")
        else:
            st.info("선택 상권·업종에 제공된 매출 원본 값이 없습니다.")
        st.caption("행정동 원본의 분기 추정매출입니다. 선택 점포·반경의 매출로 배분하지 않습니다."
                   if dong else "원본 금액을 월평균이나 분기 합계로 다시 해석하지 않습니다. 선택 점포·반경의 매출로 배분하지 않습니다.")
    elif section == "고객·인구":
        st.subheader(f"{scope_label} 전체 인구 변화")
        population = [("floating", "유동인구 원자료 집계"), ("resident", "상주인구"), ("worker", "직장인구")]
        st.dataframe([{"지표": label, "전분기": _number(population_previous[key], "명"),
                       "이번 분기": _number(report[key], "명"),
                       "변화": _comparison(report[key], population_previous[key], "명")}
                      for key, label in population], hide_index=True,
                     alt=f"선택 {scope_label}의 유동·상주·직장인구 전분기 비교")
        st.caption(f"인구는 선택 업종과 무관한 {scope_label} 전체 값입니다. 유동인구는 고유 방문자 수가 아닙니다.")
        st.info("연령·성별·시간대별 고객 구성은 현재 연결된 스냅샷에 없어 표시하지 않습니다.")
    elif section == "주변 환경":
        st.subheader(f"분석 위치와 {scope_label} 범위")
        area = report["area"]
        st.dataframe([
            {"항목": "자치구", "값": area.get("district") or "자료 없음"},
            {"항목": "행정동" if dong else "행정동 (상권 속성)", "값": area.get("dong") or "자료 없음"},
            {"항목": "분석 단위", "값": area.get("type") or "자료 없음"},
            {"항목": "분석 면적", "값": _number(area.get("area"), "㎡")},
            {"항목": "행정동 코드" if dong else "공식 상권 코드", "값": area.get("code") or "자료 없음"},
        ], hide_index=True, alt="선택 상권의 위치와 면적")
        if owner:
            if selected_business:
                st.markdown(f"**검색한 점포:** {selected_business.get('name') or '상호 없음'}")
                st.caption(selected_business.get("address") or "주소 자료 없음")
                distance = distance_m(selected_business["lat"], selected_business["lng"],
                                      market["lat"], market["lng"])
                st.metric("점포–상권 중심점 직선거리", f"{distance:,.0f}m", border=True)
                st.caption(f"주변 인허가 관측 반경 {radius:,}m와 공식 상권 경계는 별개입니다. 중심점 근접은 상권 경계 포함을 증명하지 않습니다.")
                _observations(observations, radius=radius)
            else:
                st.info("상호·주소를 검색하면 점포 위치와 상권 중심점의 관계를 볼 수 있습니다.")
        else:
            st.caption("현장 방문 시 접근 동선, 임대 조건, 실제 공실을 확인해 주세요. 현재 스냅샷에는 임대료·공실률·보행권역 수치가 없습니다.")
