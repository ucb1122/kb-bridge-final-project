export const distance=(a,b)=>{const r=Math.PI/180,h=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lng-a.lng)*r/2)**2;return 6371008.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));};
export function inRing([x,y],ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j],cross=(x-xi)*(yj-yi)-(y-yi)*(xj-xi);if(Math.abs(cross)<1e-12&&x>=Math.min(xi,xj)-1e-12&&x<=Math.max(xi,xj)+1e-12&&y>=Math.min(yi,yj)-1e-12&&y<=Math.max(yi,yj)+1e-12)return true;if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
export function inGeometry(point,g){return (g.type==='Polygon'?[g.coordinates]:g.coordinates).some(r=>inRing(point,r[0])&&!r.slice(1).some(h=>inRing(point,h)));}
export function polygonArea(v){const lat=v.reduce((n,p)=>n+p[1],0)/v.length*Math.PI/180,p=v.map(([x,y])=>[x*111195.08*Math.cos(lat),y*111195.08]);return Math.abs(p.reduce((a,b,i)=>{const c=p[(i+1)%p.length];return a+b[0]*c[1]-c[0]*b[1];},0))/2;}
export function validPolygon(vertices) {
  if (vertices.length < 3 || polygonArea(vertices) < 10) return false;
  if (new Set(vertices.map(p => p.join(','))).size !== vertices.length) return false;
  const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const onSegment = (a,b,p) => p[0]>=Math.min(a[0],b[0]) && p[0]<=Math.max(a[0],b[0]) && p[1]>=Math.min(a[1],b[1]) && p[1]<=Math.max(a[1],b[1]);
  for (let i=0; i<vertices.length; i++) for (let j=i+1; j<vertices.length; j++) {
    if (j===i+1 || (i===0 && j===vertices.length-1)) continue;
    const a=vertices[i], b=vertices[(i+1)%vertices.length], c=vertices[j], d=vertices[(j+1)%vertices.length];
    const abc=cross(a,b,c), abd=cross(a,b,d), cda=cross(c,d,a), cdb=cross(c,d,b);
    if (abc*abd<0 && cda*cdb<0) return false;
    if ((abc===0 && onSegment(a,b,c)) || (abd===0 && onSegment(a,b,d)) || (cda===0 && onSegment(c,d,a)) || (cdb===0 && onSegment(c,d,b))) return false;
  }
  return true;
}
export function selectBusinesses(rows,c){
  let bounds;
  if(c.geometry){const polygons=c.geometry.type==='Polygon'?[c.geometry.coordinates]:c.geometry.coordinates,vertices=polygons.flat(2);bounds=vertices.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);}
  return rows.filter(p=>(!c.district||p.district===c.district)&&(!c.industry||p.industry===c.industry)&&(c.geometry?p.lng>=bounds[0]&&p.lng<=bounds[2]&&p.lat>=bounds[1]&&p.lat<=bounds[3]&&inGeometry([p.lng,p.lat],c.geometry):c.center?distance(c.center,p)<=c.radius:true));
}
export function searchBusinesses(rows,q,district=''){const terms=q.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);return terms.length?rows.filter(p=>(!district||p.district===district)&&terms.every(t=>(p.name+' '+p.address).toLocaleLowerCase().includes(t))):[];}
