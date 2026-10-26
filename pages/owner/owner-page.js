import {searchAreas,resolveMarkets,nearbyMarkets} from './market-selection.js';
import {makeAnalysisContext,launchConsultation,ANALYSIS_KEY} from './consultation-data.js';
import {buildReports,renderReportHTML,downloadReports,downloadOneReport} from './reports.js';
import {moveToNearbyBank} from './bank-locator.js';
import {createMap} from './commercial-map.js';
import {districts,populateDistricts,focusDistrict} from '../../shared/districts.js';
import {distance,inGeometry,selectBusinesses,polygonArea,validPolygon,searchBusinesses} from './analysis.js';
import {industryCatalog,matchesIndustry,groupFor} from './industry-catalog.js';
import {loadRoads,buildWalkingArea} from './walking.js';

const $=id=>document.getElementById(id);
const fmt=n=>n.toLocaleString('ko-KR');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const INITIAL_MAP_VIEW={center:[37.5665,126.978],zoom:11.5};
const state={rows:[],marketCode:null,places:[],features:[],meta:null,layers:null,regional:null,reports:[],step:'location',location:null,industry:null,category:'외식업',searchType:'all',areaMode:'distance',radius:500,vertices:[],draftPolygon:null,drawing:false,applied:null,result:null,reportTab:'summary',compare:[],stores:false,boundaries:false,populationLayer:null,request:0};
let view,selectionLayer,previewLayer,boundaryLayer,storeLayer,populationLayer,locationMarker,renderer,walkingController,toastTimer,searchTimer,composing=false;

