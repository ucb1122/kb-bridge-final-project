import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { validateHeatResults, classificationFor, HEAT_LABELS, HEAT_SCHEMA_VERSION } from '../heat-adapter.js';

// Entirely synthetic validation fixtures. They must never be copied into assets.
const codes = new Set(['3110065', '3110066', '3110067', '3110068']);
const fixture = () => ({
  schemaVersion: 1,
  metadata: {
    regionKind: 'area', asOfDate: '2026-10-26', analysisVersion: 'TEST-ONLY-v1',
    source: '테스트 전용 가상 입력이며 실제 상권 분석 결과가 아닙니다.',
    definition: '가상 형식 검증. 실제 분류 기준으로 사용하지 않습니다.',
    referencePeriods: [{ indicator: 'test_measure', period: '2025Q1~2026Q2' }],
    scope: 'observed-classification',
    review: { approved: true, reviewedAt: '2026-10-26', reviewedBy: '테스트 전용', method: '가상 입력 형식 검증' },
  },
  results: [
    { regionCode: '3110065', classification: 'overheated', reason: '가상 분류 A', evidence: [{ label: '가상 지표', value: 1, unit: '테스트 단위', period: '2025Q1~2026Q2' }] },
    { regionCode: '3110066', classification: 'not_overheated', reason: '가상 분류 B', evidence: [{ label: '가상 지표', value: 0, unit: '테스트 단위', period: '2025Q1~2026Q2' }] },
    { regionCode: '3110067', classification: 'unknown', reason: '가상 지표 누락', evidence: [{ label: '가상 지표', value: null, unit: '테스트 단위', period: '2025Q1~2026Q2' }] },
  ],
});

test('null results remain pending; a missing region never becomes not_overheated', () => {
  assert.equal(HEAT_SCHEMA_VERSION, 1);
  assert.equal(validateHeatResults(null, codes).status, 'pending');
  assert.equal(classificationFor(validateHeatResults(null, codes), '3110065'), null);
  const valid = validateHeatResults(fixture(), codes);
  assert.equal(classificationFor(valid, '3110068'), null);
  assert.equal(classificationFor(valid, 'missing'), null);
  assert.equal(classificationFor(null, '3110065'), null);
});

test('all categories remain distinct and observed metadata/evidence are preserved', () => {
  const raw = fixture(), valid = validateHeatResults(raw, codes);
  assert.equal(valid.status, 'ready');
  assert.equal(valid.results.size, 3);
  assert.equal(classificationFor(valid, '3110065').classification, 'overheated');
  assert.equal(classificationFor(valid, '3110066').classification, 'not_overheated');
  assert.equal(classificationFor(valid, '3110067').classification, 'unknown');
  assert.equal(classificationFor(valid, '3110067').evidence[0].value, null);
  assert.equal(valid.metadata.scope, 'observed-classification');
  assert.equal(HEAT_LABELS.overheated, '과열상권');
  assert.notEqual(HEAT_LABELS.unknown, HEAT_LABELS.not_overheated);
  assert.deepEqual(raw, fixture(), 'validation must not mutate the input');
});

test('approval, reviewer, method and calendar-valid review date are required before exposure', () => {
  const mutations = [
    raw => { raw.metadata.review.approved = false; },
    raw => { raw.metadata.review.approved = 'true'; },
    raw => { delete raw.metadata.review; },
    raw => { raw.metadata.review.reviewedBy = ' '; },
    raw => { raw.metadata.review.method = ''; },
    raw => { raw.metadata.review.reviewedAt = '2026-02-30'; },
  ];
  for (const mutate of mutations) {
    const raw = fixture(); mutate(raw);
    const result = validateHeatResults(raw, codes);
    assert.equal(result.status, 'unreviewed');
    assert.equal(result.ready, false);
    assert.equal(result.results.size, 0);
    assert.equal(classificationFor(result, '3110065'), null);
  }
});

test('invalid area kind, version, source, classification definition and periods fail closed', () => {
  const mutations = [
    raw => { raw.schemaVersion = 2; },
    raw => { raw.metadata.regionKind = 'dong'; },
    raw => { raw.metadata.analysisVersion = ''; },
    raw => { raw.metadata.source = null; },
    raw => { raw.metadata.definition = ' '; },
    raw => { raw.metadata.referencePeriods = []; },
    raw => { raw.metadata.referencePeriods[0].period = ''; },
    raw => { raw.metadata.referencePeriods[0].indicator = null; },
    raw => { raw.results[0].evidence[0].period = ''; },
  ];
  for (const mutate of mutations) {
    const raw = fixture(); mutate(raw);
    const result = validateHeatResults(raw, codes);
    assert.equal(result.status, 'invalid');
    assert.equal(result.results.size, 0);
  }
});

