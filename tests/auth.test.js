import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openUserDb,hashPassword,verifyPassword,createSession,currentUser,revokeSession,publicUser} from '../backend/server/auth.js';

test('테스트 계정의 비밀번호와 DB 세션을 검증한다',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-auth-'));
  fs.mkdirSync(path.join(root,'data'));
  const db=openUserDb(root);
  try{
    const hash=hashPassword('sample-password-123');
    assert.notEqual(hash,'sample-password-123');
    assert.equal(verifyPassword('sample-password-123',hash),true);
    assert.equal(verifyPassword('wrong-password',hash),false);
    db.prepare('INSERT INTO users(login_id,email,name,password_hash) VALUES(?,?,?,?)').run('test1234','test1234@naver.com','홍길동',hash);
    const session=createSession(db,1),cookie=`bridge_session=${session.token}`;
    assert.deepEqual(publicUser(currentUser(db,cookie)),{id:1,loginId:'test1234',name:'홍길동',email:'test1234@naver.com',phone:null,businessName:null});
    assert.equal(db.prepare('SELECT token_hash FROM sessions').get().token_hash.includes(session.token),false);
    revokeSession(db,cookie);
    assert.equal(currentUser(db,cookie),null);
  }finally{db.close();fs.rmSync(root,{recursive:true,force:true})}
});
