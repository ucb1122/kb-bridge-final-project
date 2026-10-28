import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {resolvePublicFile} from '../backend/static-files.js';

const root=path.resolve(import.meta.dirname,'..');
test('기존 화면 주소와 공용 자산 주소가 새 frontend 파일을 가리킨다',()=>{
  for(const route of ['/', '/pages/rising/', '/pages/owner/', '/pages/intended-owner/', '/pages/guide/', '/shared/site-header.css', '/shared/finance/products.json', '/styles.css']){
    const file=resolvePublicFile(root,route);
    assert.ok(file?.startsWith(path.join(root,'frontend')+path.sep),route);
    assert.ok(fs.existsSync(file),route);
  }
});
test('정적 경로로 비밀 설정과 백엔드 파일에 접근할 수 없다',()=>{
  for(const route of ['/.env','/%2eenv','/../backend/server.js','/%2e%2e/backend/server.js']){
    assert.equal(resolvePublicFile(root,route),null,route);
  }
});
