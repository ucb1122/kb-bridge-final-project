export function parseWalkingRoute(payload){
  const route=payload?.routes?.[0]||payload?.route;
  const points=[];
  for(const leg of route?.legs||[]){
    for(const step of leg.steps||[]){
      for(const point of step.path?.points||[]){
        if(Array.isArray(point)&&Number.isFinite(point[0])&&Number.isFinite(point[1]))points.push(point);
      }
    }
  }
  const distanceMeters=Number(route?.properties?.totalDistance);
  const durationSeconds=Number(route?.properties?.totalTime);
  if(points.length<2||!Number.isFinite(distanceMeters)||!Number.isFinite(durationSeconds))throw Error('도보 경로 결과를 읽을 수 없습니다.');
  return {distanceMeters,durationSeconds,points};
}

export async function getWalkingRoute({origin,branch,key}){
  const url=new URL('https://dapi.kakao.com/v2/routing/walk');
  url.search=new URLSearchParams({start_x:String(origin.lng),start_y:String(origin.lat),end_x:String(branch.lng),end_y:String(branch.lat)}).toString();
  const response=await fetch(url,{headers:{Authorization:`KakaoAK ${key.trim()}`},signal:AbortSignal.timeout(12000)});
  const payload=await response.json();
  if(!response.ok||payload.status!=='OK')throw Error(payload?.message||payload?.error?.message||'카카오 도보 경로를 찾지 못했습니다.');
  return parseWalkingRoute(payload);
}
