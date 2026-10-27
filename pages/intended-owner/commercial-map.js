import {MAP_STYLE_URL,MAP_ZOOM_OPTIONS} from './map-config.js';

/** Page-local Leaflet interface. Layers and event handlers survive a basemap failure. */
export function createMap(id='map',options={}){
 if(!window.L)throw Error('Leaflet 라이브러리를 불러오지 못했습니다.');
 const map=L.map(id,{zoomControl:false,preferCanvas:true,...MAP_ZOOM_OPTIONS}).setView([37.5665,126.978],12.25);
 const attribution='<a href="https://openfreemap.org/">OpenFreeMap</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
 let vector,gl,timer,fallback=false;
 function restore(error){
  if(fallback)return;fallback=true;clearTimeout(timer);
  console.error('[상권지도] OpenFreeMap 로딩 실패. OpenStreetMap으로 복구합니다.',error);
  if(vector&&map.hasLayer(vector))map.removeLayer(vector);
  map.attributionControl.removeAttribution(attribution);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,maxNativeZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(map);
  map.getContainer().dataset.basemap='osm-fallback';
  map.fire('basemapchange',{name:'osm-fallback'});
 }
 try{
  if(!window.maplibregl||!L.maplibreGL)throw Error('MapLibre GL / Leaflet 어댑터 없음');
  vector=L.maplibreGL({style:options.style||MAP_STYLE_URL,interactive:false,attribution}).addTo(map);
  gl=vector.getMaplibreMap();
  const loaded=()=>{
   clearTimeout(timer);
   // Keep Bright's roads/water/colors, with Korean-first place labels.
   for(const layer of gl.getStyle().layers||[])if(layer.type==='symbol'&&JSON.stringify(layer.layout?.['text-field']||'').includes('name'))gl.setLayoutProperty(layer.id,'text-field',['coalesce',['get','name:ko'],['get','name:nonlatin'],['get','name'],['get','name_en']]);
   map.getContainer().dataset.basemap='openfreemap';map.fire('basemapchange',{name:'openfreemap'});
  };
  gl.once('load',loaded);
  gl.on('error',event=>{
   console.error('[상권지도] 벡터 지도 오류',event.error);
   // A bad tile alone may recover. A missing style or source before first paint cannot.
   if(!gl.isStyleLoaded()&&!gl.getStyle()?.sources)restore(event.error);
  });
  gl.getCanvas().addEventListener('webglcontextlost',()=>restore(Error('WebGL context lost')));
  timer=setTimeout(()=>{if(!gl.loaded())restore(Error('지도 로딩 시간 초과 (25초)'));},25000);
  map.getContainer().dataset.basemap='loading';
 }catch(error){restore(error);}
 L.control.zoom({position:'bottomright'}).addTo(map);
 L.control.scale({imperial:false,position:'bottomright'}).addTo(map);
 const markers=L.layerGroup().addTo(map);
 map.on('unload',()=>clearTimeout(timer));
 return {map,show(points){markers.clearLayers();for(const p of points)if(Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)){
  const name=document.createElement('span');name.textContent=p.name||'';L.circleMarker([+p.lat,+p.lng],{radius:7,color:'#ffffff',weight:3,fillColor:'#d49b00',fillOpacity:1}).bindPopup(name).addTo(markers);
  const label=document.createElement('strong');label.className='region-pin-label';label.textContent=p.name||'선택 지역';
  L.marker([+p.lat,+p.lng],{interactive:false,zIndexOffset:1000,icon:L.divIcon({className:'region-map-pin',html:label,iconSize:[1,1],iconAnchor:[0,0]})}).addTo(markers);
 }},focus(lat,lng){map.setView([lat,lng],14);},restore};
}
