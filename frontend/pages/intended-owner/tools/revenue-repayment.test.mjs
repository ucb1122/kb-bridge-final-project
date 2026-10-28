// 매출 연동 상환 JS 계산이 분석 원본(Python simulate_repayment.py, simulation_result.json)과 맞는지 확인
// 화면 자료는 분기 비율을 정수(%)로 반올림해 담으므로 작은 오차 허용
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {schedule,monthlySales,compareRepayment,findPattern,areaIndustries,groupIndustries,worstQuarterRatio,GROUPS} from '../revenue-repayment.js';
const data=JSON.parse(readFileSync(new URL('../assets/revenue-pattern.json',import.meta.url),'utf8'));
const base={principal:3000,annualRate:0.05,months:36};
// simulation_result.json (2026-10-28) 값
const EXPECTED={
 '3130189|한식음식점':{annuity:[[236.9,9.9,36],[210.2,7.5,36]],principal:[[231.2,9.8,36],[204.7,8.0,36]],bullet:[[450.0,1.4,36,3000],[195.5,15.7,36,899.5]]},
 '3110973|피부관리실':{annuity:[[236.9,15.4,36],[235.1,7.7,41]],principal:[[231.2,15.3,36],[228.9,8.0,41]],bullet:[[450.0,2.1,36,3000],[91.7,32.9,9,0]]}
};
const near=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: ${a.toFixed(2)} vs ${b}`);
for(const [key,methods] of Object.entries(EXPECTED)){
 const [code,ind]=key.split('|'),found=findPattern(data,code,ind);
 test(`${key} 패턴이 상권 자료에 있다`,()=>{assert.equal(found?.basis,'area');assert.equal(found.pattern.length,12);});
 const sales=monthlySales(found.pattern,1200,36);
 for(const [m,[fx,ln]] of Object.entries(methods))for(const [linked,exp] of [[false,fx],[true,ln]]){
  test(`${key} ${m} ${linked?'연동':'고정'} = Python 결과`,()=>{
   const r=schedule({...base,method:m,sales,linked,baseSales:1200});
   near(r.totalInterest,exp[0],2,'총이자');near(r.maxRate,exp[1],0.3,'최대부담률');
   assert.ok(Math.abs(r.months-exp[2])<=1,`상환개월 ${r.months} vs ${exp[2]}`);
   if(m==='bullet')near(r.balloon,exp[3],15,'만기일시금');
  });
 }
}
test('연동형은 매출이 가장 낮은 달 상환액이 고정형보다 작다',()=>{
 const p=findPattern(data,'3130189','한식음식점').pattern;
 const r=compareRepayment({principal:3000,ratePct:5,months:36,method:'annuity',avgSales:1200,pattern:p});
 assert.ok(r.worstSaved>0);assert.ok(r.linked.worstMonthPay<r.fixed.worstMonthPay);
});
test('평균 매출이 없어도 상환액 비교는 된다 (부담률만 계산 안 함)',()=>{
 const p=findPattern(data,'3130189','한식음식점').pattern;
 const r=compareRepayment({principal:3000,ratePct:5,months:36,method:'annuity',pattern:p});
 assert.equal(r.hasSales,false);assert.ok(r.worstSaved>0);
});
test('매출 급감 가정을 넣으면 연동형 첫 달 상환액이 줄어든다',()=>{
 const p=findPattern(data,'3130189','한식음식점').pattern;
 const a=compareRepayment({principal:3000,ratePct:5,months:36,method:'annuity',avgSales:1200,pattern:p});
 const b=compareRepayment({principal:3000,ratePct:5,months:36,method:'annuity',avgSales:1200,pattern:p,shock:30});
 assert.ok(b.linked.rows[0].pay<a.linked.rows[0].pay);assert.equal(b.fixed.rows[0].pay,a.fixed.rows[0].pay);
});
test('연동형도 이자는 매달 낸다',()=>{
 const sales=Array(36).fill(10);sales[0]=1;
 const r=schedule({...base,method:'annuity',sales,linked:true,baseSales:10});
 for(const row of r.rows)assert.ok(row.pay+1e-9>=row.interest);
});
test('자료에 없는 상권은 서울 업종 중앙값으로 대체',()=>{
 const f=findPattern(data,'0000000','한식음식점');assert.equal(f.basis,'seoul');
 assert.ok(areaIndustries(data,'3130189').includes('한식음식점'));
 assert.ok(worstQuarterRatio(f.pattern)<1);
});
test('잘못된 입력은 계산하지 않는다',()=>{
 assert.equal(schedule({...base,method:'x',sales:Array(36).fill(1),linked:false}),null);
 assert.equal(compareRepayment({principal:'',ratePct:5,months:36,method:'annuity',pattern:[100]}),null);
});
test('매출이 가장 많은 달에는 연동형이 더 내고, 상한은 고정 상환액의 1.5배',()=>{
 const p=findPattern(data,'3110973','피부관리실').pattern;
 const r=compareRepayment({principal:3000,ratePct:5,months:36,method:'annuity',avgSales:1200,pattern:p});
 assert.ok(r.bestExtra>0);assert.ok(r.linked.bestMonthPay<=r.fixed.bestMonthPay*1.5+1e-9);
});
test('업종 3분류: 외식업·서비스업·소매업으로 모든 세부 업종이 나뉜다',()=>{
 const all=GROUPS.flatMap(g=>groupIndustries(data,g,'3130189'));assert.equal(all.length,data.industries.length);
 assert.ok(groupIndustries(data,'외식업','3130189').some(x=>x.name==='한식음식점'&&x.hasArea));
});
test('상권에 업종 자료가 없으면 같은 자치구 → 서울 순서로 대체',()=>{
 assert.equal(findPattern(data,'3130103','한식음식점','동대문구').basis,'district');
 assert.equal(findPattern(data,'0000000','한식음식점','없는구').basis,'seoul');
});
test('앞으로 3개월 매출이 늘면 연동형 3개월 상환액이 늘고, 줄면 줄어든다 (고정형은 그대로)',()=>{
 const p=findPattern(data,'3130189','한식음식점').pattern;
 const up=compareRepayment({principal:3000,ratePct:5,months:36,method:'annuity',avgSales:1200,pattern:p,shock:-30});
 const down=compareRepayment({principal:3000,ratePct:5,months:36,method:'annuity',avgSales:1200,pattern:p,shock:30});
 const base=compareRepayment({principal:3000,ratePct:5,months:36,method:'annuity',avgSales:1200,pattern:p});
 assert.ok(up.next3.linked>base.next3.linked);assert.ok(down.next3.linked<base.next3.linked);assert.equal(up.next3.fixed,base.next3.fixed);
});
