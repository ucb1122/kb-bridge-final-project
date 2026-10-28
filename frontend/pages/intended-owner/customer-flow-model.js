import {amount,compareConcern,CONCERNS} from './recovery-model.js';
export const CUSTOMER_STEPS=['내 고민','부담 계산','필요한 도움','영업점·상담서'];
export const CUSTOMER_CONCERNS={
 ...CONCERNS,
 repayment:{...CONCERNS.repayment,plan:'매출 연동 상환 등 월 상환 부담 조정 방법 확인',headline:'매출이 줄어든 달, 상환액은 얼마나 달라질까요?',beforeLabel:'지금 내는 월 상환액',afterLabel:'상담에서 알아보고 싶은 월 상환액'},
 lease:{...CONCERNS.lease,plan:'월세 인상 부담 상담',headline:'월세가 오르면, 한 달에 얼마가 덜 남을까요?',beforeLabel:'지금 내는 월세',afterLabel:'인상 통보받았거나 예상하는 월세'},
 sales:{...CONCERNS.sales,headline:'평소보다 매출이 얼마나 줄었나요?',before:'usualRevenue',after:'recentRevenue',beforeLabel:'평소 한 달 매출',afterLabel:'최근 한 달 매출',unit:'월 매출',plan:'매출 감소 원인과 필요한 도움 확인',note:'비슷한 영업일수의 월 매출을 비교해요. 매출 감소액이 곧 순이익 감소액은 아닙니다.'},
 restart:{...CONCERNS.restart,headline:'앞으로 어떤 방향을 알아보고 싶으세요?'}
};
export function customerComparison(input,key){
 if(key!=='sales')return compareConcern(input,key);
 const before=amount(input.usualRevenue),after=amount(input.recentRevenue);
 if(before===null||after===null)return null;
 return {before,after,saved:after-before,currentCashflow:null,afterCashflow:null};
}
export function distanceKm(a,b){
 if(!a||!b||![a.lat,a.lng,b.lat,b.lng].every(n=>n!==null&&n!==''&&Number.isFinite(Number(n))))return null;
 const rad=n=>Number(n)*Math.PI/180,dlat=rad(b.lat-a.lat),dlng=rad(b.lng-a.lng);
 const h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function nearestBranches(branches,region,limit=5){
 if(!region)return [];
 return branches.map(b=>({...b,distance:distanceKm(region,b)})).filter(b=>b.distance!==null)
 .sort((a,b)=>a.distance-b.distance||a.name.localeCompare(b.name,'ko')).slice(0,limit);
}
