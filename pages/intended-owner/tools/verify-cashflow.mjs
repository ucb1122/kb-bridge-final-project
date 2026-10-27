import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOptionalNumber, calculateTenant, calculateLandlord } from '../cashflow-model.js';

const tenant = {
  monthlyRevenue: 1800, monthlyOperatingCost: 1300, monthlyRent: 180, monthlyDebtService: 60,
  loanBalance: 6000, annualInterestRate: 5, rentChangePercent: 10, rateChangePp: 1,
};
const landlord = {
  monthlyRentIncome: 240, monthlyFixedCost: 30, monthlyDebtService: 150,
  loanBalance: 12000, annualInterestRate: 5, rentChangePercent: -10, rateChangePp: 1,
  vacancyMonths: 0, monthlyVariableCost: 0,
};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('blanks stay missing; numeric zero stays zero; malformed and nonfinite input is rejected', () => {
  for (const blank of ['', '  ', null, undefined]) assert.equal(parseOptionalNumber(blank), null);
  for (const zero of [0, '0', '0.0']) assert.equal(parseOptionalNumber(zero), 0);
  assert.equal(parseOptionalNumber('1,800.5'), 1800.5);
  assert.equal(parseOptionalNumber('-0.5'), -0.5);
  for (const invalid of ['1,80', 'NaN', 'Infinity', '0x10', '1e309', Infinity, NaN, true, {}, []]) {
    assert.ok(Number.isNaN(parseOptionalNumber(invalid)));
  }
});

test('tenant rent +10% and annual rate +1 percentage point: monthly 260 -> 237', () => {
  const result = calculateTenant(tenant);
  assert.equal(result.status, 'ready');
  close(result.baseline.monthlyResidual, 260);
  close(result.scenario.monthlyRent, 198);
  close(result.scenario.monthlyDebtService, 65);
  close(result.scenario.monthlyResidual, 237);
  close(result.monthlyDifference, -23);
  close(result.annualDifference, -276);
  close(result.monthlyInterestChange, 5);
  close(result.scenario.annualInterestRate, 6);
  close(result.baseline.monthlyPrincipal, 35);
});

test('landlord concession -10%, rate +1 percentage point: occupied-month 60 -> 26', () => {
  const result = calculateLandlord(landlord);
  assert.equal(result.status, 'ready');
  close(result.baseline.monthlyResidual, 60);
  close(result.scenario.monthlyResidual, 26);
  close(result.annualBaseline, 720);
  close(result.annualScenario, 312);
  close(result.monthlyInterestChange, 10);
  assert.equal(result.breakEvenVacancyMonths, null);
});

test('rent increase can improve an occupied month while a manual vacancy lowers the annual total', () => {
  const result = calculateLandlord({ ...landlord, rentChangePercent: 10, vacancyMonths: 2 });
  assert.equal(result.status, 'ready');
  close(result.scenario.monthlyResidual, 74);
  close(result.annualScenario, 360);
  close(result.annualDifference, -360);
  close(result.annualAverageMonthlyScenario, 30);
  close(result.rentIncomeLostToVacancy, 528);
  close(result.breakEvenVacancyMonths, 168 / 264);
  assert.equal(result.vacancyMonths, 2);
});

test('fixed costs and debt continue for all 12 vacant months; occupied-only costs stop', () => {
  const result = calculateLandlord({ ...landlord, vacancyMonths: 12, monthlyVariableCost: 10 });
  assert.equal(result.status, 'ready');
  close(result.annualScenario, -(30 + 160) * 12);
  close(result.rentIncomeLostToVacancy, 216 * 12);
  close(result.cashflowLostToVacancy, (216 - 10) * 12);
  assert.equal(result.occupiedMonths, 0);
});

test('blank required fields never produce a monetary result, including an unconfirmed debt field', () => {
  for (const field of Object.keys(tenant).filter(key => !['loanBalance', 'annualInterestRate'].includes(key))) {
    const result = calculateTenant({ ...tenant, [field]: '' });
    assert.equal(result.status, 'incomplete', field);
    assert.ok(result.missing.includes(field), field);
    assert.equal(result.scenario, null);
  }
  const landlordMissingVacancy = calculateLandlord({ ...landlord, vacancyMonths: '' });
  assert.equal(landlordMissingVacancy.status, 'incomplete');
  assert.ok(landlordMissingVacancy.missing.includes('vacancyMonths'));
});

