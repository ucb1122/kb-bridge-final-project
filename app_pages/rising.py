"""Rising districts and markets, restyled to the team's KB Bridge visual language."""
from __future__ import annotations

import json
from pathlib import Path

import streamlit as st

from kb_bridge.config import load_settings
from kb_bridge.integrations.ollama_opinion import generate_opinion
from kb_bridge.repositories import rising_snapshot
from kb_bridge.services.rising_analysis import LABELS, footfall_per_ha, human_value, overview_lines, percent, sales_per_store_month
from kb_bridge.services.rising_pdf import build_pdf, build_zip
from kb_bridge.ui.kakao_rank_map import show_map
from kb_bridge.ui.rising_layout import apply_rising_layout

apply_rising_layout()

if not rising_snapshot.available():
    st.warning("상권 데이터가 아직 준비되지 않았습니다. README의 테스트 데이터 준비 명령을 실행해 주세요.")
    st.stop()

@st.cache_data(max_entries=2)
def filter_options() -> dict:
    return rising_snapshot.filters()

@st.cache_data(max_entries=80)
def load_rankings(**kwargs) -> dict:
    return rising_snapshot.rankings(**kwargs)

@st.cache_data(max_entries=80)
def load_report(kind: str, code: str, quarter: str) -> dict | None:
    return rising_snapshot.report(kind=kind, code=code, quarter=quarter)

@st.cache_data(max_entries=1)
def seoul_district_boundaries() -> list[dict]:
    path = Path(__file__).resolve().parents[1] / "assets" / "seoul-district-boundaries.geojson"
    return json.loads(path.read_text(encoding="utf-8"))["features"]


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
applied = st.session_state.rising_filters
result = load_rankings(**applied)
rows = result["rows"]
source = "서울시 기본 순위 스냅샷" if result["ranking_source"] == "official" else "공개 원본 계산값"

