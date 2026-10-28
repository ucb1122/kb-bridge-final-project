import {MAP_ZOOM_OPTIONS} from './map-config.js';

const kakaoLevel=zoom=>Math.max(1,Math.min(14,Math.round(20-zoom)));

/** Keep Leaflet analysis layers interactive over the official Kakao basemap. */
export function createMap(id='map'){
  if(!window.L)throw Error('분석 도형 라이브러리를 불러오지 못했습니다.');
  if(!window.kakao?.maps?.Map)throw Error('카카오 지도를 불러오지 못했습니다.');
  const host=document.getElementById(id);
  if(!host)throw Error('지도 영역을 찾을 수 없습니다.');
  const base=document.createElement('div');base.className='kakao-basemap';base.setAttribute('aria-label','카카오 지도');
  const overlay=document.createElement('div');overlay.className='analysis-map-overlay';
  host.replaceChildren(base,overlay);
  const center=[37.5665,126.978];
  const kakaoMap=new kakao.maps.Map(base,{center:new kakao.maps.LatLng(...center),level:kakaoLevel(12.25),draggable:false,scrollwheel:false});
  const map=L.map(overlay,{zoomControl:false,attributionControl:false,...MAP_ZOOM_OPTIONS}).setView(center,12.25);
  let scheduled=false;
  const sync=()=>{
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      const point=map.getCenter(),level=kakaoLevel(map.getZoom());
      if(kakaoMap.getLevel()!==level)kakaoMap.setLevel(level,{animate:false});
      kakaoMap.setCenter(new kakao.maps.LatLng(point.lat,point.lng));
    });
  };
  map.on('move zoom resize',sync);
  map.on('resize',()=>kakaoMap.relayout());
  sync();
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.control.scale({imperial:false,position:'bottomright'}).addTo(map);
  const markers=L.layerGroup().addTo(map);
  host.dataset.basemap='kakao';
  map.fire('basemapchange',{name:'kakao'});
  return {map,kakaoMap,show(points){markers.clearLayers();for(const point of points)if(Number.isFinite(+point.lat)&&Number.isFinite(+point.lng)){
    const name=document.createElement('span');name.textContent=point.name||'';
    L.marker([+point.lat,+point.lng]).bindPopup(name).addTo(markers);
  }},focus(lat,lng){map.setView([lat,lng],14)},restore(){}};
}