test('as-of date rejects impossible dates and timestamps; forecast needs an explicit horizon', () => {
  for (const date of ['2026-02-30', '2026-13-01', '2026-1-1', '2026-10-26T00:00:00Z', 'not-a-date']) {
    const raw = fixture(); raw.metadata.asOfDate = date;
    assert.equal(validateHeatResults(raw, codes).status, 'invalid', date);
  }
  const future = fixture(); future.metadata.scope = 'forecast';
  assert.equal(validateHeatResults(future, codes).status, 'invalid');
  future.metadata.predictionHorizon = '2027년 상반기';
  const valid = validateHeatResults(future, codes);
  assert.equal(valid.status, 'ready');
  assert.equal(valid.metadata.scope, 'forecast');
  assert.equal(valid.metadata.predictionHorizon, '2027년 상반기');
  const vague = fixture(); vague.metadata.scope = 'risk';
  assert.equal(validateHeatResults(vague, codes).status, 'invalid');
});

test('region code is a seven-digit string, unique, and present in the official boundary list', () => {
  for (const code of [3110065, '311006', '03110065', '3119999', null, '3110065 ']) {
    const raw = fixture(); raw.results[0].regionCode = code;
    const result = validateHeatResults(raw, codes);
    assert.equal(result.status, 'invalid', String(code));
    assert.equal(result.results.size, 0);
  }
  const duplicate = fixture(); duplicate.results.push(structuredClone(duplicate.results[0]));
  assert.equal(validateHeatResults(duplicate, codes).status, 'invalid');
});

test('unknown is a separate category, and blanks/bools/numeric risk scores cannot stand in for categories', () => {
  for (const classification of ['', false, null, 0, 'safe', 'normal', 'red', 'overheat']) {
    const raw = fixture(); raw.results[0].classification = classification;
    assert.equal(validateHeatResults(raw, codes).status, 'invalid');
  }
  const unknown = fixture(); unknown.results = [unknown.results[2]];
  unknown.results[0].evidence = [];
  const result = validateHeatResults(unknown, codes);
  assert.equal(result.status, 'ready');
  assert.equal(classificationFor(result, '3110067').classification, 'unknown');
});

test('evidence requires a reason, finite numeric-or-null values, a unit and an observation period', () => {
  const mutations = [
    raw => { raw.results[0].reason = ''; },
    raw => { raw.results[0].evidence[0].value = Infinity; },
    raw => { raw.results[0].evidence[0].value = NaN; },
    raw => { raw.results[0].evidence[0].value = '1'; },
    raw => { raw.results[0].evidence[0].unit = ''; },
    raw => { delete raw.results[0].evidence[0].value; },
  ];
  for (const mutate of mutations) {
    const raw = fixture(); mutate(raw);
    assert.equal(validateHeatResults(raw, codes).status, 'invalid');
  }
});

test('malformed nested metadata/evidence never throws or partially exposes validated regions', () => {
  for (const mutate of [
    raw => { raw.metadata.referencePeriods = [null]; },
    raw => { raw.results[0].evidence = [null]; },
  ]) {
    const raw = fixture(); mutate(raw);
    let result;
    assert.doesNotThrow(() => { result = validateHeatResults(raw, codes); });
    assert.equal(result.status, 'invalid');
    assert.equal(result.results.size, 0);
  }
});

test('classified regions need actual observed evidence; unknown may have no data', () => {
  for (const evidence of [[], [{ label: '가상 지표', value: null, unit: '테스트 단위', period: '2025Q1~2026Q2' }]]) {
    const raw = fixture(); raw.results[0].evidence = evidence;
    assert.equal(validateHeatResults(raw, codes).status, 'invalid');
  }
});

test('empty result collection remains pending and production manifest does not load test fixtures', async () => {
  const raw = fixture(); raw.results = [];
  assert.equal(validateHeatResults(raw, codes).status, 'pending');
  const manifest = JSON.parse(await fs.readFile(new URL('../assets/heat-connection.json', import.meta.url), 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  if (manifest.resultFile !== null) {
    assert.match(manifest.resultFile, /^[a-zA-Z0-9_.-]+\.json$/);
    assert.doesNotMatch(manifest.resultFile, /fixture|test|dummy/i);
    const production = JSON.parse(await fs.readFile(new URL(`../assets/${manifest.resultFile}`, import.meta.url), 'utf8'));
    assert.doesNotMatch(production.metadata?.analysisVersion || '', /TEST-ONLY|fixture|dummy/i);
    assert.doesNotMatch(production.metadata?.source || '', /테스트 전용|가상 입력/);
    assert.equal(validateHeatResults(production).status, 'ready', 'A reviewed real export is required before activation');
  }
});
