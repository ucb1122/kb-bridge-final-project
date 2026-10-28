/**
 * Customer-entered what-if calculations, not forecasts or credit assessments.
 * Money is in 만원, annualInterestRate is %, rateChangePp is percentage points.
 * Debt service includes principal and interest. The scenario holds the entered
 * balance and inferred monthly principal constant; it is not an amortization schedule.
 */

const FIELD_LABELS = Object.freeze({
  monthlyRevenue: '월 매출', monthlyOperatingCost: '월 운영비', monthlyRent: '월 임대료',
  monthlyRentIncome: '월 임대수입', monthlyFixedCost: '월 고정비',
  monthlyVariableCost: '입주 중에만 발생하는 월 비용', monthlyDebtService: '월 원리금 상환액',
  loanBalance: '대출 잔액', annualInterestRate: '현재 연 금리',
  rentChangePercent: '임대료 변동률', rateChangePp: '금리 변동 폭', vacancyMonths: '가정한 공실 개월',
});

/** Empty input stays null. Invalid input returns NaN, never an assumed zero. */
export function parseOptionalNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string') return NaN;
  const text = value.trim();
  if (!text) return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)
      && !/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text)) return NaN;
  const number = Number(text.replaceAll(',', ''));
  return Number.isFinite(number) ? number : NaN;
}

function readInput(input, fields, signed = []) {
  const values = {}, missing = [], errors = [];
  for (const field of fields) {
    const number = parseOptionalNumber(input?.[field]);
    values[field] = number;
    if (number === null) missing.push(field);
    else if (!Number.isFinite(number)) errors.push({ field, message: `${FIELD_LABELS[field]}에 유효한 숫자를 입력해 주세요.` });
    else if (!signed.includes(field) && number < 0) errors.push({ field, message: `${FIELD_LABELS[field]}은 0 이상이어야 합니다.` });
  }
  return { values, missing, errors };
}

function resultError(missing, errors, assumptions = []) {
  return { status: errors.length ? 'invalid' : 'incomplete', missing: [...new Set(missing)], errors,
    baseline: null, scenario: null, assumptions };
}

function debtModel(input, values, missing, errors, assumptions) {
  const loanBalance = parseOptionalNumber(input?.loanBalance);
  const annualInterestRate = parseOptionalNumber(input?.annualInterestRate);
  values.loanBalance = loanBalance;
  values.annualInterestRate = annualInterestRate;
  for (const field of ['loanBalance', 'annualInterestRate']) {
    const value = values[field];
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      errors.push({ field, message: `${FIELD_LABELS[field]}은 유효한 0 이상의 숫자여야 합니다.` });
    }
  }
  const oneMissing = (loanBalance === null) !== (annualInterestRate === null);
  if (oneMissing) missing.push(loanBalance === null ? 'loanBalance' : 'annualInterestRate');
  if (loanBalance === null && annualInterestRate === null) {
    if (values.monthlyDebtService === 0) {
      assumptions.push('월 상환액 0으로 입력한 무차입 가정입니다. 금리 변화의 영향은 0입니다.');
      return { monthlyInterest: 0, monthlyPrincipal: 0, scenarioMonthlyDebtService: 0,
        scenarioAnnualInterestRate: null, monthlyInterestChange: 0, decompositionAvailable: false };
    }
    if (values.rateChangePp !== null && values.rateChangePp !== 0) {
      missing.push('loanBalance', 'annualInterestRate');
    }
    assumptions.push('대출 잔액·금리 미입력: 입력한 월 상환액만 반영하며 원금과 이자를 분해하지 않습니다.');
    return { monthlyInterest: null, monthlyPrincipal: null,
      scenarioMonthlyDebtService: values.monthlyDebtService,
      scenarioAnnualInterestRate: null, monthlyInterestChange: 0, decompositionAvailable: false };
  }
  if (oneMissing || errors.length || missing.length) return null;
  if (loanBalance === 0 && values.monthlyDebtService > 0) {
    errors.push({ field: 'loanBalance', message: '대출 잔액이 0인데 월 상환액이 있습니다. 같은 대출 범위의 금액을 확인해 주세요.' });
    return null;
  }
  const monthlyInterest = loanBalance * annualInterestRate / 1200;
  const monthlyPrincipal = values.monthlyDebtService - monthlyInterest;
  if (monthlyPrincipal < -1e-9) {
    errors.push({ field: 'monthlyDebtService', message: '월 상환액이 입력한 잔액·금리의 월 이자보다 작습니다. 이자와 원금을 모두 포함한 상환액인지 확인해 주세요.' });
    return null;
  }
  const scenarioAnnualInterestRate = annualInterestRate + values.rateChangePp;
  if (scenarioAnnualInterestRate < 0) {
    errors.push({ field: 'rateChangePp', message: '변경 후 연 금리는 0% 이상이어야 합니다.' });
    return null;
  }
  const monthlyInterestChange = loanBalance * values.rateChangePp / 1200;
  assumptions.push('대출 잔액과 월 원금 상환액이 그대로인 경우의 단순 금리 민감도입니다. 실제 상환 스케줄·고정금리 적용 여부는 반영하지 않습니다.');
  return { monthlyInterest, monthlyPrincipal: Math.max(0, monthlyPrincipal),
    scenarioMonthlyDebtService: values.monthlyDebtService + monthlyInterestChange,
    scenarioAnnualInterestRate, monthlyInterestChange, decompositionAvailable: true };
}

