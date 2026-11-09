import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
test('공개 시연본은 로그인·상담 저장을 차단하고 실제 접수로 표시하지 않는다',async()=>{
 process.env.PUBLIC_DEMO='1';
 const previousKey=process.env.KAKAO_MAP_JAVASCRIPT_KEY;
 process.env.KAKAO_MAP_JAVASCRIPT_KEY='public-sdk-test-key';
 const {handleRequest}=await import('../backend/server.js');
 const request=async(url,method='GET')=>{let status,body='';const req=Readable.from([]);Object.assign(req,{url,method,headers:{host:'localhost'},socket:{remoteAddress:'127.0.0.1'}});const res={writeHead(code){status=code},end(value){body+=value||''}};await handleRequest(req,res);return {status,json:()=>JSON.parse(body)}};
 try{
  let r=await request('/api/auth/me');assert.deepEqual(r.json(),{user:null,publicDemo:true});
  for(const endpoint of ['/api/auth/login','/api/auth/demo-login','/api/consultation-requests']){
   r=await request(endpoint,'POST');
   assert.equal(r.status,503);assert.match(r.json().error,/은행에는 전송되지/);
  }
  r=await request('/api/rising/map-config');const map=r.json();assert.equal(map.kakaoJavaScriptKey,'public-sdk-test-key');assert.equal(map.publicDemo,true);
  r=await request('/api/deployment');assert.equal(r.json().bankConnected,false);
 }finally{delete process.env.PUBLIC_DEMO;if(previousKey===undefined)delete process.env.KAKAO_MAP_JAVASCRIPT_KEY;else process.env.KAKAO_MAP_JAVASCRIPT_KEY=previousKey;}
});
