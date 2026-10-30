const rules={
  rrBalance:{label:'남은 대출 원금',min:0.1,max:10000000},
  rrRate:{label:'연 금리',min:0,max:100},
  rrMonths:{label:'남은 기간',min:1,max:600,integer:true},
  rrSales:{label:'평균 월매출',min:0,max:100000000},
  rrShock:{label:'매출 변화율',min:0,max:60},
  payment:{label:'지금 내는 월 상환액',min:0,max:100000000},
  adjusted:{label:'상담에서 알아보고 싶은 월 상환액',min:0,max:100000000},
  usualRevenue:{label:'평소 월매출',min:0,max:100000000},
  recentRevenue:{label:'최근 월매출',min:0,max:100000000},
  rent:{label:'현재 월세',min:0,max:100000000},
  nextRent:{label:'변경 후 월세',min:0,max:100000000},
  net:{label:'지금 한 달에 남는 돈',min:-100000000,max:100000000},
  'actual-net':{label:'다음 달 실제로 남은 돈',min:-100000000,max:100000000},
};
export function validatePlannerNumber(key,value,badInput=false){
  const rule=rules[key];
  if(!rule)return null;
  if(badInput)return `${rule.label}: 숫자를 올바르게 입력해 주세요.`;
  if(value==null||String(value).trim()==='')return null;
  const number=Number(value);
  if(!Number.isFinite(number)||number<rule.min||number>rule.max||(rule.integer&&!Number.isInteger(number)))
    return `${rule.label}: ${rule.min}~${rule.max} 범위의 ${rule.integer?'정수':'숫자'}를 입력해 주세요.`;
  return null;
}
export function validatePlannerMonth(value,now=new Date()){
  if(!value)return null;
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))return '재점검 대상 월을 올바르게 선택해 주세요.';
  const year=Number(value.slice(0,4));
  if(year<now.getFullYear()||year>now.getFullYear()+2)return '재점검 대상 월은 올해부터 2년 이내로 선택해 주세요.';
  return null;
}
