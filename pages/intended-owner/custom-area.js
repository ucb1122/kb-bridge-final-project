import {loadBusinesses} from '../owner/business-data.js';
import {makeAnalysisContext} from '../owner/consultation-data.js';
import {selectBusinesses,validPolygon,polygonArea} from '../owner/analysis.js';
import {matchesIndustry,groupFor} from '../owner/industry-catalog.js';
import {searchAreas,resolveMarkets} from '../owner/market-selection.js';
import {licenseToOfficial} from '../owner/regional.js';
import {buildReports} from '../owner/reports.js';
/** Optional original location/radius/polygon analysis retained below the regional rankings. */
export function attachCustomArea(view,getContext,onReports,status){
 const $=id=>document.getElementById(id),layer=L.layerGroup().addTo(view.map),preview=L.layerGroup().addTo(view.map);let rows,loading,point,geometry,draw=false,vertices=[],marker,lastContext;
 async function load(){return rows||(loading??=loadBusinesses().then(data=>rows=data));}
 function select(p){point={...p};geometry=null;layer.clearLayers();preview.clearLayers();marker?.remove();marker=L.marker([p.lat,p.lng]).addTo(view.map).bindPopup(document.createTextNode(p.name));view.map.setView([p.lat,p.lng],16);$('custom-location').textContent=p.name;$('custom-pick').checked=false;status('분석 반경을 적용하거나 다각형을 그려주세요.');}
 $('custom-search-form').onsubmit=async e=>{e.preventDefault();try{const {data,geo}=getContext();const found=searchAreas(data,geo,[],$('custom-search').value.trim()).slice(0,15);$('custom-results').replaceChildren();for(const p of found){const b=document.createElement('button');b.type='button';b.textContent=p.name+' · '+p.address;b.onclick=()=>select(p);$('custom-results').append(b);}status(found.length?'검색 결과에서 분석 위치를 선택하세요.':'공식 상권 검색 결과가 없습니다.');}catch(e){status(e.message);}};
 view.map.on('click',e=>{if(draw){vertices.push([e.latlng.lng,e.latlng.lat]);preview.clearLayers();if(vertices.length)L.polyline(vertices.map(([x,y])=>[y,x]),{color:'#dfa400'}).addTo(preview);$('custom-draw-count').textContent=vertices.length+'개 꼭짓점';}else if($('custom-pick').checked)select({...e.latlng,name:'지도 선택 위치'});});
 $('custom-draw').onclick=()=>{if(!point){status('점포 위치를 먼저 선택하세요.');return;}draw=true;vertices=[];preview.clearLayers();$('custom-draw-controls').hidden=false;view.map.doubleClickZoom.disable();status('지도에 꼭짓점을 3개 이상 찍고 그리기 완료를 누르세요.');};
 function stop(){draw=false;view.map.doubleClickZoom.enable();$('custom-draw-controls').hidden=true;}
 $('custom-cancel').onclick=()=>{stop();preview.clearLayers();vertices=[];};
 $('custom-finish').onclick=()=>{if(!validPolygon(vertices)){status('교차하지 않는 점 3개 이상으로 다각형을 완성하세요.');return;}geometry={type:'Polygon',coordinates:[[...vertices,vertices[0]]]};stop();preview.clearLayers();layer.clearLayers();L.geoJSON(geometry,{style:{color:'#dfa400',fillOpacity:.25}}).addTo(layer);status('다각형을 적용했습니다. 선택영역 분석을 누르세요.');};
 $('custom-radius-apply').onclick=()=>{if(!point){status('점포 위치를 먼저 선택하세요.');return;}const radius=Number($('custom-radius').value);if(!(radius>=50&&radius<=3000)){status('반경은 50~3,000m입니다.');return;}stop();geometry=null;preview.clearLayers();layer.clearLayers();const c=L.circle([point.lat,point.lng],{radius,color:'#dfa400',fillOpacity:.25}).addTo(layer);view.map.fitBounds(c.getBounds(),{padding:[80,80]});status('반경 '+radius+'m를 적용했습니다.');};
 $('custom-analyze').onclick=async()=>{if(!point){status('점포 위치를 먼저 선택하세요.');return;}if(draw){status('다각형을 먼저 완성하세요.');return;}try{await load();const {industry,data,geo}=getContext(),radius=Number($('custom-radius').value);if(!geometry&&!(radius>=50&&radius<=3000)){status('반경은 50~3,000m입니다.');return;}if(!geometry){layer.clearLayers();L.circle([point.lat,point.lng],{radius,color:'#dfa400',fillOpacity:.25}).addTo(layer);}
 const all=selectBusinesses(rows,geometry?{geometry}:{center:point,radius}),id=Object.keys(licenseToOfficial).find(k=>licenseToOfficial[k]===industry.code),selected=id?all.filter(p=>matchesIndustry(p,id)):industry.code==='all'?all:['food','service','retail'].includes(industry.code)?all.filter(p=>groupFor(p).category==={food:'외식업',service:'서비스업',retail:'소매업'}[industry.code]):[];
 const market=(point.marketCode&&data.areas[point.marketCode])||resolveMarkets(point,data,geo.features,industry)[0];
 const area=geometry?{label:'다각형',kind:'polygon',geometry,area:polygonArea(geometry.coordinates[0])}:{label:'반경 '+radius+'m',kind:'radius',radius,area:Math.PI*radius**2};
 const context={location:point,industry,area,regional:data,market,license:id||['all','food','service','retail'].includes(industry.code)?{selected:selected.length,total:all.length,snapshot:'2026-10-22'}:null};lastContext=makeAnalysisContext({...context,mode:'founder'});const reports=buildReports(context);
 onReports(reports,{...point,name:point.name},area);status('직접 선택한 영역으로 분석했습니다.');
 }catch(e){status(e.message);}};
 return {get context(){return lastContext;},get active(){return draw||$('custom-pick').checked;},async restore(saved){select(saved.location);$('custom-radius').value=saved.area.radius||500;geometry=saved.area.kind==='polygon'?saved.area.geometry:null;if(geometry)L.geoJSON(geometry,{style:{color:'#dfa400',fillOpacity:.25}}).addTo(layer);await $('custom-analyze').onclick();},reset(){stop();point=null;geometry=null;lastContext=null;vertices=[];layer.clearLayers();preview.clearLayers();marker?.remove();$('custom-pick').checked=false;$('custom-location').textContent='위치를 선택해 주세요.';$('custom-results').replaceChildren();}};
}
