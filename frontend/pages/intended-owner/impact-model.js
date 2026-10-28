import { parseOptionalNumber } from './cashflow-model.js';

const LABELS = Object.freeze({
  rentAmount: '현재 월 임대료·임대수입',
  rentChangePercent: '임대료 변동률',
  loanBalance: '대출 잔액',
  rateChangePp: '연 금리 변동 폭',
  vacancySharePercent: '추가 공실의 임대수입 비중',
  vacancyMonths: '추가 공실 기간',
  currentMonthlyCashflow: '현재 월 잔여 현금',
});

/**
 * Changes in customer-entered rent and interest only; this is not a forecast.
 * Money is in 만원. Rent change is %, and annual rate change is percentage points.
 * Landlord rent is current actual receipts, already reflecting existing vacancy.
 */
export function calculateImpact(input = {}) {
  const errors = [], missing = [], assumptions = [];
  const role = input?.role;
  const validRole = role === 'tenant' || role === 'landlord';
  if (role === null || role === undefined || role === '') missing.push('role');
  else if (!validRole) errors.push({ field: 'role', message: '임차인 또는 임대인을 선택해 주세요.' });

  function number(field, { optional = false, min = -Infinity, max = Infinity } = {}) {
    const value = parseOptionalNumber(input?.[field]);
    if (value === null) {
      if (!optional) missing.push(field);
    } else if (!Number.isFinite(value)) {
      errors.push({ field, message: `${LABELS[field]}에 유효한 숫자를 입력해 주세요.` });
    } else if (value < min || value > max) {
      const range = max === Infinity ? `${min} 이상` : `${min}~${max}`;
      errors.push({ field, message: `${LABELS[field]}은 ${range} 범위로 입력해 주세요.` });
    }
    return value;
  }

  function enabled(field) {
    const value = input?.[field];
    if (value !== undefined && value !== null && typeof value !== 'boolean') {
      errors.push({ field, message: '추가 조건의 적용 여부를 선택해 주세요.' });
    }
    return value === true;
  }

  const rentAmount = number('rentAmount', { min: 0 });
  const rentChangePercent = number('rentChangePercent', { min: -100 });
  const currentMonthlyCashflow = number('currentMonthlyCashflow', { optional: true });
  const rateEnabled = enabled('rateEnabled');
  const vacancyEnabled = role === 'landlord' && enabled('vacancyEnabled');
  let loanBalance = null, rateChangePp = null;
  let vacancySharePercent = null, vacancyMonths = null;

  if (rateEnabled) {
    loanBalance = number('loanBalance', { min: 0 });
    rateChangePp = number('rateChangePp');
    assumptions.push('대출 잔액이 일정한 경우의 단순 이자 변화만 반영합니다. 실제 금리 적용 여부·원금 상환 일정은 별도 확인이 필요합니다.');
  } else {
    assumptions.push('금리 변화 조건을 선택하지 않아 이자 변화는 비교에서 제외했습니다. 대출 잔액이 0이라는 뜻은 아닙니다.');
  }

  if (role === 'landlord') {
    assumptions.push('현재 월 임대수입은 기존 공실이 이미 반영된 실제 수입입니다. 기존 공실을 다시 차감하지 않습니다. 변동률은 현재 수입 전체에 적용하는 평균 변화율입니다.');
    if (vacancyEnabled) {
      vacancySharePercent = number('vacancySharePercent', { min: 0, max: 100 });
      vacancyMonths = number('vacancyMonths', { min: 0, max: 12 });
      assumptions.push('추가 공실은 입력한 임대수입 비중과 기간에만 적용하며 나머지 임대수입은 유지합니다. 비중은 호실 수가 아닌 임대수입 기준입니다.');
    } else {
      assumptions.push('추가 공실 조건을 선택하지 않아 공실에 따른 추가 손실은 비교에서 제외했습니다. 기존 공실이 없다는 뜻은 아닙니다.');
    }
    assumptions.push('공실 비중과 기간은 직접 정한 가정입니다. 임대료 인상으로 폐업·공실이 발생한다고 예측하지 않습니다.');
  } else if (role === 'tenant') {
    assumptions.push('임차인 비교에는 임대료와 선택한 이자 변화만 반영하며 공실 조건은 적용하지 않습니다.');
  }
  assumptions.push('그 밖의 수입과 지출은 그대로인 가정입니다. 현재 월 잔여 현금을 입력한 경우에만 변경 후 잔여 현금을 표시합니다.');
  assumptions.push('임대료 인상분의 손익분기 손실률은 인상 후 연 임대료 기준의 회계적 경계입니다. 이자 변화는 제외하며 공실 발생을 예측하지 않습니다.');

  const result = {
    status: 'ready', errors, missing, assumptions, role: validRole ? role : null, unit: '만원',
    rentAmount: Number.isFinite(rentAmount) ? rentAmount : null,
    scenarioRent: null, rentChangeAmount: null, monthlyInterestChange: null,
    annualVacancyLoss: null, monthlyVacancyLoss: null,
    monthlyDifference: null, annualDifference: null,
    currentMonthlyCashflow: Number.isFinite(currentMonthlyCashflow) ? currentMonthlyCashflow : null,
    scenarioMonthlyCashflow: null,
    annualRentBefore: null, annualRentAfter: null, monthlyRentAfterVacancy: null,
    rentOnlyBreakEvenLossPercent: null,
  };
  if (errors.length || missing.length) {
    result.status = errors.length ? 'invalid' : 'incomplete';
    return result;
  }

  const growth = rentChangePercent / 100;
  const rentChangeAmount = rentAmount * growth;
  const scenarioRent = rentAmount + rentChangeAmount;
  const monthlyInterestChange = rateEnabled ? loanBalance * rateChangePp / 1200 : 0;
  const annualVacancyLoss = vacancyEnabled ? scenarioRent * (vacancySharePercent / 100) * vacancyMonths : 0;
  const monthlyVacancyLoss = annualVacancyLoss / 12;
  const annualDifference = role === 'tenant'
    ? 12 * (-rentChangeAmount - monthlyInterestChange)
    : 12 * rentChangeAmount - annualVacancyLoss - 12 * monthlyInterestChange;
  const monthlyDifference = annualDifference / 12;
  const annualRentBefore = rentAmount * 12;
  const annualRentAfter = scenarioRent * 12 - annualVacancyLoss;
  const calculated = {
    scenarioRent, rentChangeAmount, monthlyInterestChange, annualVacancyLoss, monthlyVacancyLoss,
    monthlyDifference, annualDifference, annualRentBefore, annualRentAfter,
    monthlyRentAfterVacancy: annualRentAfter / 12,
    scenarioMonthlyCashflow: currentMonthlyCashflow === null ? null : currentMonthlyCashflow + monthlyDifference,
    rentOnlyBreakEvenLossPercent: rentAmount > 0 && growth > 0 ? growth / (1 + growth) * 100 : null,
  };
  if (Object.values(calculated).some(value => value !== null && !Number.isFinite(value))) {
    errors.push({ field: 'calculation', message: '계산 가능한 범위를 벗어났습니다. 입력 금액과 변동 폭을 확인해 주세요.' });
    result.status = 'invalid';
    return result;
  }
  return { ...result, ...calculated };
}
