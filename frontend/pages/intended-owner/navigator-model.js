export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const regionKey=region=>region.kind+':'+region.code;
export function pointInGeometry(point,geometry){
 function ringContains(ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [xi,yi]=ring[i],[xj,yj]=ring[j],[x,y]=point;
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
 }return inside;}
 function polygonContains(polygon){return polygon.length>0&&ringContains(polygon[0])&&!polygon.slice(1).some(ringContains);}
 if(!geometry||!Array.isArray(point)||!point.every(Number.isFinite))return false;
 return geometry.type==='Polygon'?polygonContains(geometry.coordinates):geometry.type==='MultiPolygon'&&geometry.coordinates.some(polygonContains);
}
export function filterRegions(regions,{kind='area',district='',query='',heat='all',classifications=new Map()}={}){
 const words=query.trim().toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean);
 return regions.filter(region=>region.kind===kind&&(!district||region.district===district)&&words.every(word=>(region.name+' '+region.district+' '+(region.dong||'')).toLocaleLowerCase('ko-KR').includes(word))&&(heat==='all'||(classifications.get(String(region.code))?.classification||'unknown')===heat)).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
}
export function cashflowBars(before,after){
 if(!Number.isFinite(before)||!Number.isFinite(after))return '';
 const low=Math.min(0,before,after),high=Math.max(0,before,after),span=high-low||1;
 const min=low<0?low-span*.15:0,max=high>0?high+span*.2:span*.15;
 const y=value=>170-(value-min)/(max-min)*140;
 const zero=y(0),fmt=value=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(value);
 let svg='<svg viewBox="0 0 520 220" role="img" aria-label="현재 '+escapeHTML(fmt(before))+'만원, 조건 변경 후 '+escapeHTML(fmt(after))+'만원"><text x="8" y="17" fill="#758399" font-size="11">단위: 만원</text>';
 for(let i=0;i<4;i++){const value=min+(max-min)*i/3,yy=y(value);svg+=`<line x1="55" x2="505" y1="${yy}" y2="${yy}" stroke="#e8edf3"/><text x="47" y="${yy+4}" text-anchor="end" fill="#7d8aa0" font-size="10">${escapeHTML(fmt(value))}</text>`;}
 svg+=`<line x1="55" x2="505" y1="${zero}" y2="${zero}" stroke="#aeb9c9"/>`;
 for(const [i,value]of[before,after].entries()){const xx=125+i*215,yy=y(value),top=Math.min(zero,yy),height=Math.max(Math.abs(zero-yy),1);svg+=`<rect x="${xx}" y="${top}" width="100" height="${height}" rx="3" fill="${i?'#ffbc00':'#bacbdc'}"/><text x="${xx+50}" y="${value>=0?top-9:top+height+17}" text-anchor="middle" fill="#162239" font-size="17" font-weight="700">${escapeHTML(fmt(value))}</text><text x="${xx+50}" y="208" text-anchor="middle" fill="#3e506c" font-size="13">${i?'조건 변경 후':'현재'}</text>`;}
 return svg+'</svg>';
}
