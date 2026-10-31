import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fundingSummary,nearestBranches,founderSupport} from '../frontend/pages/owner/consultation/founder/model.js';

test('창업비용은 입력하지 않은 칸을 0원으로 단정하지 않는다',()=>{
  assert.deepEqual(fundingSummary(['','','','','']),{total:null,own:null,needed:null});
  assert.deepEqual(fundingSummary(['3000','2000','','1000','2500']),{total:6000,own:2500,needed:3500});
  assert.deepEqual(fundingSummary(['0','','','','0']),{total:0,own:0,needed:0});
  assert.throws(()=>fundingSummary(['-1','','','','']),/금액/);
  assert.throws(()=>fundingSummary(['abc','','','','']),/금액/);
});

test('공식 영업점 283곳에서 실제 좌표로 가장 가까운 세 곳을 고른다',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('../frontend/shared/finance/kb-branches.json',import.meta.url)));
  assert.equal(data.branches.length,data.count);
  const nearest=nearestBranches(data.branches,{lat:37.576,lng:126.986});
  assert.equal(nearest.length,3);
  assert.ok(nearest.every(branch=>branch.source==='KB국민은행 공식 지점검색'));
  assert.ok(nearest[0].distanceKm<=nearest[1].distanceKm);
  assert.ok(nearest[1].distanceKm<=nearest[2].distanceKm);
});

test('창업 전 안내와 등록 후 확인 상품을 구분한다',()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL('../frontend/shared/finance/founder-support.json',import.meta.url)));
  const preparing=founderSupport(catalog.items);
  assert.ok(preparing.length>0);
  assert.ok(preparing.every(item=>item.businessTypes.includes('preparing')&&item.sourceUrl.startsWith('https://')));
  assert.ok(!preparing.some(item=>item.id==='kb-ontact'));
});
