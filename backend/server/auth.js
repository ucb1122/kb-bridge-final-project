import {DatabaseSync} from 'node:sqlite';
import {randomBytes,scryptSync,createHash,timingSafeEqual} from 'node:crypto';
import path from 'node:path';

const SESSION_DAYS=7;
const hashToken=value=>createHash('sha256').update(value).digest('hex');
export function openUserDb(root){
  const db=new DatabaseSync(path.join(root,'data/users.sqlite'));
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, login_id TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL, phone TEXT, business_name TEXT, password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
  return db;
}
export function hashPassword(password){
  const salt=randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password,salt,64).toString('hex')}`;
}
export function verifyPassword(password,stored){
  const [method,salt,hex]=String(stored||'').split('$');
  if(method!=='scrypt'||!/^[a-f0-9]{32}$/.test(salt||'')||!/^[a-f0-9]{128}$/.test(hex||''))return false;
  const expected=Buffer.from(hex,'hex');
  return timingSafeEqual(scryptSync(password,salt,64),expected);
}
export function publicUser(user){return user&&{id:user.id,loginId:user.login_id,name:user.name,email:user.email,phone:user.phone,businessName:user.business_name}}
export function createSession(db,userId){
  const token=randomBytes(32).toString('base64url');
  const expiresAt=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hashToken(token),userId,expiresAt);
  db.prepare('UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?').run(userId);
  return {token,expiresAt};
}
export function currentUser(db,cookie){
  const token=/(?:^|;\s*)bridge_session=([^;]+)/.exec(cookie||'')?.[1];
  if(!token)return null;
  return db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(hashToken(token),new Date().toISOString())||null;
}
export function revokeSession(db,cookie){
  const token=/(?:^|;\s*)bridge_session=([^;]+)/.exec(cookie||'')?.[1];
  if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
}
export function sessionCookie(token,secure=false,remember=false){return `bridge_session=${token}; HttpOnly; SameSite=Lax; Path=/${remember?`; Max-Age=${SESSION_DAYS*86400}`:''}${secure?'; Secure':''}`}
