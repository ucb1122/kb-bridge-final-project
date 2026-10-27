import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnv} from './server/config.js';
import {getRankings,getFilters,getRegionSummary,getRegionReport} from './server/data.js';
import {getRegionAnalysis} from './server/analysis.js';
const root=path.dirname(fileURLToPath(import.meta.url));
loadEnv(root);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.geojson':'application/geo+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf','.pdf':'application/pdf'};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))}
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/rising/map-config')return json(res,200,{kakaoJavaScriptKey:process.env.KAKAO_MAP_JAVASCRIPT_KEY||''});
    if(url.pathname==='/api/rankings')return json(res,200,getRankings(Object.fromEntries(url.searchParams)));
    if(url.pathname==='/api/filters')return json(res,200,getFilters());
    if(url.pathname==='/api/rising/summary')return json(res,200,getRegionSummary(Object.fromEntries(url.searchParams)));
    if(url.pathname==='/api/rising/report')return json(res,200,getRegionReport(Object.fromEntries(url.searchParams)));
    if(url.pathname==='/api/rising/analysis')return json(res,200,await getRegionAnalysis(Object.fromEntries(url.searchParams)));
    if(url.pathname==='/api/rising/boundaries'){
      const kind=url.searchParams.get('kind');
      if(kind!=='area'&&kind!=='dong')return json(res,400,{error:'잘못된 지역 유형입니다.'});
      const file=path.join(root,kind==='dong'?'data/commerce-dong.geojson':'data/commerce.geojson');
      const content=await fs.readFile(file);
      res.writeHead(200,{'Content-Type':'application/geo+json; charset=utf-8'});return res.end(content);
    }
    if(url.pathname.startsWith('/api/'))return json(res,404,{error:'API를 찾을 수 없습니다.'});
    const requested=decodeURIComponent(url.pathname==='/'?'/pages/rising/index.html':url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname);
    const file=path.resolve(root,'.'+requested);
    if(!file.startsWith(root+path.sep)||file.includes(`${path.sep}data${path.sep}`)||file.includes(`${path.sep}server${path.sep}`)||path.basename(file).startsWith('.'))return json(res,403,{error:'접근할 수 없습니다.'});
    const content=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(content);
  }catch(error){json(res,error.code==='ENOENT'?404:400,{error:error.message})}
}).listen(Number(process.env.PORT||5173),()=>console.log(`http://localhost:${process.env.PORT||5173}`));
