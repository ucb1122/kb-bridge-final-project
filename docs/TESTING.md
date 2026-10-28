# 검증 안내

## 자동 검사

Node.js 22.13 이상과 `data/commerce.sqlite`를 준비한 뒤 저장소 루트에서 실행합니다.

```powershell
npm test
```

`tests/rankings.test.js`는 공식 순위, 보고서 표시값, 매출·유동인구 단위 환산, 상세조건별 순위를 검사합니다. `tests/static-files.test.js`는 기존 화면 URL과 공용 자산 경로를 확인합니다. 생성 DB가 없으면 일부 검사가 건너뛰어질 수 있으므로 **통과 수와 건너뛰기 수**를 함께 확인합니다.

## 서버 응답

```powershell
npm run dev
Invoke-WebRequest http://localhost:5173/api/filters
Invoke-WebRequest http://localhost:5173/pages/owner/
```

뜨는 상권, 현재 사업자, 창업 준비, 위험상권, 금융 상품 추천 화면의 HTTP 응답을 확인합니다. 지역 선택 후 목록·지도·보고서가 같은 지역 코드·분기를 가리키는지 확인합니다.

## 브라우저 확인

- 카카오 키를 설정했다면 등록된 도메인과 실제 지도 표시를 확인합니다. 키가 없다면 대체 지도가 로드되는지 확인합니다.
- 기준 분기·업종·정렬 조건의 적용과 취소, 패널 열림·닫힘, 좁은 화면 배치를 확인합니다.
- 지도 배지·경계·선택 지역과 보고서 제목·단위, PDF 저장 결과를 확인합니다.
- 위험·금융 메뉴가 개발 중 상태를 명확히 보여 주는지 확인합니다.
