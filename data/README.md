# 데이터 준비와 저장 위치

웹 앱은 `data/commerce.sqlite`를 읽습니다. 원본 ZIP·CSV, 생성 DB·GeoJSON은 로컬에 두고 Git에는 올리지 않습니다. 저장소에는 확인된 공식 기본 순위·일부 보고서 값의 작은 JSON만 포함합니다.

| 경로 | 내용 | Git |
| --- | --- | --- |
| `data/raw/seoul_public_data.zip` | 서울시 상권별 공개 원본 | 제외 |
| `data/raw/dong/` | 서울시 행정동별 점포·매출·유동·상주인구 CSV와 경계 | 제외 |
| `data/commerce.sqlite` | 현재 Node.js API가 조회하는 생성 SQLite | 제외 |
| `data/commerce.geojson`, `data/commerce-dong.geojson` | 지도용 상권·행정동 경계 | 제외 |
| `data/official-rankings-20262.json` | 확인된 최신 기본 순위 응답 | 포함 |
| `data/official-report-sales-20262.json` | 확인된 일부 지역의 공식 보고서 매출 표시값 | 포함 |
| `data/official-dong-workers-20252-20262.json` | 서울시 직장인구-행정동 공개 CSV에서 추출한 지역 전체 직장인구 총수. 원본 CSV SHA-256과 출처를 파일에 기록 | 포함 |

## 재구성

Node.js 22.13 이상과 Python 3을 준비합니다. 원본 ZIP을 `data/raw/seoul_public_data.zip`에 두고 `.env`에 필요한 서울시 API 키를 설정합니다.

```powershell
npm run fetch:dong
npm run import:raw
npm run import:details
npm run sync:rankings
npm test
```

`fetch:dong`은 행정동 공개 자료를 준비하며, `import:raw`가 상권 ZIP과 행정동 자료를 SQLite에 적재합니다. `import:details`는 보고서 세부 열을 보강합니다. `sync:rankings`는 기본 순위 확인값의 기준 분기를 갱신할 때만 사용합니다. 원본 제공 범위, 인코딩, 자료 시점을 먼저 확인하고 기존 공식 확인값을 무조건 덮어쓰지 마세요.

직장인구 가공본은 기존 별도 행정동 적재 결과에서 가져온 2025년 2분기~2026년 2분기 총수입니다. 각 분기 414개 행정동에 값이 있고 11개는 원본에 없습니다. 공식 상권 직장인구나 지도 기준점 주변 인구로 결측 행정동을 대체하지 않습니다. 이 파일은 전체 지역 값이며 업종별 값이 아닙니다.

원본과 생성 산출물을 공유할 때는 출처, 수집일, SHA-256, 관측 분기와 재현 명령을 함께 전달합니다. 인허가 기록은 공식 점포수와 다른 관측 단위입니다.