with st.container(key="rising-canvas"):
    with st.container(key="rising-map-canvas"):
        selected = show_map(key=load_settings().kakao_map_javascript_key,
                            rows=[{**r, "display": human_value(applied["metric"], r["value"])} for r in rows],
                            boundaries=boundaries(applied["kind"], applied["district"], tuple(r["code"] for r in rows)),
                            fallback_districts=seoul_district_boundaries(),
                            selected=st.session_state.rising_selected, source=result["ranking_source"], district=applied["district"], height=820)
        if selected and selected != st.session_state.rising_selected and selected in {r["code"] for r in rows}:
            st.session_state.rising_selected = selected
            st.rerun()
        if not load_settings().kakao_map_javascript_key:
            st.info("카카오 지도 키가 없어 지도는 표시되지 않습니다. 왼쪽 순위 목록으로 보고서를 열 수 있습니다.")
    with st.container(key="rising-filter-panel"):
        st.markdown("## 뜨는 상권")
        st.caption("같은 자료, 지역 변화에 맞는 해석")
        with st.form("rising-filters", border=False):
            st.subheader("분석 조건")
            kind = st.segmented_control("지역 유형", options=["dong", "area"], format_func=lambda x: {"dong": "뜨는 동네", "area": "뜨는 상권"}[x], default=applied["kind"])
            metric = st.segmented_control("분석 지표", options=list(LABELS), format_func=lambda x: LABELS[x], default=applied["metric"])
            district = st.selectbox("자치구", ["", *options["districts"]], index=["", *options["districts"]].index(applied["district"]) if applied["district"] in options["districts"] else 0, format_func=lambda x: x or "서울 전체")
            quarter_col, criterion_col = st.columns(2)
            with quarter_col:
                quarter = st.selectbox("기준 분기", options["quarters"], index=options["quarters"].index(applied["quarter"]) if applied["quarter"] in options["quarters"] else 0,
                                       format_func=lambda x: f"{x[:4]}년 {x[-1]}분기")
            with criterion_col:
                criterion = st.selectbox("정렬 기준", ["growth", "highest", "absolute"], index=["growth", "highest", "absolute"].index(applied["criterion"]),
                                         format_func=lambda x: {"growth": "비교증가율", "highest": "최고순위", "absolute": "비교절대값"}[x])
            with st.expander("상세조건"):
                detail1, detail2 = st.columns(2)
                with detail1:
                    period = st.segmented_control("기간", ["quarter", "year"], format_func=lambda x: "분기" if x == "quarter" else "년도", default=applied["period"])
                with detail2:
                    year_options = sorted({q[:4] for q in options["quarters"]}, reverse=True)
                    year = st.selectbox("기준년도", year_options, index=year_options.index(applied["year"]) if applied["year"] in year_options else 0)
                comparison = st.segmented_control("조회분기", ["previous", "same"], format_func=lambda x: "전분기" if x == "previous" else "전년 동분기", default=applied["comparison"])
                industry = st.selectbox("업종", ["all", "CS1", "CS2", "CS3"], index=["all", "CS1", "CS2", "CS3"].index(applied["industry"]),
                                        format_func=lambda x: {"all": "전체", "CS1": "외식업", "CS2": "서비스업", "CS3": "소매업"}[x])
            submitted = st.form_submit_button("조건 적용", type="primary", width="stretch")
        if submitted:
            if industry != "all" and metric not in {"stores", "sales"}:
                st.error("업종 조건은 점포수와 매출에만 적용됩니다.")
            else:
                st.session_state.rising_filters = {"kind": kind, "metric": metric, "quarter": quarter, "district": district,
                                                    "criterion": criterion, "comparison": comparison, "industry": industry,
                                                    "period": period, "year": year}
                st.session_state.rising_selected = None
                st.rerun()
        st.caption(f"{result['quarter'][:4]}년 {result['quarter'][-1]}분기 · {source} · {applied['district'] or '서울 전체'}")
        with st.container(border=True):
            st.subheader("순위 TOP 10")
            st.caption(LABELS[applied["metric"]] + " · " + source)
            if not rows:
                st.info("선택한 조건에 해당하는 순위 자료가 없습니다.")
            for index, row in enumerate(rows, 1):
                label = f"{index:02d}  {row['district']} {row['name']}  ·  {human_value(applied['metric'], row['value'])}"
                if st.button(label, key=f"rank-{row['code']}", width="stretch", type="primary" if row["code"] == st.session_state.rising_selected else "secondary"):
                    st.session_state.rising_selected = row["code"]
                    st.rerun()
                st.caption(f"{percent(row['change'])} · 비교값 {human_value(applied['metric'], row['previous'])}")
    with st.container(key="rising-source-badge"):
        st.caption("서울시 지도 · 순위 배지나 경계를 선택하면 지역 보고서를 엽니다. 배지는 실제 상권 반경이 아닙니다.")
    selected_row = next((row for row in rows if row["code"] == st.session_state.rising_selected), None)
    if selected_row:
        with st.container(key="rising-report-panel"):
            report = load_report(applied["kind"], selected_row["code"], result["quarter"])
            if report:
                st.html('<div class="kb-rising-report-banner">분석리포트 <span>지역 데이터에 기반한 참고 보고서</span></div>')
                head, close = st.columns([5, 1])
                with head:
                    st.subheader(f"{report['district']} {report['name']} 분석 리포트")
                with close:
                    if st.button("닫기", key="rising-close-report"):
                        st.session_state.rising_selected = None
                        st.rerun()
                st.caption(f"{report['quarter'][:4]}년 {report['quarter'][-1]}분기 · 공개 원본과 확인된 공식 표시값을 구분합니다.")
                st.info("상권 지표는 지역의 변화 신호입니다. 우리 가게의 매출·임대료나 대출 심사 결과를 뜻하지 않습니다.")
                tabs = ["종합의견", "업종분석", "매출분석", "인구분석", "지역(배후지)분석"]
                tab = st.segmented_control("보고서 항목", tabs, default="종합의견")
                if tab == "종합의견":
                    metric_cols = st.columns(4)
                    for column, (metric, label) in zip(metric_cols, LABELS.items()):
                        item = report["metrics"].get(metric)
                        with column:
                            st.metric(label, human_value(metric, item["value"]) if item else "자료 없음", percent(item["change"]) if item else None, border=True)
                    for line in overview_lines(report):
                        st.markdown("- " + line)
                    if st.button("로컬 AI 종합의견 생성"):
                        with st.spinner("검증된 보고서 수치로 의견을 생성하는 중입니다."):
                            st.session_state[f"opinion-{report['code']}-{report['quarter']}"] = generate_opinion(report)
                    generated = st.session_state.get(f"opinion-{report['code']}-{report['quarter']}")
                    if generated:
                        st.subheader("AI 종합의견" if generated["mode"] == "ai" else "데이터 기반 요약")
                        for line in generated["lines"]: st.markdown("- " + line)
                        st.caption(generated["note"])
                elif tab == "업종분석":
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
                    history = [h for h in report["history"] if h["metric"] == "sales"]
                    if history:
                        st.line_chart({h["quarter"]: h["value"] for h in history}, alt="분기별 추정매출 추이")
                elif tab == "인구분석":
                    density, label = footfall_per_ha(report)
                    st.metric("3개월간 1ha당 유동인구", f"{density:,.0f}명/ha" if density is not None else "면적 정보 없음", border=True)
                    st.caption(label)
                    for metric in ["footfall", "residents"]:
                        item = report["metrics"].get(metric)
                        if item:
                            st.metric(LABELS[metric], human_value(metric, item["value"]), percent(item["change"]), border=True)
                else:
                    area = report.get("area_m2")
                    st.metric("분석 면적", f"{area / 10_000:,.1f}ha" if area else "자료 없음", border=True)
                    st.caption("면적은 확보된 서울시 분석 영역 기준입니다. 거주·유동인구와 개별 점포를 같은 모집단으로 합산하지 않습니다.")
                    benchmark = report.get("benchmarks", {}).get(applied["metric"])
                    if benchmark:
                        st.dataframe([{"범위": "선택 자치구 합계", "값": human_value(applied["metric"], benchmark["district"])}, {"범위": "서울 합계", "값": human_value(applied["metric"], benchmark["city"])}], hide_index=True, alt="자치구와 서울 합계 비교")
                exports = st.columns(2)
                with exports[0]:
                    st.download_button("현재 항목 PDF", data=build_pdf(report, tab), file_name=f"{report['code']}_{tab}.pdf", mime="application/pdf", width="stretch")
                with exports[1]:
                    st.download_button("PDF 5종 ZIP", data=build_zip(report), file_name=f"{report['code']}_reports.zip", mime="application/zip", width="stretch")
                if st.button("내 상권 경영·금융진단으로 이어가기", type="primary"):
                    st.session_state["consultation_region"] = {"code": report["code"], "kind": report["kind"], "name": report["name"], "district": report["district"], "quarter": report["quarter"]}
                    st.switch_page("app_pages/my_market.py")