function ensureFiniteResult(numbers, errors) {
  if (numbers.some(number => !Number.isFinite(number))) {
    errors.push({ field: 'calculation', message: '계산 가능한 범위를 벗어났습니다. 입력 금액을 확인해 주세요.' });
  }
}

function validateRentChange(value, errors) {
  if (Number.isFinite(value) && value < -100) errors.push({ field: 'rentChangePercent', message: '임대료는 100%보다 더 줄일 수 없습니다.' });
}

/** Tenant: revenue - operating expenses (excluding rent/debt) - rent - debt service. */
export function calculateTenant(input = {}) {
  const { values: v, missing, errors } = readInput(input,
    ['monthlyRevenue', 'monthlyOperatingCost', 'monthlyRent', 'monthlyDebtService', 'rentChangePercent', 'rateChangePp'],
    ['rentChangePercent', 'rateChangePp']);
  const assumptions = ['월 운영비에는 임대료·대출 원리금을 중복하여 넣지 않습니다.',
    '매출·운영비는 고정한 가정입니다. 세금·비정기 지출 등 입력하지 않은 항목은 포함하지 않습니다.'];
  validateRentChange(v.rentChangePercent, errors);
  const debt = debtModel(input, v, missing, errors, assumptions);
  if (missing.length || errors.length || !debt) return resultError(missing, errors, assumptions);
  const baseline = {
    monthlyRevenue: v.monthlyRevenue, monthlyOperatingCost: v.monthlyOperatingCost,
    monthlyRent: v.monthlyRent, monthlyDebtService: v.monthlyDebtService,
    monthlyInterest: debt.monthlyInterest, monthlyPrincipal: debt.monthlyPrincipal,
    totalMonthlyOutflow: v.monthlyOperatingCost + v.monthlyRent + v.monthlyDebtService,
    monthlyResidual: v.monthlyRevenue - v.monthlyOperatingCost - v.monthlyRent - v.monthlyDebtService,
  };
  const monthlyRent = v.monthlyRent * (1 + v.rentChangePercent / 100);
  const scenario = { ...baseline, monthlyRent, monthlyDebtService: debt.scenarioMonthlyDebtService,
    monthlyInterest: debt.monthlyInterest === null ? null : debt.monthlyInterest + debt.monthlyInterestChange,
    annualInterestRate: debt.scenarioAnnualInterestRate,
    totalMonthlyOutflow: v.monthlyOperatingCost + monthlyRent + debt.scenarioMonthlyDebtService,
    monthlyResidual: v.monthlyRevenue - v.monthlyOperatingCost - monthlyRent - debt.scenarioMonthlyDebtService,
  };
  const monthlyDifference = scenario.monthlyResidual - baseline.monthlyResidual;
  ensureFiniteResult([baseline.monthlyResidual, scenario.monthlyResidual, monthlyDifference,
    baseline.monthlyResidual * 12, scenario.monthlyResidual * 12, monthlyDifference * 12,
    baseline.totalMonthlyOutflow, scenario.totalMonthlyOutflow], errors);
  if (errors.length) return resultError([], errors, assumptions);
  return { status: 'ready', missing: [], errors: [], unit: '만원', baseline, scenario,
    monthlyDifference, annualBaseline: baseline.monthlyResidual * 12,
    annualScenario: scenario.monthlyResidual * 12, annualDifference: monthlyDifference * 12,
    rentChangeAmount: monthlyRent - v.monthlyRent,
    monthlyInterestChange: debt.monthlyInterestChange,
    debtDecompositionAvailable: debt.decompositionAvailable, assumptions };
}

/**
 * Landlord: a FULLY OCCUPIED month is compared separately from the 12-month
 * manual-vacancy scenario. Vacancy is a customer assumption, never a prediction.
 */
