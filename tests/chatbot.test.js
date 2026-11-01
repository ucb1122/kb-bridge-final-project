import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {loadKnowledge,findKnowledge,documentFallback} from '../backend/server/chat/knowledge.js';

const root=path.resolve(import.meta.dirname,'..');

test('허용된 Markdown 문서에서 창업 상담 안내를 찾는다',async()=>{
  const chunks=await loadKnowledge(root);
  const hits=findKnowledge(chunks,'창업 준비 중인데 KB 영업점 금융상담은 어디서 시작해?');
  assert.ok(hits.length);
  assert.match(hits[0].text,/KB 영업점 금융상담/);
  assert.ok(hits.every(hit=>!hit.source.includes('.env')));
});

test('문서에 없는 질문에는 추측하지 않고 명시한다',()=>{
  assert.match(documentFallback([]),/근거를 찾지 못했어요/);
});
