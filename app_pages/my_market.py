"""Owner and future-owner analysis in the shared map-first layout."""
from __future__ import annotations

import json

import streamlit as st

from kb_bridge.config import load_settings
from kb_bridge.domain.finance import amortizing_payment
from kb_bridge.repositories import owner_snapshot
from kb_bridge.ui.kakao_rank_map import show_map
from kb_bridge.ui.owner_layout import apply_owner_layout

apply_owner_layout()

if not owner_snapshot.available():
    st.warning("팀원 테스트 데이터가 준비되지 않았습니다. README의 데이터 준비 명령을 실행해 주세요.")
    st.stop()

for state_key in ("owner_left_open", "owner_right_open"):
    if state_key not in st.session_state:
        st.session_state[state_key] = True

catalog = owner_snapshot.catalog()
categories = ["외식업", "서비스업", "소매업"]
metric_labels = {"stores": "점포수", "sales": "매출", "floating": "유동인구", "resident": "거주인구"}


@st.cache_data(max_entries=64)
def load_licences(lat: float, lng: float, radius: int, group_id: str) -> dict:
    return owner_snapshot.licence_observations(lat=lat, lng=lng, radius_m=radius, group_id=group_id)


@st.cache_data(max_entries=64)
def load_market_report(code: str, industry_code: str | None) -> dict:
    return owner_snapshot.market_report(code, industry_code)


@st.cache_data(max_entries=16)
def market_boundary(code: str) -> list[dict]:
    path = owner_snapshot.LOCAL / "commerce.geojson"
    if not path.is_file():
        return []
    return [feature for feature in json.loads(path.read_text(encoding="utf-8"))["features"]
            if str(feature["properties"].get("code")) == code]


def metric_value(report: dict, metric: str) -> float | None:
    return report["current"].get(metric) if metric in {"stores", "sales"} else report.get(metric)


def select_owner_market(code: str) -> None:
    st.session_state.owner_market_choice = code
    st.session_state.owner_right_open = True


def metric_display(metric: str, value: float | None) -> str:
    if value is None:
        return "자료 없음"
    if metric == "sales":
        return f"{value / 100_000_000:,.1f}억 원"
    return f"{value:,.0f}{'개' if metric == 'stores' else '명'}"


