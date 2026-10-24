"""Current-owner and future-owner analysis based on the team's test snapshot."""
from __future__ import annotations

import json

import streamlit as st

from kb_bridge.config import load_settings
from kb_bridge.domain.finance import amortizing_payment, rent_stress
from kb_bridge.repositories import owner_snapshot
from kb_bridge.ui.kakao_rank_map import show_map

st.title("내상권 분석")
st.caption("상권 데이터에서 출발해 내 사업의 비용과 다음 상담 질문까지 이어갑니다.")

if not owner_snapshot.available():
    st.warning("팀원 테스트 데이터가 준비되지 않았습니다. README의 데이터 준비 명령을 실행해 주세요.")
    st.stop()

mode = st.segmented_control("이용 모드", ["나는 사장", "나도 곧 사장"], default="나는 사장", key="owner-mode")
catalog = owner_snapshot.catalog()
categories = ["외식업", "서비스업", "소매업"]

@st.cache_data(max_entries=64)
def load_licences(lat: float, lng: float, radius: int, group_id: str) -> dict:
    return owner_snapshot.licence_observations(lat=lat, lng=lng, radius_m=radius, group_id=group_id)

@st.cache_data(max_entries=64)
def load_market_report(code: str, industry_code: str | None) -> dict:
    return owner_snapshot.market_report(code, industry_code)

left, right = st.columns([1, 2], gap="medium")
with left:
    with st.container(border=True):
        st.subheader("1 · 업종과 상권 선택" if mode == "나도 곧 사장" else "1 · 점포 위치와 업종 선택")
        category = st.segmented_control("업종 대분류", categories, default="외식업")
        groups = [item for item in catalog if item["category"] == category and not item.get("unavailable")]
        labels = {item["id"]: item["label"] for item in groups}
        group_id = st.selectbox("세부 업종", list(labels), format_func=lambda key: labels[key])
        group = next(item for item in groups if item["id"] == group_id)
        industry_code = group.get("officialCode")
        st.caption(group.get("note") or "인허가 업태와 서울시 서비스업종 코드는 구분해서 표시합니다.")
        districts = sorted({item["district"] for item in owner_snapshot.markets()})
        district = st.selectbox("자치구", ["", *districts], format_func=lambda value: value or "서울 전체")
        if mode == "나도 곧 사장" and industry_code:
            candidates = owner_snapshot.founder_rankings(industry_code, district=district)
            st.caption(f"{owner_snapshot.regional()['quarter']} 기준 · 선택 업종 추정매출 순 · 공식 상권 전체 단위")
            if candidates:
                st.dataframe([{"상권": f"{row['district']} {row['name']}", "점포수": row["stores"], "추정매출(원)": row["sales"]} for row in candidates[:10]], hide_index=True, alt="예비 창업자 업종별 상권 목록")
                codes = [row["code"] for row in candidates]
            else:
                codes = []
        else:
            query = st.text_input("상권·역·주요 지역 검색", placeholder="예: 잠실역, 석촌호수")
            candidates = owner_snapshot.markets(district=district, query=query)
            if len(candidates) > 100 and not query and not district:
                st.caption("검색어 또는 자치구를 입력하면 선택 목록을 좁힐 수 있습니다.")
                candidates = candidates[:100]
            codes = [row["code"] for row in candidates]
        chosen_code = st.selectbox("분석 상권", codes, format_func=lambda code: next(f"{x['district']} · {x['name']} ({x['type']})" for x in candidates if x["code"] == code)) if codes else None
        radius = st.segmented_control("주변 인허가 관측 반경", [300, 500, 1000], default=500, format_func=lambda x: f"{x:,}m")
        st.caption("반경 안 인허가 관측과 공식 상권 전체의 점포·매출은 서로 다른 범위입니다.")

if not chosen_code:
    with right:
        st.info("분석할 상권을 선택해 주세요.")
    st.stop()

@st.cache_data(max_entries=16)
def market_boundary(code: str) -> list[dict]:
    path = owner_snapshot.LOCAL / "commerce.geojson"
    if not path.is_file(): return []
    return [feature for feature in json.loads(path.read_text(encoding="utf-8"))["features"] if str(feature["properties"].get("code")) == code]

market = next(item for item in candidates if item["code"] == chosen_code)
report = load_market_report(chosen_code, industry_code)
with right:
    st.subheader(f"{market['district']} {market['name']}")
    st.caption(f"{market['type']} · {report['quarter'][:4]}년 {report['quarter'][-1]}분기 · 공식 상권 전체 단위")
    selected = show_map(key=load_settings().kakao_map_javascript_key,
                        rows=[{"code": market["code"], "name": market["name"], "district": market["district"],
                               "lat": market["lat"], "lng": market["lng"]}], boundaries=market_boundary(market["code"]), selected=market["code"],
                        source="official", district=market["district"], radius=radius)
    if not load_settings().kakao_map_javascript_key:
        st.info("카카오 지도 키가 없어 지도를 표시할 수 없습니다. 아래 분석 결과는 계속 확인할 수 있습니다.")

