"""Owner and future-owner analysis in the shared map-first layout."""
from __future__ import annotations

import importlib
import json
from html import escape
from collections import Counter, defaultdict
from pathlib import Path

import streamlit as st

from kb_bridge.config import load_settings
from kb_bridge.domain.finance import amortizing_payment
from kb_bridge.repositories import owner_dong, owner_snapshot
from kb_bridge.ui import kakao_rank_map, owner_layout, owner_report

# Streamlit reruns page code without re-importing modules already in the server process.
if (getattr(owner_snapshot, "OWNER_SNAPSHOT_VERSION", 0) != 2 or
        not callable(getattr(owner_snapshot, "search_businesses", None))):
    importlib.reload(owner_snapshot)
if getattr(owner_dong, "OWNER_REGION_VERSION", 0) != 2:
    importlib.reload(owner_dong)
if getattr(owner_report, "OWNER_REPORT_VERSION", 0) != 4:
    importlib.reload(owner_report)
importlib.reload(owner_layout)
if getattr(kakao_rank_map, "COMPONENT_VERSION", 0) != 9:
    importlib.reload(kakao_rank_map)
show_map = kakao_rank_map.show_map
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
metric_labels = {"stores": "점포수", "sales": "매출", "floating": "유동인구", "resident": "상주인구"}


@st.cache_data(max_entries=64)
def load_licences(lat: float, lng: float, radius: int, group_id: str) -> dict:
    return owner_snapshot.licence_observations(lat=lat, lng=lng, radius_m=radius, group_id=group_id)


@st.cache_data(max_entries=64)
def load_market_report(kind: str, code: str, industry_code: str | None,
                       quarter: str, snapshot_version: int) -> dict:
    return owner_dong.report(code, industry_code, quarter, kind=kind)


@st.cache_data(max_entries=16)
def market_boundary(kind: str, code: str) -> list[dict]:
    path = owner_snapshot.LOCAL / ("commerce-dong.geojson" if kind == "dong" else "commerce.geojson")
    if not path.is_file():
        return []
    return [feature for feature in json.loads(path.read_text(encoding="utf-8"))["features"]
            if str(feature["properties"].get("code")) == code]


@st.cache_data(max_entries=1)
def seoul_outline() -> list[dict]:
    """Trace only the outer border; shared district edges must stay hidden."""
    path = Path(__file__).resolve().parents[1] / "assets" / "seoul-district-boundaries.geojson"
    if not path.is_file():
        return []
    features = json.loads(path.read_text(encoding="utf-8"))["features"]
    edge_counts = Counter()
    for feature in features:
        for line in feature["geometry"]["coordinates"]:
            edge_counts.update(tuple(sorted((tuple(a), tuple(b)))) for a, b in zip(line, line[1:]))
    neighbors = defaultdict(list)
    for (a, b), count in edge_counts.items():
        if count == 1:
            neighbors[a].append(b)
            neighbors[b].append(a)
    loops = []
    remaining = set(neighbors)
    while remaining:
        start = next(iter(remaining))
        loop = [start]
        previous, current = None, start
        while True:
            candidates = [point for point in neighbors[current] if point != previous]
            if not candidates:
                break
            following = candidates[0]
            loop.append(following)
            remaining.discard(current)
            if following == start:
                break
            previous, current = current, following
        if len(loop) > 2:
            loops.append([list(point) for point in loop])
    return [{"type": "Feature", "properties": {"district": "서울특별시"},
             "geometry": {"type": "MultiLineString", "coordinates": loops}}]


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
    st.session_state.pop("owner_pending_map_choice", None)


def choose_owner_metric(value: str) -> None:
    st.session_state.owner_metric_choice = value


def reset_owner_filters() -> None:
    for key in ("owner-mode", "owner-find-mode", "owner-region-kind-v2", "owner-category", "owner-district",
                "owner-market-query", "owner_market_choice",
                *(f"owner-rank-sort-{key}" for key in metric_labels),
                "owner-business-query", "owner_business_anchor", "owner_pending_map_choice",
                "owner-quarter-dong", "owner-quarter-area"):
        st.session_state.pop(key, None)
    st.session_state.owner_metric_choice = "stores"
    st.session_state.owner_right_open = False


if "owner_metric_choice" not in st.session_state:
    st.session_state.owner_metric_choice = "stores"

# Component events arrive after the selectbox has been rendered. Apply the choice
# at the start of the next run, before that widget is instantiated again.
pending_map_choice = st.session_state.pop("owner_pending_map_choice", None)
if pending_map_choice:
    st.session_state.owner_market_choice = pending_map_choice
    st.session_state.owner_right_open = True


