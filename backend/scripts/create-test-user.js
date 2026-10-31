import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {openUserDb,hashPassword} from '../server/auth.js';

async function secret(prompt){
  if(!process.stdin.isTTY)throw Error('터미널에서 직접 실행해 비밀번호를 입력해 주세요.');
  process.stdout.write(prompt);
  return new Promise((resolve,reject)=>{
    let value='';process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
    const done=()=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n')};
    const onData=key=>{if(key==='\u0003'){done();reject(Error('취소했습니다.'))}else if(key==='\r'||key==='\n'){done();resolve(value)}else if(key==='\u007f'||key==='\b'){if(value){value=value.slice(0,-1);process.stdout.write('\b \b')}}else if(key.length===1&&key>=' '){value+=key;process.stdout.write('*')}};
    process.stdin.on('data',onData);
  });
}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const password=await secret('test1234 계정 비밀번호 (4자 이상): ');
if(password.length<4)throw Error('비밀번호는 4자 이상으로 입력해 주세요.');
const confirm=await secret('비밀번호 다시 입력: ');
if(password!==confirm)throw Error('비밀번호가 일치하지 않습니다.');
const db=openUserDb(root);
try{
  const existing=db.prepare('SELECT id FROM users WHERE login_id=?').get('test1234');
  if(existing)db.prepare('UPDATE users SET name=?,email=?,phone=?,password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run('홍길동','test1234@example.com','010-1234-5678',hashPassword(password),existing.id);
  else db.prepare('INSERT INTO users(login_id,email,name,phone,password_hash) VALUES(?,?,?,?,?)').run('test1234','test1234@example.com','홍길동','010-1234-5678',hashPassword(password));
  console.log('테스트 계정이 준비되었습니다: test1234 / 홍길동 / test1234@example.com / 010-1234-5678');
}finally{db.close()}
