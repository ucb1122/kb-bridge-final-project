import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateImpact } from '../impact-model.js';

const tenant = { role: 'tenant', rentAmount: 180, rentChangePercent: 10 };
const landlord = { role: 'landlord', rentAmount: 1500, rentChangePercent: 10 };
const partial = { ...landlord, vacancyEnabled: true, vacancySharePercent: 10, vacancyMonths: 6 };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const invalidField = (result, field) => {
  assert.equal(result.status, 'invalid');
  assert.ok(result.errors.some(error => error.field === field), field);
  assert.equal(result.monthlyDifference, null);
};

test('required blanks stay missing and never become zero', () => {
  for (const blank of ['', '  ', null, undefined]) {
    for (const field of ['rentAmount', 'rentChangePercent']) {
      const result = calculateImpact({ ...tenant, [field]: blank });
      assert.equal(result.status, 'incomplete');
      assert.ok(result.missing.includes(field));
      assert.equal(result.monthlyDifference, null);
    }
  }
  assert.ok(calculateImpact().missing.includes('role'));
  invalidField(calculateImpact({ ...tenant, role: 'other' }), 'role');
});

test('tenant rent impact does not invent a current cash-flow value', () => {
  const result = calculateImpact(tenant);
  assert.equal(result.status, 'ready');
  assert.equal(result.unit, '만원');
  close(result.scenarioRent, 198);
  close(result.rentChangeAmount, 18);
  close(result.monthlyDifference, -18);
  close(result.annualDifference, -216);
  assert.equal(result.currentMonthlyCashflow, null);
  assert.equal(result.scenarioMonthlyCashflow, null);
  close(calculateImpact({ ...tenant, currentMonthlyCashflow: 260 }).scenarioMonthlyCashflow, 242);
});

test('optional cash flow accepts signed values and explicit zero; blank stays null', () => {
  for (const blank of ['', ' ', undefined, null]) {
    assert.equal(calculateImpact({ ...tenant, currentMonthlyCashflow: blank }).scenarioMonthlyCashflow, null);
  }
  close(calculateImpact({ ...tenant, currentMonthlyCashflow: -20 }).scenarioMonthlyCashflow, -38);
  close(calculateImpact({ ...tenant, currentMonthlyCashflow: 0 }).scenarioMonthlyCashflow, -18);
  invalidField(calculateImpact({ ...tenant, currentMonthlyCashflow: 'not a number' }), 'currentMonthlyCashflow');
});

test('interest sensitivity uses balance and signed annual percentage-point change only', () => {
  const input = { ...tenant, rateEnabled: true, loanBalance: 6000, rateChangePp: 1 };
  const result = calculateImpact(input);
  assert.equal(result.status, 'ready');
  close(result.monthlyInterestChange, 5);
  close(result.monthlyDifference, -23);
  close(calculateImpact({ ...input, rateChangePp: -1 }).monthlyDifference, -13);
  close(calculateImpact({ ...input, loanBalance: 0 }).monthlyInterestChange, 0);
  const cash = calculateImpact({ ...input, currentMonthlyCashflow: 260 });
  close(cash.scenarioMonthlyCashflow, 237);
});

test('disabled interest ignores stale invalid loan inputs and states the exclusion', () => {
  const result = calculateImpact({ ...tenant, rateEnabled: false, loanBalance: 'invalid', rateChangePp: Infinity });
  assert.equal(result.status, 'ready');
  close(result.monthlyInterestChange, 0);
  close(result.monthlyDifference, -18);
  assert.ok(result.assumptions.some(text => text.includes('이자 변화는 비교에서 제외')));
});

test('enabled interest requires both fields and validates the balance', () => {
  const result = calculateImpact({ ...tenant, rateEnabled: true, loanBalance: '', rateChangePp: '' });
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(result.missing, ['loanBalance', 'rateChangePp']);
  invalidField(calculateImpact({ ...tenant, rateEnabled: true, loanBalance: -1, rateChangePp: 1 }), 'loanBalance');
  invalidField(calculateImpact({ ...tenant, rateEnabled: true, loanBalance: 6000, rateChangePp: NaN }), 'rateChangePp');
});

test('landlord baseline uses actual receipts without applying existing vacancy again', () => {
  assert.equal(calculateImpact({ ...landlord, rentAmount: 0 }).rentOnlyBreakEvenLossPercent, null);
  const result = calculateImpact(landlord);
  assert.equal(result.status, 'ready');
  close(result.monthlyDifference, 150);
  close(result.annualDifference, 1800);
  close(result.annualRentBefore, 18000);
  close(result.annualRentAfter, 19800);
  assert.equal(result.scenarioMonthlyCashflow, null);
  assert.ok(result.assumptions.some(text => text.includes('기존 공실이 이미 반영된 실제 수입')));
});

