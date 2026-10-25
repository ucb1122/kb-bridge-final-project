"""Rising districts and markets, restyled to the team's KB Bridge visual language."""
from __future__ import annotations

import importlib
import inspect
import json
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from html import escape
from pathlib import Path

import streamlit as st

from kb_bridge.config import load_settings
from kb_bridge.integrations import ollama_opinion
from kb_bridge.repositories import rising_snapshot
from kb_bridge.services import rising_analysis
from kb_bridge.services.rising_pdf import build_pdf, build_zip
from kb_bridge.ui import kakao_rank_map, rising_layout, rising_report

# Running Streamlit sessions retain imported modules across page reruns.
if getattr(rising_analysis, "OVERVIEW_CARDS_VERSION", 0) != 2:
    importlib.reload(rising_analysis)
    importlib.reload(rising_report)
elif getattr(rising_report, "RISING_REPORT_VERSION", 0) != 2:
    importlib.reload(rising_report)
if getattr(rising_snapshot, "REPORT_RANKS_VERSION", 0) != 2:
    importlib.reload(rising_snapshot)

from kb_bridge.services.rising_analysis import LABELS, footfall_per_ha, human_value, percent, ranking_change_label, sales_per_store_month
from kb_bridge.ui.rising_report import breakdown_chart, history_chart, history_table, highlight_trends, industry_chart, overview_card_grid

importlib.reload(rising_layout)
rising_layout.apply_rising_layout()

# Streamlit can rerun this page while retaining a previously imported map helper.
# Reload it when the running helper predates the current component arguments.
if getattr(kakao_rank_map, "COMPONENT_VERSION", None) != 8 or "selector" not in inspect.signature(kakao_rank_map.show_map).parameters:
    importlib.reload(kakao_rank_map)
show_map = kakao_rank_map.show_map
map_helper_parameters = inspect.signature(show_map).parameters
if inspect.isfunction(ollama_opinion.generate_opinion) and "focus_metric" not in inspect.signature(ollama_opinion.generate_opinion).parameters:
    importlib.reload(ollama_opinion)
generate_opinion = ollama_opinion.generate_opinion

if not rising_snapshot.available():
    st.warning("상권 데이터가 아직 준비되지 않았습니다. README의 테스트 데이터 준비 명령을 실행해 주세요.")
    st.stop()

@st.cache_resource
def opinion_executor() -> ThreadPoolExecutor:
    return ThreadPoolExecutor(max_workers=4, thread_name_prefix="rising-opinion")


def render_ai_opinion(report: dict, focus_metric: str, opinion_key: str) -> None:
    future_key = f"{opinion_key}-future"
    pending = opinion_key not in st.session_state

    @st.fragment(run_every="2s" if pending else None)
    def opinion_fragment() -> None:
        with st.container(key="rising-ai-summary"):
            if opinion_key not in st.session_state:
                future = st.session_state.get(future_key)
                if future is None:
                    future = opinion_executor().submit(generate_opinion, report, focus_metric)
                    st.session_state[future_key] = future
                if future.done():
                    try:
                        st.session_state[opinion_key] = future.result()
                    except Exception:
                        st.session_state[opinion_key] = {
                            "mode": "data", "lines": rising_analysis.overview_lines(report)[:4],
                        }
                    st.session_state.pop(future_key, None)
            ai_head, ai_refresh = st.columns([5, 1], vertical_alignment="center")
            with ai_head:
                st.html('<strong class="kb-ai-summary-title">AI 종합의견</strong>')
            with ai_refresh:
                if st.button("재분석", key=f"refresh-{opinion_key}",
                             help="현재 지역의 수치로 AI 종합의견 다시 생성",
                             disabled=opinion_key not in st.session_state):
                    st.session_state.pop(opinion_key, None)
                    st.session_state.pop(future_key, None)
                    st.rerun()
            if opinion_key not in st.session_state:
                st.caption("AI 종합의견을 생성하는 중입니다. 아래 보고서 항목은 바로 이용할 수 있습니다.")
                return
            generated = st.session_state[opinion_key]
            summary_items = "".join(f"<li>{highlight_trends(line)}</li>" for line in generated["lines"][:4])
            st.html(f'<ul class="kb-ai-summary-points">{summary_items}</ul>')
            st.caption("로컬 Ollama 생성 의견" if generated["mode"] == "ai" else "Ollama 연결 실패 · 검증된 수치 기반 요약")

    opinion_fragment()


