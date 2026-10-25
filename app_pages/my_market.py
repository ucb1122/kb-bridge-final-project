"""Owner and future-owner analysis in the shared map-first layout."""
from __future__ import annotations

import importlib
import json
from pathlib import Path

import streamlit as st

from kb_bridge.config import load_settings
from kb_bridge.domain.finance import amortizing_payment
from kb_bridge.repositories import owner_snapshot
from kb_bridge.ui.kakao_rank_map import show_map
from kb_bridge.ui import owner_layout, owner_report

# Streamlit reruns page code without re-importing modules already in the server process.
if (getattr(owner_snapshot, "OWNER_SNAPSHOT_VERSION", 0) != 2 or
        not callable(getattr(owner_snapshot, "search_businesses", None))):
    importlib.reload(owner_snapshot)
if getattr(owner_report, "OWNER_REPORT_VERSION", 0) != 1:
    importlib.reload(owner_report)
importlib.reload(owner_layout)
render_section = owner_report.render_section
owner_layout.apply_owner_layout()

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
def load_market_report(code: str, industry_code: str | None, snapshot_version: int) -> dict:
    return owner_snapshot.market_report(code, industry_code)


@st.cache_data(max_entries=16)
def market_boundary(code: str) -> list[dict]:
    path = owner_snapshot.LOCAL / "commerce.geojson"
    if not path.is_file():
        return []
    return [feature for feature in json.loads(path.read_text(encoding="utf-8"))["features"]
            if str(feature["properties"].get("code")) == code]


@st.cache_data(max_entries=26)
def district_outline(district: str) -> list[dict]:
    path = Path(__file__).resolve().parents[1] / "assets" / "seoul-district-boundaries.geojson"
    if not path.is_file():
        return []
    features = json.loads(path.read_text(encoding="utf-8"))["features"]
    return [feature for feature in features
            if not district or feature["properties"].get("district") == district]


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


def change_owner_mode() -> None:
    st.session_state.pop("owner_market_choice", None)


def choose_owner_metric(value: str) -> None:
    st.session_state.owner_metric_choice = value


if "owner_metric_choice" not in st.session_state:
    st.session_state.owner_metric_choice = "sales"


