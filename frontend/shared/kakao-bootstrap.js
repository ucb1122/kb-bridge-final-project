export async function loadKakaoMaps(){
  if(window.kakao?.maps?.Map)return window.kakao.maps;
  const response=await fetch('/api/rising/map-config');
  if(!response.ok)throw Error('지도 설정을 불러오지 못했습니다.');
  const {kakaoJavaScriptKey,publicDemo}=await response.json();
  if(publicDemo){await(await import('/shared/public-map.js')).installPublicMap();return window.kakao.maps;}
  if(!kakaoJavaScriptKey)throw Error('카카오 지도 JavaScript 키를 .env에 설정해 주세요.');
  await new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=`https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${encodeURIComponent(kakaoJavaScriptKey)}`;
    script.onload=()=>window.kakao?.maps?.load?window.kakao.maps.load(resolve):reject(Error('카카오 지도 SDK를 초기화하지 못했습니다.'));
    script.onerror=()=>reject(Error('카카오 지도 SDK를 불러오지 못했습니다. 카카오 앱의 JavaScript SDK 도메인을 확인해 주세요.'));
    document.head.append(script);
  });
  return window.kakao.maps;
}
const entry=document.querySelector('script[data-kakao-entry]')?.dataset.kakaoEntry;
if(entry){
  try{await loadKakaoMaps();await import(entry)}
  catch(error){const map=document.getElementById('map')||document.getElementById('consult-map');if(map){map.classList.add('map-error');map.textContent=error.message}const status=document.getElementById('dataset-status')||document.getElementById('founder-status');if(status)status.textContent=error.message;console.error(error)}
}