export function calculateLandlord(input = {}) {
  const { values: v, missing, errors } = readInput(input,
    ['monthlyRentIncome', 'monthlyFixedCost', 'monthlyDebtService', 'rentChangePercent', 'rateChangePp', 'vacancyMonths'],
    ['rentChangePercent', 'rateChangePp']);
  const assumptions = ['임대료 인상이 폐업이나 공실을 일으킨다고 계산하지 않습니다. 공실 개월은 고객이 직접 정하는 가정입니다.',
    '기준안은 공실 없는 12개월입니다. 비교안의 공실 중에도 입력한 고정비·대출 상환액은 계속 발생합니다.',
    '보증금 반환·신규 임차인 모집·수선·세금 등 입력하지 않은 현금 지출은 포함하지 않습니다.'];
  validateRentChange(v.rentChangePercent, errors);
  if (Number.isFinite(v.vacancyMonths) && (v.vacancyMonths < 0 || v.vacancyMonths > 12)) {
    errors.push({ field: 'vacancyMonths', message: '12개월 비교이므로 공실 가정은 0~12개월로 입력해 주세요.' });
  }
  const optionalVariable = parseOptionalNumber(input.monthlyVariableCost);
  const variableCostIncluded = optionalVariable !== null;
  if (variableCostIncluded && (!Number.isFinite(optionalVariable) || optionalVariable < 0)) {
    errors.push({ field: 'monthlyVariableCost', message: '입주 중 비용은 유효한 0 이상의 숫자여야 합니다.' });
  }
  const variable = optionalVariable === null ? 0 : optionalVariable;
  if (!variableCostIncluded) assumptions.push('입주 중에만 발생하는 월 비용은 미입력하여 비교에서 제외했습니다. 비용이 0이라고 확인한 것은 아닙니다.');
  const debt = debtModel(input, v, missing, errors, assumptions);
  if (missing.length || errors.length || !debt) return resultError(missing, errors, assumptions);
  const baseline = {
    monthlyRentIncome: v.monthlyRentIncome, monthlyFixedCost: v.monthlyFixedCost,
    monthlyVariableCost: optionalVariable, monthlyDebtService: v.monthlyDebtService,
    monthlyInterest: debt.monthlyInterest, monthlyPrincipal: debt.monthlyPrincipal,
    totalMonthlyOutflow: v.monthlyFixedCost + variable + v.monthlyDebtService,
    monthlyResidual: v.monthlyRentIncome - v.monthlyFixedCost - variable - v.monthlyDebtService,
  };
  const monthlyRentIncome = v.monthlyRentIncome * (1 + v.rentChangePercent / 100);
  const scenario = { ...baseline, monthlyRentIncome,
    monthlyDebtService: debt.scenarioMonthlyDebtService,
    monthlyInterest: debt.monthlyInterest === null ? null : debt.monthlyInterest + debt.monthlyInterestChange,
    annualInterestRate: debt.scenarioAnnualInterestRate,
    totalMonthlyOutflow: v.monthlyFixedCost + variable + debt.scenarioMonthlyDebtService,
    monthlyResidual: monthlyRentIncome - v.monthlyFixedCost - variable - debt.scenarioMonthlyDebtService,
  };
  const annualBaseline = baseline.monthlyResidual * 12;
  const annualScenario = (monthlyRentIncome - variable) * (12 - v.vacancyMonths)
    - (v.monthlyFixedCost + debt.scenarioMonthlyDebtService) * 12;
  const annualDifference = annualScenario - annualBaseline;
  const occupiedAnnualDifference = (scenario.monthlyResidual - baseline.monthlyResidual) * 12;
  const occupiedContribution = monthlyRentIncome - variable;
  // This threshold compares entered assumptions only; it is not a vacancy forecast.
  const breakEvenVacancyMonths = occupiedContribution > 0 && occupiedAnnualDifference >= 0
    ? occupiedAnnualDifference / occupiedContribution : null;
  ensureFiniteResult([baseline.monthlyResidual, scenario.monthlyResidual, annualBaseline,
    annualScenario, annualDifference, baseline.totalMonthlyOutflow, scenario.totalMonthlyOutflow], errors);
  if (errors.length) return resultError([], errors, assumptions);
  return { status: 'ready', missing: [], errors: [], unit: '만원', baseline, scenario,
    monthlyDifference: scenario.monthlyResidual - baseline.monthlyResidual,
    annualBaseline, annualScenario, annualDifference,
    annualAverageMonthlyScenario: annualScenario / 12,
    vacancyMonths: v.vacancyMonths, occupiedMonths: 12 - v.vacancyMonths,
    rentIncomeLostToVacancy: monthlyRentIncome * v.vacancyMonths,
    cashflowLostToVacancy: occupiedContribution * v.vacancyMonths,
    breakEvenVacancyMonths, variableCostIncluded,
    rentChangeAmount: monthlyRentIncome - v.monthlyRentIncome,
    monthlyInterestChange: debt.monthlyInterestChange,
    debtDecompositionAvailable: debt.decompositionAvailable, assumptions };
}
