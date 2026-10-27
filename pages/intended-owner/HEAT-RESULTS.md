# 코랩 결과를 상생 네비게이터 지도에 연결하기

현재는 과열 판정 기준·가중치·분류 데이터가 확정되지 않았다. `assets/heat-connection.json`의 `resultFile`은 null이며 실제 상권을 과열/비과열로 표시하지 않는다. 지도에 제공되는 기본 경계나 고객의 현금흐름 시뮬레이션과 과열 판정은 별개다.

현재 작업 저장소는 `C:\dev\project\kb-bridge-final-project`다. 결과 파일 위치는 `C:\dev\project\kb-bridge-final-project\pages\intended-owner\assets`이며 아래 상대경로는 이 저장소를 기준으로 한다. 원본 CSV·ZIP·생성 DB·개인 입력자료는 Git에 올리지 않고, 공유 가능한 지역 집계 결과 JSON만 별도로 관리한다.

## 전달 과정

1. 팀원이 코랩·Python에서 정해진 기준에 따라 지역별 결과를 만든다.
2. 계산 과정·기간·분류 기준·결측과 지역 매핑을 팀에서 검토한다.
3. 아래 형식의 작은 JSON 파일을 `pages/intended-owner/assets/` 안에 저장한다. 원본 개인정보·개별 차주의 상환내역은 넣지 않는다.
4. `assets/heat-connection.json`의 `resultFile`을 파일명으로 바꾼다. 예: `"resultFile": "heat-results-20261026.json"`. 파일 이름에 폴더 경로나 외부 URL을 넣지 않는다.
5. Node.js는 파일을 제공하고 브라우저의 `heat-adapter.js`가 형식을 검사한다. 상권코드로 기존 공식 지도 경계와 연결한다. Python에서 지도를 이미지로 저장하거나 분석 코드를 JavaScript로 다시 작성할 필요는 없다.

현재 검증되지 않은 실제 분류 파일을 대신하는 가상 결과는 `assets`에 넣지 않는다. 형식 테스트용 가상 값은 `tools/verify-heat.mjs` 안에만 있다.

## 결과 JSON 계약: schemaVersion 1

루트는 `{ schemaVersion: 1, metadata: {...}, results: [...] }`다. 실제 결과가 준비될 때 아래 필드를 채운다. 예시 상권코드·분류·수치는 임의로 넣지 않는다.

| 위치 | 필드 | 형식·의미 |
|---|---|---|
| metadata | regionKind | `"area"`. 현재 연결은 서울시 공식 상권 단위이며 행정동 결과를 대신 붙이지 않는다 |
| metadata | asOfDate | `YYYY-MM-DD`, 이 결과의 자료 기준일. 존재하는 날짜만 허용 |
| metadata | analysisVersion | 기준·가중치·산출 코드 버전. 변경 시 새 버전 |
| metadata | source | 사용한 데이터 출처 |
| metadata | definition | 과열/비과열 구분 정의. 기준이 없다면 연결하지 않는다 |
| metadata | referencePeriods | `{indicator, period}` 배열. 지표마다 실제 관측기간을 기록한다. 예: 월 자료·누적기간·연간자료를 한 분기로 가장하지 않는다 |
| metadata | scope | `"observed-classification"`(관측자료 분류) 또는 `"forecast"`(미래 예측) |
| metadata | predictionHorizon | forecast인 경우 필수. 예측이 대상으로 하는 기간을 명시 |
| metadata.review | approved | 팀 검토 후 boolean `true`. 문자열 `"true"`는 허용하지 않는다 |
| metadata.review | reviewedAt | `YYYY-MM-DD`, 검토일 |
| metadata.review | reviewedBy | 검토 담당자 또는 팀 |
| metadata.review | method | 검토 방법·범위. 단순 형식 확인과 통계 검증을 구분 |
| results 각 행 | regionCode | 7자리 문자열 상권코드. 이름으로 근사 연결하지 않는다 |
| results 각 행 | classification | `"overheated"`, `"not_overheated"`, `"unknown"` 중 하나 |
| results 각 행 | reason | 분류 근거 또는 자료 부족 사유 |
| results 각 행 | evidence | `{label, value, unit, period}` 배열. 값은 유한한 숫자 또는 null |

과열/비과열 행은 실제 숫자 근거가 있어야 한다. 자료가 부족한 경우 `unknown`을 쓰고 근거가 없는 항목은 null로 둔다. 문자열 숫자, Infinity, NaN, 빈 문자열을 숫자 대신 넣지 않는다. `unknown`은 빈 evidence 배열을 허용한다.

