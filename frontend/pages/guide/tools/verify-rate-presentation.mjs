import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ratePresentation,feeHeadline} from '../rate-model.js';
import {productInformationSections} from '../detail-view.js';
const read=f=>JSON.parse(fs.readFileSync(new URL('../../../shared/finance/'+f,import.meta.url)));
const catalog=read('products.json').products,details=new Map(['details-bank-a.json','details-bank-b.json','details-policy.json'].flatMap(f=>read(f).products).map(p=>[p.id,p]));
const model=id=>ratePresentation(catalog.find(p=>p.id===id),details.get(id));
test('ranges before and after preferential rate come from all four same-condition COFIX rows',()=>{
 const p=model('kb-general-property-collateral');assert.equal(p.kind,'comparison');assert.equal(p.before,'연 5.77~6.06%');assert.equal(p.after,'연 4.87~5.16%');assert.equal(p.rows.length,4);assert.match(p.note,/모든 고객.*아닙니다/);
});
test('single-value examples stay single values, including explicitly marked subsidy calculation',()=>{
 assert.equal(model('kb-seller').before,'연 4.35%');assert.equal(model('kb-seller').after,'연 3.85%');assert.equal(model('kb-regional-guarantee').before,'연 4.56%');assert.match(model('kb-regional-guarantee').note,/합한 값/);
});
test('missing before/after never inferred from published loan range and maximum discount',()=>{
 const p=model('kb-soho-credit');assert.equal(p.kind,'published');assert.equal(p.range,'연 3.63~5.64%');assert.equal(p.before,undefined);assert.equal(p.benefit.headline,'최대 연 2.60%p');
 assert.equal(model('kb-sales-plus').range,'연 4.91~6.32%');assert.equal(model('kb-office-interim').range,'연 5.99%');assert.equal(model('semas-policy-2026').range,'연 1.40~5.72%');
});
test('rate details show the published product terms instead of a generic preference placeholder',()=>{
 for(const product of catalog){
  const html=productInformationSections(product,details.get(product.id),'tenant')[1].html;
  assert.doesNotMatch(html,/상품별 확인|미공시 수치를 임의로 계산하지 않아요/,product.id);
 }
 const product=catalog.find(p=>p.id==='kb-sales-plus');
 const html=productInformationSections(product,details.get(product.id),'tenant')[1].html;
 assert.match(html,/금리 산정·우대 조건/);
 assert.match(html,/기준금리|가산금리|우대조건/);
});
test('fee exemption and unknown fees stay distinct; stamp tax is numeric and bounded',()=>{
 assert.equal(feeHeadline({text:'공식 안내상 면제입니다.'}),'0원');assert.equal(feeHeadline({text:'추가 확인 필요'}),'조건별 확인');
 assert.equal(details.get('kb-soho-credit').fees.find(f=>f.label==='인지세').headline,'0~7만5천원');
 assert.equal(details.get('kb-regional-guarantee').fees.find(f=>f.label==='인지세').headline,'0~3만5천원');
 assert.equal(details.get('kb-ontact').fees.find(f=>f.label==='인지세').headline,'0원');
 assert.equal(feeHeadline({label:'중도상환수수료',text:'소진공 공통 FAQ: 없음.'}),'0원');
});
test('document classification preserves conditional and electronic data without turning the page into a form',()=>{
 const p=catalog.find(p=>p.id==='kb-soho-credit'),html=productInformationSections(p,details.get(p.id),'tenant')[3].html;
 assert.match(html,/기본 제출·확인/);assert.match(html,/해당하는 경우/);assert.match(html,/5천만원 초과/);assert.doesNotMatch(html,/type="checkbox"|상담 요청|접수하기/);
});
