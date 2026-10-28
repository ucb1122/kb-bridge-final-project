// 매출 연동 상환 계산 (제안 기능, 실제 KB 상품 아님)
// 규칙: k = clip(그달 매출 / 기준 평균 매출, 하한, 상한). 이자는 매달 반드시 내고,
// 덜 낸 원금은 만기 뒤 기준 상환액으로 이어서 갚는다(기간 연장).
// 만기일시형은 평균을 넘는 매출의 beta만큼 원금을 미리 갚는다.
// 분석 원본: output/analysis/20261028_매출연동상환/simulate_repayment.py 와 같은 규칙
export const METHODS={annuity:'원리금균등',principal:'원금균등',bullet:'만기일시'};
export const DEFAULTS={kmin:0.5,kmax:1.5,beta:0.5,maxExtension:120};
const num=v=>{if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
// 분기 패턴(평균=100)을 월 매출로 펼친다. 기간이 패턴보다 길면 패턴을 반복한다.
// start: 패턴의 몇 번째 분기부터 시작할지(계절 맞추기). 처음 shockMonths개월은 '예년 같은 시기 매출 × (1-shock)' (shock<0이면 증가).
export function monthlySales(pattern,avgSales,months,shock=0,shockMonths=3,start=0){
 if(!Array.isArray(pattern)||!pattern.length)return null;
 const mean=pattern.reduce((a,b)=>a+b,0)/pattern.length,base=[];
 for(let t=0;t<months;t++)base.push(pattern[(start+Math.floor(t/3))%pattern.length]/mean*avgSales);
 return base.map((s,t)=>t<shockMonths?s*(1-shock):s);
}
export function schedule({principal,annualRate,months,method,sales,linked,baseSales,kmin=DEFAULTS.kmin,kmax=DEFAULTS.kmax,beta=DEFAULTS.beta}){
 const P=num(principal),N=Math.round(num(months)),i=num(annualRate)/12;
 if(!(P>0)||!(N>0)||!(i>=0)||!METHODS[method]||!Array.isArray(sales)||sales.length<N)return null;
 const sbar=num(baseSales)??sales.slice(0,N).reduce((a,b)=>a+b,0)/N;
 const A=i===0?P/N:P*i*(1+i)**N/((1+i)**N-1),rows=[];let bal=P,t=0,balloon=0;
 while(bal>1e-6&&t<N+DEFAULTS.maxExtension){
  const st=t<N?sales[t]:sbar,k=linked&&t<N?Math.min(kmax,Math.max(kmin,st/sbar)):1,intr=bal*i;let pay;
  if(method==='annuity')pay=Math.max(intr,A*k);
  else if(method==='principal')pay=Math.max(intr,(P/N+intr)*k);
  else{pay=intr+(linked?Math.min(bal,beta*Math.max(st-sbar,0)):0);if(t===N-1){balloon=bal-(pay-intr);pay=intr+bal;}}
  const prin=Math.min(bal,pay-intr);pay=intr+prin;bal-=prin;rows.push({month:t+1,pay,interest:intr,principal:prin,sales:st,k});t++;
 }
 const regular=method==='bullet'?rows.filter(r=>r.month<N):rows,rate=r=>r.pay/r.sales;
 const inTerm=rows.slice(0,N),worst=inTerm.reduce((a,b)=>b.sales<a.sales?b:a,inTerm[0]),best=inTerm.reduce((a,b)=>b.sales>a.sales?b:a,inTerm[0]);
 return {rows,totalInterest:rows.reduce((a,r)=>a+r.pay,0)-P,maxPay:Math.max(...rows.map(r=>r.pay)),
  maxRate:regular.length?Math.max(...regular.map(rate))*100:null,minRate:regular.length?Math.min(...regular.map(rate))*100:null,
  months:rows.length,extension:Math.max(0,rows.length-N),balloon:method==='bullet'?balloon:0,worstMonth:worst.month,worstMonthPay:worst.pay,worstMonthSales:worst.sales,bestMonth:best.month,bestMonthPay:best.pay,bestMonthSales:best.sales};
}
// 화면용: 같은 조건에서 고정형과 연동형을 함께 계산
export function compareRepayment(input){
 // shock: 앞으로 3개월 매출 감소율(%) · 음수면 증가
 const months=Math.round(num(input.months)),avg=num(input.avgSales),shock=Math.min(0.9,Math.max(-1,(num(input.shock)??0)/100));
 if(!(months>0)||!input.pattern)return null;
 const scale=avg>0?avg:100,sales=monthlySales(input.pattern,scale,months,shock,3,Math.max(0,Math.round(num(input.startQuarter)??0)));
 const base={principal:input.principal,annualRate:(num(input.ratePct)??NaN)/100,months,method:input.method,sales,baseSales:scale};
 const fixed=schedule({...base,linked:false}),linked=schedule({...base,linked:true});
 if(!fixed||!linked)return null;
 return {fixed,linked,hasSales:avg>0,interestDiff:linked.totalInterest-fixed.totalInterest,worstSaved:fixed.worstMonthPay-linked.worstMonthPay,bestExtra:linked.bestMonthPay-fixed.bestMonthPay,
  next3:{fixed:fixed.rows.slice(0,3).reduce((a,r)=>a+r.pay,0),linked:linked.rows.slice(0,3).reduce((a,r)=>a+r.pay,0)}};
}
export const GROUPS=['외식업','서비스업','소매업'];
// 상권×업종 패턴 찾기. 없으면 같은 자치구 업종 중앙값 → 서울 업종 중앙값 순서로 대체
export function findPattern(data,code,industry,district){
 if(!data)return null;const idx=data.industries.indexOf(industry);if(idx<0)return null;const k=String(idx);
 const own=data.areas?.[String(code)]?.[k];if(own)return {pattern:own,basis:'area'};
 const d=district&&data.districtMedian?.[district]?.[k];if(d)return {pattern:d,basis:'district'};
 const seoul=data.seoulMedian?.[k];return seoul?{pattern:seoul,basis:'seoul'}:null;
}
// 대분류(외식업·서비스업·소매업)에 속한 세부 업종. 이 상권 자료가 있는 업종을 앞에
export function groupIndustries(data,group,code){
 if(!data)return [];const own=data.areas?.[String(code)]||{};
 return data.industries.map((name,i)=>({name,group:data.industryGroups?.[i],hasArea:Object.hasOwn(own,String(i))}))
  .filter(x=>x.group===group).sort((a,b)=>(b.hasArea-a.hasArea)||a.name.localeCompare(b.name,'ko'));
}
export function areaIndustries(data,code){
 if(!data)return [];const own=data.areas?.[String(code)];
 return (own?Object.keys(own):Object.keys(data.seoulMedian)).map(i=>data.industries[Number(i)]).sort((a,b)=>a.localeCompare(b,'ko'));
}
export function worstQuarterRatio(pattern){if(!pattern?.length)return null;const m=pattern.reduce((a,b)=>a+b,0)/pattern.length;return Math.min(...pattern)/m;}
