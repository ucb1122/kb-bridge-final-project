# 데이터 모델과 관계도

`kb_bridge/repositories/schema.sql`의 SQLite 스키마는 출처를 보존하는 관측값의 기본 계약이다. 실제 화면은 별도로 준비한 로컬 스냅샷 스키마를 읽는다. 두 스키마의 목적과 상태를 구분한다.

~~~mermaid
erDiagram
  AREA ||--o{ METRIC_OBSERVATION : measures
  SOURCE_DATASET ||--o{ METRIC_OBSERVATION : provides
  AREA {
    text area_code PK
    text area_name
    text area_kind
    text parent_area_code FK
  }
  SOURCE_DATASET {
    text source_id PK
    text provider
    text dataset_name
    text retrieved_at
    text reference_url
  }
  METRIC_OBSERVATION {
    text area_code PK,FK
    text period PK
    text metric_code PK
    real value
    text unit
    text derivation PK
    text source_id PK,FK
  }
~~~

## 관측 단위와 키

- 관측값 하나는 지역 × 기간 × 지표 × 출처 × 산출 방식의 조합이다. 같은 조합을 다시 적재할 때는 명시적으로 갱신하거나 거부하고 중복 생성하지 않는다.
- 행정동과 공식 상권의 코드가 겹칠 수 있으므로 `area_code`에는 출처와 코드 체계의 맥락을 포함한다. `area_kind`는 자치구, 행정동, 상권을 구분한다.
- 앱의 기간 표기는 `YYYYQn`이다. 적재 단계에서 `20262` 같은 원본 분기 코드를 변환한다.
- `metric_code`와 `unit`은 적재 전에 지표 목록에서 함께 정의한다. 분기 총액, 점포당 월평균, 면적당 밀도를 한 지표 코드로 섞지 않는다.
- `derivation`은 원본 값, 계산값, 수작업으로 검증한 공식 화면 표시값을 구분한다. 보고서에서 우선 사용할 값은 서비스 계층이 결정하고 출처를 표시한다.
- `source_dataset`에 제공 기관, 수집일, 참조 주소를 보존한다. 스키마를 채우려고 허위 출처나 날짜를 만들지 않는다.

## 다음 스키마 결정 사항

- 업종 차원을 추가하기 전에 정규화한 업종 코드와 원본 코드의 대응표를 정의한다.
- 사업자의 비공개 입력을 저장할지 결정한다. 저장한다면 보존 기간, 동의, 접근 통제를 명시한다.
- 금융 시나리오는 공개 지역 관측값과 별도 모델로 둔다. 시나리오 계산 결과는 대출 추천이나 승인 결과가 아니다.
- 위험 경고 테이블을 추가하기 전에 모델 버전, 학습 기간, 검증 결과와 설명 방식을 정한다.

기존 노트북은 2021~2022년 과거 분석을 재현하고 일부 지역 레이블을 추정한 연구 자료다. 검증된 미래 예측이 아니다. 향후 위험 경고에는 관측일, 모델 버전, 적용 범위와 불확실성을 표시해야 한다.
