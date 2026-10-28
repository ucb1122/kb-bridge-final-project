import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateClosureRisk,riskRows,riskDetail,criteriaHTML} from '../closure-risk.js';
const raw=JSON.parse(fs.readFileSync(new URL('../assets/closure-risk.json',import.meta.url)));
const regions=JSON.parse(fs.readFileSync(new URL('../assets/regions.json',import.meta.url))).regions;
const data=validateClosureRisk(raw,new Set(regions.filter(r=>r.kind==='area').map(r=>r.code)));
test('1650 official codes join with 1548 evaluated /155 candidate /102 missing',()=>{assert.equal(data.results.length,1650);assert.equal(data.eligibleCount,1548);assert.equal(data.candidateCount,155);assert.equal(data.unavailableCount,102);});
test('all predictions independently equal the learned OLS formula, no G term',()=>{
 const c=data.model.coefficients;
 for(const row of data.results.filter(r=>r.rank!==null)){
  const expected=c.intercept+c.closureRate*(row.closedStores/row.averageStores*100)+c.log1pStores*Math.log1p(row.averageStores)+(c['type:'+row.type]??0);
  assert.ok(Math.abs(expected-row.predictedClosureRate)<1e-9);
 }
 assert.equal(Object.keys(c).some(k=>/G/.test(k)),false);
});
test('default rank order agrees with report leading candidate and exact top ten',()=>{const rows=riskRows(regions,data,{});assert.equal(rows.length,155);assert.equal(rows[0].name,'이경시장');assert.equal(rows[0].code,data.results.find(r=>r.rank===1).code);assert.equal(new Set(rows.slice(0,10).map(r=>r.code)).size,10);});
test('district/search/filter do not reassign official global ranks',()=>{const rows=riskRows(regions,data,{district:'강서구',query:'공항',heat:'candidate'});assert.ok(rows.length>=2);assert.ok(rows.every(r=>r.district==='강서구'&&r.name.includes('공항')));assert.ok(data.byCode.get(rows[0].code).rank>1);assert.equal(riskRows(regions,data,{heat:'unknown'}).length,102);assert.equal(riskRows(regions,data,{heat:'all'}).length,1650);});
test('missing and nonselected cohorts are never labelled safe',()=>{const missing=regions.find(r=>data.byCode.get(r.code)?.status==='insufficient');const observed=regions.find(r=>data.byCode.get(r.code)?.status==='observed');assert.match(riskDetail(data,missing).description,/안전한 상권이라는 뜻이 아닙니다/);assert.match(riskDetail(data,observed).description,/위험이 없다는 뜻은 아닙니다/);});
test('2027 forecast versus 2025 source and G auxiliary weights are visible',()=>{const html=criteriaHTML(data);assert.match(html,/2027/);assert.match(html,/2025/);assert.match(html,/23.9%/);assert.match(html,/49/);assert.match(html,/고정 가중치 비율 아님/);});
test('invalid codes, duplicate rows and missing ranking are rejected',()=>{const known=new Set(regions.filter(r=>r.kind==='area').map(r=>r.code));for(const mutate of [r=>r.results[0].code='0000000',r=>r.results[0]=r.results[1],r=>r.candidateCount=10]){const broken=structuredClone(raw);mutate(broken);assert.throws(()=>validateClosureRisk(broken,known));}});
