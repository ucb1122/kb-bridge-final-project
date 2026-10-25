"""Right-hand owner report sections built from the team's local snapshot."""
from __future__ import annotations

import streamlit as st

from kb_bridge.repositories.owner_snapshot import distance_m

OWNER_REPORT_VERSION = 2


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
            st.subheader(f"{market['name']} 경영 진단 보고서")
        else:
            st.subheader("내 점포 주변과 공식 상권" if selected_business else "공식 상권 한눈에 보기" if owner else "창업 후보 상권 한눈에 보기")
        cards = st.columns(3, gap="small")
        with cards[0]:
            st.metric("점포수" if dong else "공식 점포수", _number(current["stores"], "개"),
                      _sales_delta(current["stores"], previous["stores"]) if dong
                      else _delta(current["stores"], previous["stores"], "개"), border=True)
        with cards[1]:
            st.metric("분기 추정매출" if dong else "추정매출 원본 금액", _amount(current["sales"]),
                      _sales_delta(current["sales"], previous["sales"]), border=True)
        with cards[2]:
            st.metric("유동인구 집계" if dong else "상권 유동인구 집계", _number(report["floating"], "명"),
                      _sales_delta(report["floating"], population_previous["floating"]) if dong
                      else _delta(report["floating"], population_previous["floating"], "명"), border=True)
        st.caption(f"{_coverage(current)} · 점포수·매출은 선택 업종/{scope_label}, 인구는 {scope_label} 전체입니다.")
        if dong and report.get("history") and report.get("industry_code") is None:
            history = {}
            for row in report["history"]:
                if row["metric"] in {"stores", "sales", "footfall"}:
                    history.setdefault(row["quarter"], {})[row["metric"]] = row["value"]
            with st.expander("최근 5분기 원본 수치·계산 근거"):
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