@st.cache_data(max_entries=2)
def filter_options() -> dict:
    return rising_snapshot.filters()

@st.cache_data(max_entries=80)
def load_rankings(**kwargs) -> dict:
    return rising_snapshot.rankings(**kwargs)

@st.cache_data(max_entries=80)
def load_report(kind: str, code: str, quarter: str, industry: str,
                rank_version: int = 2) -> dict | None:
    return rising_snapshot.report(kind=kind, code=code, quarter=quarter, industry=industry)

@st.cache_data(max_entries=200)
def load_overview_ranks(kind: str, code: str, quarter: str, district: str,
                        industry: str, rank_version: int = 2) -> dict[str, tuple[int, int]]:
    return rising_snapshot.overview_ranks(kind=kind, code=code, quarter=quarter,
                                          district=district, industry=industry)


@st.cache_data(max_entries=16)
def load_locations(kind: str, quarter: str) -> list[dict]:
    return rising_snapshot.locations(kind=kind, quarter=quarter)

@st.cache_data(max_entries=1)
def seoul_district_boundaries() -> list[dict]:
    path = Path(__file__).resolve().parents[1] / "assets" / "seoul-district-boundaries.geojson"
    return json.loads(path.read_text(encoding="utf-8"))["features"]


@st.cache_data(max_entries=26)
def visible_district_outline(district: str) -> list[dict]:
    features = seoul_district_boundaries()
    if district:
        return [feature for feature in features if feature["properties"]["district"] == district]

    # Adjacent district lines share exact endpoints. Keep edges occurring once to
    # draw only the outer Seoul border, not all 25 internal district lines.
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


@st.cache_data(max_entries=16)
def boundaries(kind: str, district: str, codes: tuple[str, ...]) -> list[dict]:
    name = "commerce-dong.geojson" if kind == "dong" else "commerce.geojson"
    path = Path(__file__).resolve().parents[1] / "data" / "local" / name
    if not path.is_file():
        return []
    features = json.loads(path.read_text(encoding="utf-8"))["features"]
    selected = set(codes)
    return [f for f in features if str(f["properties"].get("code")) in selected and (not district or f["properties"].get("district") == district)]

options = filter_options()
if not options["quarters"]:
    st.warning("조회할 수 있는 분기 자료가 없습니다.")
    st.stop()

initial = {"kind": "dong", "metric": "stores", "quarter": options["quarters"][0], "district": "",
           "criterion": "growth", "comparison": "previous", "industry": "all", "period": "quarter", "year": options["quarters"][0][:4]}
if "rising_filters" not in st.session_state:
    st.session_state.rising_filters = initial
if "rising_selected" not in st.session_state:
    st.session_state.rising_selected = None
for panel_key in ("rising_left_open", "rising_right_open", "rising_selector_open"):
    if panel_key not in st.session_state:
        st.session_state[panel_key] = True
applied = st.session_state.rising_filters
for widget_key, field in (("rising_left_district", "district"),
                          ("rising_quick_kind", "kind"), ("rising_quick_metric", "metric")):
    if widget_key not in st.session_state:
        st.session_state[widget_key] = applied[field]
result = load_rankings(**applied)
rows = result["rows"]
locations = load_locations(applied["kind"], result["quarter"])
location_by_code = {item["code"]: item for item in locations}
if "rising_map_pending_district" in st.session_state:
    st.session_state.rising_map_district = st.session_state.pop("rising_map_pending_district")
if "rising_map_pending_region" in st.session_state:
    st.session_state.rising_map_region = st.session_state.pop("rising_map_pending_region")
if "rising_map_district" not in st.session_state:
    st.session_state.rising_map_district = applied["district"]
if "rising_map_region" not in st.session_state or st.session_state.rising_map_region not in location_by_code:
    st.session_state.rising_map_region = ""
metric_labels = {"stores": "점포수", "sales": "매출", "footfall": "유동인구", "residents": "주거인구"}


