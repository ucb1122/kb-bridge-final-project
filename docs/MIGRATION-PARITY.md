# Streamlit 화면과 Node.js 화면 대응

이 문서는 보관된 Python·Streamlit 구현과 현재 Node.js 화면의 대응 관계를 기록한다. 공식 표시값과 공개 원본 계산값은 별도 출처로 취급한다.

| 이전 구현 | 현재 화면 | 옮긴 데이터·동작 |
| --- | --- | --- |
| `app_pages/rising.py`, `kb_bridge/ui/rising_layout.py` | `frontend/pages/rising/` | 뜨는 동네·상권 전환, 점포수·매출·인구 지표, 상세조건, 순위 TOP 10, 지도 선택 |
| `kb_bridge/ui/rising_report.py` | `frontend/pages/rising/full-report.js`, `backend/server/data.js` | 선택 지역의 다섯 항목 보고서와 분기별 원본 수치. 오른쪽 보고서 본문은 화면 디자인 수정 중에도 유지 |
| `app_pages/my_market.py` | `frontend/pages/owner/`, `frontend/pages/owner/dong.html` | 현재 사업자의 위치·업종·분석영역 선택, 행정동 전체 원본 집계 구분 |
| 예비 창업자 화면 | `frontend/pages/intended-owner/` | 후보 상권과 업종 선택, 순위·보고서·상담 준비 흐름. 상단 메뉴에서는 내 상권 분석 안의 링크로 이동 |
| `app_pages/warning.py`, `app_pages/products.py` | `frontend/pages/warning/`, `frontend/pages/products/` | 이전에도 준비 중 화면이었다. 위험 예측과 실제 상품 추천은 아직 연결되지 않았다. |

## 지도 구현

뜨는 상권과 행정동 분석은 카카오 지도 SDK 위에 순위 표식과 경계를 표시한다. 내 상권 분석·창업 준비·상담 준비는 카카오 지도를 바탕 지도로 사용하고 기존 Leaflet 분석 도형·선택 레이어를 그 위에 둔다. 지도 표시에 카카오 JavaScript 키와 등록된 웹 도메인이 필요하다. 카카오 지도 확대 단계와 분석 레이어 확대 단계의 차이로 도형 경계의 세부 위치는 실제 브라우저에서 확인해야 한다.

## 검증 기준

`npm test`는 공식 순위, 원본 집계, 매출·유동인구 변환, 이문1동 행정동 전체 수치와 상세조건을 확인한다. 지도 패널의 실제 크기·도형 정렬·클릭 동작은 화면에서 추가 확인한다.
