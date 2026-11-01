# Node.js 아키텍처

## 실행 구조

`backend/server.js`는 Node.js 내장 `node:http` 서버입니다. 브라우저에 `frontend/`의 정적 HTML·CSS·JavaScript를 제공하고 `/api/` 요청을 `backend/server/data.js`와 `backend/server/analysis.js`에 전달합니다. 프런트엔드는 별도 빌드 단계 없이 동작합니다. Python은 웹 요청 처리에 참여하지 않고 서울시 원본 적재 스크립트에서만 사용합니다.

```text
서울시 공개 ZIP·CSV --Python backend/scripts/--> data/commerce.sqlite
공식 순위·보고서 확인값 ----------> data/*.json
                                       ↓
브라우저 /pages/·/shared/ ← frontend/ ← backend/server.js ← backend/server/data.js
                                            AI 의견 ← backend/server/analysis.js → Ollama(선택)
```

| 위치 | 역할 |
| --- | --- |
| `backend/server.js` | API 경로, 정적 파일 제공, 오류 응답 |
| `backend/static-files.js` | 기존 화면 URL과 `frontend/`의 파일 경로 연결 |
| `backend/server/data.js` | SQLite 읽기, 조건별 순위·보고서, 공식 확인값 우선 범위 |
| `backend/server/analysis.js` | 선택형 Ollama 종합의견과 자료 기반 대체 문장 |
| `backend/server/chat/` | SQLite 지역 통계 조회, Markdown 안내 문서 검색, Ollama 스트리밍 응답, 답변 지침 |
| `backend/server/config.js` | 저장소 루트 `.env` 로딩 |
| `frontend/pages/rising/` | 행정동·상권 순위, 지도, 5개 보고서와 PDF 저장 화면 |
| `frontend/pages/owner/` | 현재 사업자 위치·업종·영역 분석과 상담 준비 시연 |
| `frontend/pages/intended-owner/` | 예비 창업자 지역 비교와 보고서 |
| `frontend/pages/guide/` | 금융상품 공시 안내 화면 |
| `frontend/pages/warning/`, `frontend/pages/products/` | 개발 중인 위험 진단·금융 연결 안내 |
| `frontend/shared/` | 카카오 SDK 로더, 공용 화면 코드·폰트·브랜드·금융 자료 |
| `frontend/shared/chatbot.js` | 공용 헤더의 챗봇 대화창과 타이핑 표시 |
| `backend/scripts/` | 원본 다운로드·SQLite 적재·공식 순위 동기화 |
| `data/` | 공개 원본, 생성 DB·경계, 출처가 구분된 공식 확인값 |

## 데이터 계약

목록과 지도 배지는 동일한 순위 API 응답의 지역 코드·순서를 사용합니다. 보고서는 선택 지역·분기·업종으로 별도 조회합니다. 행정동과 공식 상권은 다른 공간 범위이며 서로 합산해 대체하지 않습니다. 점포수·매출은 업종 자료가 있을 때만 업종 필터를 적용하고 인구는 지역 전체 기준입니다. 공식 기본 순위 스냅샷의 적용 범위 밖에서는 로컬 원본 계산값임을 표시합니다.

## 연동과 경계

- 카카오 JavaScript 지도 키는 브라우저 지도를 위해 제공되는 키입니다. 허용 도메인을 설정하고 서버 전용 비밀키와 구분합니다.
- Ollama가 없거나 지연되면 검증된 수치에 근거한 대체 의견을 사용합니다.
- 챗봇은 지역 이름이 포함된 질문에서 `data/commerce.sqlite`의 최신 분기 행정동·공식 상권 원본값을 조회해 답합니다. 그 밖의 사이트 이용 질문은 허용된 `docs/`와 README Markdown을 검색해 Ollama에 전달합니다. 이는 모델 재학습이 아니라 요청 시 자료를 조회하는 방식입니다. 답변 형식과 수치 표현 규칙은 `backend/server/chat/instructions.md`에 둡니다. 로컬 Ollama가 없으면 짧은 문서 안내를 표시합니다. 요청 대화는 서버 DB에 저장하지 않으며, 향후 다른 모델은 `backend/server/chat/ollama.js` 제공부를 교체해 연동합니다.
- 상담 흐름은 시연입니다. 입력한 사업자 정보의 실제 인증, 대출 심사, 상담 예약·접수는 연결되지 않았습니다.
- 위험 진단 모델과 금융 상품 추천은 개발 중입니다. 지역 통계에서 개인 신용도나 승인 가능성을 추론하지 않습니다.
