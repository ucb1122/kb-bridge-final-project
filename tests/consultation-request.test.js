import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import branches from '../frontend/shared/finance/kb-branches.json' with {type:'json'};
import {saveConsultationRequest} from '../backend/server/consultation-request.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('상담 요청을 사용자 SQLite에 저장하고 유효하지 않은 요청은 거부한다',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'bridge-consult-'));
  const db=new DatabaseSync(path.join(dir,'users.sqlite'));
  try{
    db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY)');
    db.prepare('INSERT INTO users(id) VALUES(?)').run(7);
    const branch=branches.branches.find(item=>item.visitConsultation)||branches.branches[0];
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const body={branchId:branch.id,region:{kind:'area',code:'3110008',quarter:'20262'},concern:'상환 부담',form:{channel:branch.visitConsultation?'visit':'phone',date:today,time:'오전',phone:'010-1234-5678',name:'홍길동',consent:true}};
    assert.throws(()=>saveConsultationRequest(db,root,null,body),/로그인/);
    const saved=saveConsultationRequest(db,root,{id:7},body);
    assert.equal(saved.saved,true);
    assert.deepEqual({...db.prepare('SELECT user_id,branch_id,phone,concern FROM consultation_requests WHERE id=?').get(saved.id)},{user_id:7,branch_id:branch.id,phone:'01012345678',concern:'상환 부담'});
    assert.throws(()=>saveConsultationRequest(db,root,{id:7},{...body,form:{...body.form,consent:false}}),/확인/);
    assert.equal(db.prepare('SELECT count(*) AS count FROM consultation_requests').get().count,1);
  }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});
