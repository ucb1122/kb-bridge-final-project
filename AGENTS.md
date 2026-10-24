# Repository guide

## What

- 소상공인의 상권 변화와 경영 부담을 연결해 금융·정책 지원 및 상담 준비까지 돕는 의사결정 지원 서비스다. 예비 창업자의 입지·사업 준비 흐름도 포함한다.
- Python·Streamlit 화면, SQLite 데이터, 카카오 지도와 로컬 Ollama 연동을 계획한다.
- 화면은 app.py와 app_pages/, 업무 코드는 kb_bridge/에 둔다. 데이터·협업 계약은 docs/를 본다.

## Why

- 공식 표시값과 공개 원본에서 계산한 값을 혼동하지 않아야 한다.
- 금융 시뮬레이션과 젠트리피케이션 신호는 근거·기준 시점·한계를 함께 보여줘야 한다.
- 상권의 지역 신호와 개별 사업자의 재무·대출 적격성을 분리한다. 입력하지 않은 개인 매출·임대료를 지역 통계에서 추정하거나 상담 안내를 은행 심사 결과로 표현하지 않는다.

## How

- python -m pip install -e . 로 설치하고 python -m streamlit run app.py 로 실행한다.
- python -m unittest discover -s tests -v 로 기본 계약을 검증한다.
- 이슈·브랜치·커밋·PR 규칙은 docs/COLLABORATION.md를 따른다.
- README에는 현재 동작과 향후 계획을 구분한다.
