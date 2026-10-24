"""Interactive Kakao rank map for the Streamlit rising-area page."""
from __future__ import annotations

import streamlit as st

_MAP = st.components.v2.component(
    "kb_bridge_rising_map",
    html="<div id='kb-map'><div id='kb-map-status'>지도를 불러오는 중…</div></div>",
    css="""
#kb-map {position:relative;width:100%;height:100%;min-height:390px;border:1px solid #e9e6de;border-radius:14px;overflow:hidden;background:#f5f3ee}
#kb-map-status {position:absolute;z-index:2;top:16px;left:min(430px,35vw);max-width:400px;line-height:1.45;padding:9px 13px;border-radius:8px;background:white;color:#344054;font:13px sans-serif;box-shadow:0 2px 10px #0002}
.kb-rank-marker {display:grid;place-items:center;min-width:66px;max-width:130px;padding:8px 10px;border:2px solid #fff;border-radius:14px;background:#ffbf00;color:#101624;box-shadow:0 3px 12px #0004;font:600 12px sans-serif;cursor:pointer;text-align:center}
.kb-rank-marker strong {font-size:16px}
.kb-rank-marker span {display:block;max-width:105px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-rank-marker.active {background:#101624;color:white;z-index:10}
""",
    js="""
let map, mapRoot=null, overlays=[], polygons=[], loadedKey=null;
function loadKakao(key) {
  if (window.kakao?.maps) return Promise.resolve();
  if (!key) return Promise.reject(new Error('카카오 지도 JavaScript 키가 없습니다.'));
  if (!window.__kbKakaoLoading) window.__kbKakaoLoading = new Promise((resolve,reject) => {
    const script=document.createElement('script');
    script.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey='+encodeURIComponent(key);
    script.onload=()=>window.kakao.maps.load(resolve);
    script.onerror=()=>reject(new Error('카카오 지도 인증에 실패했습니다. Kakao Developers 앱의 Web 사이트 도메인에 http://localhost:8501 을 등록한 뒤 새로고침하세요.'));
    document.head.appendChild(script);
  });
  return window.__kbKakaoLoading;
}
function paths(geometry) {
  const rings=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
  return rings.map(poly=>poly[0].map(([lng,lat])=>new kakao.maps.LatLng(lat,lng)));
}
function renderBoundaryFallback(root, data, setTriggerValue) {
  root.querySelectorAll('.kb-fallback').forEach(el=>el.remove());
  const width=1200, height=750;
  const districts=data.fallback_districts||[];
  const coordinateSets=[];
  const polygons=(feature)=>feature.geometry?.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry?.type==='MultiPolygon'?feature.geometry.coordinates:[];
  for(const feature of districts) for(const polygon of polygons(feature)) for(const point of polygon[0]) coordinateSets.push(point);
  if (!coordinateSets.length) return;
  const longitudes=coordinateSets.map(p=>p[0]), latitudes=coordinateSets.map(p=>p[1]);
  const minLng=Math.min(...longitudes), maxLng=Math.max(...longitudes);
  const minLat=Math.min(...latitudes), maxLat=Math.max(...latitudes);
  const span=Math.max((maxLng-minLng)*.85,maxLat-minLat);
  const centerLng=(minLng+maxLng)/2, centerLat=(minLat+maxLat)/2;
  const x=lng=>width/2+(lng-centerLng)/span*height;
  const y=lat=>height/2-(lat-centerLat)/span*height;
  const ns='http://www.w3.org/2000/svg';
  const fallback=document.createElement('div');fallback.className='kb-fallback';
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio','xMidYMid meet');
  Object.assign(svg.style,{position:'absolute',inset:'0',width:'100%',height:'100%',background:'#eef0ed'});
  const draw=(feature,top)=>{
    for(const polygon of polygons(feature)) {
      const ring=polygon[0];if(!ring?.length)continue;
      const path=document.createElementNS(ns,'path');
      path.setAttribute('d',ring.map(([lng,lat],i)=>`${i?'L':'M'}${x(lng).toFixed(1)} ${y(lat).toFixed(1)}`).join(' ')+' Z');
      path.setAttribute('fill',top?'#ffe4a1':'#f8f8f5');
      path.setAttribute('stroke',top?'#d49a00':'#cfd4d0');
      path.setAttribute('stroke-width',top?'2.5':'1.3');
      if(top){path.style.cursor='pointer';path.onclick=()=>setTriggerValue('selected',String(feature.properties.code));}
      svg.appendChild(path);
    }
  };
  districts.forEach(f=>draw(f,false));
  (data.boundaries||[]).forEach(f=>draw(f,true));
  fallback.appendChild(svg);
  (data.rows||[]).forEach((row,index)=>{
    if(!Number.isFinite(row.lat)||!Number.isFinite(row.lng))return;
    const marker=document.createElement('button');marker.type='button';
    marker.className='kb-rank-marker'+(row.code===data.selected?' active':'');
    marker.textContent=`${index+1} ${row.name}`;
    marker.setAttribute('aria-label',`${index+1}위 ${row.district} ${row.name}`);
    Object.assign(marker.style,{position:'absolute',left:`${x(row.lng)/width*100}%`,top:`${y(row.lat)/height*100}%`,transform:'translate(-50%,-50%)',zIndex:String(30-index)});
    marker.onclick=()=>setTriggerValue('selected',String(row.code));
    fallback.appendChild(marker);
  });
  Object.assign(fallback.style,{position:'absolute',inset:'0',overflow:'hidden'});
  root.prepend(fallback);
}
export default async function(component) {
  const {data,parentElement,setTriggerValue}=component;
  const root=parentElement.querySelector('#kb-map');
  const status=parentElement.querySelector('#kb-map-status');
  if (!root) return;
  root.style.height=`${data.height||590}px`;
  try {
    await loadKakao(data.key);
    root.querySelectorAll('.kb-fallback').forEach(el=>el.remove());
    status.textContent=data.source==='official'?'서울시 기본 순위':'공개 원본 계산 순위';
    if (!map || mapRoot!==root || loadedKey!==data.key) {
      root.querySelectorAll('.kb-map-inner').forEach(el=>el.remove());
      const inner=document.createElement('div'); inner.className='kb-map-inner';
      Object.assign(inner.style,{position:'absolute',inset:'0'}); root.prepend(inner);
      map=new kakao.maps.Map(inner,{center:new kakao.maps.LatLng(37.5665,126.9780),level:9});
      loadedKey=data.key; mapRoot=root;
    }
    overlays.forEach(o=>o.setMap(null)); overlays=[];
    polygons.forEach(p=>p.setMap(null)); polygons=[];
    for (const feature of data.boundaries||[]) {
      for (const path of paths(feature.geometry)) {
        const polygon=new kakao.maps.Polygon({path,strokeWeight:2,strokeColor:'#B8953B',strokeOpacity:.6,fillColor:'#FFCB45',fillOpacity:.06});
        polygon.setMap(map); polygons.push(polygon);
        kakao.maps.event.addListener(polygon,'mouseover',()=>polygon.setOptions({fillOpacity:.2,strokeWeight:3}));
        kakao.maps.event.addListener(polygon,'mouseout',()=>polygon.setOptions({fillOpacity:.06,strokeWeight:2}));
        kakao.maps.event.addListener(polygon,'click',()=>setTriggerValue('selected',String(feature.properties.code)));
      }
    }
    if (data.radius && data.rows?.length === 1) {
      const row=data.rows[0];
      const circle=new kakao.maps.Circle({center:new kakao.maps.LatLng(row.lat,row.lng),radius:data.radius,strokeWeight:2,strokeColor:'#D49A00',strokeOpacity:.9,fillColor:'#FFCB45',fillOpacity:.12});
      circle.setMap(map);polygons.push(circle);
    }
    (data.rows||[]).forEach((row,index)=>{
      if (!Number.isFinite(row.lat)||!Number.isFinite(row.lng)) return;
      const marker=document.createElement('button'); marker.type='button';
      marker.className='kb-rank-marker'+(row.code===data.selected?' active':'');
      marker.setAttribute('aria-label',`${index+1}위 ${row.district} ${row.name}`);
      const rank=document.createElement('strong');rank.textContent=String(index+1);
      const name=document.createElement('span');name.textContent=row.name;
      marker.append(rank,name);
      marker.onclick=()=>setTriggerValue('selected',String(row.code));
      const overlay=new kakao.maps.CustomOverlay({position:new kakao.maps.LatLng(row.lat,row.lng),content:marker,yAnchor:.5,zIndex:100-index});
      overlay.setMap(map);overlays.push(overlay);
    });
    const selected=(data.rows||[]).find(r=>r.code===data.selected);
    if(selected && Number.isFinite(selected.lat) && Number.isFinite(selected.lng)) {map.setCenter(new kakao.maps.LatLng(selected.lat,selected.lng));map.setLevel(5)}
    else if(data.district && data.rows?.length) {map.setCenter(new kakao.maps.LatLng(data.rows[0].lat,data.rows[0].lng));map.setLevel(7)}
    else {map.setCenter(new kakao.maps.LatLng(37.5665,126.9780));map.setLevel(9)}
  } catch(error) {
    renderBoundaryFallback(root,data,setTriggerValue);
    status.textContent='카카오 지도 인증 전 · 서울시 경계 임시 보기. '+error.message;
  }
}
""",
)


def show_map(*, key: str | None, rows: list[dict], boundaries: list[dict], selected: str | None,
             source: str, district: str, radius: int | None = None, height: int = 590,
             fallback_districts: list[dict] | None = None) -> str | None:
    result = _MAP(key="rising-map", data={"key": key, "rows": rows, "boundaries": boundaries,
                                         "selected": selected, "source": source, "district": district, "radius": radius, "height": height,
                                         "fallback_districts": fallback_districts or []},
                  height=height, on_selected_change=lambda: None)
    return getattr(result, "selected", None)
