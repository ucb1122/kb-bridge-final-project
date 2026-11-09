// Public-demo map adapter: OpenStreetMap tiles, original region polygons and labels.
// No Kakao key or developer-console domain registration is required.
export async function installPublicMap(){
 if(!window.L){
  const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.append(css);
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.onload=resolve;s.onerror=reject;document.head.append(s)});
 }
 const point=p=>p instanceof LatLng?[p.lat,p.lng]:Array.isArray(p)?p:p;
 const paths=p=>Array.isArray(p)?p.map(x=>x instanceof LatLng?point(x):paths(x)):p;
 class LatLng{constructor(lat,lng){this.lat=lat;this.lng=lng}getLat(){return this.lat}getLng(){return this.lng}}
 class LatLngBounds{constructor(a,b){this.bounds=L.latLngBounds([]);if(a)this.extend(a);if(b)this.extend(b)}extend(p){this.bounds.extend(point(p));return this}}
 class Map{
  constructor(host,o){this.leaflet=L.map(host,{zoomControl:false}).setView(point(o.center),18-o.level);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(this.leaflet);L.control.zoom({position:'bottomright'}).addTo(this.leaflet);L.control.scale({imperial:false}).addTo(this.leaflet);host.dataset.basemap='openstreetmap';}
  setCenter(p){this.leaflet.panTo(point(p),{animate:false})}getCenter(){const p=this.leaflet.getCenter();return new LatLng(p.lat,p.lng)}
  setLevel(n){this.leaflet.setZoom(18-n,{animate:false})}getLevel(){return 18-this.leaflet.getZoom()}
  setBounds(b,t=30,r=30,bottom=30,left=30){this.leaflet.fitBounds(b.bounds,{paddingTopLeft:[left,t],paddingBottomRight:[r,bottom],animate:false})}
  panBy(x,y){this.leaflet.panBy([x,y],{animate:false})}relayout(){this.leaflet.invalidateSize()}
  on(name,cb){this.leaflet.on(({bounds_changed:'moveend',zoom_changed:'zoomend',idle:'moveend'})[name]||name,e=>cb(e.latlng?{latLng:new LatLng(e.latlng.lat,e.latlng.lng)}:e))}
 }
 const style=o=>({color:o.strokeColor||'#8b98a6',weight:o.strokeWeight??1,opacity:o.strokeOpacity??1,fillColor:o.fillColor,fillOpacity:o.fillOpacity??0,dashArray:o.strokeStyle==='shortdash'?'4 4':null});
 class Shape{
  constructor(o,line=false){this.layer=(line?L.polyline:L.polygon)(paths(o.path||[]),style(o));if(o.map)this.setMap(o.map)}
  setMap(map){this.layer.remove();if(map)this.layer.addTo(map.leaflet)}setOptions(o){this.layer.setStyle(style(o))}setZIndex(n){if(n>0)this.layer.bringToFront()}on(n,cb){this.layer.on(n,cb)}
 }
 class Polygon extends Shape{}
 class Polyline extends Shape{constructor(o){super(o,true)}}
 class CustomOverlay{
  constructor(o){this.options=o;const el=document.createElement('div');el.style.cssText=`transform:translate(-50%,-${100*(o.yAnchor??.5)}%);width:max-content`;if(typeof o.content==='string')el.innerHTML=o.content;else el.append(o.content);this.layer=L.marker(point(o.position),{icon:L.divIcon({html:el,className:'public-map-overlay',iconSize:[0,0]}),zIndexOffset:o.zIndex||0});if(o.map)this.setMap(o.map)}
  setMap(map){this.layer.remove();if(map)this.layer.addTo(map.leaflet)}setZIndex(n){this.layer.setZIndexOffset(n)}getContent(){return this.options.content}setPosition(p){this.layer.setLatLng(point(p))}on(n,cb){this.layer.on(n,cb)}
 }
 window.kakao={maps:{Map,LatLng,LatLngBounds,Polygon,Polyline,CustomOverlay,load:cb=>cb(),event:{addListener:(target,name,cb)=>target.on(name,cb),preventMap(){}}}};
}
