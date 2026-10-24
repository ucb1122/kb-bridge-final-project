"""Interactive Kakao rank map for the Streamlit rising-area page."""
from __future__ import annotations

import streamlit as st

_MAP = st.components.v2.component(
    "kb_bridge_rising_map",
    html="<div id='kb-map'><div id='kb-map-status'>지도를 불러오는 중…</div></div>",
    css="""
#kb-map {position:relative;width:100%;height:100%;min-height:390px;border:0;border-radius:0;overflow:hidden;background:#f5f3ee}
#kb-map-status:empty {display:none}
#kb-map-status {position:absolute;z-index:5;top:16px;left:50%;transform:translateX(-50%);max-width:min(520px,90%);line-height:1.45;padding:9px 13px;border-radius:8px;background:white;color:#344054;font:13px sans-serif;box-shadow:0 2px 10px #0002}
.kb-rank-marker {position:relative;isolation:isolate;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;width:82px;height:86px;padding:0;border:0;background:transparent;color:#101624;font:700 11px 'Malgun Gothic',sans-serif;cursor:pointer;text-align:center;overflow:visible;filter:drop-shadow(0 2px 5px #3c331b55)}
.kb-rank-marker::before {content:"";position:absolute;z-index:-1;top:12px;left:4px;width:74px;height:74px;border-radius:50%;background:#efb900aa;pointer-events:none}
.kb-rank-marker::after {content:"";position:absolute;z-index:-2;top:12px;left:4px;width:74px;height:74px;border:2px solid #d59c00;border-radius:50%;pointer-events:none;animation:kb-rank-pulse 3.6s ease-out infinite}
.kb-rank-marker strong {position:relative;display:grid;place-items:center;width:29px;height:30px;background:#fff0bf;border:1px solid #af7f00;clip-path:polygon(0 0,100% 0,100% 100%,50% 82%,0 100%);color:#473200;font-size:14px;font-weight:800}
.kb-rank-marker span {position:relative;display:block;max-width:78px;width:73px;margin-top:-1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 2px;border-radius:3px;background:#f4b900;color:#101624}
.kb-rank-marker small {position:relative;display:block;width:67px;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 2px;border-radius:3px;background:#fff;color:#4d3900;font-size:10px}
.kb-rank-marker.active::before {background:#efb900e8}
.kb-rank-marker.active span {background:#ffca20}
.kb-rank-marker:hover::after,.kb-rank-marker:focus-visible::after {animation-duration:2.6s;border-color:#af7f00}
.kb-rank-marker:focus-visible {outline:2px solid #101624;outline-offset:5px}
@keyframes kb-rank-pulse {0%{transform:scale(1);opacity:.75}75%,100%{transform:scale(1.9);opacity:0}}
@media(prefers-reduced-motion:reduce){.kb-rank-marker::after{animation:none;transform:scale(1.15);opacity:.45}}

""",
    js="""
let map, mapRoot=null, overlays=[], polygons=[], loadedKey=null;
let kakaoResizeObserver=null, boundarySvg=null, boundaryDraw=null, boundaryPaths=[];
let rankLayer=null, rankMarkers=[], positionKakaoMarkers=null, redrawFrame=null, viewKey=null;
let fallbackMap=null, fallbackMarkers=[], fallbackResizeObserver=null;
let mapLibreLoading=null;
function loadKakao(key) {
  if (window.kakao?.maps) return Promise.resolve();
  if (!key) return Promise.reject(new Error('카카오 지도 JavaScript 키가 없습니다.'));
  if (!window.__kbKakaoLoading) window.__kbKakaoLoading = new Promise((resolve,reject) => {
    const script=document.createElement('script');
    script.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey='+encodeURIComponent(key);
    script.onload=()=>window.kakao.maps.load(resolve);
    script.onerror=()=>reject(new Error('카카오 지도 인증에 실패했습니다. Kakao Developers [앱] > [플랫폼 키] > [JavaScript 키] > [JavaScript SDK 도메인]에 http://localhost:8501 을 등록한 뒤 새로고침하세요.'));
    document.head.appendChild(script);
  });
  return window.__kbKakaoLoading;
}
function paths(geometry) {
  const rings=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
  return rings.map(poly=>poly[0].map(([lng,lat])=>new kakao.maps.LatLng(lat,lng)));
}
function drawKakaoBoundaries(root,map,features,setTriggerValue) {
  if (!boundarySvg) {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    Object.assign(svg.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'2',pointerEvents:'none'});
    for(const feature of features||[]) {
      for(const ring of paths(feature.geometry)) {
        if(ring.length<3)continue;
        const shape=document.createElementNS('http://www.w3.org/2000/svg','path');
        shape.setAttribute('fill','#f3c53a');shape.setAttribute('fill-opacity','.14');
        shape.setAttribute('stroke','#c59800');shape.setAttribute('stroke-width','2');
        shape.style.pointerEvents='visibleStroke';shape.style.cursor='pointer';
        shape.addEventListener('click',()=>setTriggerValue('selected',String(feature.properties.code)));
        svg.appendChild(shape);boundaryPaths.push({shape,ring});
      }
    }
    root.appendChild(svg);boundarySvg=svg;
  }
  boundarySvg.setAttribute('width',String(root.clientWidth));
  boundarySvg.setAttribute('height',String(root.clientHeight));
  const projection=map.getProjection();
  for(const {shape,ring} of boundaryPaths) {
    const points=ring.map(coord=>projection.containerPointFromCoords(coord));
    shape.setAttribute('d',points.map((point,index)=>`${index?'L':'M'}${point.x} ${point.y}`).join(' ')+' Z');
  }
}
function scheduleKakaoDecorations() {
  if(redrawFrame!==null)return;
  redrawFrame=requestAnimationFrame(()=>{
    redrawFrame=null;
    boundaryDraw?.();
    positionKakaoMarkers?.();
  });
}

function renderSvgFallback(root, data, setTriggerValue) {
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
    const rank=document.createElement('strong');rank.textContent=String(index+1);
    const name=document.createElement('span');name.textContent=row.name;
    const value=document.createElement('small');value.textContent=row.display||'';
    marker.append(rank,name,value);
    marker.setAttribute('aria-label',`${index+1}위 ${row.district} ${row.name}`);
    Object.assign(marker.style,{position:'absolute',left:`${x(row.lng)/width*100}%`,top:`${y(row.lat)/height*100}%`,transform:'translate(-50%,-50%)',zIndex:String(30-index)});
    marker.onclick=()=>setTriggerValue('selected',String(row.code));
    fallback.appendChild(marker);
  });
  Object.assign(fallback.style,{position:'absolute',inset:'0',overflow:'hidden'});
  root.prepend(fallback);
}
function loadMapLibre(root) {
  if (!root.getRootNode().querySelector?.('link[data-kb-maplibre]')) {
    const link=document.createElement('link');link.rel='stylesheet';
    link.href='/app/static/vendor/maplibre-gl.css';link.dataset.kbMaplibre='';
    root.getRootNode().appendChild(link);
  }
  if (window.maplibregl) return Promise.resolve();
  if (!mapLibreLoading) mapLibreLoading=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='/app/static/vendor/maplibre-gl.js';
    script.onload=()=>window.maplibregl?resolve():reject(new Error('MapLibre 로드 실패'));
    script.onerror=()=>reject(new Error('MapLibre 로드 실패'));
    document.head.appendChild(script);
  });
  return mapLibreLoading;
}
async function renderTileFallback(root,data,setTriggerValue) {
  await loadMapLibre(root);
  if(fallbackResizeObserver){fallbackResizeObserver.disconnect();fallbackResizeObserver=null;}
  if(fallbackMap){fallbackMap.remove();fallbackMap=null;}
  fallbackMarkers.forEach(marker=>marker.remove());fallbackMarkers=[];
  root.querySelectorAll('.kb-fallback').forEach(el=>el.remove());
  const inner=document.createElement('div');inner.className='kb-fallback';
  Object.assign(inner.style,{position:'absolute',inset:'0'});root.prepend(inner);
  const m=new maplibregl.Map({container:inner,style:'https://tiles.openfreemap.org/styles/bright',
    center:[126.978,37.5665],zoom:10,attributionControl:true});
  fallbackMap=m;
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('지도 타일 로드 시간 초과')),12000);
      m.once('load',()=>{clearTimeout(timer);resolve();});
      m.once('error',event=>{if(!m.loaded()){clearTimeout(timer);reject(event.error||new Error('지도 타일 로드 실패'));}});
    });
    m.resize();
    fallbackResizeObserver=new ResizeObserver(()=>m.resize());
    fallbackResizeObserver.observe(inner);
    requestAnimationFrame(()=>{
      m.resize();
      if(!data.selected&&!data.district)m.fitBounds([[126.76,37.41],[127.22,37.71]],{padding:24,duration:0});
    });
    const collection=features=>({type:'FeatureCollection',features:features||[]});
    m.addSource('kb-districts',{type:'geojson',data:collection(data.fallback_districts)});
    m.addLayer({id:'kb-district-line',type:'line',source:'kb-districts',paint:{'line-color':'#b4bcb0','line-width':1}});
    m.addSource('kb-rank-areas',{type:'geojson',data:collection(data.boundaries)});
    m.addLayer({id:'kb-rank-fill',type:'fill',source:'kb-rank-areas',paint:{'fill-color':'#ffbf00','fill-opacity':.14}});
    m.addLayer({id:'kb-rank-line',type:'line',source:'kb-rank-areas',paint:{'line-color':'#c59600','line-width':2}});
    m.on('click','kb-rank-fill',event=>{
      const code=event.features?.[0]?.properties?.code;
      if(code!=null)setTriggerValue('selected',String(code));
    });
    (data.rows||[]).forEach((row,index)=>{
      if(!Number.isFinite(row.lat)||!Number.isFinite(row.lng))return;
      const marker=document.createElement('button');marker.type='button';
      marker.className='kb-rank-marker'+(row.code===data.selected?' active':'');
      marker.setAttribute('aria-label',`${index+1}위 ${row.district} ${row.name}`);
      const rank=document.createElement('strong');rank.textContent=String(index+1);
      const name=document.createElement('span');name.textContent=row.name;
      const value=document.createElement('small');value.textContent=row.display||'';
      marker.append(rank,name,value);
      marker.onclick=()=>setTriggerValue('selected',String(row.code));
      fallbackMarkers.push(new maplibregl.Marker({element:marker,anchor:'center'}).setLngLat([row.lng,row.lat]).addTo(m));
    });
    const selected=(data.rows||[]).find(row=>row.code===data.selected);
    if(selected)m.flyTo({center:[selected.lng,selected.lat],zoom:12});
    else if(data.district&&data.rows?.length)m.flyTo({center:[data.rows[0].lng,data.rows[0].lat],zoom:11});
  } catch(error) {
    if(fallbackResizeObserver){fallbackResizeObserver.disconnect();fallbackResizeObserver=null;}
    m.remove();fallbackMap=null;inner.remove();throw error;
  }
}
export default async function(component) {
  const {data,parentElement,setTriggerValue}=component;
  const root=parentElement.querySelector('#kb-map');
  const status=parentElement.querySelector('#kb-map-status');
  if (!root) return;
  root.style.height=`${data.height||590}px`;
  try {
    await loadKakao(data.key);
    if(fallbackResizeObserver){fallbackResizeObserver.disconnect();fallbackResizeObserver=null;}
    if(fallbackMap){fallbackMap.remove();fallbackMap=null;}
    fallbackMarkers.forEach(marker=>marker.remove());fallbackMarkers=[];
    root.querySelectorAll('.kb-fallback').forEach(el=>el.remove());
    if (!map || mapRoot!==root || loadedKey!==data.key) {
      if(kakaoResizeObserver){kakaoResizeObserver.disconnect();kakaoResizeObserver=null;}
      root.querySelectorAll('.kb-map-inner').forEach(el=>el.remove());
      const inner=document.createElement('div'); inner.className='kb-map-inner';
      Object.assign(inner.style,{position:'absolute',inset:'0'}); root.prepend(inner);
      map=new kakao.maps.Map(inner,{center:new kakao.maps.LatLng(37.5665,126.9780),level:9});
      loadedKey=data.key; mapRoot=root; viewKey=null;
      kakaoResizeObserver=new ResizeObserver(()=>{map.relayout();scheduleKakaoDecorations();});
      kakaoResizeObserver.observe(inner);
      for(const event of ['center_changed','zoom_changed','drag','idle'])
        kakao.maps.event.addListener(map,event,scheduleKakaoDecorations);
    }
    status.textContent='';
    overlays.forEach(o=>o.setMap(null)); overlays=[];
    polygons.forEach(p=>p.setMap(null)); polygons=[];
    if(boundarySvg){boundarySvg.remove();boundarySvg=null;}boundaryPaths=[];
    if(rankLayer){rankLayer.remove();rankLayer=null;}rankMarkers=[];
    let boundaryError=null, markerErrors=0;
    boundaryDraw=()=>{
      try {drawKakaoBoundaries(root,map,data.boundaries,setTriggerValue);}
      catch(error) {boundaryError=error;console.warn('상권 경계 표시 실패',error);}
    };
    if (data.radius && data.rows?.length === 1) {
      const row=data.rows[0];
      try {
        const circle=new kakao.maps.Circle({center:new kakao.maps.LatLng(row.lat,row.lng),radius:data.radius,strokeWeight:2,strokeColor:'#c59800',strokeOpacity:.9,fillColor:'#f3c53a',fillOpacity:.12});
        circle.setMap(map);polygons.push(circle);
      } catch(error) {boundaryError=error;console.warn('선택 반경 표시 실패',error);}
    }
    rankLayer=document.createElement('div');rankLayer.className='kb-rank-layer';
    Object.assign(rankLayer.style,{position:'absolute',inset:'0',zIndex:'3',pointerEvents:'none',overflow:'hidden'});
    root.appendChild(rankLayer);
    (data.rows||[]).forEach((row,index)=>{
      const lat=Number(row.lat),lng=Number(row.lng);
      if (!Number.isFinite(lat)||!Number.isFinite(lng)) return;
      try {
        const marker=document.createElement('button');marker.type='button';
        marker.className='kb-rank-marker'+(row.code===data.selected?' active':'');
        marker.setAttribute('aria-label',`${index+1}위 ${row.district} ${row.name}`);
        const rank=document.createElement('strong');rank.textContent=String(index+1);
        const name=document.createElement('span');name.textContent=row.name;
        const value=document.createElement('small');value.textContent=row.display||'';
        marker.append(rank,name,value);
        Object.assign(marker.style,{position:'absolute',transform:'translate(-50%,-50%)',pointerEvents:'auto'});
        marker.onclick=()=>setTriggerValue('selected',String(row.code));
        rankLayer.appendChild(marker);rankMarkers.push({marker,lat,lng});
      } catch(error) {markerErrors++;console.warn('순위 배지 표시 실패',error);}
    });
    positionKakaoMarkers=()=>{
      const projection=map.getProjection(), width=root.clientWidth, height=root.clientHeight;
      for(const {marker,lat,lng} of rankMarkers) {
        const point=projection.containerPointFromCoords(new kakao.maps.LatLng(lat,lng));
        const visible=point.x>=-50&&point.x<=width+50&&point.y>=-50&&point.y<=height+50;
        marker.style.display=visible?'flex':'none';
        if(visible){marker.style.left=`${point.x}px`;marker.style.top=`${point.y}px`;}
      }
    };
    const selected=(data.rows||[]).find(r=>r.code===data.selected)||data.selected_location;
    const nextViewKey=JSON.stringify([data.selected||'',data.district||'']);
    if(viewKey!==nextViewKey) {
      if(selected && Number.isFinite(selected.lat) && Number.isFinite(selected.lng)) {map.setCenter(new kakao.maps.LatLng(selected.lat,selected.lng));map.setLevel(5)}
      else if(data.district && data.rows?.length) {map.setCenter(new kakao.maps.LatLng(data.rows[0].lat,data.rows[0].lng));map.setLevel(7)}
      else {map.setCenter(new kakao.maps.LatLng(37.5665,126.9780));map.setLevel(9)}
      viewKey=nextViewKey;
    }
    requestAnimationFrame(()=>{map.relayout();scheduleKakaoDecorations();
      if(boundaryError||markerErrors) status.textContent=`카카오 지도 일부 표시 실패 · 경계: ${boundaryError?.message||'정상'}, 순위 배지 ${markerErrors}건`;
    });
  } catch(error) {
    console.error('카카오 지도 초기화 실패',error);
    if(map && mapRoot===root){status.textContent='카카오 지도 일부 표시 실패: '+error.message;return;}
    overlays.forEach(o=>o.setMap(null));overlays=[];
    polygons.forEach(p=>p.setMap(null));polygons=[];
    if(kakaoResizeObserver){kakaoResizeObserver.disconnect();kakaoResizeObserver=null;}
    if(boundarySvg){boundarySvg.remove();boundarySvg=null;}boundaryPaths=[];boundaryDraw=null;
    if(rankLayer){rankLayer.remove();rankLayer=null;}rankMarkers=[];positionKakaoMarkers=null;viewKey=null;
    root.querySelectorAll('.kb-map-inner').forEach(el=>el.remove());
    map=null;mapRoot=null;loadedKey=null;
    try {
      await renderTileFallback(root,data,setTriggerValue);
      status.textContent='카카오 지도 초기화 실패 · 대체 지도 표시: '+error.message;
    } catch(fallbackError) {
      renderSvgFallback(root,data,setTriggerValue);
      status.textContent='카카오 지도 인증 전 · 서울시 경계 임시 보기. '+error.message;
    }
  }
}
""",
)


def show_map(*, key: str | None, rows: list[dict], boundaries: list[dict], selected: str | None,
             source: str, district: str, selected_location: dict | None = None, radius: int | None = None, height: int = 590,
             fallback_districts: list[dict] | None = None) -> str | None:
    result = _MAP(key="rising-map", data={"key": key, "rows": rows, "boundaries": boundaries,
                                         "selected": selected, "selected_location": selected_location, "source": source, "district": district, "radius": radius, "height": height,
                                         "fallback_districts": fallback_districts or []},
                  height=height, on_selected_change=lambda: None)
    return getattr(result, "selected", None)