with st.container(key="owner-canvas"):
    with st.container(key="owner-filter-panel"):
        with st.container(key="owner-controls-card"):
            st.markdown("## 내 상권 분석")
            mode = st.segmented_control("분석 대상", ["나는 사장", "나도 곧 사장"],
                                        key="owner-mode", default="나는 사장",
                                        on_change=change_owner_mode, width="stretch", wrap=False)
            st.caption("점포 위치와 주변 인허가 관측을 확인합니다." if mode == "나는 사장"
                       else "업종별 상권의 전분기 변화율을 살펴봅니다.")
            selected_business = None
            radius = 500
            group_id = None
            group = {"label": "전체 업종"}
            if mode == "나는 사장":
                st.html('<div class="kb-owner-field-heading">점포 위치</div>')
                business_query = st.text_input("상호·주소 검색", key="owner-business-query",
                                               placeholder="상호 또는 확보된 주소를 2글자 이상 입력")
                business_matches = owner_snapshot.search_businesses(business_query)
                if business_query and not business_matches:
                    st.caption("확보된 영업 인허가 기록에서 일치하는 위치가 없습니다.")
                if business_matches:
                    business_index = st.selectbox("검색 결과", range(len(business_matches)),
                        format_func=lambda index: f"{business_matches[index].get('name') or '상호 없음'} · {business_matches[index].get('address') or '주소 없음'}",
                        key="owner-business-choice")
                    selected_business = business_matches[business_index]
                    business_id = selected_business.get("id")
                    if st.session_state.get("owner_business_anchor") != business_id:
                        st.session_state.owner_business_anchor = business_id
                        st.session_state["owner-district"] = selected_business.get("district", "")
                        st.session_state.owner_market_choice = ""
                category = st.segmented_control("업종 대분류", categories, default="외식업",
                                                key="owner-licence-category", width="stretch", wrap=False)
                groups = [item for item in catalog if item["category"] == category and not item.get("unavailable")]
                labels = {item["id"]: item["label"] for item in groups}
                group_id = st.selectbox("세부 인허가 업태", list(labels),
                                        format_func=lambda key: labels[key], key=f"owner-group-{category}")
                group = next(item for item in groups if item["id"] == group_id)
                industry_code = owner_snapshot.official_scope_for_group(group)
                radius = st.segmented_control("주변 인허가 관측 반경", [300, 500, 1000],
                                              default=500, format_func=lambda value: f"{value:,}m",
                                              key="owner-radius", width="stretch", wrap=False)
                st.caption("점포 위치 반경의 인허가 관측과 공식 상권 통계는 별도 범위입니다.")
            else:
                category = st.segmented_control("공식 업종", ["전체 업종", "외식업", "서비스업", "소매업"],
                                                default="전체 업종", key="owner-founder-category",
                                                width="stretch", wrap=False)
                scope = {"전체 업종": None, "외식업": "food", "서비스업": "service", "소매업": "retail"}[category]
                codes_for_category = sorted(
                    (code for code in owner_snapshot.regional()["industries"]
                     if scope is None or code.startswith({"food":"CS1","service":"CS2","retail":"CS3"}[scope])),
                    key=lambda code: owner_snapshot.regional()["industries"][code])
                industry_code = st.selectbox("세부 업종", [scope or "all", *codes_for_category],
                    format_func=lambda code: (category if code in {"all", "food", "service", "retail"}
                                               else owner_snapshot.regional()["industries"][code]),
                    key=f"owner-founder-industry-{category}")
                if industry_code == "all":
                    industry_code = None
                group = {"label": category if industry_code in {None, "food", "service", "retail"}
                         else owner_snapshot.regional()["industries"][industry_code]}
            with st.container(key="owner-metric-control"):
                st.html('<div class="kb-owner-field-heading">비교 지표</div>')
                metric_columns = st.columns(4, gap="small", wrap=False)
                for metric_key, column in zip(metric_labels, metric_columns):
                    with column:
                        st.button(metric_labels[metric_key], key=f"owner-metric-{metric_key}",
                                  type="primary" if st.session_state.owner_metric_choice == metric_key else "secondary",
                                  on_click=choose_owner_metric, args=(metric_key,), width="stretch")
            metric = st.session_state.owner_metric_choice
            districts = sorted({item["district"] for item in owner_snapshot.markets()})
            district = st.selectbox("자치구", ["", *districts],
                                    format_func=lambda value: value or "서울시 전체", key="owner-district")
            if mode == "나는 사장":
                query = st.text_input("상권·동네 검색", key="owner-market-query",
                                      placeholder="공식 상권명 또는 동네 검색")
                dong = ""
                candidates = owner_snapshot.markets(district=district, query=query)
                if selected_business and candidates and not st.session_state.get("owner_market_choice"):
                    nearest = min(candidates, key=lambda item: owner_snapshot.distance_m(
                        selected_business["lat"], selected_business["lng"], item["lat"], item["lng"]))
                    st.session_state.owner_market_choice = nearest["code"]
                ranked = owner_snapshot.growth_rankings(
                    industry_scope=None if industry_code == "unmapped" else industry_code,
                    metric=metric, district=district)
                st.caption("점포와 중심 좌표가 가까운 공식 상권을 먼저 제안합니다. 상권 포함 여부는 확정하지 않으며, 보고서 수치는 선택한 공식 상권 전체 기준입니다." if selected_business else "공식 상권을 고르면 해당 상권 전체의 집계값을 보여줍니다.")
            else:
                dong_names = sorted({item["dong"] for item in owner_snapshot.markets(district=district)
                                     if item.get("dong")})
                dong = st.selectbox("행정동", ["", *dong_names],
                                    format_func=lambda value: value or "전체", key="owner-founder-dong")
                ranked = owner_snapshot.growth_rankings(industry_scope=industry_code,
                                                         metric=metric, district=district, dong=dong)
                candidates = [item for item in owner_snapshot.markets(district=district)
                              if not dong or item.get("dong") == dong]
                st.caption(f"{owner_snapshot.regional()['quarter'][:4]}년 {owner_snapshot.regional()['quarter'][-1]}분기 · 전분기 대비 증가율 기준")
            codes = [item["code"] for item in candidates]
            if "owner_market_choice" not in st.session_state and codes:
                st.session_state.owner_market_choice = ranked[0]["code"] if ranked else ""
            elif st.session_state.get("owner_market_choice", "") not in codes:
                st.session_state.owner_market_choice = ""
            chosen_code = st.selectbox("분석 상권", ["", *codes], key="owner_market_choice",
                format_func=lambda code: next((f"{item['district']} · {item['name']}" for item in candidates
                                               if item["code"] == code), "상권을 선택해 주세요"))
        if mode == "나도 곧 사장":
            with st.container(key="owner-rank-card"):
                st.subheader(f"{metric_labels[metric]} 상승 상권 TOP 10")
                if not ranked:
                    st.info("전분기와 비교할 수 있는 상권 자료가 없습니다.")
                for place, item in enumerate(ranked[:10], 1):
                    st.button(f"{place}  {item['district']} {item['name']} · {metric_display(metric, item['value'])} · {item['change']:+.1f}%",
                              key=f"owner-rank-{item['code']}", width="stretch",
                              on_click=select_owner_market, args=(item["code"],))
            st.caption("출처: 팀원 테스트 프로젝트의 서울시 공식 상권 원본 스냅샷")

    with st.container(key="owner-left-toggle"):
        if not st.session_state.owner_left_open:
            st.html('<span class="kb-owner-left-collapsed" hidden></span>')
        if st.button("‹" if st.session_state.owner_left_open else "›", key="owner-left-collapse",
                     help="내 상권 조건 접기 또는 펼치기"):
            st.session_state.owner_left_open = not st.session_state.owner_left_open
            st.rerun()

    market = next((item for item in candidates if item["code"] == chosen_code), None)
    report = load_market_report(chosen_code, industry_code, owner_snapshot.OWNER_SNAPSHOT_VERSION) if market else None
    with st.container(key="owner-map-canvas"):
        if mode == "나도 곧 사장":
            visible_ranked = ranked[:10]
            selected_rank = next((item for item in ranked if item["code"] == chosen_code), None)
            if selected_rank and selected_rank not in visible_ranked:
                visible_ranked = [*visible_ranked, selected_rank]
            map_rows = [{**item, "display": metric_display(metric, item["value"])} for item in visible_ranked]
            map_selected = chosen_code or None
        elif selected_business:
            map_rows = [{"code": "selected-business", "name": selected_business.get("name") or "선택 점포",
                         "district": market["district"] if market else "", "lat": selected_business["lat"],
                         "lng": selected_business["lng"], "display": f"반경 {radius:,}m"}]
            map_selected = "selected-business"
        else:
            visible_ranked = ranked[:10]
            selected_rank = next((item for item in ranked if item["code"] == chosen_code), None)
            if selected_rank and selected_rank not in visible_ranked:
                visible_ranked = [*visible_ranked, selected_rank]
            map_rows = [{**item, "display": metric_display(metric, item["value"])} for item in visible_ranked]
            if market and not selected_rank:
                map_rows.append({"code": market["code"], "name": market["name"],
                                 "district": market["district"], "lat": market["lat"], "lng": market["lng"],
                                 "display": metric_display(metric, metric_value(report, metric))})
            map_selected = chosen_code or None
        map_result = show_map(key=load_settings().kakao_map_javascript_key, rows=map_rows,
                 boundaries=market_boundary(market["code"]) if market else [],
                 selected=map_selected, source="official",
                 district=market["district"] if market else "",
                 fallback_districts=district_outline(district),
                 radius=radius if mode == "나는 사장" and selected_business else None, height=820)
        clicked_code = getattr(map_result, "selected", map_result)
        if clicked_code and clicked_code in codes and clicked_code != chosen_code:
            select_owner_market(clicked_code)
            st.rerun()
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
            st.subheader(f"{market['district']} {market['name']} 분석 리포트")
            st.caption(f"{mode} · {market.get('type', '상권')} · {report['quarter'][:4]}년 {report['quarter'][-1]}분기 · {group['label']}")
            if industry_code == "unmapped":
                st.info("선택한 인허가 업태에 대응하는 공식 서비스업종 코드가 없어 점포수·매출은 표시하지 않습니다.")
            report_tab = st.segmented_control("분석 항목",
                ["한눈에 보기", "업종·경쟁", "매출", "고객·인구", "주변 환경", "금융상담 준비"],
                default="한눈에 보기", key=f"owner-report-tab-{mode}", width="stretch", wrap=False)
            if report_tab != "금융상담 준비":
                observations = (load_licences(selected_business["lat"], selected_business["lng"],
                                              radius, group_id)
                                if mode == "나는 사장" and selected_business and
                                report_tab in {"한눈에 보기", "업종·경쟁", "주변 환경"} else None)
                render_section(report_tab, report=report, market=market, mode=mode,
                               selected_business=selected_business, radius=radius,
                               observations=observations, metric=metric, ranking=ranked)
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
