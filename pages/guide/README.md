# 4번째 화면 — 금융상품 안내

최종 인계: 2026-10-28. 화면과 검증 도구는 이 폴더에, 여러 화면에서 읽는 금융상품·영업점 데이터와 브랜드 자산은 `shared/`에 둡니다. 원 자료와 출처 기록은 기존 위치에 보존합니다.

## 실행

```powershell
node pages/guide/serve.mjs
```

http://localhost:5174/pages/guide/ 에서 확인합니다. Node.js 22.13 이상만 필요합니다. Python·DB·API 키·개발자 PC 외부 폴더는 필요 없습니다. 이미 5174가 실행 중이면 기존 주소를 확인하거나 PORT 환경변수로 포트를 바꾸세요. 3번째 화면과 같은 정적 실행 서버이며 두 폴더를 함께 제공합니다.

## 화면 데이터의 정답 파일

| 파일 | 어떻게 사용하나요? |
|---|---|
| `shared/finance/products.json` | 목록·상품 고유 ID·분류·임차인/임대인 관련성·검색·금리/한도/기간 기본 요약 |
| `shared/finance/details-bank-a.json`, `details-bank-b.json` | KB 상품의 금리·수수료·상환·서류·신청 절차·공식 근거 URL |
| `shared/finance/details-policy.json` | 소진공 자금별 대상·금리 구조·한도·서류·절차·공고 출처 |
| `shared/finance/kb-branches.json` | 회복 플래너와 공유하는 공식 지점 스냅샷. 현재 4번째 화면은 상담 기능을 제공하지 않음 |
| `sources/current-catalog.csv` | 현재 28개 안내를 팀원이 표로 볼 수 있도록 위 JSON을 펼친 파일. 화면은 JSON을 직접 읽음 |
| `sources/official-source-index.json` | 상품 ID별 공식 출처와 상세 근거 URL. 정적 스냅샷의 재검토 시작점 |
| `sources/original-finance/` | 사용자가 확보한 원 금융 자료 17개: KB 8종 CSV·JSON, 지원 후보, 정책금융 CSV 4종+메타, 영업점 자료, 기존 수집 README |
| `catalog-sources.md`, `tools/*audit*.md` | 최초 수집 및 상세 조건·금리 범위 보완 과정의 근거 기록 |
| `rate-model.js` | 동일 공시 조건의 우대 전후 범위·수수료 숫자 표현. 없는 금리는 역산하지 않음 |
| `detail-view.js`, `process-readable.css` | 요약/금리·비용/상환/서류/절차 탭. 절차는 큰 번호·단계별 카드로 표시 |
| `vendor/`, `shared/kb-bank-brand-source.png`, `shared/kb-favicon.png` | 폰트·공용 브랜드 자산 및 라이선스 |
| `DATA-MANIFEST.json` | 원본·화면용 자료의 상대 경로·용량·SHA-256 |

## 상품 개수와 원 자료의 차이

- 현재 **28개 안내 = KB 대출 15개 + 개별 정책자금 12개 + 정책자금 통합 안내 1개**입니다. 실제 개별 상품·자금은 27개입니다.
- 임차인: 개별 상품·자금 26개 + 통합 안내 1개. 임대인: 개별 상품 5개. 두 역할에 공통 상품이 있어 합산하면 중복됩니다.
- 원 `KB_금융상품_8종.csv`는 초기 8개만 담습니다. 현재 전체 28개를 대체하지 않습니다. 이후 추가한 항목과 금리·수수료·서류는 상세 JSON 및 공식 근거 URL에 보완되어 있습니다.
- 초기 정책금융 CSV 4개는 은행·보증등급·산업별 참고 통계입니다. 111행을 111개 금융상품으로 세지 않고, 과거 평균금리를 고객 적용금리로 사용하지 않습니다. 중진공 기준을 소진공 제외업종 기준으로 대체하지 않습니다.
- 금리 예시·보증료·공고는 각각 기준일이 다릅니다. `confirmedAt`, `asOf`, `sources`를 확인하세요. 실시간 금리·접수·예산·은행 전체 상품 DB가 아닙니다.

## 데이터 수정 방법

1. 공식 원문에서 대상·기간·금리의 기준 조건을 확인합니다.
2. 고유 ID를 유지하면서 목록 JSON과 해당 상세 JSON을 함께 수정합니다.
3. 우대 전후 범위가 별도로 공시되지 않은 경우 임의로 만들지 않습니다. 보증료·수수료 미확인은 0원이 아닙니다.
4. 금융상품·정책자금의 의미와 조건은 유지하고 제목·단계 카드 등 표시만 수정할 수 있습니다.
5. 아래 검증을 실행한 후 `DATA-MANIFEST.json`의 해시도 갱신합니다. 자동 외부 수집이 아닌 검토된 스냅샷입니다.

```powershell
node --test pages/guide/tools/verify-catalog.mjs pages/guide/tools/verify-details.mjs pages/guide/tools/verify-information-ui.mjs pages/guide/tools/verify-rate-presentation.mjs
node pages/guide/tools/verify-package.mjs
```

현재 화면은 정보 열람 전용입니다. 상담 신청·연락처 입력·은행 전송을 4번째 페이지에 추가하지 않았습니다. 공식 상품 사이트를 방문하지 않아도 동봉된 상세 정보를 볼 수 있으며, 출처 URL은 데이터 검토용으로 보존합니다.

이번 공유 요청에 따라 공개 원 금융 CSV까지 동봉했습니다. 원본은 바꾸지 않았고 .env·고객 개인정보·DB는 포함하지 않습니다. 은행 공식 문서의 전문을 무단 복제하지 않고 확인한 사실을 요약한 데이터와 출처를 전달합니다.

출처: KB국민은행 공식 상품 안내 / 중소벤처기업부 / 소상공인시장진흥공단 / 공공데이터포털(data.go.kr). 정책금융 원본의 라이선스·갱신일·해시는 각 `.meta.json`을 확인하세요.