with st.container(key="owner-canvas"):
    with st.container(key="owner-filter-panel"):
        st.caption("같은 자료, 내 상황에 맞는 해석")
        st.subheader("내 상권 분석")
        mode = st.segmented_control("나의 상황", ["나는 사장", "나도 곧 사장"],
                                    default="나는 사장", key="owner-mode", width="stretch")
        st.caption("주변 상권과 우리 가게의 운영을 함께 점검해 보세요." if mode == "나는 사장"
                   else "입지와 업종을 고르며 창업 준비를 점검해 보세요.")
        search_mode = st.segmented_control("지역 찾는 방법", ["우리 동네 직접 찾기", "매출·상권 둘러보기"],
                                           default="매출·상권 둘러보기", width="stretch")
        metric = st.segmented_control("비교할 지표", list(metric_labels),
                                      format_func=lambda key: metric_labels[key], default="sales",
                                      key="owner-metric", width="stretch", wrap=False)
        category = st.segmented_control("업종 대분류", categories, default="외식업", width="stretch")
        groups = [item for item in catalog if item["category"] == category and not item.get("unavailable")]
        labels = {item["id"]: item["label"] for item in groups}
        group_id = st.selectbox("세부 업종", list(labels), format_func=lambda key: labels[key])
        group = next(item for item in groups if item["id"] == group_id)
        industry_code = group.get("officialCode")
        st.caption(group.get("note") or "인허가 업태와 서울시 서비스업종 코드는 구분해서 표시합니다.")
        districts = sorted({item["district"] for item in owner_snapshot.markets()})
        district = st.selectbox("자치구", ["", *districts], format_func=lambda value: value or "서울시 전체")
        query = st.text_input("동네·역·상권 검색", placeholder="동네·역·확보된 주소 검색")
        candidates = owner_snapshot.markets(district=district, query=query)
        if mode == "나도 곧 사장" and industry_code and search_mode == "매출·상권 둘러보기":
            candidates = owner_snapshot.founder_rankings(industry_code, district=district)
            if query:
                candidates = [item for item in candidates
                              if query.casefold() in (item["name"] + " " + item["district"]).casefold()]
        codes = [item["code"] for item in candidates]
        if "owner_market_choice" not in st.session_state and codes:
            # Open a real team-data report on first visit; keep later user selections intact.
            featured = owner_snapshot.founder_rankings(industry_code, district=district) if industry_code else []
            st.session_state.owner_market_choice = next(
                (item["code"] for item in featured if item["code"] in codes), codes[0]
            )
        elif st.session_state.get("owner_market_choice", "") not in codes:
            st.session_state.owner_market_choice = ""
        chosen_code = st.selectbox("분석 상권", ["", *codes], key="owner_market_choice",
                                   format_func=lambda code: next(
                                       (f"{item['district']} · {item['name']}" for item in candidates if item["code"] == code),
                                       "상권을 선택해 주세요"))
        radius = st.segmented_control("주변 인허가 관측 반경", [300, 500, 1000],
                                      default=500, format_func=lambda value: f"{value:,}m")
        st.caption("반경 안 인허가 관측과 공식 상권 전체 통계는 서로 다른 범위입니다.")
        st.subheader(f"{metric_labels[metric]} 기준 지역 비교")
        ranked = []
        if search_mode == "매출·상권 둘러보기":
            for item in candidates:
                data = load_market_report(item["code"], industry_code)
                value = metric_value(data, metric)
                if value is not None:
                    ranked.append((value, item))
            ranked.sort(key=lambda pair: pair[0], reverse=True)
            for place, (value, item) in enumerate(ranked[:10], 1):
                st.button(f"{place}  {item['name']} · {metric_display(metric, value)}",
                          key=f"owner-rank-{item['code']}", width="stretch",
                          on_click=select_owner_market, args=(item["code"],))
        else:
            st.caption("검색과 상권 선택으로 분석할 위치를 찾으세요.")
        st.caption("출처: 팀원 테스트 프로젝트의 서울시 상권 원본 스냅샷")

    with st.container(key="owner-left-toggle"):
        if not st.session_state.owner_left_open:
            st.html('<span class="kb-owner-left-collapsed" hidden></span>')
        if st.button("‹" if st.session_state.owner_left_open else "›", key="owner-left-collapse",
                     help="내 상권 조건 접기 또는 펼치기"):
            st.session_state.owner_left_open = not st.session_state.owner_left_open
            st.rerun()

    market = next((item for item in candidates if item["code"] == chosen_code), None)
    report = load_market_report(chosen_code, industry_code) if market else None
    with st.container(key="owner-map-canvas"):
        map_rows = ([{"code": market["code"], "name": market["name"], "district": market["district"],
                     "lat": market["lat"], "lng": market["lng"], "display": metric_display(metric, metric_value(report, metric))}]
                    if market else [])
        show_map(key=load_settings().kakao_map_javascript_key, rows=map_rows,
                 boundaries=market_boundary(market["code"]) if market else [],
                 selected=market["code"] if market else None, source="official",
                 district=market["district"] if market else "",
                 radius=radius if market else None, height=820)
        if not load_settings().kakao_map_javascript_key:
            st.info("카카오 지도 키가 없어 지도를 표시할 수 없습니다. 왼쪽 조건과 보고서는 이용할 수 있습니다.")

    if market and report:
        with st.container(key="owner-right-toggle"):
            if not st.session_state.owner_right_open:
                st.html('<span class="kb-owner-right-collapsed" hidden></span>')
            if st.button("›" if st.session_state.owner_right_open else "‹", key="owner-right-collapse",
                         help="내 상권 보고서 접기 또는 펼치기"):
                st.session_state.owner_right_open = not st.session_state.owner_right_open
                st.rerun()

        with st.container(key="owner-report-panel"):
            st.caption("지역 데이터에 기반한 참고 보고서")
            report_title, collapse = st.columns([5, 1])
            with report_title:
                st.subheader(f"{market['district']} {market['name']} 분석 리포트")
            with collapse:
                if st.button("접기 ›", key="owner-collapse-report", help="내 상권 보고서 접기"):
                    st.session_state.owner_right_open = False
                    st.rerun()
            st.caption(f"{market.get('type', '상권')} · {report['quarter'][:4]}년 {report['quarter'][-1]}분기 · {group['label']}")
            current, prior = report["current"], report["prior"]
            st.metric(metric_labels[metric], metric_display(metric, metric_value(report, metric)), border=True)
            st.caption("선택 업종의 점포수·매출과 지역 전체의 인구를 구분해 표시합니다.")
            report_tab = st.segmented_control("분석 항목",
                ["간략보고서", "업종분석", "매출분석", "인구분석", "금융상담 준비"],
                default={"stores":"업종분석","sales":"매출분석","floating":"인구분석","resident":"인구분석"}[metric],
                key=f"owner-report-tab-{metric}", width="stretch", wrap=False)
            if report_tab == "간략보고서":
                obs = load_licences(market["lat"], market["lng"], radius, group_id)
                a, b = st.columns(2)
                with a:
                    st.metric("선택 업종 인허가 관측", f"{obs['selected']:,}건", border=True)
                with b:
                    st.metric("반경 안 확보 인허가 관측", f"{obs['total']:,}건", border=True)
                st.caption(f"선택 위치 반경 {radius:,}m의 확보 인허가 기록입니다. 공식 점포수와 직접 비교할 수 없습니다.")
                if obs["examples"]:
                    st.dataframe(obs["examples"], hide_index=True, alt="주변 인허가 업소 예시")
            elif report_tab == "업종분석":
                st.metric("선택 업종 공식 점포수", metric_display("stores", current.get("stores")), border=True)
                if prior.get("stores") is not None:
                    st.caption(f"이전 분기 {prior['stores']:,.0f}개")
                st.metric("개업 점포", metric_display("stores", current.get("opened")), border=True)
                st.metric("폐업 점포", metric_display("stores", current.get("closed")), border=True)
                st.caption("업종별 공식 집계와 주변 인허가 업태는 별도의 지표입니다.")
            elif report_tab == "매출분석":
                sales = current.get("sales")
                st.metric("선택 상권·업종 추정매출", f"{sales:,.0f}원" if sales is not None else "자료 없음", border=True)
                if sales is not None and prior.get("sales") is not None and prior["sales"] > 0:
                    st.caption(f"전분기 대비 {(sales/prior['sales']-1)*100:+.1f}% · 전분기 {prior['sales']:,.0f}원")
                st.caption("상권 전체의 공식 집계입니다. 선택 반경이나 개별 업소의 매출로 환산하지 않습니다.")
            elif report_tab == "인구분석":
                order = [("resident", "거주인구"), ("floating", "유동인구"), ("worker", "직장인구")] if metric == "resident" else [("floating", "유동인구"), ("resident", "거주인구"), ("worker", "직장인구")]
                for key, label in order:
                    st.metric(label, f"{report[key]:,.0f}명" if report.get(key) is not None else "자료 없음", border=True)
                st.caption("서로 다른 모집단과 집계 기간을 합산하지 않습니다.")
            else:
                st.subheader("경영·금융진단")
                st.caption("직접 입력한 가정만 계산합니다. 은행 대출 심사·사업자 인증·실제 상담 접수는 연결되지 않았습니다.")
                with st.form("cashflow-form", border=True):
                    a, b = st.columns(2)
                    with a:
                        monthly_sales = st.number_input("월매출 · 만원", min_value=0, value=1800, step=10)
                        monthly_cost = st.number_input("월 영업비용 · 만원 (월세·대출 상환 제외)", min_value=0, value=1450, step=10)
                        rent = st.number_input("현재 월세 · 만원", min_value=0, value=180, step=10)
                    with b:
                        debt_payment = st.number_input("기존 월 대출 상환액 · 만원", min_value=0, value=60, step=10)
                        rent_increase = st.slider("월세 인상 가정", min_value=0, max_value=100, value=25, format="%d%%")
                        purpose = st.selectbox("상담 주제", ["월세 부담", "매출 감소", "운영자금", "창업자금", "채무관리", "경영지원"])
                    with st.expander("가상 신규대출 부담도 비교"):
                        loan_principal = st.number_input("가상 대출원금 · 만원", min_value=0, value=2000, step=100)
                        loan_rate = st.number_input("가정 연이율 · %", min_value=0.0, max_value=100.0, value=6.0, step=0.1)
                        loan_months = st.number_input("가정 상환 기간 · 개월", min_value=1, max_value=600, value=24)
                    calculated = st.form_submit_button("시나리오 계산", type="primary")
                if calculated:
                    before = monthly_sales - monthly_cost - rent - debt_payment
                    after = monthly_sales - monthly_cost - rent * (1 + rent_increase / 100) - debt_payment
                    loan_payment = float(amortizing_payment(principal=loan_principal, annual_rate_percent=loan_rate, months=loan_months))
                    a, b = st.columns(2)
                    with a:
                        st.metric("현재 월 현금흐름 여유액", f"{before:,.0f}만 원", border=True)
                    with b:
                        st.metric("월세 인상 가정 후", f"{after:,.0f}만 원", f"{after-before:+,.0f}만 원", border=True)
                    st.metric("가상 신규대출 월 원리금", f"{loan_payment:,.1f}만 원", border=True)
                    st.metric("월세 변화와 신규대출 가정 후 여유액", f"{after-loan_payment:,.1f}만 원", border=True)
                    if after - loan_payment < 0:
                        st.warning("이 가정에서는 추가 차입 후 월 현금흐름이 음수입니다.")
                    st.caption("세금, 보증금, 비정기 지출, 계절 변동과 실제 대출 조건은 미반영입니다.")
                st.subheader("가까운 KB 영업점 · 상담 준비")
                branches = owner_snapshot.nearest_branches(market["lat"], market["lng"])
                for branch in branches:
                    with st.container(border=True):
                        st.markdown(f"**{branch['name']}** · 직선 약 {branch['meters']/1000:.2f}km")
                        st.caption(f"{branch['address']} · {branch['phone']} · {branch['hours']}")
                memo = {"state": "교육용 시연 · 미접수 · 예약 미확정", "market": market["name"],
                        "district": market["district"], "industry": group["label"], "topic": purpose,
                        "quarter": report["quarter"],
                        "branch_candidates": [{"name": item["name"], "address": item["address"]} for item in branches]}
                st.download_button("상담 준비 메모 저장", data=json.dumps(memo, ensure_ascii=False, indent=2),
                                   file_name="kb-bridge-consultation-draft.json", mime="application/json",
                                   width="stretch")
                st.caption("메모에는 입력한 개인 재무 수치를 넣지 않습니다. 저장 버튼을 눌러도 은행에는 전송되지 않습니다.")
