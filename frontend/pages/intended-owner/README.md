# 3번째 화면 — 우리 가게 회복 플래너

최종 인계: 2026-10-28. 이 폴더에 3번째 화면의 코드·분석 원본을 두고, 공용 영업점 자료와 브랜드 이미지는 `frontend/shared/`에서 읽습니다.

## 바로 실행

저장소 전체를 받은 뒤 루트에서 다음 명령을 실행합니다. Node.js 22.13 이상만 필요하며 화면 실행에 Python·DB·API 키는 필요 없습니다.

```powershell
node backend/preview-server.mjs
```

- 3번째 화면: http://localhost:5174/pages/intended-owner/
- 4번째 화면: http://localhost:5174/pages/guide/
- 같은 포트가 이미 실행 중이면 위 주소를 먼저 확인하세요. 다른 포트 사용: `$env:PORT=5185; node backend/preview-server.mjs`.
- 이 간이 서버는 위 두 페이지를 제공합니다. 기존 전체 앱 서버도 이 폴더의 정적 화면을 그대로 제공할 수 있습니다.
- 지도 바탕 타일은 OpenFreeMap/OSM 인터넷 연결이 필요합니다. 상권 경계·순위·금융 데이터는 동봉 파일에서 읽습니다. 지도 서버를 사용하지 못하면 OSM 타일로 복구합니다.

## 무엇을 어디에 사용하나요?

| 파일·폴더 | 역할 | 실행 때 필요 |
|---|---|---|
| `index.html`, `main.js`, `commercial-map.js` | 좌측 검색·상위 10곳·지도 선택 | 예 |
| `assets/regions.json`, `boundaries.json` | 상권·행정동·역 검색, 이름·좌표·WGS84 경계 | 예 |
| `assets/closure-risk.json` | Python이 계산한 1,650개 상권의 예측값·전역 순위·상태·계수 | 예 |
| `frontend/shared/finance/kb-branches.json` | 금융상품 안내와 공유하는 공식 공개 영업점 283곳, 가까운 3곳을 직선거리로 표시 | 예 |
| `recovery-planner.js` → `friendly-planner.js` | 내 고민 → 부담 계산 → 필요한 도움 → 영업점·PDF | 예 |
| `customer-flow-model.js`, `appointment-*.js`, `consultation-pdf.js` | 고민별 계산·거리 정렬·상담서 양식·PDF 생성 | 예 |
| `vendor/` | 지도·PDF 라이브러리·한글 폰트·라이선스. CDN 설치 불필요 | 예 |
| `analysis/raw/` | 의사결정 지원 폴더 원본 21개. 원본 바이트를 그대로 복사 | 재분석만 |
| `analysis/sources/의사결정.ipynb` | 원 분석 노트북. Colab 설치·Drive 연결 셀은 실행하지 않음 | 재분석만 |
| `analysis/sources/*.docx` | 모델 선택·지원 해석의 근거 보고서 | 근거 검토 |
| `analysis/map-inputs/`, `analysis/public-boundaries/` | 지도 생성에 사용한 기존 검증 스냅샷·공공 경계·메타정보 | 지도 재생성만 |
| `analysis/generated/` | 동봉 원본으로 재실행한 결과·검증표 | 재현 검토 |
| `references/` | 웹에서 확인한 공개 신청서 PDF와 참조 위치·적용 범위 기록 | 양식 근거 |
| `DATA-MANIFEST.json` | 동봉 자료의 상대 경로·용량·SHA-256 | 무결성 검사 |

## Python 분석 재현

