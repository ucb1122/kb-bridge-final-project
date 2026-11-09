import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnv} from './server/config.js';
import {getRankings,getFilters,getRegionSummary,getRegionReport} from './server/data.js';
import {getRegionAnalysis} from './server/analysis.js';
import {resolvePublicFile} from './static-files.js';
import {getWalkingRoute} from './server/walking-route.js';
import {openUserDb,hashPassword,verifyPassword,publicUser,createSession,currentUser,revokeSession,sessionCookie} from './server/auth.js';
import {randomBytes} from 'node:crypto';
import {handleChat} from './server/chat/index.js';
import {saveConsultationRequest} from './server/consultation-request.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
loadEnv(root);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.geojson':'application/geo+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf','.pdf':'application/pdf'};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function readJson(req){
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw Error('요청 크기가 너무 큽니다.')}
  try{return JSON.parse(raw)}catch{throw Error('요청 형식이 올바르지 않습니다.')}
}
function authResponse(res,status,data,cookie){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})});res.end(JSON.stringify(data))}
function localDemoRequest(req){return process.env.NODE_ENV!=='production'&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)}
export async function handleRequest(req,res){
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/deployment')return json(res,200,{publicDemo:process.env.PUBLIC_DEMO==='1',login:process.env.PUBLIC_DEMO!=='1',bankConnected:false});
    if(process.env.PUBLIC_DEMO==='1'){
      if(url.pathname==='/api/auth/me')return json(res,200,{user:null,publicDemo:true});
      if(url.pathname.startsWith('/api/auth/')||url.pathname==='/api/consultation-requests')return json(res,503,{error:'공개 시연본에서는 로그인과 상담 서버 저장을 제공하지 않습니다. 상담서는 PDF로 저장할 수 있으며 은행에는 전송되지 않습니다.'});
    }
    if(url.pathname==='/api/chat')return await handleChat(req,res,root);
    if(url.pathname==='/api/consultation-requests'&&req.method==='POST'){
      if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'허용되지 않은 요청입니다.'});
      const db=openUserDb(root);
      try{
        const user=currentUser(db,req.headers.cookie);
        if(!user)return json(res,401,{error:'로그인 후 상담서를 저장해 주세요.'});
        const saved=saveConsultationRequest(db,root,user,await readJson(req));
        return json(res,201,saved);
      }catch(error){return json(res,error.status||400,{error:error.message})}
      finally{db.close()}
    }
    if(url.pathname.startsWith('/api/auth/')){
      if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return authResponse(res,403,{error:'허용되지 않은 요청입니다.'});
      const db=openUserDb(root);
      try{
        if(url.pathname==='/api/auth/me'&&req.method==='GET')return authResponse(res,200,{user:publicUser(currentUser(db,req.headers.cookie))});
        if(url.pathname==='/api/auth/login'&&req.method==='POST'){
          const body=await readJson(req),loginId=String(body.loginId||'').trim(),password=String(body.password||'');
          if(loginId.length>100||password.length>1024)return authResponse(res,400,{error:'입력값을 확인해 주세요.'});
          const user=db.prepare('SELECT * FROM users WHERE login_id=? OR email=?').get(loginId,loginId);
          if(!user||!verifyPassword(password,user.password_hash))return authResponse(res,401,{error:'아이디 또는 비밀번호를 확인해 주세요.'});
          const session=createSession(db,user.id);
          return authResponse(res,200,{user:publicUser(user)},sessionCookie(session.token,Boolean(req.socket.encrypted),body.remember==='on'));
        }
        if(url.pathname==='/api/auth/demo-login'&&req.method==='POST'){
          if(!localDemoRequest(req))return authResponse(res,403,{error:'로컬 시연 환경에서만 사용할 수 있습니다.'});
          let user=db.prepare('SELECT * FROM users WHERE login_id=?').get('test1234');
          if(!user){
            db.prepare('INSERT INTO users(login_id,email,name,phone,password_hash) VALUES(?,?,?,?,?)').run('test1234','test1234@example.com','홍길동','010-1234-5678',hashPassword(randomBytes(32).toString('hex')));
            user=db.prepare('SELECT * FROM users WHERE login_id=?').get('test1234');
          }
          const session=createSession(db,user.id);
          return authResponse(res,200,{user:publicUser(user)},sessionCookie(session.token,Boolean(req.socket.encrypted),true));
        }
        if(url.pathname==='/api/auth/logout'&&req.method==='POST'){
          revokeSession(db,req.headers.cookie);
          return authResponse(res,200,{ok:true},'bridge_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
        }
        return authResponse(res,404,{error:'API를 찾을 수 없습니다.'});
      }finally{db.close()}
    }
    if(url.pathname==='/api/rising/map-config'){
      loadEnv(root);
      return json(res,200,{kakaoJavaScriptKey:process.env.KAKAO_MAP_JAVASCRIPT_KEY||'',publicDemo:process.env.PUBLIC_DEMO==='1'});
    }
    if(url.pathname==='/api/rankings')return json(res,200,getRankings(Object.fromEntries(url.searchParams)));
    if(url.pathname==='/api/filters')return json(res,200,getFilters());
    if(url.pathname==='/api/rising/summary')return json(res,200,getRegionSummary(Object.fromEntries(url.searchParams)));
    if(url.pathname==='/api/rising/report')return json(res,200,getRegionReport(Object.fromEntries(url.searchParams)));
    if(url.pathname==='/api/rising/analysis')return json(res,200,await getRegionAnalysis(Object.fromEntries(url.searchParams)));
    if(url.pathname==='/api/owner/walking-route'){
      const kind=url.searchParams.get('kind'),code=url.searchParams.get('code'),quarter=url.searchParams.get('quarter'),industry=url.searchParams.get('industry')||'all',branchId=url.searchParams.get('branchId');
      if(!['area','dong'].includes(kind)||!/^\d{5,12}$/.test(code||'')||!/^20\d{2}[1-4]$/.test(quarter||'')||!/^\d{1,12}$/.test(branchId||''))return json(res,400,{error:'경로 조회 조건이 올바르지 않습니다.'});
      const region=getRegionReport({kind,code,quarter,industry});
      const banks=JSON.parse(await fs.readFile(path.join(root,'frontend/shared/finance/kb-branches.json'),'utf8'));
      const branch=banks.branches.find(item=>item.id===branchId);
      if(!branch||!Number.isFinite(region?.lat)||!Number.isFinite(region?.lng))return json(res,404,{error:'선택한 지역이나 영업점을 찾지 못했습니다.'});
      loadEnv(root);
      if(!process.env.KAKAO_REST_API_KEY)return json(res,503,{error:'카카오 도보 경로 조회 키가 설정되지 않았습니다.'});
      try{return json(res,200,await getWalkingRoute({origin:region,branch,key:process.env.KAKAO_REST_API_KEY}))}
      catch(error){return json(res,502,{error:`도보 경로를 불러오지 못했습니다. ${error.message}`})}
    }
    if(url.pathname==='/api/rising/boundaries'){
      const kind=url.searchParams.get('kind');
      if(kind!=='area'&&kind!=='dong')return json(res,400,{error:'잘못된 지역 유형입니다.'});
      const file=path.join(root,kind==='dong'?'data/commerce-dong.geojson':'data/commerce.geojson');
      const content=await fs.readFile(file);
      res.writeHead(200,{'Content-Type':'application/geo+json; charset=utf-8'});return res.end(content);
    }
    if(url.pathname.startsWith('/api/'))return json(res,404,{error:'API를 찾을 수 없습니다.'});
    const file=resolvePublicFile(root,url.pathname);
    if(!file)return json(res,403,{error:'접근할 수 없습니다.'});
    const content=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(content);
  }catch(error){json(res,error.code==='ENOENT'?404:400,{error:error.message})}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))http.createServer(handleRequest).listen(Number(process.env.PORT||5173),()=>console.log(`http://localhost:${process.env.PORT||5173}`));
