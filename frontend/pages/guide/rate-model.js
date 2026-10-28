export function validExamples(product,detail){const rows=(detail?.rate?.examples||[]).filter(r=>r?.range&&r.asOf&&r.conditions);return rows.length?rows:product.rateExample?[product.rateExample]:[];}
export function ratePresentation(product,detail){
 const comparison=detail?.rate?.comparison;
 if(comparison?.asOf&&comparison.conditions&&Array.isArray(comparison.rows)&&comparison.rows.length&&comparison.rows.every(r=>Number.isFinite(r.before)&&Number.isFinite(r.after)&&r.after>=0&&r.before>=r.after)){
  const fmt=n=>n.toFixed(2),range=key=>{const values=comparison.rows.map(r=>r[key]),lo=Math.min(...values),hi=Math.max(...values);return '연 '+fmt(lo)+(lo===hi?'':'~'+fmt(hi))+'%';};
  return {kind:'comparison',before:range('before'),after:range('after'),...comparison};
 }
 const example=validExamples(product,detail)[0];
 const policy=product.category==='policy';
 const policyDate=policy?(detail?.rate?.details||[]).join(' ').match(/\d{4}-\d{2}-\d{2}/)?.[0]:null;
 return {kind:'published',range:example?.range||(policy?detail?.rate?.summary||product.rateText:'수치 미공시'),asOf:example?.asOf||(policy?detail?.rate?.asOf||policyDate:null),conditions:example?.conditions||'',benefit:detail?.rate?.benefit||null};
}
export function feeHeadline(fee){
 if(typeof fee?.headline==='string'&&fee.headline.trim())return fee.headline;
 const text=fee?.text||'';
 if(/면제|수수료 없음|모두 없/.test(text)||(/수수료/.test(fee?.label||'')&&/없음/.test(text)))return '0원';
 const matches=text.match(/\d+(?:\.\d+)?\s*(?:~|～)\s*(?:최고\s*)?\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*%/g);
 return matches?.length?matches.slice(0,2).join(' · '):'조건별 확인';
}