test('a confirmed zero debt has no interest effect; unspecified debt is not the same as zero debt', () => {
  const result = calculateTenant({ ...tenant, monthlyDebtService: 0, loanBalance: '', annualInterestRate: '' });
  assert.equal(result.status, 'ready');
  close(result.monthlyInterestChange, 0);
  close(result.scenario.monthlyDebtService, 0);
  const missing = calculateTenant({ ...tenant, monthlyDebtService: '', loanBalance: '', annualInterestRate: '' });
  assert.equal(missing.status, 'incomplete');
  assert.equal(missing.baseline, null);
});

test('unentered decomposition is allowed only when a nonzero debt is not shocked by rate changes', () => {
  const noShock = calculateTenant({ ...tenant, loanBalance: '', annualInterestRate: '', rateChangePp: 0 });
  assert.equal(noShock.status, 'ready');
  assert.equal(noShock.baseline.monthlyInterest, null);
  assert.equal(noShock.debtDecompositionAvailable, false);
  const shock = calculateTenant({ ...tenant, loanBalance: '', annualInterestRate: '' });
  assert.equal(shock.status, 'incomplete');
  assert.ok(shock.missing.includes('loanBalance'));
  assert.ok(shock.missing.includes('annualInterestRate'));
  for (const field of ['loanBalance', 'annualInterestRate']) {
    const partial = calculateTenant({ ...tenant, [field]: '' });
    assert.equal(partial.status, 'incomplete');
    assert.ok(partial.missing.includes(field));
  }
});

test('inconsistent debt, negative input, below-zero rate/rent, and nonfinite input are invalid', () => {
  const invalidInputs = [
    { monthlyDebtService: 10 }, { monthlyRevenue: -1 }, { loanBalance: -1 },
    { monthlyDebtService: 60, loanBalance: 0 }, { rateChangePp: -6 },
    { rentChangePercent: -101 }, { monthlyRent: Infinity }, { monthlyOperatingCost: 'abc' },
  ];
  for (const override of invalidInputs) {
    const result = calculateTenant({ ...tenant, ...override });
    assert.equal(result.status, 'invalid', JSON.stringify(override));
    assert.ok(result.errors.length > 0);
    assert.equal(result.baseline, null);
  }
  for (const vacancyMonths of [-1, 12.1, NaN]) {
    assert.equal(calculateLandlord({ ...landlord, vacancyMonths }).status, 'invalid');
  }
});

test('negative residual is shown as a shortfall, never clipped to zero or turned into approval', () => {
  const result = calculateTenant({ ...tenant, monthlyRevenue: 100 });
  assert.equal(result.status, 'ready');
  close(result.baseline.monthlyResidual, -1440);
  close(result.scenario.monthlyResidual, -1463);
  assert.equal('approval' in result, false);
  assert.equal('closureProbability' in result, false);
});

test('optional occupied-only cost distinguishes unentered (excluded) from confirmed zero', () => {
  const blank = calculateLandlord({ ...landlord, monthlyVariableCost: '' });
  const zero = calculateLandlord(landlord);
  assert.equal(blank.status, 'ready');
  assert.equal(blank.variableCostIncluded, false);
  assert.equal(blank.baseline.monthlyVariableCost, null);
  assert.ok(blank.assumptions.some(text => text.includes('미입력')));
  assert.equal(zero.variableCostIncluded, true);
  close(blank.annualScenario, zero.annualScenario);
  assert.equal(calculateLandlord({ ...landlord, monthlyVariableCost: 'bad' }).status, 'invalid');
});

test('zero rent and full concession are valid; tradeoff never divides by zero', () => {
  const zero = calculateLandlord({ ...landlord, monthlyRentIncome: 0, rentChangePercent: 0, vacancyMonths: 12 });
  assert.equal(zero.status, 'ready');
  assert.equal(zero.breakEvenVacancyMonths, null);
  const concession = calculateTenant({ ...tenant, rentChangePercent: -100, rateChangePp: -5 });
  assert.equal(concession.status, 'ready');
  close(concession.scenario.monthlyRent, 0);
  close(concession.scenario.monthlyInterest, 0);
  close(concession.scenario.monthlyDebtService, 35);
});

test('calculations are pure and preserve input including blank values', () => {
  const input = Object.freeze({ ...landlord, monthlyVariableCost: '' });
  calculateLandlord(input);
  assert.equal(input.monthlyVariableCost, '');
  assert.equal(input.rentChangePercent, -10);
});

test('a finite monthly input that overflows the annual calculation is rejected', () => {
  const result = calculateTenant({ ...tenant, monthlyRevenue: 1e308 });
  assert.equal(result.status, 'invalid');
  assert.ok(result.errors.some(error => error.field === 'calculation'));
  assert.equal(result.scenario, null);
});
