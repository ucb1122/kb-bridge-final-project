import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const hasData=fs.existsSync(new URL('../data/commerce.sqlite',import.meta.url));
test('지역 AI 요약을 SQLite에 저장하고 새 모듈에서도 재사용한다',{skip:!hasData},async()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'bridge-analysis-'));
  const previousPath=process.env.ANALYSIS_CACHE_PATH,originalFetch=globalThis.fetch;
  process.env.ANALYSIS_CACHE_PATH=path.join(dir,'analysis.sqlite');
  const query={kind:'dong',code:'11110640',quarter:'20262'};
  let calls=0;
  try{
    globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({response:JSON.stringify({opinions:['첫째','둘째','셋째','넷째']})}),{status:200})};
    const first=await import('../backend/server/analysis.js?cache-test=first');
    assert.equal((await first.getRegionAnalysis(query)).mode,'ai');
    assert.equal(calls,1);
    globalThis.fetch=async()=>{throw Error('저장된 요약을 다시 생성했습니다.')};
    const second=await import('../backend/server/analysis.js?cache-test=second');
    assert.deepEqual((await second.getRegionAnalysis(query)).lines,['첫째','둘째','셋째','넷째']);
  }finally{
    globalThis.fetch=originalFetch;
    if(previousPath===undefined)delete process.env.ANALYSIS_CACHE_PATH;else process.env.ANALYSIS_CACHE_PATH=previousPath;
    rmSync(dir,{recursive:true,force:true});
  }
});
