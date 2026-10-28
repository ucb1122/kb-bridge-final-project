import {distance} from './analysis.js';
const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
const cache=new Map();
const allowed=new Set(['footway','pedestrian','path','steps','living_street','residential','service','unclassified','tertiary','tertiary_link','secondary','secondary_link','primary','primary_link','cycleway','track']);
export function walkable(tags={}) {
  if(['no','private','use_sidepath'].includes(tags.foot))return false;
  if(['no','private'].includes(tags.access)&&!['yes','designated','permissive'].includes(tags.foot))return false;
  return allowed.has(tags.highway)||(['yes','designated'].includes(tags.foot)&&['trunk','trunk_link'].includes(tags.highway));
}
export async function loadRoads(center,signal,budget=1400) {
  // Fetch a coarse public map tile rather than transmitting the selected point.
  const lat=Math.floor(center.lat/.02)*.02,lng=Math.floor(center.lng/.02)*.02;
  const bbox=[lat-.02,lng-.02,lat+.04,lng+.04],key=bbox.map(n=>n.toFixed(2)).join(',')+'/'+Math.ceil(budget/100);
  if(cache.has(key))return cache.get(key);
  const local=await fetch(new URL('./assets/walk-network.json',import.meta.url),{signal}).then(r=>r.ok?r.json():null).catch(()=>null);
  const marginLat=(budget+150)/111195.08,marginLng=marginLat/Math.cos(center.lat*Math.PI/180);
  if(local?.bbox && center.lat>local.bbox[0]+marginLat && center.lat<local.bbox[2]-marginLat && center.lng>local.bbox[1]+marginLng && center.lng<local.bbox[3]-marginLng)return local;
  let error;
  // A small official OSM map extract is a fallback when Overpass is overloaded.
  // Requests are only made after Apply, cached per coarse tile and distance limit.
  const tileLat=Math.floor(center.lat/.005)*.005,tileLng=Math.floor(center.lng/.005)*.005;
  const smallBox=[tileLat-marginLat,tileLng-marginLng,tileLat+.005+marginLat,tileLng+.005+marginLng];
  try{
    const url='https://api.openstreetmap.org/api/0.6/map.json?bbox='+[smallBox[1],smallBox[0],smallBox[3],smallBox[2]].map(n=>n.toFixed(6)).join(',');
    const response=await fetch(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000)});
    if(!response.ok)throw Error(`공식 지도 HTTP ${response.status}`);
    const data=await response.json(),ways=data.elements?.filter(e=>e.type==='way'&&e.tags?.highway)||[];
    if(!ways.length)throw Error('보행도로가 없는 지도입니다.');
    const needed=new Set(ways.flatMap(w=>w.nodes));
    const result={bbox:smallBox,source:url,timestamp:new Date().toISOString(),attribution:'OpenStreetMap contributors, ODbL 1.0',elements:[...data.elements.filter(e=>e.type==='node'&&needed.has(e.id)).map(n=>({type:'node',id:n.id,lat:n.lat,lon:n.lon,tags:n.tags})),...ways.map(w=>({type:'way',id:w.id,nodes:w.nodes,tags:w.tags}))]};
    cache.set(key,result);return result;
  }catch(e){error=e;if(signal?.aborted)throw e;}
  const query=`[out:json][timeout:20];way[highway][highway!~"^(motorway|motorway_link|trunk|trunk_link|construction|proposed)$"](${bbox.join(',')});(._;>;);out body;`;
  for(const endpoint of endpoints){
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    try{
      const response=await fetch(`${endpoint}?data=${encodeURIComponent(query)}`,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000)});
      if(!response.ok)throw Error(`도로 데이터 HTTP ${response.status}`);
      const data=await response.json();
      if(data.remark||!data.elements?.some(e=>e.type==='way'))throw Error('보행 도로 응답이 불완전합니다.');
      const result={...data,bbox,source:endpoint};cache.set(key,result);return result;
    }catch(e){error=e;if(signal?.aborted)throw e;}
  }
  throw Error('보행도로를 불러오지 못했습니다. 잠시 후 다시 적용하거나 반경/다각형을 선택해 주세요. '+(error?.message||''));
}
class Heap {
  data=[];
  push(item){const a=this.data;let i=a.length;a.push(item);while(i){const p=(i-1)>>1;if(a[p][0]<=item[0])break;a[i]=a[p];i=p;}a[i]=item;}
  pop(){const a=this.data,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1][0]<a[c][0])c++;if(a[c][0]>=last[0])break;a[i]=a[c];i=c;}a[i]=last;}return first;}
}
export function buildWalkingArea(data,center,budget) {
  const nodes=new Map(data.elements.filter(e=>e.type==='node').map(n=>[n.id,{lat:n.lat,lng:n.lon,tags:n.tags||{}}]));
  const edges=[],adj=new Map();
  const connect=(a,b,length)=>{if(!adj.has(a))adj.set(a,[]);adj.get(a).push([b,length]);};
  for(const way of data.elements.filter(e=>e.type==='way'&&walkable(e.tags))){
    for(let i=1;i<way.nodes.length;i++){
      const a=nodes.get(way.nodes[i-1]),b=nodes.get(way.nodes[i]);if(!a||!b||['no','private'].includes(a.tags.access)||['no','private'].includes(b.tags.access))continue;
      const length=distance(a,b);if(!length)continue;
      const edge={a,b,aid:way.nodes[i-1],bid:way.nodes[i],length,way:way.id};edges.push(edge);
      if(way.tags['oneway:foot']!=='-1')connect(edge.aid,edge.bid,length);
      if(!['yes','1','true'].includes(way.tags['oneway:foot']))connect(edge.bid,edge.aid,length);
      edge.forward=way.tags['oneway:foot']!=='-1';edge.reverse=!['yes','1','true'].includes(way.tags['oneway:foot']);
    }
  }
  if(!edges.length)throw Error('이 위치 주변에 계산 가능한 보행도로가 없습니다.');
  const scale=Math.cos(center.lat*Math.PI/180),xy=p=>[(p.lng-center.lng)*111195.08*scale,(p.lat-center.lat)*111195.08];
  // Index road segments in 100m cells; avoid scanning every road for every shop.
  const cells=new Map(),cellSize=100;
  for(const edge of edges){
    [edge.ax,edge.ay]=xy(edge.a);const [bx,by]=xy(edge.b);edge.dx=bx-edge.ax;edge.dy=by-edge.ay;
    for(let x=Math.floor(Math.min(edge.ax,bx)/cellSize);x<=Math.floor(Math.max(edge.ax,bx)/cellSize);x++)for(let y=Math.floor(Math.min(edge.ay,by)/cellSize);y<=Math.floor(Math.max(edge.ay,by)/cellSize);y++){
      const key=x+','+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(edge);
    }
  }
  const snap=(p,range=60)=>{
    const [px,py]=xy(p),candidates=new Set();
    for(let x=Math.floor((px-range)/cellSize);x<=Math.floor((px+range)/cellSize);x++)for(let y=Math.floor((py-range)/cellSize);y<=Math.floor((py+range)/cellSize);y++)for(const edge of cells.get(x+','+y)||[])candidates.add(edge);
    let best={edge:null,t:0,offset:Infinity};
    for(const e of candidates){const t=Math.max(0,Math.min(1,((px-e.ax)*e.dx+(py-e.ay)*e.dy)/(e.dx*e.dx+e.dy*e.dy))),offset=Math.hypot(px-e.ax-t*e.dx,py-e.ay-t*e.dy);if(offset<best.offset)best={edge:e,t,offset};}
    return best;
  };
  const origin=snap(center,150);
  if(origin.offset>150)throw Error('선택 위치에서 150m 이내에 연결할 수 있는 보행도로가 없습니다. 도로 가까운 위치를 선택하세요.');
  const costs=new Map(),heap=new Heap();
  const seed=(id,cost)=>{if(cost<(costs.get(id)??Infinity)){costs.set(id,cost);heap.push([cost,id]);}};
  if(origin.edge.reverse)seed(origin.edge.aid,origin.offset+origin.t*origin.edge.length);
  if(origin.edge.forward)seed(origin.edge.bid,origin.offset+(1-origin.t)*origin.edge.length);
  while(heap.data.length){const [cost,id]=heap.pop();if(cost!==costs.get(id)||cost>budget)continue;for(const [next,weight] of adj.get(id)||[])if(cost+weight<=budget)seed(next,cost+weight);}
  function walkingDistance(p){
    if(distance(center,p)>budget)return Infinity;
    const target=snap(p);if(target.offset>60)return Infinity;
    const e=target.edge;
    let cost=Math.min(e.forward?(costs.get(e.aid)??Infinity)+target.t*e.length:Infinity,e.reverse?(costs.get(e.bid)??Infinity)+(1-target.t)*e.length:Infinity);
    if(e===origin.edge&&((target.t>=origin.t&&e.forward)||(target.t<=origin.t&&e.reverse)))cost=Math.min(cost,origin.offset+Math.abs(target.t-origin.t)*e.length);
    return cost+target.offset;
  }
  const lines=[];
  for(const e of edges){
    const ranges=[];
    if(e.forward&&(costs.get(e.aid)??Infinity)<budget)ranges.push([0,Math.min(1,(budget-costs.get(e.aid))/e.length)]);
    if(e.reverse&&(costs.get(e.bid)??Infinity)<budget)ranges.push([Math.max(0,1-(budget-costs.get(e.bid))/e.length),1]);
    if(e===origin.edge){const remain=Math.max(0,budget-origin.offset)/e.length;ranges.push([e.reverse?Math.max(0,origin.t-remain):origin.t,e.forward?Math.min(1,origin.t+remain):origin.t]);}
    for(const [start,end] of ranges)if(end>start)lines.push([[e.a.lng+(e.b.lng-e.a.lng)*start,e.a.lat+(e.b.lat-e.a.lat)*start],[e.a.lng+(e.b.lng-e.a.lng)*end,e.a.lat+(e.b.lat-e.a.lat)*end]]);
  }
  return {contains:p=>walkingDistance(p)<=budget,walkingDistance,geometry:{type:'MultiLineString',coordinates:lines},edges:edges.length,originOffset:origin.offset,budget,timestamp:data.osm3s?.timestamp_osm_base||data.timestamp||'기준시각 미제공'};
}