재분석 환경: Python 3.11 이상. 검증에 사용한 버전은 Python 3.12.14 / numpy 2.3.5 / pandas 3.0.1 / openpyxl 3.1.5이며 requirements에 고정했습니다. 화면만 실행할 때는 설치하지 않아도 됩니다.

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r frontend/pages/intended-owner/tools/requirements-closure.txt
.venv\Scripts\python frontend/pages/intended-owner/tools/build_closure_risk.py --output frontend/pages/intended-owner/analysis/generated/closure-risk-rebuilt.json
node frontend/pages/intended-owner/tools/verify-package.mjs
```

- 기본 입력은 모두 이 폴더의 `analysis/`입니다. `C:\dev\seoul_public_data`, 기존 `kb-test-project`, 루트 `data/`를 요구하지 않습니다.
- `build_closure_risk.py`는 원 노트북 5·6·9·10번 셀의 전처리와 36번 셀의 폐업률 OLS를 재현합니다.
- 실제 사용한 입력: 2021~2025년 점포 5개·추정매출 5개, 길단위인구, 상권변화지표, 영역 CSV, 주민등록 XLSX = 14개. 나머지 7개 원본은 원 자료 묶음의 참고 자료로 보존하며 순위에 추가 투입하지 않습니다.
- 2025년 입력 → 2027년 상권 폐업률 추정. OLS 식: `y ~ close_now + logstore + C(typ)`. 평가 1,548곳, 예측값 상위 10% 155곳, 자료미비 102곳. UI는 조건별 상위 10곳을 보여줍니다.
- 학습 계수는 고정 비율 가중치가 아닙니다. G지수는 참고 지표이며 순위 가산점이 아닙니다. 연평균 점포 10개 미만을 제외하고 G 입력이 완전한 표본을 사용합니다.
- 2026-10-28 동봉 원본으로 재실행해 현재 화면 JSON과 모든 예측값·순위·모델 계수·과거 검증 결과가 일치함을 확인했습니다.
- 화면 결과를 재계산으로 교체하려면 검증 후 `--output frontend/pages/intended-owner/assets/closure-risk.json`을 지정합니다. 원본 파일은 수정하지 않습니다.
- 지도 재생성: `python frontend/pages/intended-owner/tools/build-navigator-data.py`. 기본 입력도 동봉 `analysis/map-inputs`, `analysis/public-boundaries`입니다.

## 상담서와 시연 범위

- 공개 신청서의 표 구성을 참고해 신청인·연락처·상담 희망·현재/변경 금액·노란우산 요청을 구획한 자체 사전 상담서를 만들었습니다. 정부·KB 정식 신청서가 아닙니다.
- PDF와 미리보기는 동일한 폰트·좌표·표 그리기 명령을 사용합니다. 실제 PDF 파일을 내려받을 수 있습니다.
- '영업점에 상담서 보내기' 버튼은 활성화된 시연 흐름입니다. 누르면 시연 확인을 보여주며 실제 접수·예약 완료를 표시하지 않습니다. 공식 은행 수신처·전송 API·계좌 조회·공제 가입은 없습니다.
- 연락처·상담서·개인 금액은 서버로 전송하지 않습니다. 고객이 동의해 저장하는 계획에도 연락처는 포함하지 않습니다. PDF는 사용자가 직접 내려받을 때만 파일로 저장됩니다.
- 입력하지 않은 개인 매출·비용·금리·공실은 추정하지 않습니다. 상권 신호는 개별 점포의 폐업 확률·대출 심사 결과가 아닙니다.

## 개발자 검증

```powershell
node --test frontend/pages/intended-owner/tools/customer-flow.test.mjs frontend/pages/intended-owner/tools/appointment-request.test.mjs frontend/pages/intended-owner/tools/recovery-model.test.mjs frontend/pages/intended-owner/tools/verify-closure-risk.mjs frontend/pages/intended-owner/tools/verify-navigator.mjs
node frontend/pages/intended-owner/tools/verify-package.mjs
```

사용자 요청에 따라 공개 분석 원본까지 함께 배포합니다. 원본 CSV를 제외하던 일반 규칙의 이번 요청 범위에 대한 예외입니다. 고객 입력 자료·.env·개인 연락처·생성 DB는 동봉하지 않습니다.

출처: 서울특별시 서울 열린데이터광장 / 공공데이터포털(data.go.kr). 영업점: KB국민은행 공식 지점검색. 노란우산: KB Think 공식 안내(상세 기준일은 화면에 표시). 지도·폰트·라이브러리는 각 동봉 라이선스를 따릅니다.
