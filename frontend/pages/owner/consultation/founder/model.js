export function parseAmount(value){
  if(value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)&&n>=0&&n<=100000000&&/^\d+(?:\.\d{1,2})?$/.test(String(value))?n:NaN;
}

export function fundingSummary(values){
  const amounts=values.map(parseAmount);
  if(amounts.some(Number.isNaN))throw Error('금액은 0 이상, 소수 둘째 자리 이하의 숫자로 입력해 주세요.');
  const [deposit,facilities,inventory,operating,own]=amounts;
  const costs=[deposit,facilities,inventory,operating];
  const total=costs.every(v=>v===null)?null:costs.reduce((sum,v)=>sum+(v||0),0);
  return {total,own,needed:total===null||own===null?null:Math.max(0,total-own)};
}

export function distanceKm(a,b){
  const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLng=(b.lng-a.lng)*rad;
  const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2;
  return 12742*Math.asin(Math.min(1,Math.sqrt(h)));
}

export function nearestBranches(branches,origin,limit=3){
  return branches.filter(b=>Number.isFinite(b.lat)&&Number.isFinite(b.lng)&&b.id&&b.address)
    .map(b=>({...b,distanceKm:distanceKm(origin,b)})).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,limit);
}

export function founderSupport(items){
  return items.filter(item=>item.businessTypes?.includes('preparing'));
}