test('partial vacancy reduces only the entered rent share during the entered months', () => {
  const result = calculateImpact(partial);
  assert.equal(result.status, 'ready');
  close(result.annualVacancyLoss, 990);
  close(result.monthlyVacancyLoss, 82.5);
  close(result.monthlyDifference, 67.5);
  close(result.annualDifference, 810);
  close(result.annualRentAfter, 18810);
  close(result.monthlyRentAfterVacancy, 1567.5);
  close(calculateImpact({ ...partial, currentMonthlyCashflow: 400 }).scenarioMonthlyCashflow, 467.5);
});

test('whole-building vacancy applies only when explicitly set to 100 percent', () => {
  const result = calculateImpact({ ...partial, vacancySharePercent: 100 });
  assert.equal(result.status, 'ready');
  close(result.annualVacancyLoss, 9900);
  close(result.monthlyDifference, -675);
  close(result.annualRentAfter, 9900);
});

test('enabled vacancy blanks remain missing; disabled fields are excluded', () => {
  for (const field of ['vacancySharePercent', 'vacancyMonths']) {
    const result = calculateImpact({ ...partial, [field]: '' });
    assert.equal(result.status, 'incomplete');
    assert.ok(result.missing.includes(field));
    assert.equal(result.annualVacancyLoss, null);
  }
  const result = calculateImpact({ ...landlord, vacancyEnabled: false, vacancySharePercent: 'invalid', vacancyMonths: Infinity });
  assert.equal(result.status, 'ready');
  close(result.annualVacancyLoss, 0);
  close(result.monthlyDifference, 150);
  assert.ok(result.assumptions.some(text => text.includes('공실에 따른 추가 손실은 비교에서 제외')));
  const tenantResult = calculateImpact({ ...tenant, vacancyEnabled: true, vacancySharePercent: 'invalid', vacancyMonths: Infinity });
  assert.equal(tenantResult.status, 'ready');
  close(tenantResult.annualVacancyLoss, 0);
});

test('rent and vacancy bounds accept explicit zero and reject out-of-range values', () => {
  for (const rentAmount of [-1, Infinity, NaN, '1,80']) {
    invalidField(calculateImpact({ ...tenant, rentAmount }), 'rentAmount');
  }
  invalidField(calculateImpact({ ...tenant, rentChangePercent: -100.01 }), 'rentChangePercent');
  for (const vacancySharePercent of [-0.01, 100.01]) {
    invalidField(calculateImpact({ ...partial, vacancySharePercent }), 'vacancySharePercent');
  }
  for (const vacancyMonths of [-0.01, 12.01]) {
    invalidField(calculateImpact({ ...partial, vacancyMonths }), 'vacancyMonths');
  }
  for (const extra of [{ vacancySharePercent: 0 }, { vacancyMonths: 0 }]) {
    close(calculateImpact({ ...partial, ...extra }).annualVacancyLoss, 0);
  }
  close(calculateImpact({ ...landlord, rentChangePercent: -100 }).scenarioRent, 0);
  close(calculateImpact({ ...tenant, rentAmount: 0 }).monthlyDifference, 0);
  const allVacant = calculateImpact({ ...partial, vacancySharePercent: 100, vacancyMonths: 12 });
  close(allVacant.annualRentAfter, 0);
});

test('rent-only break-even loss is based on post-increase annual rent and excludes interest', () => {
  const withoutRate = calculateImpact(partial);
  const withRate = calculateImpact({ ...partial, rateEnabled: true, loanBalance: 6000, rateChangePp: 1 });
  close(withoutRate.rentOnlyBreakEvenLossPercent, 100 / 11);
  close(withRate.rentOnlyBreakEvenLossPercent, withoutRate.rentOnlyBreakEvenLossPercent);
  close(withRate.monthlyDifference, 62.5);
  close(withoutRate.annualRentAfter, withRate.annualRentAfter);
  for (const rentChangePercent of [0, -10, -100]) {
    assert.equal(calculateImpact({ ...landlord, rentChangePercent }).rentOnlyBreakEvenLossPercent, null);
  }
});

test('overflow never exposes non-finite or partially calculated monetary results', () => {
  const cases = [
    { ...landlord, rentAmount: Number.MAX_VALUE },
    { ...landlord, rentChangePercent: Number.MAX_VALUE },
    { ...tenant, rateEnabled: true, loanBalance: Number.MAX_VALUE, rateChangePp: 1200 },
    { ...tenant, rateEnabled: true, loanBalance: Number.MAX_VALUE / 2, rateChangePp: -1200, currentMonthlyCashflow: Number.MAX_VALUE },
  ];
  for (const input of cases) {
    const result = calculateImpact(input);
    invalidField(result, 'calculation');
    assert.equal(result.scenarioRent, null);
    assert.equal(result.annualDifference, null);
    assert.ok(Object.values(result).every(value => typeof value !== 'number' || Number.isFinite(value)));
  }
});

test('calculation preserves customer input and gives consistent repeated results', () => {
  const input = Object.freeze({ ...partial, rentAmount: '1,500', currentMonthlyCashflow: '-20' });
  const first = calculateImpact(input);
  assert.deepEqual(calculateImpact(input), first);
  assert.equal(input.rentAmount, '1,500');
  close(first.scenarioMonthlyCashflow, 47.5);
});
