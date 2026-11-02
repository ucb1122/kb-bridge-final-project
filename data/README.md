# 데이터 준비와 저장 위치

웹 앱의 지역 순위와 보고서는 `data/commerce.sqlite`를 읽습니다. 이 DB와 지도 경계 GeoJSON은 **현재 개발 PC에는 있지만 GitHub 저장소에는 없습니다.** Git clone만 받은 사람은 아래의 **빠른 실행** 또는 **원본에서 재구성** 중 하나를 선택해야 합니다.

| 경로 | 내용 | Git |
| --- | --- | --- |
| `data/raw/seoul_public_data.zip` | 서울시 상권별 공개 원본 | 제외 |
| `data/raw/dong/` | 서울시 행정동별 점포·매출·유동·상주인구 CSV와 경계 | 제외 |
| `data/commerce.sqlite` | 현재 Node.js API가 조회하는 생성 SQLite | 제외 |
| `data/commerce.geojson`, `data/commerce-dong.geojson` | 지도용 상권·행정동 경계 | 제외 |
| `data/official-rankings-20262.json` | 확인된 최신 기본 순위 응답 | 포함 |
| `data/official-report-sales-20262.json` | 확인된 일부 지역의 공식 보고서 매출 표시값 | 포함 |
| `data/official-dong-workers-20252-20262.json` | 서울시 직장인구-행정동 공개 CSV에서 추출한 지역 전체 직장인구 총수. 원본 CSV SHA-256과 출처를 파일에 기록 | 포함 |

`frontend/pages/intended-owner/analysis/raw/`에는 회복 플래너 분석을 재현하기 위한 공개 자료 사본이 별도로 포함되어 있습니다. 이 폴더는 `import:raw`가 요구하는 `data/raw/seoul_public_data.zip`을 대체하지 않습니다. 금융상품 출처 자료도 `frontend/pages/guide/sources/`에 포함되어 있습니다.

## 빠른 실행: DB와 지도 경계를 함께 받은 경우

보내는 사람은 개발 서버를 종료한 뒤 아래 **세 파일**만 별도 전달합니다. `users.sqlite`에는 사용자·상담 요청이 있을 수 있으므로 전달하지 않습니다. `analysis-cache.sqlite`는 선택형 AI 캐시라 필수 파일이 아닙니다.

| 전달 파일 | 받는 사람의 저장 위치 |
| --- | --- |
| `commerce.sqlite` | `data/commerce.sqlite` |
| `commerce.geojson` | `data/commerce.geojson` |
| `commerce-dong.geojson` | `data/commerce-dong.geojson` |

받는 사람은 Node.js 22.13 이상을 설치한 뒤 저장소 루트에서 실행합니다. 지역 통계·경계가 준비된 경우 Python과 `npm run import:*` 명령은 필요하지 않습니다.

```powershell
git clone https://github.com/ucb1122/kb-bridge-final-project.git
cd kb-bridge-final-project
# 전달받은 세 파일을 data/ 폴더에 복사
Copy-Item .env.example .env
npm run dev
```

브라우저 주소는 `http://localhost:5173`입니다. 카카오 지도를 사용하려면 `.env`에 `KAKAO_MAP_JAVASCRIPT_KEY`를 입력하고 카카오 개발자 콘솔에 이 로컬 주소를 허용 도메인으로 등록합니다. 도보 경로 조회에는 `KAKAO_REST_API_KEY`가 별도로 필요합니다. 키는 받는 사람에게 별도로 전달하되 `.env`를 Git에 커밋하지 않습니다. 로그인 시연은 받는 사람이 `npm run setup:test-user`로 자신의 테스트 계정을 생성할 수 있습니다.

## 원본에서 재구성: DB를 전달받지 않은 경우

Node.js 22.13 이상과 Python 3을 준비합니다. 서울시 상권별 공개 원본 ZIP을 **별도로 확보**해 `data/raw/seoul_public_data.zip`에 둡니다. 현재 개발 PC의 `data/raw/`에도 이 ZIP은 없으므로 Git clone이나 `fetch:dong`만으로 이 단계가 완료되지 않습니다. `fetch:dong`은 행정동 원본과 경계를 내려받는 명령입니다.

```powershell
npm run fetch:dong
npm run import:raw
npm run import:details
npm test
```

`import:raw`는 상권 ZIP과 행정동 자료를 SQLite에 적재하고 지도 경계를 만듭니다. `import:details`는 보고서 세부 열을 보강합니다. `sync:rankings`는 **실행 준비 명령이 아니며**, 공식 기본 순위 확인값을 갱신할 때만 별도로 사용합니다. 원본 제공 범위, 인코딩과 자료 시점을 먼저 확인하세요.

직장인구 가공본은 기존 별도 행정동 적재 결과에서 가져온 2025년 2분기~2026년 2분기 총수입니다. 각 분기 414개 행정동에 값이 있고 11개는 원본에 없습니다. 공식 상권 직장인구나 지도 기준점 주변 인구로 결측 행정동을 대체하지 않습니다. 이 파일은 전체 지역 값이며 업종별 값이 아닙니다.

원본과 생성 산출물을 공유할 때는 출처, 수집일, SHA-256, 관측 분기와 재현 명령을 함께 전달합니다. 인허가 기록은 공식 점포수와 다른 관측 단위입니다.
