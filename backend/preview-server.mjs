import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../frontend/',import.meta.url)));
const port=Number(process.env.PORT||5174);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.woff2':'font/woff2','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),route=decodeURIComponent(url.pathname==='/'?'/pages/intended-owner/':url.pathname);
  if(!(/^\/pages\/(intended-owner|guide)\//.test(route)||/^\/shared\/(finance\/|kb-favicon\.png$|kb-bank-brand-source\.png$)/.test(route))||/\/(analysis|sources|tools)\//.test(route))throw Error('대상 페이지의 화면 자산만 제공합니다.');
  const file=path.resolve(root,'.'+(route.endsWith('/')?route+'index.html':route));
  if(!file.startsWith(root+path.sep)||path.basename(file).startsWith('.'))throw Error('허용되지 않은 경로');
  const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(bytes);
 }catch(error){res.writeHead(error.code==='ENOENT'?404:400,{'Content-Type':'text/plain; charset=utf-8'});res.end(error.message);}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`포트 ${port}가 사용 중입니다. 이미 실행된 http://localhost:${port}/pages/intended-owner/ 를 확인하거나 PORT를 바꿔 실행하세요.`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`두 페이지 실행: http://localhost:${port}/pages/intended-owner/ | /pages/guide/`));
