import {parseOptionalNumber} from './cashflow-model.js';

// Both alternatives refer to the same single lease, in 만원, over 12 months.
export function compareCooperation(input={}) {
  const missing=[],errors=[];
  const value=(key,min,max=Infinity)=>{
    const number=parseOptionalNumber(input[key]);
    if(number===null) missing.push(key);
    else if(!Number.isFinite(number)||number<min||number>max) errors.push(key);
    return number;
  };
  const rent=value('rent',0),requestedPercent=value('requestedPercent',-100,100),agreedPercent=value('agreedPercent',-100,100);
  if(input.vacancyEnabled!==undefined&&typeof input.vacancyEnabled!=='boolean') errors.push('vacancyEnabled');
  const vacancyMonths=input.vacancyEnabled===true?value('vacancyMonths',0,12):0;
  const base={status:errors.length?'invalid':missing.length?'incomplete':'ready',missing,errors,unit:'만원'};
  if(base.status!=='ready') return base;
  const requestedRent=rent*(1+requestedPercent/100),agreedRent=rent*(1+agreedPercent/100);
  const requestedAnnual=requestedRent*(12-vacancyMonths),agreedAnnual=agreedRent*12;
  const tenantMonthlySaving=requestedRent-agreedRent,landlordAnnualDifference=agreedAnnual-requestedAnnual;
  const breakEvenVacancyMonths=requestedRent>0&&agreedRent<=requestedRent?12*(1-agreedRent/requestedRent):null;
  const values={requestedRent,agreedRent,requestedAnnual,agreedAnnual,tenantMonthlySaving,landlordAnnualDifference,breakEvenVacancyMonths};
  if(Object.values(values).some(number=>number!==null&&!Number.isFinite(number))) return {...base,status:'invalid',errors:['calculation']};
  return {...base,...values,rent,vacancyMonths,vacancyEnabled:input.vacancyEnabled===true,mutualBenefit:tenantMonthlySaving>0&&landlordAnnualDifference>=-1e-9};
}
