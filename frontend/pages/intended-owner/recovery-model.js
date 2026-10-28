export const STEPS=['가게 상태','대응안 비교','함께 준비','영업점 상담'];
export function amount(value){if(value===null||value===undefined||String(value).trim()==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;}
export function comparePlans(input){
 const revenue=amount(input.revenue),cost=amount(input.cost),payment=amount(input.payment);
 if([revenue,cost,payment].includes(null))return null;
 const adjusted=amount(input.adjusted),target=amount(input.target);
 return {current:revenue-cost-payment,adjusted:adjusted===null?null:revenue-cost-adjusted,combined:adjusted===null||target===null?null:revenue-target-adjusted};
}
export function recommendedOptions(answers){return {safety:answers.safety==='no'||answers.safety==='unknown',household:false,restart:false,lease:answers.lease==='expiry'||answers.lease==='increase'};}
export function reviewPlan(plan,revenue,cost,payment){const values=[revenue,cost,payment].map(amount);if(values.includes(null))return null;const actual=values[0]-values[1]-values[2];return {actual,difference:plan===null?null:actual-plan};}
export const CONCERNS={
 repayment:{title:'대출 상환이 부담돼요',plan:'상환 부담 조정',before:'payment',after:'adjusted',beforeLabel:'현재 월 상환액',afterLabel:'비교할 월 상환액',unit:'월 상환액',note:'상환조건 상담에서 월 납입액과 총이자를 함께 확인해요.'},
 sales:{title:'매출이 줄었어요',plan:'영업비용 점검',before:'cost',after:'target',beforeLabel:'현재 월 영업비용',afterLabel:'점검 후 목표 비용',unit:'월 영업비용',note:'매출 변화의 원인과 조정할 수 있는 비용을 먼저 살펴봐요.'},
 lease:{title:'월세·계약 갱신이 걱정돼요',plan:'월세 조건 비교',before:'rent',after:'nextRent',beforeLabel:'현재 월세',afterLabel:'비교할 월세',unit:'월세',note:'실제 인상 통보와 협의 조건을 확인해요.'},
 restart:{title:'전환·정리·재기를 고민해요',plan:'정리·재기 경로 확인',note:'원하는 방향에 맞는 지원 경로를 함께 준비해요.'},
};
export function compareConcern(input,key){const spec=CONCERNS[key];if(!spec?.before)return null;const before=amount(input[spec.before]),after=amount(input[spec.after]);if(before===null||after===null)return null;const raw=input.net;const net=raw!==null&&raw!==undefined&&String(raw).trim()!==''&&Number.isFinite(Number(raw))?Number(raw):comparePlans(input)?.current??null;const saved=before-after;return {before,after,saved,currentCashflow:net,afterCashflow:net===null?null:net+saved};}