st.divider()
st.subheader("2 · 상권 분석 리포트")
st.caption("팀원 테스트 프로젝트의 공식 상권·업종 집계 스냅샷입니다. 개별 점포의 실매출을 뜻하지 않습니다.")
current = report["current"]
prior = report["prior"]
cols = st.columns(4)
for col, label, key, unit in zip(cols, ["점포수", "개업 점포", "폐업 점포", "추정매출"], ["stores", "opened", "closed", "sales"], ["개", "개", "개", "원"]):
    value = current.get(key)
    with col:
        st.metric(label, f"{value:,.0f}{unit}" if value is not None else "자료 없음", border=True)
        if key == "sales":
            st.caption("원본 `당월_매출_금액` · 원본 분기코드와 함께 표시")

report_tab = st.segmented_control("분석 항목", ["간략보고서", "업종분석", "매출분석", "인구분석", "금융상담 준비"], default="간략보고서")
if report_tab == "간략보고서":
    obs = load_licences(market["lat"], market["lng"], radius, group_id)
    a, b = st.columns(2)
    with a:
        st.metric("선택 업종 인허가 관측", f"{obs['selected']:,}건", border=True)
    with b:
        st.metric("반경 안 확보 인허가 관측", f"{obs['total']:,}건", border=True)
    st.caption(f"선택 위치 반경 {radius:,}m의 확보 인허가 기록입니다. 중복 허가가 가능하며 공식 점포수와 직접 비교할 수 없습니다.")
    if obs["examples"]:
        st.dataframe(obs["examples"], hide_index=True, alt="주변 인허가 업소 예시")
    st.write(f"상권 유형: {market['type']} · 행정동: {market.get('dong') or '자료 없음'}")
elif report_tab == "업종분석":
    st.metric("선택 업종 공식 점포수", f"{current['stores']:,.0f}개" if current.get("stores") is not None else "자료 없음", border=True)
    if prior.get("stores") is not None:
        st.caption(f"이전 분기 {prior['stores']:,.0f}개")
    st.caption("업종별 공식 집계와 주변 인허가 업태는 별도의 지표입니다.")
elif report_tab == "매출분석":
    if current.get("sales") is not None:
        st.metric("선택 상권·업종 추정매출", f"{current['sales']:,.0f}원", border=True)
        if prior.get("sales") is not None and prior["sales"] > 0:
            st.caption(f"전분기 대비 {(current['sales']/prior['sales']-1)*100:+.1f}% · 전분기 {prior['sales']:,.0f}원")
    else:
        st.info("선택한 상권·업종의 추정매출 자료가 제공되지 않습니다.")
    st.caption("상권 전체의 공식 집계입니다. 선택 반경이나 개별 업소의 매출로 환산하지 않습니다.")
elif report_tab == "인구분석":
    for key, label in [("floating", "유동인구"), ("resident", "상주인구"), ("worker", "직장인구")]:
        st.metric(label, f"{report[key]:,.0f}명" if report.get(key) is not None else "자료 없음", border=True)
    st.caption("서로 다른 모집단과 집계 기간을 합산하지 않습니다.")
else:
    st.subheader("3 · 경영·금융진단")
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
        c1, c2 = st.columns(2)
        with c1:
            st.metric("현재 월 현금흐름 여유액", f"{before:,.0f}만 원", border=True)
        with c2:
            st.metric("월세 인상 가정 후", f"{after:,.0f}만 원", f"{after-before:+,.0f}만 원", border=True)
        st.metric("가상 신규대출 월 원리금", f"{loan_payment:,.1f}만 원", border=True)
        st.metric("월세 변화와 신규대출 가정 후 여유액", f"{after-loan_payment:,.1f}만 원", border=True)
        if after - loan_payment < 0:
            st.warning("이 가정에서는 추가 차입 후 월 현금흐름이 음수입니다. 신규대출 외에 비용·채무관리·경영지원 상담도 검토하세요.")
        st.caption("세금, 보증금, 비정기 지출, 계절 변동과 실제 대출 조건은 미반영입니다. 월세 인상률과 연이율은 가정값이며 은행 제시금리가 아닙니다.")
    st.subheader("가까운 KB 영업점 · 상담 준비")
    branches = owner_snapshot.nearest_branches(market["lat"], market["lng"])
    for branch in branches:
        with st.container(border=True):
            st.markdown(f"**{branch['name']}** · 직선 약 {branch['meters']/1000:.2f}km")
            st.caption(f"{branch['address']} · {branch['phone']} · {branch['hours']}")
    st.caption("KB국민은행 공식 지점검색 스냅샷 기준입니다. RM 상주·상담 가능 업무·운영시간은 방문 전 공식 채널에서 확인하세요.")
    memo = {"state": "교육용 시연 · 미접수 · 예약 미확정", "market": market["name"], "district": market["district"],
            "industry": group["label"], "topic": purpose, "quarter": report["quarter"],
            "branch_candidates": [{"name": item["name"], "address": item["address"]} for item in branches]}
    st.download_button("상담 준비 메모 저장", data=json.dumps(memo, ensure_ascii=False, indent=2),
                       file_name="kb-bridge-consultation-draft.json", mime="application/json", width="stretch")
    st.caption("메모에는 입력한 개인 재무 수치를 넣지 않습니다. 저장 버튼을 눌러도 은행에는 전송되지 않습니다.")
