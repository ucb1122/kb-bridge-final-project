import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getRankings,getRegionReport} from '../server/data.js';
import {monthlySalesPerStore} from '../pages/rising/report-view.js';

const hasData=fs.existsSync(new URL('../data/commerce.sqlite',import.meta.url));

test('행정동 직장인구는 별도 공개자료의 지역 전체 값으로 표시한다',{skip:!hasData},()=>{
  for(const [code,expected] of [['11140580',4450],['11260580',1611],['11305603',364]]){
    const report=getRegionReport({kind:'dong',code,quarter:'20262'});
    assert.equal(report.details['20262'].workers.total,expected);
  }
});

test('서울시 화면의 강남구 점포수 순위와 일치한다',{skip:!hasData},()=>{
  const result=getRankings({kind:'dong',metric:'stores',quarter:'20262',district:'강남구'});
  assert.equal(result.rankingSource,'official');
  assert.deepEqual(result.rows.map(row=>row.code),['11680720','11680656','11680565','11680700','11680690','11680660','11680650','11680630','11680510','11680640']);
});

test('서울시 화면의 중랑구 3·4위와 8~10위가 일치한다',{skip:!hasData},()=>{
  const result=getRankings({kind:'dong',metric:'stores',quarter:'20262',district:'중랑구'});
  assert.equal(result.rankingSource,'official');
  assert.deepEqual(result.rows.map(row=>row.code),['11260680','11260580','11260520','11260590','11260610','11260630','11260575','11260655','11260690','11260565']);
});

test('서울시 매출 표시값과 증감률을 순위에 반영한다',{skip:!hasData},()=>{
  const result=getRankings({kind:'dong',metric:'sales',quarter:'20262',district:'강동구'});
  const row=result.rows.find(item=>item.code==='11740600');
  assert.equal(row.value,287.9e8);
  assert.equal(row.change,0.034);
});

test('서울시 분석 면적으로 환산한 송천동 유동인구 밀도가 보고서와 일치한다',{skip:!hasData},()=>{
  const report=getRegionReport({kind:'dong',code:'11305555',quarter:'20262'});
  assert.equal(Math.round(report.metrics.footfall.value/(report.analysisAreaM2/10000)),118254);
  assert.equal(Math.round((report.metrics.footfall.value-report.history.filter(row=>row.metric==='footfall'&&row.quarter==='20261')[0].value)/(report.analysisAreaM2/10000)),73);
});

test('신길1동의 매출과 유동인구를 서울시 화면 단위로 환산한다',{skip:!hasData},()=>{
  const report=getRegionReport({kind:'dong',code:'11560630',quarter:'20262'});
  assert.equal(report.metrics.stores.value,872);
  assert.equal(Math.round(report.officialSalesEok*1e8/3/report.metrics.stores.value/1e4),1213);
  assert.equal(Math.round(report.metrics.footfall.value/(report.analysisAreaM2/10000)),76470);
});

test('화곡1동 상주인구와 일원본동 점포수는 원본과 서울시 화면이 일치한다',{skip:!hasData},()=>{
  const residents=getRegionReport({kind:'dong',code:'11500540',quarter:'20262'});
  const stores=getRegionReport({kind:'dong',code:'11680720',quarter:'20262'});
  assert.equal(residents.metrics.residents.value,50743);
  assert.equal(stores.metrics.stores.value,462);
  assert.equal(Math.round(stores.metrics.footfall.value/(stores.analysisAreaM2/10000)),10434);
});

test('화곡1동 점포당 월평균 매출은 서울시 화면의 1,194만 원과 일치한다',{skip:!hasData},()=>{
  const report=getRegionReport({kind:'dong',code:'11500540',quarter:'20262'});
  const monthly=q=>monthlySalesPerStore(
    report.history.find(row=>row.metric==='sales'&&row.quarter===q)?.value,
    report.history.find(row=>row.metric==='stores'&&row.quarter===q)?.value
  );
  assert.equal(Math.round(monthly('20262')/1e4),1194);
  assert.equal(Math.round((monthly('20262')-monthly('20261'))/1e4),-14);
  assert.equal(monthlySalesPerStore(100,0),null);
});

test('잠실4동은 원본 CSV와 다른 서울시 분석보고서 매출 표시값을 사용한다',{skip:!hasData},()=>{
  const report=getRegionReport({kind:'dong',code:'11710690',quarter:'20262'});
  assert.equal(Math.round(monthlySalesPerStore(report.metrics.sales.value,report.metrics.stores.value)/1e4),999);
  assert.deepEqual(report.officialReportSales,{current:1003,previousChange:-60,yearAgoChange:-184});
});

test('상세조건의 최고순위와 업종 선택이 실제 순위를 바꾼다',{skip:!hasData},()=>{
  const highest=getRankings({kind:'dong',metric:'stores',quarter:'20262',district:'강남구',criterion:'highest'});
  const food=getRankings({kind:'dong',metric:'stores',quarter:'20262',district:'강남구',industry:'CS1'});
  assert.equal(highest.rows[0].name,'역삼1동');
  assert.equal(highest.rows[0].value,11922);
  assert.equal(food.rows[0].name,'일원본동');
  assert.equal(food.rows[0].value,53);
  assert.notDeepEqual(food.rows.map(row=>row.code),getRankings({kind:'dong',metric:'stores',quarter:'20262',district:'강남구'}).rows.map(row=>row.code));
});

test('동분기 비교와 연도 선택은 보유한 비교 분기를 사용한다',{skip:!hasData},()=>{
  const same=getRankings({kind:'dong',metric:'stores',quarter:'20262',district:'강남구',comparison:'same'});
  const annual=getRankings({kind:'dong',metric:'stores',quarter:'20262',district:'강남구',period:'year',year:'2026'});
  assert.equal(same.rows[0].name,'일원본동');
  assert.equal(annual.rows[0].name,'일원본동');
  assert.equal(getRankings({kind:'dong',metric:'stores',quarter:'20262',period:'year',year:'2025'}).rows.length,0);
});


test('이문1동 행정동 전체는 상권 합계가 아닌 원본 값으로 보고한다',{skip:!hasData},()=>{
  const report=getRegionReport({kind:'dong',code:'11230740',quarter:'20262'});
  assert.equal(report.metrics.stores.value,1116);
  assert.equal(report.metrics.sales.value,31007618538);
  assert.equal(report.metrics.footfall.value,14072454);
  assert.equal(report.history.find(row=>row.metric==='stores'&&row.quarter==='20261')?.value,1097);
});


test('내 상권 분석의 점포당 월평균은 분기 매출과 점포수로 계산한다',{skip:!hasData},()=>{
  const result=getRankings({kind:'dong',metric:'salesPerStore',quarter:'20262',district:'구로구'});
  const hang=result.rows.find(row=>row.name==='항동');
  assert.ok(hang);
  assert.equal(Math.round(hang.value/1e4*10)/10,10.9);
});

test('선택 업종 보고서의 매출과 점포수는 해당 업종만 집계한다',{skip:!hasData},()=>{
  const all=getRegionReport({kind:'dong',code:'11230740',quarter:'20262'});
  const food=getRegionReport({kind:'dong',code:'11230740',quarter:'20262',industry:'CS1'});
  assert.equal(food.scopeIndustry,'CS1');
  assert.ok(food.metrics.stores.value<all.metrics.stores.value);
  assert.ok(food.metrics.sales.value<all.metrics.sales.value);
  assert.ok(food.industries.every(row=>row.code.startsWith('CS1')));
});
