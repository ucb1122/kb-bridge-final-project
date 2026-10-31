import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnv} from './server/config.js';
import {getRankings,getFilters,getRegionSummary,getRegionReport} from './server/data.js';
import {getRegionAnalysis} from './server/analysis.js';
import {resolvePublicFile} from './static-files.js';
import {getWalkingRoute} from './server/walking-route.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
loadEnv(root);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.geojson':'application/geo+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf','.pdf':'application/pdf'};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))}
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/rising/map-config'){
      loadEnv(root);
      return json(res,200,{kakaoJavaScriptKey:process.env.KAKAO_MAP_JAVASCRIPT_KEY||''});
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
}).listen(Number(process.env.PORT||5173),()=>console.log(`http://localhost:${process.env.PORT||5173}`));
