import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {loadKnowledge,findKnowledge,documentFallback} from '../backend/server/chat/knowledge.js';
import {regionReply} from '../backend/server/chat/region.js';

const root=path.resolve(import.meta.dirname,'..');

test('허용된 Markdown 문서에서 창업 상담 안내를 찾는다',async()=>{
  const chunks=await loadKnowledge(root);
  const hits=findKnowledge(chunks,'창업 준비 중인데 KB 영업점 금융상담은 어디서 시작해?');
  assert.ok(hits.length);
  assert.match(hits[0].text,/KB 영업점 금융상담/);
  assert.ok(hits.every(hit=>!hit.source.includes('.env')));
});

test('문서에 없는 질문에는 추측하지 않고 명시한다',()=>{
  assert.match(documentFallback([]),/자료를 찾지 못했어요/);
});

test('동화동 질문은 실제 행정동 원본 수치와 기준 분기로 답한다',()=>{
  const reply=regionReply('동화동 점포수, 매출, 유동인구, 거주인구 요약해줘');
  assert.match(reply.text,/동화동 · 행정동 전체 · 2026년 2분기/);
  assert.match(reply.text,/점포 수: 574개/);
  assert.match(reply.text,/분기 추정매출: 253\.5억 원/);
  assert.match(reply.text,/분기 유동인구 원본값: 3,577,959명/);
  assert.match(reply.text,/거주인구 원본값: 9,941명/);
  assert.equal(reply.source.source,'data/commerce.sqlite');
});

test('상권 이름을 쓰면 같은 이름의 행정동과 혼동하지 않는다',()=>{
  const reply=regionReply('동화동 골목형상점가 점포수는?');
  assert.match(reply.text,/공식 상권/);
  assert.match(reply.text,/점포 수: 250개/);
  assert.doesNotMatch(reply.text,/분기 추정매출/);
});
