import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {customerComparison,nearestBranches,distanceKm} from '../customer-flow-model.js';
import {buildConsultationPDF} from '../consultation-pdf.js';
test('sales loss never becomes fabricated profit or a cost-saving assumption',()=>{
 const r=customerComparison({usualRevenue:1200,recentRevenue:1000,net:500},'sales');
 assert.deepEqual(r,{before:1200,after:1000,saved:-200,currentCashflow:null,afterCashflow:null});
 assert.equal(customerComparison({usualRevenue:1200,recentRevenue:''},'sales'),null);
});
test('rent increase explains existing monthly surplus without subtracting current rent twice',()=>{
 assert.equal(customerComparison({rent:250,nextRent:300,net:1000},'lease').afterCashflow,950);
 assert.equal(customerComparison({rent:250,nextRent:300},'lease').afterCashflow,null);
});
test('nearby branches sort by actual coordinates and do not turn missing positions into zero',()=>{
 const origin={lat:37.5,lng:127};
 const rows=[{id:'far',name:'먼 지점',lat:37.8,lng:127},{id:'near',name:'가까운 지점',lat:37.501,lng:127},{id:'missing',name:'좌표 없음',lat:null,lng:127}];
 assert.equal(nearestBranches(rows,origin)[0].id,'near');assert.equal(nearestBranches(rows,origin).length,2);
 assert.deepEqual(nearestBranches(rows,null),[]);assert.equal(distanceKm(origin,{lat:null,lng:127}),null);
});
function loadUMD(path){const module={exports:{}};new Function('module','exports',fs.readFileSync(new URL(path,import.meta.url),'utf8'))(module,module.exports);return module.exports;}
test('consultation PDF embeds the Korean font and creates a real readable PDF document',async()=>{
 const PDFLib=loadUMD('../vendor/pdf-lib.min.js'),fontkit=loadUMD('../vendor/fontkit.umd.min.js');
 const bytes=await buildConsultationPDF({summary:'상담서\n상권: 동대문구 이경시장\n고민: 월세·계약 갱신이 걱정돼요\n월세: 250만원 → 300만원\n지금 남는 돈 1,000만원 - 부담 차이 50만원 = 변경 후 950만원\n노란우산 요청: 가입 설명 상담',branch:{name:'외대역',address:'서울 동대문구 이문로 120'},form:{date:'2026-10-29',time:'오전',channel:'phone',phone:'010-0000-0000'}},{PDFLib,fontkit,fontBytes:fs.readFileSync(new URL('../vendor/NotoSansKR-PDF.ttf',import.meta.url))});
 assert.equal(Buffer.from(bytes).subarray(0,4).toString(),'%PDF');assert.ok(bytes.length>50000,'full Korean font should be embedded');
 const doc=await PDFLib.PDFDocument.load(bytes);assert.equal(doc.getPageCount(),1);
 if(process.env.CONSULTATION_QA_PDF)fs.writeFileSync(process.env.CONSULTATION_QA_PDF,bytes);
});