def update_quick_filter(field: str, widget_key: str) -> None:
    value = st.session_state[widget_key]
    current = st.session_state.rising_filters
    if value == current[field]:
        return
    updated = {**current, field: value}
    if field == "metric" and value in {"footfall", "residents"}:
        updated["industry"] = "all"
    st.session_state.rising_filters = updated
    if field in {"kind", "district"}:
        st.session_state.rising_selected = None
        st.session_state.rising_map_pending_region = ""
    if field == "district":
        st.session_state.rising_map_pending_district = value
        if widget_key != "rising_left_district":
            st.session_state.rising_left_district = value


def select_map_district() -> None:
    update_quick_filter("district", "rising_map_district")


def reset_map_to_seoul() -> None:
    st.session_state.rising_map_district = ""
    st.session_state.rising_map_region = ""
    st.session_state.rising_left_district = ""
    st.session_state.rising_selected = None
    st.session_state.rising_filters = {**st.session_state.rising_filters, "district": ""}


def select_map_region() -> None:
    st.session_state.rising_selected = st.session_state.rising_map_region or None


def choose_metric(metric: str) -> None:
    st.session_state.rising_quick_metric = metric
    update_quick_filter("metric", "rising_quick_metric")

with st.container(key="rising-canvas"):
    with st.container(key="rising-map-canvas"):
        map_extras = {}
        if "show_all_boundaries" in map_helper_parameters:
            map_extras["show_all_boundaries"] = st.session_state.get("rising_show_all_boundaries", False)
        if "all_locations" in map_helper_parameters:
            map_extras["all_locations"] = [item for item in locations if not applied["district"] or item["district"] == applied["district"]] if st.session_state.get("rising_show_all_boundaries", False) else []
        map_result = show_map(key=load_settings().kakao_map_javascript_key,
                            rows=[{**r, "display": human_value(applied["metric"], r["value"])} for r in rows],
                            boundaries=boundaries(applied["kind"], applied["district"], tuple(r["code"] for r in rows)),
                            fallback_districts=visible_district_outline(applied["district"]),
                            **map_extras,
                            selected=st.session_state.rising_selected,
                            selected_location=location_by_code.get(st.session_state.rising_selected),
                            source=result["ranking_source"], district=applied["district"], height=820, stretch=True)
        selected = getattr(map_result, "selected", map_result)
        if selected and selected != st.session_state.rising_selected and selected in {r["code"] for r in rows}:
            st.session_state.rising_selected = selected
            st.session_state.rising_map_region = selected
            st.rerun()
        if not load_settings().kakao_map_javascript_key:
            st.info("카카오 지도 키가 없어 지도는 표시되지 않습니다. 왼쪽 순위 목록으로 보고서를 열 수 있습니다.")
    with st.container(key="rising-map-selector"):
        if st.session_state.rising_selector_open:
            city_col, district_col, region_col, close_col = st.columns([1, 1.1, 1.1, 0.7], gap="small", vertical_alignment="center")
            with city_col:
                st.button("◉ 서울특별시", key="rising-city-reset", on_click=reset_map_to_seoul,
                          help="서울시 전체로 돌아가기", width="stretch")
            with district_col:
                map_district = st.selectbox("지도 자치구", ["", *options["districts"]],
                                            key="rising_map_district", format_func=lambda value: value or "전체",
                                            label_visibility="collapsed", on_change=select_map_district)
            visible_locations = [item for item in locations if not map_district or item["district"] == map_district]
            visible_codes = {item["code"] for item in visible_locations}
            if st.session_state.rising_map_region not in visible_codes:
                st.session_state.rising_map_region = ""
            with region_col:
                st.selectbox("지도 지역", ["", *(item["code"] for item in visible_locations)],
                             key="rising_map_region", label_visibility="collapsed",
                             format_func=lambda value: location_by_code[value]["name"] if value else "전체",
                             on_change=select_map_region)
            with close_col:
                if st.button("접기", key="rising-selector-toggle", width="stretch"):
                    st.session_state.rising_selector_open = False
                    st.rerun()
        else:
            st.html('<span class="kb-rising-selector-collapsed" hidden></span>')
            if st.button("펼치기", key="rising-selector-toggle", width="stretch"):
                st.session_state.rising_selector_open = True
                st.rerun()

    with st.container(key="rising-filter-panel"):
        with st.container(key="rising-controls-card"):
            st.markdown("## 뜨는 상권")
            st.selectbox("자치구", ["", *options["districts"]],
                         key="rising_left_district", format_func=lambda x: x or "서울시 전체",
                         on_change=update_quick_filter, args=("district", "rising_left_district"))
            st.checkbox("지도에 전체 지역 표시", key="rising_show_all_boundaries")
            st.segmented_control("지역 유형", options=["dong", "area"],
                                 format_func=lambda x: {"dong": "뜨는 동네", "area": "뜨는 상권"}[x],
                                 key="rising_quick_kind", on_change=update_quick_filter,
                                 args=("kind", "rising_quick_kind"), width="stretch")
            with st.container(key="rising-metric-control"):
                st.html('<div class="kb-metric-label">분석 지표</div>')
                metrics = ("stores", "sales", "footfall", "residents")
                metric_columns = st.columns(4, gap="small", wrap=False)
                for metric, column in zip(metrics, metric_columns):
                    with column:
                        st.button(metric_labels[metric], key=f"rising-metric-{metric}",
                                  type="primary" if applied["metric"] == metric else "secondary",
                                  on_click=choose_metric, args=(metric,), width="stretch")
            with st.expander("상세조건", icon=":material/filter_alt:"):
                with st.form("rising-filters", border=False):
                    with st.container(key="rising-detail-criterion"):
                        criterion = st.segmented_control("기준조건", ["highest", "growth", "absolute"],
                                                         format_func=lambda x: {"growth": "비교증가율", "highest": "최고순위", "absolute": "비교절대값"}[x],
                                                         default=applied["criterion"], width="stretch")
                    with st.container(key="rising-detail-quarter"):
                        quarter = st.segmented_control("기준분기", list(reversed(options["quarters"][:5])),
                                                       format_func=lambda x: f"{x[:4]}년 {x[-1]}분기",
                                                       default=applied["quarter"], width="stretch")
                    with st.container(key="rising-detail-period"):
                        period = st.segmented_control("기간", ["quarter", "year"],
                                                      format_func=lambda x: "분기" if x == "quarter" else "년도",
                                                      default=applied["period"], width="stretch")
                    with st.container(key="rising-detail-comparison"):
                        comparison = st.segmented_control("조회분기", ["previous", "same"],
                                                          format_func=lambda x: "전분기" if x == "previous" else "전년 동분기",
                                                          default=applied["comparison"], width="stretch")
                    year_options = sorted({q[:4] for q in options["quarters"]})
                    with st.container(key="rising-detail-year"):
                        year = st.segmented_control("기준년도", year_options,
                                                    format_func=lambda x: f"{x}년",
                                                    default=applied["year"] if applied["year"] in year_options else year_options[-1],
                                                    width="stretch")
                    with st.container(key="rising-detail-industry"):
                        industry = st.segmented_control("업종", ["all", "CS1", "CS2", "CS3"],
                                                        default=applied["industry"], width="stretch",
                                                        format_func=lambda x: {"all": "전체", "CS1": "외식업", "CS2": "서비스업", "CS3": "소매업"}[x])
                    cancel_col, apply_col = st.columns(2)
                    with cancel_col:
                        cancelled = st.form_submit_button("취소", width="stretch")
                    with apply_col:
                        submitted = st.form_submit_button("적용", type="primary", width="stretch")
            if cancelled:
                st.rerun()
            if submitted:
                if industry != "all" and applied["metric"] not in {"stores", "sales"}:
                    industry = "all"
                st.session_state.rising_filters = {"kind": applied["kind"], "metric": applied["metric"], "quarter": quarter, "district": applied["district"],
                                                    "criterion": criterion, "comparison": comparison, "industry": industry,
                                                    "period": period, "year": year}
                st.session_state.rising_selected = None
                st.session_state.rising_map_pending_district = applied["district"]
                st.session_state.rising_map_pending_region = ""
                st.rerun()
        with st.container(key="rising-rank-card"):
            st.subheader("순위 TOP 10")
            if not rows:
                st.info("선택한 조건에 해당하는 순위 자료가 없습니다.")
            for index, row in enumerate(rows, 1):
                with st.container(key=f"rising-rank-row-{index}"):
                    rank_col, place_col, value_col, change_col = st.columns([0.24, 1.65, 0.83, 0.68], gap="small", vertical_alignment="center")
                    with rank_col:
                        st.html(f'<span class="kb-rank-number">{index}</span>')
                    with place_col:
                        if st.button(f"{row['district']} {row['name']}", key=f"rank-{row['code']}", width="stretch",
                                     type="primary" if row["code"] == st.session_state.rising_selected else "secondary"):
                            st.session_state.rising_selected = row["code"]
                            st.session_state.rising_map_pending_region = row["code"]
                            st.rerun()
                    with value_col:
                        st.html(f'<strong class="kb-rank-value">{escape(human_value(applied["metric"], row["value"]))}</strong>')
                    with change_col:
                        change = row["delta"] if applied["criterion"] == "absolute" else row["change"]
                        arrow = "↑" if change is not None and change > 0 else "↓" if change is not None and change < 0 else ""
                        st.html(f'<span class="kb-rank-change">{escape(ranking_change_label(applied["metric"], row, applied["criterion"]))} {arrow}</span>')
    with st.container(key="rising-left-toggle"):
        if not st.session_state.rising_left_open:
            st.html('<span class="kb-left-collapsed-flag" hidden></span>')
        if st.button("‹" if st.session_state.rising_left_open else "›", key="rising-left-collapse"):
            st.session_state.rising_left_open = not st.session_state.rising_left_open
            st.rerun()
    selected_row = next((row for row in rows if row["code"] == st.session_state.rising_selected), None)
    if selected_row is None:
        selected_row = location_by_code.get(st.session_state.rising_selected)
    if selected_row:
        with st.container(key="rising-report-panel"):
            report = load_report(applied["kind"], selected_row["code"], result["quarter"], applied["industry"], rank_version=2)
            if report:
                st.html('<div class="kb-rising-report-banner">분석리포트 <span>지역 데이터에 기반한 참고 보고서</span></div>')
                st.subheader(f"{report['district']} {report['name']} 분석 리포트")
                ranked_row = next((row for row in rows if row["code"] == report["code"]), None)
                rank_number = next((index for index, row in enumerate(rows, 1)
                                    if row["code"] == report["code"]), None)
                opinion_key = f"opinion-{report['kind']}-{report['code']}-{report['quarter']}-{report['industry']}-{applied['metric']}-compact-v1"
                render_ai_opinion(report, applied["metric"], opinion_key)
                if applied["industry"] != "all":
                    st.caption("업종별 세부 구성·요일·연령 자료는 확인되지 않아 해당 그래프에는 전체 업종 원본만 사용합니다.")
                tabs = ["종합의견", "업종분석", "매출분석", "인구분석", "지역(배후지)분석"]
                tab = st.segmented_control("보고서 항목", tabs, default="종합의견",
                                           key=f"rising-report-tab-{report['kind']}-{report['code']}-{report['quarter']}-{report['industry']}-{applied['metric']}",
                                           width="stretch", wrap=False)
                if tab == "종합의견":
                    card_ranks = load_overview_ranks(report["kind"], report["code"], report["quarter"],
                                                    report["district"], report["industry"], rank_version=2)
                    overview_card_grid(report, ranks=card_ranks)
                    st.divider()
                    for metric in ("stores", "sales", "footfall"):
                        history_chart(report, metric)
                    history_table(report)
                elif tab == "업종분석":
                    history_chart(report, "stores")
                    industry_chart(report)
                    breakdown_chart(report, category="stores", title="일반점포와 프랜차이즈",
                                    keys=["regular", "franchise"], names=["일반점포", "프랜차이즈"], unit="개")
                    if report["industries"]:
                        st.dataframe([{"업종": item["name"], "점포수": item["stores"], "개업": item["opened"], "폐업": item["closed"]} for item in report["industries"][:30]], hide_index=True, alt="업종별 점포·개폐업 분석")
                    else:
                        st.info("업종별 세부 자료가 없습니다.")
                elif tab == "매출분석":
                    value, label = sales_per_store_month(report)
                    st.metric("점포당 월평균 매출", f"{value:,.0f}만 원" if value is not None else "자료 없음", border=True)
                    st.caption(label + " · 분기 추정매출 합계와 다른 지표입니다.")
                    sales = report["metrics"].get("sales")
                    if sales:
                        st.metric("분기 추정매출 합계", human_value("sales", sales["value"]), percent(sales["change"]), border=True)
                    history_chart(report, "sales")
                    breakdown_chart(report, category="sales", title="요일별 추정매출",
                                    keys=[f"day_{index}" for index in range(7)],
                                    names=["월", "화", "수", "목", "금", "토", "일"], unit="원")
                    breakdown_chart(report, category="sales", title="연령대별 추정매출",
                                    keys=[f"age_{age}" for age in (10, 20, 30, 40, 50, 60)],
                                    names=["10대", "20대", "30대", "40대", "50대", "60대 이상"], unit="원")
                elif tab == "인구분석":
                    density, label = footfall_per_ha(report)
                    st.metric("3개월간 1ha당 유동인구", f"{density:,.0f}명/ha" if density is not None else "면적 정보 없음", border=True)
                    st.caption(label)
                    population_order = ["residents", "footfall"] if applied["metric"] == "residents" else ["footfall", "residents"]
                    for metric in population_order:
                        item = report["metrics"].get(metric)
                        if item:
                            st.metric(LABELS[metric], human_value(metric, item["value"]), percent(item["change"]), border=True)
                        history_chart(report, metric)
                    breakdown_chart(report, category="footfall", title="연령대별 유동인구",
                                    keys=[f"age_{age}" for age in (10, 20, 30, 40, 50, 60)],
                                    names=["10대", "20대", "30대", "40대", "50대", "60대 이상"], unit="명")
                else:
                    area = report.get("area_m2")
                    st.metric("분석 면적", f"{area / 10_000:,.1f}ha" if area else "자료 없음", border=True)
                    st.caption("면적은 확보된 서울시 분석 영역 기준입니다. 거주·유동인구와 개별 점포를 같은 모집단으로 합산하지 않습니다.")
                    benchmark = report.get("benchmarks", {}).get(applied["metric"])
                    if benchmark:
                        st.dataframe([{"범위": "선택 자치구 합계", "값": human_value(applied["metric"], benchmark["district"])}, {"범위": "서울 합계", "값": human_value(applied["metric"], benchmark["city"])}], hide_index=True, alt="자치구와 서울 합계 비교")
                export_report = {**report, "selected_ranking": {
                    "metric": applied["metric"], "rank": rank_number, "value": ranked_row["value"],
                    "value_source": ranked_row["value_source"], "change_source": ranked_row["change_source"],
                    "industry": applied["industry"], "criterion": applied["criterion"],
                } if ranked_row else None}
                def current_pdf() -> bytes:
                    return build_pdf(export_report, tab)

                def report_zip() -> bytes:
                    return build_zip(export_report)

                exports = st.columns(2)
                with exports[0]:
                    st.download_button("현재 항목 PDF", data=current_pdf, file_name=f"{report['code']}_{tab}.pdf",
                                       mime="application/pdf", width="stretch", on_click="ignore")
                with exports[1]:
                    st.download_button("PDF 5종 ZIP", data=report_zip, file_name=f"{report['code']}_reports.zip",
                                       mime="application/zip", width="stretch", on_click="ignore")
                if st.button("내 상권 경영·금융진단으로 이어가기", type="primary"):
                    st.session_state["consultation_region"] = {"code": report["code"], "kind": report["kind"], "name": report["name"], "district": report["district"], "quarter": report["quarter"]}
                    st.switch_page("app_pages/my_market.py")

        with st.container(key="rising-right-toggle"):
            if not st.session_state.rising_right_open:
                st.html('<span class="kb-right-collapsed-flag" hidden></span>')
            if st.button("›" if st.session_state.rising_right_open else "‹",
                         key="rising-right-collapse"):
                st.session_state.rising_right_open = not st.session_state.rising_right_open
                st.rerun()