with st.container(key="owner-canvas"):
    with st.container(key="owner-filter-panel"):
        with st.container(key="owner-controls-card"):
            st.caption("같은 자료, 내 상황에 맞는 해석")
            title_column, reset_column = st.columns([5, 1], vertical_alignment="center")
            with title_column:
                st.markdown("## 내 상권 분석")
            with reset_column:
                st.button("↻", key="owner-reset", on_click=reset_owner_filters, width="stretch")
            with st.container(key="owner-persona-control"):
                mode = st.segmented_control("분석 대상", ["나는 사장", "나도 곧 사장"],
                                            key="owner-mode", default="나는 사장",
                                            on_change=change_owner_mode, width="stretch", wrap=False,
                                            format_func=lambda value: "사업 운영 중이에요" if value == "나는 사장" else "창업을 준비중이에요",
                                            label_visibility="collapsed")
            st.caption("주변 상권과 우리 가게의 운영을 함께 점검해 보세요." if mode == "나는 사장"
                       else "창업 후보지의 상권과 업종 변화를 함께 살펴보세요.")
            with st.container(key="owner-find-control"):
                find_mode = st.segmented_control("지역 찾는 방법",
                        ["우리 동네 직접 찾기", "매출·상권 둘러보기"],
                        default="매출·상권 둘러보기", key="owner-find-mode",
                        width="stretch", wrap=False, label_visibility="collapsed")
            with st.container(key="owner-metric-control"):
                metric_columns = st.columns(4, gap="small", wrap=False)
                for metric_key, column in zip(metric_labels, metric_columns):
                    with column:
                        st.button(metric_labels[metric_key], key=f"owner-metric-{metric_key}",
                                  type="primary" if st.session_state.owner_metric_choice == metric_key else "secondary",
                                  on_click=choose_owner_metric, args=(metric_key,), width="stretch")
            metric = st.session_state.owner_metric_choice
            unit_column, quarter_column = st.columns(2)
            with unit_column:
                region_kind = st.selectbox("분석 단위", ["행정동 전체", "공식 상권 전체"]
                    if owner_dong.available() else ["공식 상권 전체"], key="owner-region-kind-v2")
            kind = "dong" if region_kind == "행정동 전체" else "area"
            with quarter_column:
                quarter = st.selectbox("기준 분기", owner_dong.quarters(),
                                       key=f"owner-quarter-{kind}",
                                       format_func=lambda q: f"{q[:4]}년 {q[-1]}분기")
            district_column, industry_column = st.columns(2)
            with district_column:
                districts = sorted({item["district"] for item in
                                    owner_dong.regions(quarter=quarter, kind=kind)})
                district = st.selectbox("자치구", ["", *districts],
                                        format_func=lambda value: value or "서울시 전체", key="owner-district")
            with industry_column:
                category = st.selectbox("업종", ["전체 업종", *categories], key="owner-category")
            scope = {"전체 업종": None, "외식업": "food", "서비스업": "service", "소매업": "retail"}[category]
            industry_code = scope
            group_id = None
            group = {"label": category}
            selected_business = None
            radius = 500
            search_field, search_action = st.columns([8, 1], vertical_alignment="bottom")
            with search_field:
                query = st.text_input("동네·상권 검색", key="owner-market-query",
                                      placeholder="동네 또는 공식 상권명 검색", label_visibility="collapsed")
            with search_action:
                st.button("⌕", key="owner-search", help="입력한 동네·상권 검색", width="stretch")
            if find_mode == "우리 동네 직접 찾기" and mode == "나는 사장":
                with st.expander("우리 가게 위치와 주변 인허가 조건", expanded=True):
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
                            st.session_state.owner_market_choice = ""
                    if category != "전체 업종":
                        groups = [item for item in catalog if item["category"] == category and not item.get("unavailable")]
                        labels = {item["id"]: item["label"] for item in groups}
                        group_id = st.selectbox("세부 인허가 업태", list(labels),
                                                format_func=lambda key: labels[key],
                                                key=f"owner-group-{category}")
                        group = next(item for item in groups if item["id"] == group_id)
                        industry_code = owner_snapshot.official_scope_for_group(group)
                    radius = st.segmented_control("주변 인허가 관측 반경", [300, 500, 1000],
                                                  default=500, format_func=lambda value: f"{value:,}m",
                                                  key="owner-radius", width="stretch", wrap=False)
                    st.caption("인허가 관측 반경과 공식 상권 통계는 서로 다른 범위입니다.")
            elif mode == "나도 곧 사장" and category != "전체 업종":
                with st.expander("세부 업종 선택"):
                    codes_for_category = sorted(
                        (code for code in owner_snapshot.regional()["industries"]
                         if code.startswith({"food": "CS1", "service": "CS2", "retail": "CS3"}[scope])),
                        key=lambda code: owner_snapshot.regional()["industries"][code])
                    industry_code = st.selectbox("세부 업종", [scope, *codes_for_category],
                        format_func=lambda code: category if code == scope else owner_snapshot.regional()["industries"][code],
                        key=f"owner-founder-industry-{category}")
                    group = {"label": category if industry_code == scope
                             else owner_snapshot.regional()["industries"][industry_code]}
            candidates = owner_dong.regions(quarter=quarter, district=district,
                                            query=query, kind=kind)
            ranked = owner_dong.rankings(quarter=quarter, metric=metric,
                                         industry_code=industry_code,
                                         district=district, kind=kind)
            if query:
                candidate_codes = {item["code"] for item in candidates}
                ranked = [item for item in ranked if item["code"] in candidate_codes]
            codes = [item["code"] for item in candidates]
            if "owner_market_choice" not in st.session_state:
                st.session_state.owner_market_choice = ranked[0]["code"] if mode == "나도 곧 사장" and ranked else ""
            elif st.session_state.get("owner_market_choice", "") not in codes:
                st.session_state.owner_market_choice = ""
            if selected_business and candidates and not st.session_state.owner_market_choice:
                nearest = min(candidates, key=lambda item: owner_snapshot.distance_m(
                    selected_business["lat"], selected_business["lng"], item["lat"], item["lng"]))
                st.session_state.owner_market_choice = nearest["code"]
        with st.container(key="owner-rank-card"):
            rank_title, sort_column = st.columns([3, 2], vertical_alignment="bottom")
            with rank_title:
                st.subheader(f"{metric_labels[metric]} 비교")
            has_change = any(item["change"] != 0 for item in ranked)
            with sort_column:
                sort_options = (["전분기 증가율순", "현재 값순", "전분기 감소율순"]
                                if has_change else ["현재 값순"])
                sort_order = st.selectbox("정렬 기준", sort_options,
                                          key=f"owner-rank-sort-{metric}", label_visibility="collapsed")
            if sort_order == "현재 값순":
                ranked = sorted(ranked, key=lambda item: (-item["value"], item["code"]))
            elif sort_order == "전분기 감소율순":
                ranked = sorted(ranked, key=lambda item: (item["change"], item["code"]))
            if not ranked:
                st.info("전분기와 비교할 수 있는 상권 자료가 없습니다.")
            elif not has_change:
                st.caption("전분기 변화가 없어 현재 값이 큰 순서로 표시합니다.")
            for place, item in enumerate(ranked[:10], 1):
                with st.container(key=f"owner-rank-row-{place}"):
                    label = f"{item['change']:+.1f}%" if item["change"] else "변화 없음"
                    trend = "up" if item["change"] > 0 else "down" if item["change"] < 0 else "flat"
                    st.html(
                        f'<div class="kb-owner-rank-line">'
                        f'<span class="kb-owner-rank-number">{place}</span>'
                        f'<span class="kb-owner-rank-name">{escape(item["district"])} {escape(item["name"])}</span>'
                        f'<span class="kb-owner-rank-value">{escape(metric_display(metric, item["value"]))}</span>'
                        f'<span class="kb-owner-rank-change {trend}">{label}</span>'
                        '</div>'
                    )
                    st.button(f"{item['district']} {item['name']}",
                              key=f"owner-rank-{item['code']}", width="stretch",
                              on_click=select_owner_market, args=(item["code"],))
            st.caption("출처: 서울시 공개 상권 원본 · 전분기 비교 가능 지역")
            with st.expander("상권 직접 선택"):
                chosen_code = st.selectbox("분석 상권", ["", *codes], key="owner_market_choice",
                    format_func=lambda code: next((f"{item['district']} · {item['name']}" for item in candidates
                                                   if item["code"] == code), "상권을 선택해 주세요"))

    with st.container(key="owner-left-toggle"):
        if not st.session_state.owner_left_open:
            st.html('<span class="kb-owner-left-collapsed" hidden></span>')
        if st.button("‹" if st.session_state.owner_left_open else "›", key="owner-left-collapse",
                     help="내 상권 조건 접기 또는 펼치기"):
            st.session_state.owner_left_open = not st.session_state.owner_left_open
            st.rerun()

    market = next((item for item in candidates if item["code"] == chosen_code), None)
    report = load_market_report(kind, chosen_code, industry_code, quarter,
                                owner_snapshot.OWNER_SNAPSHOT_VERSION) if market else None
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
                 boundaries=market_boundary(kind, market["code"]) if market else [],
                 selected=map_selected, source="official",
                 district=market["district"] if market else "",
                 fallback_districts=seoul_outline(),
                 radius=radius if mode == "나는 사장" and selected_business else None,
                 marker_style="card", height=820)
        clicked_code = getattr(map_result, "selected", map_result)
        if clicked_code and clicked_code in codes and clicked_code != chosen_code:
            st.session_state.owner_pending_map_choice = clicked_code
            st.rerun()
        if not load_settings().kakao_map_javascript_key:
            st.info("카카오 지도 키가 없어 지도를 표시할 수 없습니다. 왼쪽 조건과 보고서는 이용할 수 있습니다.")

    if market and report:
        with st.container(key="owner-right-toggle"):
            if not st.session_state.owner_right_open:
                st.html('<span class="kb-owner-right-collapsed" hidden></span>')
            if st.button("×" if st.session_state.owner_right_open else "‹", key="owner-right-collapse",
                         help="내 상권 보고서 접기 또는 펼치기"):
                st.session_state.owner_right_open = not st.session_state.owner_right_open
                st.rerun()

        with st.container(key="owner-report-panel"):
            with st.container(key="owner-report-header"):
                st.caption("경영 진단 보고서")
                st.subheader(market["name"])
                st.caption(f"{market['district']} · {report.get('scope') or market.get('type', '상권')} · {group['label']} · {report['quarter'][:4]}년 {report['quarter'][-1]}분기")
            if industry_code == "unmapped":
                st.info("선택한 인허가 업태에 대응하는 공식 서비스업종 코드가 없어 점포수·매출은 표시하지 않습니다.")
            with st.container(key="owner-report-tabs"):
                report_tab = st.segmented_control("분석 항목",
                    ["한눈에 보기", "업종·경쟁", "매출", "고객·인구", "주변 환경"],
                    default="한눈에 보기", key=f"owner-report-tab-{mode}", width="stretch", wrap=False)
            with st.container(key="owner-report-body"):
                observations = (load_licences(selected_business["lat"], selected_business["lng"],
                                              radius, group_id)
                                if mode == "나는 사장" and selected_business and
                                report_tab in {"한눈에 보기", "업종·경쟁", "주변 환경"} else None)
                render_section(report_tab, report=report, market=market, mode=mode,
                               selected_business=selected_business, radius=radius,
                               observations=observations, metric=metric, ranking=ranked)
                if st.session_state.get("owner_consultation") == "finance":
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

                elif st.session_state.get("owner_consultation") == "management":
                    st.info("소상공인 경영상담 연결은 개발 예정입니다. 현재 보고서의 통계와 실제 운영 자료를 함께 준비해 주세요.")
            with st.container(key="owner-report-footer"):
                with st.expander("위치·반경·보행·다각형으로 더 자세히 보기"):
                    st.caption("아래 범위는 인허가 업소 분포를 별도로 셉니다. 공식 통계의 공간 범위는 바꾸지 않습니다.")
                    if selected_business:
                        st.write(f"선택 점포 기준 반경 {radius:,}m · {selected_business.get('name') or '상호 없음'}")
                    else:
                        st.write("상호·주소에서 점포 위치를 선택하면 주변 인허가 관측을 확인할 수 있습니다.")
                consultation_columns = st.columns(2)
                with consultation_columns[0]:
                    if st.button("KB 영업점 금융상담 →", key="owner-finance-consult", type="primary", width="stretch"):
                        st.session_state.owner_consultation = "finance"
                        st.rerun()
                with consultation_columns[1]:
                    if st.button("소상공인 경영상담 →", key="owner-management-consult", width="stretch"):
                        st.session_state.owner_consultation = "management"
                        st.rerun()
                with st.container(key="owner-report-pdf-actions"):
                    pdf_buttons = st.columns([1, 1, 4])
                    with pdf_buttons[0]:
                        st.button("이 항목 PDF", key="owner-pdf-one", disabled=True, help="PDF 저장 개발 예정")
                    with pdf_buttons[1]:
                        st.button("PDF 5종 받기", key="owner-pdf-all", disabled=True, help="PDF 저장 개발 예정")
