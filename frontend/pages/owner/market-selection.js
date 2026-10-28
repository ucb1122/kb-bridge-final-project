import {distance,inGeometry} from './analysis.js';
import {metricValue,licenseToOfficial} from './regional.js';
export const industryCode=industry=>industry?.code||industry?.officialCode||licenseToOfficial[industry?.id]||(industry?.id==='all'?'all':null);
export function resolveMarkets(point,regional,features,industry){
 const code=industryCode(industry)||'CS100010';
 const contained=features.filter(f=>inGeometry([point.lng,point.lat],f.geometry)).map(f=>regional.areas[String(f.properties.TRDAR_CD)]).filter(Boolean);
 return contained.sort((a,b)=>Number(metricValue(b,regional.quarter,code,'sales')!=null)-Number(metricValue(a,regional.quarter,code,'sales')!=null)||a.area-b.area);
}
export function searchAreas(regional,features,places,query,district='',type='all'){
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const match=text=>words.every(w=>text.toLowerCase().includes(w));
 const candidates=[];
 if(type!=='place')for(const a of Object.values(regional.areas))if((!district||a.district===district)&&match(a.name+' '+a.district+' '+a.dong))candidates.push({id:'market-'+a.code,name:a.name,address:a.district+' '+a.dong+' · '+a.type,lat:a.lat,lng:a.lng,district:a.district,marketCode:a.code,kind:'상권'});
 if(type!=='address'&&words.length)for(const p of places){
  if(!match(p.name+' '+p.address+' '+(p.context||''))||/은행|약국|카페|커피|치킨|식당|마트|편의점/.test(p.name))continue;
  if(!/(역(?:\s*\([^)]*\))?|역\s*\d+번출구|공원|호수(?:\s*[동서]호)?|학교|대학교|광장|시장|터미널|백화점|구청|주민센터|관광정보센터|도서관)$/.test(p.name)&&!/^롯데월드(?: 어드벤처|타워|몰)?$/.test(p.name)&&p.name!=='잠실광역환승센터'&&p.name!=='매직아일랜드')continue;
  const areas=resolveMarkets(p,regional,features,{code:'CS100010'}).filter(a=>!district||a.district===district);
  if(areas[0])candidates.push({...p,id:'place-'+p.id,address:areas[0].name+' · '+(p.address||areas[0].district),district:areas[0].district,marketCode:areas[0].code,kind:'주요 지역'});
 }
 const unique=new Map();for(const p of candidates){const key=p.kind+':'+p.name+':'+p.marketCode;if(!unique.has(key))unique.set(key,p);}
 return [...unique.values()].sort((a,b)=>Number(b.name===query)-Number(a.name===query)||Number(b.name.startsWith(query))-Number(a.name.startsWith(query))||a.name.localeCompare(b.name,'ko'));
}
export function nearbyMarkets(point,regional,features,industry){
 const contained=resolveMarkets(point,regional,features,industry),codes=new Set(contained.map(a=>a.code));
 return [...contained,...Object.values(regional.areas).filter(a=>!codes.has(a.code)&&distance(point,a)<1500).sort((a,b)=>distance(point,a)-distance(point,b)).slice(0,12)];
}