function textNode(text){const n=document.createElement('span');n.textContent=text;return n;}
function announce(text,error=false){
  $('map-message').hidden=false;$('map-message').textContent=text;
  $('map-message').style.color=error?'#b03939':'';
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('map-message').hidden=true,error?12000:6500);
}
function info(title,html){$('info-title').textContent=title;$('info-content').innerHTML=html;$('info-dialog').showModal();}
function clearReport(){state.result=null;$('report-panel').hidden=true;$('open-report').hidden=true;drawStores();}
function cancelWalking(){walkingController?.abort();walkingController=null;state.request++;}
function markAreaDirty(){
  cancelWalking();state.applied=null;clearReport();
  selectionLayer?.clearLayers();$('area-summary').textContent='선택해주세요';
  $('area-status').textContent='선택한 조건으로 적용을 눌러주세요.';$('area-status').className='area-status';
  updateButtons();
}
function updateButtons(){
  $('next-location').disabled=!(state.meta&&state.location);
  $('next-industry').disabled=!state.industry;
  $('analyze').disabled=!(state.meta&&state.location&&state.industry&&state.applied&&!state.drawing);
  $('finish-polygon').disabled=state.vertices.length<3;
  $('undo-polygon').disabled=!state.vertices.length;
  $('draw-polygon').disabled=!view;
  document.querySelectorAll('[data-step]').forEach(b=>b.classList.toggle('complete',b.dataset.step==='location'?!!state.location:b.dataset.step==='industry'?!!state.industry:!!state.applied));
}
function showStep(step){
  // Match the reference: tabs can be explored before all conditions are complete.
  // Location, industry and an applied area are required only for actual analysis.
  if(state.drawing&&step!=='area')stopDrawing();
  state.step=step;
  document.querySelectorAll('[data-step]').forEach(b=>{const active=b.dataset.step===step;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});
  for(const name of ['location','industry','area'])$('pane-'+name).hidden=name!==step;
  document.querySelector('.wizard-content').scrollTop=0;
}
function setLocation(point){
  if(!state.regional){announce('상권 자료를 불러오는 중입니다. 잠시 후 선택해 주세요.');return;}
  if(!(point.lat>37.4&&point.lat<37.72&&point.lng>126.76&&point.lng<127.2)){announce('서울 지역 안에서 위치를 선택해 주세요.',true);return;}
  stopDrawing();state.location={...point};state.marketCode=point.marketCode||resolveMarkets(point,state.regional,state.features,state.industry)[0]?.code||null;markAreaDirty();renderMarketOptions();
  if(view){locationMarker?.remove();locationMarker=L.marker([point.lat,point.lng],{icon:L.divIcon({className:'selected-store-icon',html:'<span>●</span>',iconSize:[28,42],iconAnchor:[14,40]})}).addTo(view.map).bindPopup(textNode(point.name));
    view.map.setView([point.lat,point.lng],16);}
  $('location-summary').textContent=point.name;$('location-summary').title=point.address||point.name;
  $('location-status').textContent=point.address||`${point.name} · ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
  $('pick-on-map').checked=false;
  $('area-status').textContent='위치가 선택되었습니다. 분석영역을 선택하고 적용하세요.';
  document.querySelectorAll('.reference-result').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===point.id)));
  updateButtons();drawStores();
}

try{
  view=createMap();view.map.setView(INITIAL_MAP_VIEW.center,INITIAL_MAP_VIEW.zoom,{animate:false});
  renderer=L.canvas({padding:.2});selectionLayer=L.layerGroup().addTo(view.map);previewLayer=L.layerGroup().addTo(view.map);boundaryLayer=L.layerGroup().addTo(view.map);storeLayer=L.layerGroup().addTo(view.map);populationLayer=L.layerGroup().addTo(view.map);
  view.map.on('click',event=>{
    if(state.drawing){addVertex([event.latlng.lng,event.latlng.lat]);return;}
    if($('pick-on-map').checked)setLocation({...event.latlng,name:'지도 선택 위치'});
  });
  view.map.on('dblclick',event=>{if(state.drawing){L.DomEvent.stop(event);finishPolygon();}});
  view.map.on('contextmenu',event=>{if(state.drawing){L.DomEvent.preventDefault(event.originalEvent);finishPolygon();}});
  view.map.on('moveend',drawStores);
}catch(error){announce('지도를 불러오지 못했습니다. 인터넷 연결 후 새로고침해 주세요.',true);}
populateDistricts($('map-district'));

function clearSearchResults(){
  $('search-results').innerHTML='<p class="search-placeholder">⌖<br>상권 또는 주요 지역을 입력해 주세요.</p>';
  $('search-status').textContent='상권 또는 주요 지역을 검색하거나 지도에서 위치를 선택하세요.';
}

// Search only after the user supplies a query; entry never selects a location.
function runSearch(){
  const query=$('address').value.trim(),district=$('map-district').value;
  $('search-results').replaceChildren();
  if(!query){clearSearchResults();return;}
  const found=searchAreas(state.regional,state.features,state.places,query,district,state.searchType);
  $('search-status').textContent=found.length?fmt(found.length)+'개 상권·주요 지역 · 최대 30개 표시':'확보된 상권·주요 지역이 없습니다. 다른 지역명 또는 지도 선택을 이용하세요.';
  for(const p of found.slice(0,30)){
    const button=document.createElement('button');button.type='button';button.className='reference-result';button.dataset.id=p.id;button.setAttribute('aria-pressed',String(state.location?.id===p.id));
    button.innerHTML=`<span aria-hidden="true">⌖</span><div><b>${escape(p.name)}</b><small>${escape(p.kind+' · '+p.address)}</small></div>`;
    button.addEventListener('click',()=>setLocation(p));$('search-results').append(button);
  }
}
function renderMarketOptions(){
 if(!state.location||!state.regional){$('analysis-market').replaceChildren(new Option('상권을 선택해 주세요',''));$('market-note').textContent='';return;}
 const choices=nearbyMarkets(state.location,state.regional,state.features,state.industry),selected=state.regional.areas[state.marketCode];if(selected&&!choices.some(a=>a.code===selected.code))choices.unshift(selected);
 $('analysis-market').replaceChildren(new Option('분석상권 선택',''),...choices.map(a=>new Option(a.name+' · '+a.type,a.code)));
 $('analysis-market').value=state.marketCode||'';
 $('market-note').textContent=state.marketCode?'추정매출·인구는 선택한 공식 상권 전체 기준입니다. 반경 안 점포 매출로 환산하지 않습니다.':'이 위치를 포함하는 상권이 없습니다. 주변 분석상권을 직접 선택하세요.';
}
$('analysis-market').addEventListener('change',()=>{state.marketCode=$('analysis-market').value||null;clearReport();renderMarketOptions();announce('추정매출 분석상권을 변경했습니다. 분석하기를 눌러주세요.');});
$('address-form').addEventListener('submit',e=>{e.preventDefault();if(composing)return;clearTimeout(searchTimer);runSearch();});
$('address').addEventListener('compositionstart',()=>{composing=true;clearTimeout(searchTimer);});
$('address').addEventListener('compositionend',()=>{composing=false;clearTimeout(searchTimer);searchTimer=setTimeout(runSearch,300);});
$('address').addEventListener('input',event=>{clearTimeout(searchTimer);if(!composing&&!event.isComposing)searchTimer=setTimeout(runSearch,300);});
document.querySelectorAll('[data-search]').forEach(b=>b.addEventListener('click',()=>{state.searchType=b.dataset.search;document.querySelectorAll('[data-search]').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',String(t===b));});if($('address').value.trim())runSearch();}));
$('pick-on-map').addEventListener('change',()=>{if($('pick-on-map').checked){stopDrawing();announce('지도에서 점포 위치를 클릭하세요.');}});
document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>showStep(b.dataset.step)));
$('next-location').addEventListener('click',()=>showStep('industry'));
$('next-industry').addEventListener('click',()=>showStep('area'));

function renderIndustries(){
  const items=state.category==='전체'?[{id:'all',label:'전체 확보 업소'},...industryCatalog]:industryCatalog.filter(g=>g.category===state.category);
  $('industry-grid').replaceChildren();
  for(const group of items){
    const button=document.createElement('button');button.type='button';button.dataset.industry=group.id;button.disabled=!!group.unavailable;
    button.textContent=group.label;button.classList.toggle('active',state.industry?.id===group.id);button.setAttribute('aria-pressed',String(state.industry?.id===group.id));
    if(group.unavailable){const small=document.createElement('small');small.textContent='자료 미확보';button.append(small);}
    button.addEventListener('click',()=>{
      state.industry=group;$('industry-summary').textContent=group.label;
      $('industry-note').textContent=group.note||'인허가 업태를 묶은 검색 분류입니다. 원본 업태와 제공 범위는 출처에서 확인할 수 있습니다.';
      clearReport();renderIndustries();renderMarketOptions();updateButtons();
    });$('industry-grid').append(button);
  }
}
document.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.category;document.querySelectorAll('[data-category]').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',String(t===b));});renderIndustries();$('industry-note').textContent='활성화된 업종은 추가 확보한 인허가 자료를 포함합니다. 회색 항목은 점포별 인허가 자료가 없으며 지역 통계는 예비창업자 화면에서 확인할 수 있습니다.';}));
renderIndustries();

function showAreaMode(mode){
  if(state.areaMode!==mode){stopDrawing();markAreaDirty();}
  state.areaMode=mode;
  document.querySelectorAll('[data-area-mode]').forEach(b=>{const active=b.dataset.areaMode===mode;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});
  for(const name of ['distance','time','radius'])$('area-'+name).hidden=mode!==name;
}
document.querySelectorAll('[data-area-mode]').forEach(b=>b.addEventListener('click',()=>showAreaMode(b.dataset.areaMode)));
function updateRange(id,output,display){const input=$(id);$(output).textContent=display(Number(input.value));input.style.setProperty('--progress',`${(input.value-input.min)/(input.max-input.min)*100}%`);}
for(const [id,out,display] of [['walk-distance','walk-distance-value',n=>(n/1000).toFixed(1)],['walk-time','walk-time-value',n=>String(n)]]){
  updateRange(id,out,display);$(id).addEventListener('input',()=>{updateRange(id,out,display);markAreaDirty();});
}
function radiusValue(){return state.radius==='custom'?Number($('custom-radius').value):state.radius;}
document.querySelectorAll('[data-radius]').forEach(b=>b.addEventListener('click',()=>{
  stopDrawing();state.draftPolygon=null;previewLayer?.clearLayers();state.radius=b.dataset.radius==='custom'?'custom':Number(b.dataset.radius);
  document.querySelectorAll('[data-radius]').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',String(t===b));});
  $('custom-radius-wrap').hidden=state.radius!=='custom';markAreaDirty();previewRadius();
}));
$('custom-radius').addEventListener('input',()=>{markAreaDirty();previewRadius();});
function previewRadius(){
  previewLayer?.clearLayers();if(!view||!state.location||state.areaMode!=='radius'||state.draftPolygon||state.drawing)return;
  const radius=radiusValue();if(radius>=50&&radius<=3000)L.circle([state.location.lat,state.location.lng],{radius,color:'#dfa400',weight:3,fillColor:'#ffcc32',fillOpacity:.27,interactive:false}).addTo(previewLayer);
}
function stopDrawing(){
  state.drawing=false;state.vertices=[];$('polygon-controls').hidden=true;$('draw-polygon').classList.remove('active');
  if(view){view.map.doubleClickZoom.enable();view.map.getContainer().style.cursor='';}
  previewLayer?.clearLayers();updateButtons();
}
function addVertex(point){
  const previous=state.vertices.at(-1);if(previous&&distance({lat:previous[1],lng:previous[0]},{lat:point[1],lng:point[0]})<1)return;
  if(point[1]<37.4||point[1]>37.72||point[0]<126.76||point[0]>127.2){announce('서울 지도 안에서 다각형을 그려주세요.',true);return;}
  state.vertices.push(point);drawDraft();
}
function drawDraft(){
  previewLayer?.clearLayers();const coords=state.vertices.map(([lng,lat])=>[lat,lng]);
  if(view&&coords.length){L.polyline(coords,{color:'#dfa400',weight:3,dashArray:'6 5',interactive:false}).addTo(previewLayer);for(const p of coords)L.circleMarker(p,{radius:5,color:'#dfa400',fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(previewLayer);}
  $('polygon-status').textContent=`꼭짓점 ${coords.length}개 · 더블클릭/오른쪽 클릭 또는 그리기 완료`;
  updateButtons();
}
$('draw-polygon').addEventListener('click',()=>{if(!state.location){announce('위치를 먼저 선택해 주세요.',true);return;}markAreaDirty();state.draftPolygon=null;state.drawing=true;state.vertices=[];$('polygon-controls').hidden=false;$('draw-polygon').classList.add('active');view.map.doubleClickZoom.disable();view.map.getContainer().style.cursor='crosshair';drawDraft();announce('지도에 점을 찍어 다각형을 그려주세요. 더블클릭이나 오른쪽 클릭으로 완성할 수 있습니다.');});
function finishPolygon(){
  if(!state.drawing)return;
  if(!validPolygon(state.vertices)){announce('교차하지 않는 꼭짓점 3개 이상으로 영역을 그려주세요. 최소 면적은 10m²입니다.',true);return;}
  state.draftPolygon={type:'Polygon',coordinates:[[...state.vertices,state.vertices[0]]]};
  stopDrawing();L.geoJSON(state.draftPolygon,{style:{color:'#dfa400',weight:3,fillColor:'#ffcc32',fillOpacity:.3},interactive:false}).addTo(previewLayer);
  $('area-status').textContent='다각형을 완성했습니다. 적용을 눌러주세요.';updateButtons();
}
$('finish-polygon').addEventListener('click',finishPolygon);
$('undo-polygon').addEventListener('click',()=>{state.vertices.pop();drawDraft();});
$('cancel-polygon').addEventListener('click',()=>{stopDrawing();state.draftPolygon=null;previewRadius();$('area-status').textContent='그리기를 취소했습니다. 반경을 선택하거나 다시 그려주세요.';});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.drawing)$('cancel-polygon').click();});

async function applyArea(mode){
  if(!state.location||!state.industry){announce('점포 위치와 업종을 먼저 선택해 주세요.',true);return;}
  if(state.drawing){announce('다각형 그리기를 먼저 완료해 주세요.',true);return;}
  cancelWalking();const request=state.request;clearReport();
  const center={...state.location};let area;
  if(mode==='radius'){
    if(state.draftPolygon)area={kind:'polygon',geometry:state.draftPolygon,label:'다각형',area:polygonArea(state.draftPolygon.coordinates[0])};
    else{const radius=radiusValue();if(!(radius>=50&&radius<=3000)){announce('반경을 50~3,000m로 입력해 주세요.',true);return;}area={kind:'radius',center,radius,label:`반경 ${fmt(radius)}m`,area:Math.PI*radius**2};}
  }else{
    const budget=mode==='distance'?Number($('walk-distance').value):Number($('walk-time').value)*4000/60;
    $('area-status').textContent='보행도로를 불러와 도달 가능한 도로를 계산하고 있습니다…';$('area-status').className='area-status';
    walkingController=new AbortController();document.querySelectorAll('[data-apply]').forEach(b=>b.disabled=true);
    try{
      const roads=await loadRoads(center,walkingController.signal,budget);
      if(request!==state.request)return;
      const walk=buildWalkingArea(roads,center,budget);
      area={kind:'walking',center,walk,label:mode==='distance'?`보행거리 ${(budget/1000).toFixed(1)}km`:`보행시간 ${$('walk-time').value}분`,area:null};
    }catch(error){
      if(request!==state.request)return;
      state.applied=null;$('area-status').textContent=error.message;$('area-status').className='area-status error';updateButtons();return;
    }finally{document.querySelectorAll('[data-apply]').forEach(b=>b.disabled=false);}
  }
  if(request!==state.request)return;
  state.applied=area;previewLayer?.clearLayers();selectionLayer?.clearLayers();
  if(view){
    let shape;
    const style={color:'#dfa400',weight:3,fillColor:'#ffcc32',fillOpacity:.3};
    if(area.kind==='radius')shape=L.circle([center.lat,center.lng],{...style,radius:area.radius}).addTo(selectionLayer);
    else if(area.kind==='walking')shape=L.geoJSON(area.walk.geometry,{style:{color:'#d0559b',weight:5,opacity:.7}}).addTo(selectionLayer);
    else shape=L.geoJSON(area.geometry,{style}).addTo(selectionLayer);
    shape.on('click',e=>{if($('pick-on-map').checked||state.drawing)return;L.DomEvent.stopPropagation(e);analyze();});
    const bounds=shape.getBounds();
    if(bounds.isValid())view.map.fitBounds(bounds,{paddingTopLeft:view.map.getSize().x>=1500?[80,80]:[Math.min(440,view.map.getSize().x*.34),80],paddingBottomRight:[120,60],maxZoom:17});
  }
  $('area-summary').textContent=area.label;
  $('area-status').textContent=area.kind==='walking'?`${area.label} 적용 완료 · 보행도로 최단거리 기준, 점포는 가까운 도로에서 60m 이내 연결. 시속 4km 가정.`:`${area.label} 적용 완료. 분석하기 또는 지도 위 영역을 클릭하세요.`;
  $('area-status').className='area-status success';updateButtons();announce(`${area.label}을 적용했습니다.`);
}
document.querySelectorAll('[data-apply]').forEach(b=>b.addEventListener('click',()=>applyArea(b.dataset.apply)));

function scopedRows(area){
  if(area.kind==='radius')return selectBusinesses(state.rows,{center:area.center,radius:area.radius});
  if(area.kind==='walking')return state.rows.filter(p=>distance(area.center,p)<=area.walk.budget&&area.walk.contains(p));
  return selectBusinesses(state.rows,{geometry:area.geometry});
}
function analyze(){
  if($('analyze').disabled)return;
  const all=scopedRows(state.applied),selected=all.filter(p=>matchesIndustry(p,state.industry.id));
  state.result={all,selected,industry:{...state.industry},location:{...state.location},area:state.applied};
  $('report-location').textContent='위치 '+state.location.name;$('report-industry').textContent='업종 '+state.industry.label;$('report-area').textContent=state.applied.label;
  const q=state.regional?.quarter;
  $('report-quarter').textContent=`${q?q.slice(0,4)+'년 '+q.slice(4)+'분기 · ':''}인허가 수집 기준 ${state.meta.snapshot}`;
  state.stores=true;$('tool-stores').setAttribute('aria-pressed','true');renderReport();openReport();drawStores();
}
$('analyze').addEventListener('click',analyze);
function openReport(){$('report-panel').hidden=false;$('open-report').hidden=true;$('tool-panel').hidden=true;if(window.innerWidth<=760)$('report-panel').scrollIntoView({behavior:'smooth',block:'start'});}
$('close-report').addEventListener('click',()=>{$('report-panel').hidden=true;$('open-report').hidden=!state.result;});
$('open-report').addEventListener('click',openReport);
$('print-report').addEventListener('click',()=>window.print());
function containingMarkets(point){return point?state.features.filter(f=>inGeometry([point.lng,point.lat],f.geometry)):[];}
function populationCards(point){
  const markets=containingMarkets(point);
  if(!markets.length)return '<p class="notice">선택 위치를 포함하는 공식 상권이 없어 상권별 인구 자료를 표시하지 않습니다.</p>';
  return `<p class="data-note">아래 값은 선택 위치가 포함된 공식 상권 단위입니다. ${escape(state.result?.area.label||'선택 영역')} 안의 인구로 환산하거나 합산하지 않습니다.</p>`+markets.slice(0,8).map(f=>{
    const record=state.layers?.byCode[f.properties.TRDAR_CD]||{},quarter=state.layers?.datasets.floating.quarter||'';
    return `<h3>${escape(f.properties.TRDAR_CD_NM)}</h3><small>${quarter.slice(0,4)}년 ${quarter.slice(4)}분기 · 상권코드 ${f.properties.TRDAR_CD}</small><dl class="metric-list"><div><dt>총 유동인구 (원자료 집계)</dt><dd>${record.floating==null?'자료 없음':fmt(record.floating)+'명'}</dd></div><div><dt>상주인구</dt><dd>${record.resident==null?'자료 없음':fmt(record.resident)+'명'}</dd></div><div><dt>직장인구</dt><dd>${record.worker==null?'자료 없음':fmt(record.worker)+'명'}</dd></div></dl>`;
  }).join('');
}
function currentReports(){
 const r=state.result;if(!r)return [];
 const candidates=containingMarkets(r.location).sort((a,b)=>Number(a.properties.RELM_AR)-Number(b.properties.RELM_AR));
 const market=state.regional?.areas[state.marketCode]||resolveMarkets(r.location,state.regional,state.features,r.industry)[0];
 const groups=new Map();for(const point of r.all){const label=groupFor(point).label;groups.set(label,(groups.get(label)||0)+1);}
 return buildReports({location:r.location,industry:r.industry,area:r.area,regional:state.regional,market,markets:candidates.map(f=>state.regional?.areas[f.properties.TRDAR_CD]).filter(Boolean),license:{selected:r.selected.length,total:r.all.length,snapshot:state.meta.snapshot,groups:[...groups].sort((a,b)=>b[1]-a[1]).slice(0,5),shops:r.selected.slice(0,30)}});
}
function renderReport(){
 if(!state.result)return;
 state.reports=currentReports();
 const report=state.reports.find(r=>r.id===state.reportTab);$('report-content').setAttribute('aria-labelledby','report-tab-'+state.reportTab);
 $('report-content').innerHTML=renderReportHTML(report);
}
async function exportPDF(all){
 const buttons=[$('download-pdfs'),$('download-pdf')];buttons.forEach(b=>b.disabled=true);
 try{if(all)await downloadReports(currentReports(),text=>$('pdf-status').textContent=text);else{await downloadOneReport(currentReports().find(r=>r.id===state.reportTab));$('pdf-status').textContent='현재 항목의 PDF를 저장했습니다.';}}
 catch(error){$('pdf-status').textContent=error.message;console.error(error);}finally{buttons.forEach(b=>b.disabled=false);}
}
$('download-pdfs').addEventListener('click',()=>exportPDF(true));
$('download-pdf').addEventListener('click',()=>exportPDF(false));
$('nearby-bank').addEventListener('click',()=>{if(state.result)moveToNearbyBank(view,state.result.location,text=>$('bank-status').textContent=text);});

document.querySelectorAll('[data-report]').forEach((b,index,list)=>{
  b.id='report-tab-'+b.dataset.report;b.setAttribute('aria-controls','report-content');
  b.addEventListener('click',()=>{state.reportTab=b.dataset.report;list.forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-selected',String(t===b));});renderReport();});
  b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?list.length-1:(index+(e.key==='ArrowRight'?1:-1)+list.length)%list.length;list[next].click();list[next].focus();});
});

function drawStores(){
  if(!view||!state.meta)return;storeLayer.clearLayers();if(!state.stores)return;
  const bounds=view.map.getBounds(),rows=(state.result?.selected||state.rows.filter(p=>!state.industry||matchesIndustry(p,state.industry.id))).filter(p=>bounds.contains([p.lat,p.lng]));
  const stride=Math.max(1,Math.ceil(rows.length/1200));
  for(const p of rows.filter((_,i)=>i%stride===0).slice(0,1200))L.circleMarker([p.lat,p.lng],{renderer,radius:4,color:'#fff',weight:1,fillColor:'#0c80cf',fillOpacity:.85}).bindTooltip(textNode(p.name)).on('click',()=>{if(!state.drawing&&!$('pick-on-map').checked){setLocation(p);showStep('location');}}).addTo(storeLayer);
}
function drawBoundaries(){
  if(!view||!state.meta)return;boundaryLayer.clearLayers();if(!state.boundaries)return;
  const district=$('map-district').value;
  L.geoJSON({type:'FeatureCollection',features:state.features.filter(f=>!district||f.properties.SIGNGU_CD_NM===district)},{renderer,style:{color:'#5790b9',weight:1.5,fillOpacity:.05},onEachFeature:(f,l)=>{l.bindTooltip(textNode(f.properties.TRDAR_CD_NM));l.on('click',()=>{if(state.drawing||$('pick-on-map').checked)return;showTool('공식 상권 영역',`<b>${escape(f.properties.TRDAR_CD_NM)}</b><p>${escape(f.properties.TRDAR_SE_CD_NM)} · ${fmt(Number(f.properties.RELM_AR))}m²<br>상권코드 ${escape(f.properties.TRDAR_CD)}</p><p>분석영역 탭에서 내 점포의 보행권역 또는 반경·다각형을 선택할 수 있습니다.</p>`);});}}).addTo(boundaryLayer);
}
function populateDongs(){const district=$('map-district').value,names=[...new Set(state.features.filter(f=>!district||f.properties.SIGNGU_CD_NM===district).map(f=>f.properties.ADSTRD_CD_NM))].sort((a,b)=>a.localeCompare(b,'ko'));$('map-dong').replaceChildren(new Option('전체',''),...names.map(n=>new Option(n,n)));}
$('map-district').addEventListener('change',()=>{populateDongs();if(view)focusDistrict(view.map,$('map-district').value);drawBoundaries();drawPopulationLayer();if($('address').value.trim())runSearch();});
$('map-dong').addEventListener('change',()=>{const features=state.features.filter(f=>f.properties.ADSTRD_CD_NM===$('map-dong').value&&(!$('map-district').value||f.properties.SIGNGU_CD_NM===$('map-district').value));if(features.length&&view)view.map.fitBounds(L.geoJSON({type:'FeatureCollection',features}).getBounds(),{paddingTopLeft:[430,80],paddingBottomRight:[120,50]});});
function showTool(title,html){$('tool-title').textContent=title;$('tool-content').innerHTML=html;$('tool-panel').hidden=false;$('report-panel').hidden=true;$('open-report').hidden=!state.result;}
$('close-tool').addEventListener('click',()=>$('tool-panel').hidden=true);
$('tool-boundaries').addEventListener('click',()=>{state.boundaries=!state.boundaries;$('tool-boundaries').setAttribute('aria-pressed',String(state.boundaries));drawBoundaries();announce(state.boundaries?'공식 상권 경계를 표시합니다. 경계를 클릭하면 정보를 볼 수 있습니다.':'공식 상권 경계를 숨겼습니다.');});
$('tool-stores').addEventListener('click',()=>{state.stores=!state.stores;$('tool-stores').setAttribute('aria-pressed',String(state.stores));drawStores();announce(state.stores?'확보 점포 분포를 표시합니다. 지도에는 최대 1,200곳, 분석에는 전체 데이터를 사용합니다.':'점포 분포를 숨겼습니다.');});
$('tool-history').addEventListener('click',()=>{
  const p=state.location;
  showTool('점포 인허가 이력',p?.industry?`<b>${escape(p.name)}</b><p>${escape(p.address)}</p><dl class="metric-list"><div><dt>최초 인허가일</dt><dd>${escape(p.opened||'자료 없음')}</dd></div><div><dt>수집 시점 상태</dt><dd>영업/정상</dd></div><div><dt>업태</dt><dd>${escape(p.industry)}</dd></div></dl><p>인허가 수집일: ${escape(state.meta.snapshot)}<br>최초 인허가일은 실제 현재 상호의 영업 시작일과 다를 수 있습니다. 폐업·상호변경 전체 이력은 미연결입니다.</p>`:'<p>인허가 점포 마커를 선택하면 원본의 인허가일과 수집 시점 영업상태를 확인할 수 있습니다. 일반 지도 장소에는 인허가 영업상태를 적용하지 않습니다.</p>');
});
function layerValue(feature,mode){const r=state.layers?.byCode[feature.properties.TRDAR_CD];if(mode==='floating')return r?.floating??null;const area=Number(feature.properties.RELM_AR);return r?.resident!=null&&area>0?r.resident/(area/1e6):null;}
function drawPopulationLayer(){
  if(!view)return;populationLayer.clearLayers();if(!state.populationLayer||!state.layers)return;
  const mode=state.populationLayer,district=$('map-district').value,features=state.features.filter(f=>!district||f.properties.SIGNGU_CD_NM===district),values=features.map(f=>layerValue(f,mode)).filter(v=>v!=null).sort((a,b)=>a-b);
  const cuts=[.2,.4,.6,.8].map(q=>values[Math.floor((values.length-1)*q)]||0),colors=['#eff3ff','#c6dbef','#6baed6','#3182bd','#08519c'];
  const color=f=>{const v=layerValue(f,mode);return v==null?'#ddd':colors[cuts.filter(c=>v>c).length];};
  L.geoJSON({type:'FeatureCollection',features},{renderer,style:f=>({color:'#7193b4',weight:1,fillColor:color(f),fillOpacity:.6}),onEachFeature:(f,l)=>{const v=layerValue(f,mode);l.bindTooltip(textNode(`${f.properties.TRDAR_CD_NM} · ${v==null?'자료 없음':fmt(Math.round(v))+(mode==='floating'?'명':'명/km²')}`));}}).addTo(populationLayer);
}
function togglePopulation(mode){
  if(!state.layers){announce('인구 레이어를 아직 불러오지 못했습니다.',true);return;}
  state.populationLayer=state.populationLayer===mode?null:mode;
  $('tool-floating').setAttribute('aria-pressed',String(state.populationLayer==='floating'));$('tool-density').setAttribute('aria-pressed',String(state.populationLayer==='density'));drawPopulationLayer();
  if(!state.populationLayer){$('tool-panel').hidden=true;return;}
  const title=mode==='floating'?'유동인구 (상권별)':'상주인구 밀도',quarter=state.layers.datasets[mode==='floating'?'floating':'resident'].quarter;
  showTool(title,`<b>${quarter.slice(0,4)}년 ${quarter.slice(4)}분기 · 공식 상권 경계 기준</b><div class="layer-legend">낮음 ${['#eff3ff','#c6dbef','#6baed6','#3182bd','#08519c'].map(c=>`<i style="background:${c}"></i>`).join('')} 높음</div><p>${mode==='floating'?'길단위 유동인구 원자료의 상권별 총 유동인구 집계값입니다. 도로 구간별 좌표 자료가 없어 도로선 대신 상권 경계에 표시합니다.':'상권별 상주인구 ÷ 공식 상권면적(km²)으로 계산했습니다. 회색은 자료 없음입니다.'}</p><p>각 상권은 겹칠 수 있어 값을 합산하지 않습니다. 지도 영역에 마우스를 올리면 원자료 값을 볼 수 있습니다.</p>`);
}
$('tool-floating').addEventListener('click',()=>togglePopulation('floating'));
$('tool-density').addEventListener('click',()=>togglePopulation('density'));
$('tool-building').addEventListener('click',()=>showTool('유동인구 (건물별)','<p>확보된 자료에는 건물별 유동인구가 없습니다. 상권별 길단위 유동인구 레이어를 이용해 주세요.</p>'));

// Comparison remains local to this browser tab, with frozen analysis conditions.
$('add-compare').addEventListener('click',()=>{
  if(!state.result)return;
  if(state.compare.length>=3){announce('최대 3개 분석을 비교할 수 있습니다.',true);return;}
  const r=state.result;state.compare.push({location:r.location.name,industry:r.industry.label,area:r.area.label,selected:r.selected.length,total:r.all.length,date:state.meta.snapshot});
  $('compare-count').textContent=state.compare.length;announce('비교 리스트에 담았습니다.');
});
function showComparisons(){
  info('비교담기 리스트',state.compare.length?`<p class="small-note">각 분석의 영역과 업종이 다를 수 있으므로 조건을 함께 비교하세요.</p><div class="comparison-grid">${state.compare.map((r,i)=>`<div class="comparison-card"><strong>${escape(r.location)}</strong><p>${escape(r.industry)}<br>${escape(r.area)}</p><b>${fmt(r.selected)}곳</b><p>확보 인허가 ${fmt(r.total)}건<br>${escape(r.date)} 수집 기준</p><button type="button" data-remove-compare="${i}">삭제</button></div>`).join('')}</div>`:'<p>분석 리포트에서 비교담기를 눌러 최대 3개 결과를 담아보세요.</p>');
  document.querySelectorAll('[data-remove-compare]').forEach(b=>b.addEventListener('click',()=>{state.compare.splice(Number(b.dataset.removeCompare),1);$('compare-count').textContent=state.compare.length;$('info-dialog').close();showComparisons();}));
}
$('tool-compare').addEventListener('click',showComparisons);

function finance(){
 const r=state.result;if(!r){announce('상권 분석을 먼저 완료해 주세요.',true);return;}
 const market=state.regional.areas[state.marketCode]||resolveMarkets(r.location,state.regional,state.features,r.industry)[0];
 try{launchConsultation(makeAnalysisContext({location:r.location,industry:r.industry,area:r.area,market,regional:state.regional,license:{selected:r.selected.length,total:r.all.length,snapshot:state.meta.snapshot},mode:'owner'}));}catch(e){announce(e.message,true);}
}
$('finance-link').addEventListener('click',finance);$('tool-finance').addEventListener('click',finance);
$('finance-close').addEventListener('click',()=>$('finance-dialog').close());
$('download-finance').addEventListener('click',()=>{const content=`금융상담 준비 메모 (미접수)\n${$('finance-context').textContent}\n상담 주제: ${$('finance-topic').value}\n메모: ${$('finance-memo').value}\n\n외부로 전송되지 않았습니다. 실제 상담은 별도 신청이 필요합니다.`,url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='금융상담-준비메모.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('finance-status').textContent='메모를 저장했습니다. 상담이 접수되지는 않았습니다.';});
$('info-close').addEventListener('click',()=>$('info-dialog').close());
$('help-button').addEventListener('click',()=>info('나는 사장 이용안내','<ol><li>점포위치: 상호·주소 검색 결과를 고르거나 지도에서 위치를 지정합니다.</li><li>업종선택: 대분류와 세부 업종을 고르고 다음을 누릅니다.</li><li>분석영역: 보행거리·보행시간·반경/다각형 중 하나를 고르고 적용합니다.</li><li>분석하기 또는 지도에 그려진 영역을 클릭하면 리포트가 열립니다.</li></ol><p>보행권역은 OSM 도로망 기준입니다. 상용 지도와 경로·포함 점포가 다를 수 있습니다. 금융상담은 메모 저장 시연 기능입니다.</p>'));
$('source-button').addEventListener('click',()=>info('데이터 출처와 제공 범위',`<p>음식점·서비스업·소매업 영업/정상 및 개원 인허가 중 좌표가 유효한 ${fmt(state.meta?.total||0)}건. 수집 기준 ${escape(state.meta?.snapshot||'')}</p><p>인허가 업태를 화면 업종으로 묶은 매핑은 industry-catalog.js에 기록했습니다. 공식 서비스업종과 정확히 같지 않으며 서비스업·소매업·제과점 추가 자료가 반영되어 있습니다. 인허가 자료는 전체 업종 모집단이 아닙니다. 동일 사업장의 복수 허가가 포함될 수 있어 고유 점포 수와 다릅니다.</p><p>지도는 카카오 지도 JavaScript SDK를 사용합니다. 지도 위의 분석 도형과 선택 동작은 Leaflet 레이어로 표시합니다. 보행 계산은 공개 도로의 연결관계와 거리로 수행하며 시속 4km, 도로에서 점포까지 최대 60m 연결을 가정합니다.</p><p>${escape(state.meta?.notes?.join(' ')||'')}</p><a href="https://data.seoul.go.kr/dataList/OA-23056/S/1/datasetView.do" target="_blank" rel="noreferrer">서울시 일반음식점 인허가</a><br><a href="https://data.seoul.go.kr/dataList/OA-23059/S/1/datasetView.do" target="_blank" rel="noreferrer">서울시 휴게음식점 인허가</a><br><a href="https://data.seoul.go.kr/dataList/OA-15560/S/1/datasetView.do" target="_blank" rel="noreferrer">서울시 상권영역</a><br><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors · ODbL</a>`));
$('collapse-picker').addEventListener('click',()=>{$('wizard').hidden=true;$('expand-picker').hidden=false;});
$('expand-picker').addEventListener('click',()=>{$('wizard').hidden=false;$('expand-picker').hidden=true;});
function resetSelection(notify=true){
  sessionStorage.removeItem(ANALYSIS_KEY);state.marketCode=null;cancelWalking();stopDrawing();state.location=null;renderMarketOptions();state.industry=null;state.applied=null;state.draftPolygon=null;state.radius=500;state.stores=false;state.boundaries=false;state.populationLayer=null;state.areaMode='distance';
  locationMarker?.remove();locationMarker=null;selectionLayer?.clearLayers();boundaryLayer?.clearLayers();populationLayer?.clearLayers();storeLayer?.clearLayers();
  $('map-district').value='';populateDongs();$('address').value='';clearSearchResults();$('location-status').textContent='';$('location-summary').removeAttribute('title');$('pick-on-map').checked=false;
  state.searchType='all';document.querySelectorAll('[data-search]').forEach(b=>{const active=b.dataset.search==='all';b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  for(const id of ['location-summary','industry-summary','area-summary'])$(id).textContent='선택해주세요';
  for(const id of ['tool-stores','tool-boundaries','tool-floating','tool-density'])$(id).setAttribute('aria-pressed','false');
  document.querySelector('[data-radius="500"]').click();$('walk-distance').value='500';$('walk-time').value='10';updateRange('walk-distance','walk-distance-value',n=>(n/1000).toFixed(1));updateRange('walk-time','walk-time-value',String);
  state.category='외식업';document.querySelector('[data-category="외식업"]').click();showAreaMode('distance');showStep('location');$('tool-panel').hidden=true;state.reports=[];clearReport();
  $('wizard').hidden=false;$('expand-picker').hidden=true;$('collapse-picker').setAttribute('aria-expanded','true');
  for(const id of ['info-dialog','finance-dialog'])if($(id).open)$(id).close();
  view?.map.setView(INITIAL_MAP_VIEW.center,INITIAL_MAP_VIEW.zoom,{animate:false});updateButtons();
  if(notify)announce('조건을 초기화했습니다.');else{clearTimeout(toastTimer);$('map-message').hidden=true;}
}
$('reset-map').addEventListener('click',()=>resetSelection());
// Browser history can reuse an old document with selected layers and form fields.
window.addEventListener('pageshow',event=>{if(event.persisted)resetSelection(false);});

async function load(){
  const json=async name=>{const response=await fetch(new URL('./assets/'+name,import.meta.url));if(!response.ok)throw Error(name+' 불러오기 실패');return response.json();};
  try{
    const [data,geo,meta,regional,additional,additionalMeta]=await Promise.all([json('businesses.json'),json('boundaries.geojson'),json('metadata.json'),json('regional-data.json'),json('additional-businesses.json'),json('additional-metadata.json')]);state.regional=regional;
    state.rows=data.rows.map(r=>Object.fromEntries(data.columns.map((key,i)=>[key,r[i]])));state.rows=state.rows.concat(additional.rows.map(r=>Object.fromEntries(additional.columns.map((key,i)=>[key,r[i]]))));state.features=geo.features;state.meta={...meta,total:meta.total+additionalMeta.total,snapshot:additionalMeta.snapshot,additional:additionalMeta};
    $('dataset-status').textContent=`인허가 기록 ${fmt(state.meta.total)}건 · ${state.meta.snapshot} 반영`;
    $('address').disabled=false;$('search-button').disabled=false;populateDongs();updateButtons();$('address').value='';clearSearchResults();
    try{state.layers=await json('map-layers.json');}catch(error){/* Point selection and analysis work independently of population layers. */}
    try{
      const poi=await json('places.json');
      const boundaries=state.features.map(f=>{const vertices=(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).flat(2);return {feature:f,bounds:vertices.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity])};});
      state.places=poi.places.map(p=>{const markets=boundaries.filter(({bounds:b,feature:f})=>p.lng>=b[0]&&p.lng<=b[2]&&p.lat>=b[1]&&p.lat<=b[3]&&inGeometry([p.lng,p.lat],f.geometry)).map(m=>m.feature.properties);return {...p,district:markets[0]?.SIGNGU_CD_NM||'',context:markets.map(m=>m.SIGNGU_CD_NM+' '+m.ADSTRD_CD_NM+' '+m.TRDAR_CD_NM).join(' ')};});
      if($('address').value.trim())runSearch();
    }catch(error){/* Public POIs are optional; licence search stays available. */}
  }catch(error){$('dataset-status').textContent='데이터를 불러오지 못했습니다.';announce(error.message+' · 새로고침해 주세요.',true);}
}
load();