period는 현재 고정된 분기 표현 하나만 강제하지 않는 설명형 문자열이다. `2025Q1~2026Q2`, `2020-12~2026-06`처럼 시작·종료와 주기를 알 수 있게 기록한다. 어댑터는 비어 있는 기간을 거부하지만 기간의 과학적 타당성이나 데이터 누출까지 판정하지는 않는다. 미래 예측이라면 예측시점에 확보 가능한 자료만 썼는지 검토해야 한다.

## Python에서 저장하는 방법

다음은 파일 저장 부분만 보여주는 예시다. `reviewed_metadata`와 `reviewed_rows`는 팀에서 실제로 검증한 결과로 만들어야 한다. 아래 코드는 현재 모델을 실행하거나 분류를 생성하지 않는다.

```python
import json
from pathlib import Path

# reviewed_rows의 regionCode는 변환 전부터 문자열로 읽는다.
# 숫자 열의 결측은 0으로 채우지 말고 None으로 바꾼다.
# pandas를 사용한다면 DataFrame의 NaN/inf를 별도 검사한다.
payload = {
    "schemaVersion": 1,
    "metadata": reviewed_metadata,
    "results": reviewed_rows,
}
output = Path("heat-results-YYYYMMDD.json")
with output.open("w", encoding="utf-8") as file:
    json.dump(payload, file, ensure_ascii=False, allow_nan=False, indent=2)
```

코랩이라면 이 파일을 내려받아 `assets`에 넣는다. 로컬 Python이라면 위 output 경로를 해당 assets 안으로 지정할 수 있다. `allow_nan=False`는 비표준 JSON 숫자 저장을 막으며 결측을 자동 0으로 만들지는 않는다.

## 지도 표시 원칙

- **과열상권:** 기준에 해당하는 검토된 결과가 있을 때만 표시한다.
- **비과열상권:** 해당 기준에 미해당한다는 뜻이다. 미래 안전·폐업 가능성 0·대출 적격을 뜻하지 않는다.
- **결과 없음:** 미분류·자료 부족·해당 코드 누락. 비과열로 대신 채우지 않는다.
- 검토가 완료되지 않았거나 잘못된 코드·중복·기간 누락이 발견되면 분류 지도를 활성화하지 않는다.
- 관측 분류와 미래 예측은 화면에서도 구분하고, forecast라면 예측 대상 기간을 함께 표시한다.
- 고객이 입력한 임대료·금리·현금흐름 가정은 이 지역 분류값을 바꾸지 않는다. 두 결과의 근거가 다르기 때문이다.

## 검토 표시의 한계

`approved: true`와 형식 검사를 통과했다고 과학적 검증이 완료되는 것은 아니다. 팀은 지역 매핑, 원본 보존, 지표별 기간, 표본 개편, 누락 편향, 기준 민감도, 미래 자료 사용 여부를 별도로 확인해야 한다. 예측모델이라면 시간 분리 검증·단순 기준과의 비교·보정/불확실성 등을 검토하고 method에 실제 수행 범위를 적는다.

현재 확보한 지역 공공데이터만으로 임대료 인상률을 특정 임차인의 폐업 확률로 바꾸지 않는다. 수동 공실 시뮬레이션은 별도 `ANALYSIS-EVIDENCE.md`의 계산 범위를 따른다.

## 실행 검증

프로젝트 루트에서 `node --test pages/intended-owner/tools/verify-heat.mjs`를 실행한다. 테스트는 미연결 상태, 검토 정보, 관측/예측 구분, 코드·기간·날짜, 중복, 근거, 자료 부족, 잘못된 중첩 입력을 확인한다. 실제 분류 성능을 검증하는 테스트는 아니다.


## CSV로 받은 Python 결과 내보내기

저장소 루트에서 실행한다. CSV는 UTF-8이며 regionCode, classification, reason, evidence 열을 사용한다. evidence 셀은 위 계약의 JSON 배열이다. metadata 파일은 위 표의 실제 분석 메타정보 객체만 담는다. 이 도구가 분류나 검토 승인을 대신 만들지 않는다.

```powershell
python pages/intended-owner/tools/export_heat_results.py --csv 팀결과.csv --metadata 팀검토메타.json --output pages/intended-owner/assets/heat-results.json
```

팀 검토를 거쳐 지도 연결까지 하려면 --activate를 추가한다. 기존 결과 파일을 교체할 때만 --overwrite를 명시한다. 검토 미승인, 중복/미일치 상권코드, 숫자 근거 누락, 잘못된 날짜는 연결하지 않는다. 원본 CSV와 메타정보는 변경하지 않는다. Python 실행기는 설치된 Python 3를 사용한다.
