# project4 공개 시연본 배포 (2026-11-09)

## 로컬과 공개 서비스

실제 저장소 루트는 `kb-bridge-final-project4/kb-bridge-final-project-main`입니다. 상위 폴더에서 실행하지 않습니다. 팀원이 작성한 backend/frontend 구조와 기존 미커밋 변경을 보존했습니다.

| 항목 | 로컬 `npm start` | Vercel 공개 시연본 |
|---|---|---|
| 서버 | `backend/server.js`의 장기 실행 HTTP 서버 | 동일한 `handleRequest`를 Node.js 함수로 호출 |
| 데이터 조회 | 로컬 `data/commerce.sqlite` | 공개 통계 논리 사본에서 빌드한 읽기 전용 SQLite |
| 지도 | 카카오 지도와 키·도메인 설정 | 동일한 카카오 지도. Vercel의 JavaScript 키 환경변수와 배포 도메인 등록 필요 |
| 로그인·상담 저장 | 로컬 사용자 DB | 비활성화, 503 응답. 사용자 DB는 배포하지 않음 |
| AI 요약·자유 질문 | PC의 Ollama 모델, 문서·데이터 대체 응답 | 검증된 데이터·문서 응답. PC 모델 호출 안 함 |
| 상담 PDF | 브라우저 생성 | 브라우저 생성, 은행 전송·예약은 안 함 |
| 도보 경로 | 별도 카카오 REST 키 필요 | 키를 설정하지 않으면 실제 도보 경로 미확인 표시 |

공개 시연본을 실제 은행 접수 서비스로 소개하지 않습니다. 상담 요청을 서비스 내부에 저장하는 것과 실제 KB 영업점에 전달하는 것은 다릅니다.

## 공개 데이터와 재현

`backend/scripts/export-public-snapshot.py`는 `commerce.sqlite`의 공개 집계표 네 개만 읽습니다. 사용자·세션·상담 DB에는 접근하지 않습니다. 결측과 원본 값을 보존한 JSON 배열 행을 gzip으로 저장하고 SHA-256 및 행 수를 기록합니다. 생성 DB 자체와 원본 CSV는 새로 커밋하지 않습니다.

| 표 | 행 수 | 활용 |
|---|---:|---|
| observations | 115,295 | 분기·지역·지표별 순위와 보고서 |
| report_details | 966,605 | 매출·인구·점포 등 세부 구성 |
| report_industries | 556,827 | 지역·업종별 점포와 매출 |
| report_group_sales | 162,030 | 업종 그룹 매출 세부 항목 |

출처: 서울특별시 서울 열린데이터광장 / 공공데이터포털(data.go.kr). 기존 적재 결과의 배포용 사본이며 이번에 데이터를 새로 수집하거나 갱신한 것이 아닙니다. 실제 원본 수집·전처리는 `data/README.md`, 기존 분석 문서와 노트북을 확인합니다.

`data/public-snapshot/manifest.json`이 표별 파일과 검증값의 기준입니다. 빌드 시 검증값과 행 수가 다르면 중단하고, 파일을 읽어 생성 DB·경계와 정적 화면을 `.vercel/output`에 구성합니다. 함수 한 개의 용량을 검사합니다.

```powershell
npm run build:vercel
node backend/scripts/preview-vercel.mjs
# http://localhost:5180
npm test
```

Vercel 프로젝트는 이 저장소 루트를 지정하고 `vercel.json`의 빌드 명령을 사용합니다. Build Output API로 정적 화면과 `/api/*` 함수를 분리합니다. Node.js 22 이상이 필요합니다. 카카오 JavaScript 키는 Vercel 환경변수 `KAKAO_MAP_JAVASCRIPT_KEY`로 설정하고 카카오 개발자 콘솔의 JavaScript SDK 도메인에 `https://kob-bridge-project4.vercel.app`을 등록합니다. 키 값은 Git에 커밋하지 않습니다. 별도 DB 계정과 금융기관 연결 없이 공개 시연본을 실행할 수 있습니다.

## 포함·제외 원칙

- 포함: 웹 코드, 금융상품 JSON, 위험 분석 결과 JSON, 공개 통계 논리 사본, 공개 지도 경계, 검증 코드와 설명 문서.
- 배포 제외: `.env` 및 백업, 사용자·세션·상담 DB, AI 캐시, 원본 ZIP/CSV, 분석 노트북, 로컬 인증정보.
- 기존 Git에 들어 있던 분석 재현 자료를 삭제하지 않고 Vercel 업로드와 정적 화면에서 제외합니다. 새 원본 자료는 추가하지 않습니다.
- `.vercel/`은 Git에서 제외합니다. 배포 계정 인증정보를 저장소에 넣지 않습니다.

## 이전 project3와 비교

project3는 루트 `pages/`, `shared/`, `server.js` 구조였고, 기본 테스트 명령은 순위 검증 파일을 실행했습니다. project4는 `frontend/`, `backend/` 분리, 로그인·세션, 상담 요청 저장, 챗봇과 도보 경로 모듈 및 전체 테스트 실행이 추가되어 있습니다. 두 버전 모두 Node.js·브라우저 JS·SQLite 기반입니다. 프레임워크가 바뀐 것이 아니라 역할과 서버 기능이 확장된 것입니다.

백엔드·인증·챗봇의 기존 구현은 팀원의 작업입니다. 이번 변경은 공개 배포에 맞춘 실행부 분리, 데이터 재현, 제한 기능 표시와 검증입니다. 실제 영구 사용자 DB, 기관 접수, 원격 AI 모델 운영은 후속 과제입니다.

## 협업

GitHub 이슈 #73, `feature/73-vercel-demo`에서 작업합니다. develop에 직접 반영하지 않고 PR로 공유하며 팀원 검토 후 병합합니다. Vercel은 이 브랜치의 공개 시연본으로 별도 배포합니다.
