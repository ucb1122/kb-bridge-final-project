import {districts,populateDistricts,focusDistrict} from '../../shared/districts.js';
import {renderReportTab} from './full-report.js';

const $=id=>document.getElementById(id);
const labels={stores:'점포수',sales:'매출',footfall:'유동인구',residents:'상주인구'};
let kind='dong',metric='stores',map,requestId=0,summaryId=0,rows=[],selectedCode,pinned=false;
const appliedFilters={criterion:'growth',comparison:'previous',industry:'all',period:'quarter',quarter:'',year:''};
let draftFilters={...appliedFilters},availableQuarters=[];
let badges,provider='leaflet';
const summaryCache=new Map();
const boundaryCache=new Map();
let boundaryFeatures=[],boundaryPolygons=[],markerElements=new Map(),hoveredCode=null;
let dongFeatures=[],districtFeatures=[],districtOutlines=[],hoverLabel;
async function initializeMap(){
  const config=await api('/api/rising/map-config');
  if(!config.kakaoJavaScriptKey)throw Error('카카오 지도 JavaScript 키를 .env에 설정해 주세요.');
  if(config.kakaoJavaScriptKey){
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=`https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${encodeURIComponent(config.kakaoJavaScriptKey)}`;
      script.onload=()=>{
        if(window.kakao?.maps?.load)window.kakao.maps.load(resolve);
        else reject(Error('카카오 지도 SDK를 불러오지 못했습니다.'));
      };
      script.onerror=()=>reject(Error('카카오 지도 SDK를 불러오지 못했습니다.'));
      document.head.append(script);
    });
    provider='kakao';
    map=new kakao.maps.Map($('map'),{center:new kakao.maps.LatLng(37.5665,126.978),level:9});
    hoverLabel=new kakao.maps.CustomOverlay({zIndex:999,yAnchor:1});
    badges=[];
  }
}
const reportToggle=document.createElement('button');
reportToggle.id='region-card-toggle';reportToggle.className='region-card-toggle';reportToggle.type='button';reportToggle.textContent='❯';
reportToggle.setAttribute('aria-label','보고서 접기');reportToggle.setAttribute('aria-expanded','true');$('region-card').prepend(reportToggle);
reportToggle.onclick=()=>{const collapsed=$('region-card').classList.toggle('collapsed');reportToggle.textContent=collapsed?'❮':'❯';reportToggle.setAttribute('aria-label',collapsed?'보고서 펼치기':'보고서 접기');reportToggle.setAttribute('aria-expanded',String(!collapsed))};
const sidebar=document.querySelector('.sidebar'),sidebarToggle=document.createElement('button');
sidebarToggle.id='sidebar-toggle';sidebarToggle.className='sidebar-toggle';sidebarToggle.type='button';sidebarToggle.textContent='❮';
sidebarToggle.setAttribute('aria-label','뜨는 상권 창 접기');sidebarToggle.setAttribute('aria-expanded','true');sidebar.after(sidebarToggle);
sidebarToggle.onclick=()=>{const collapsed=sidebar.classList.toggle('collapsed');sidebar.inert=collapsed;sidebarToggle.classList.toggle('collapsed',collapsed);sidebarToggle.textContent=collapsed?'❯':'❮';sidebarToggle.setAttribute('aria-label',collapsed?'뜨는 상권 창 펼치기':'뜨는 상권 창 접기');sidebarToggle.setAttribute('aria-expanded',String(!collapsed))};
const mapTop=document.querySelector('.map-top'),mapTopToggle=document.createElement('button');
mapTopToggle.id='map-top-toggle';mapTopToggle.className='map-top-toggle';mapTopToggle.type='button';mapTopToggle.textContent='접기';
mapTopToggle.setAttribute('aria-label','지도 지역 선택창 접기');mapTopToggle.setAttribute('aria-expanded','true');mapTop.append(mapTopToggle);
mapTopToggle.onclick=()=>{const collapsed=mapTop.classList.toggle('collapsed');mapTopToggle.textContent=collapsed?'펼치기':'접기';mapTopToggle.setAttribute('aria-label',collapsed?'지도 지역 선택창 펼치기':'지도 지역 선택창 접기');mapTopToggle.setAttribute('aria-expanded',String(!collapsed))};

document.querySelectorAll('[data-kind]').forEach(button=>button.onclick=()=>{kind=button.dataset.kind;select('[data-kind]',button);load()});
document.querySelectorAll('[data-metric]').forEach(button=>button.onclick=()=>{metric=button.dataset.metric;select('[data-metric]',button);if(!['stores','sales'].includes(metric)){appliedFilters.industry='all';draftFilters.industry='all'}syncFilterUi();load()});
function select(selector,button){document.querySelectorAll(selector).forEach(item=>item.classList.toggle('selected',item===button))}
function syncFilterUi(){
  for(const button of document.querySelectorAll('[data-filter]')){
    const active=draftFilters[button.dataset.filter]===button.dataset.value;
    button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));
  }
  $('filter-quarter-field').hidden=draftFilters.period!=='quarter';
  $('filter-year-field').hidden=draftFilters.period!=='year';
  const industryAvailable=['stores','sales'].includes(metric);
  for(const button of document.querySelectorAll('[data-filter="industry"]'))button.disabled=!industryAvailable;
  $('filter-industry-hint').hidden=industryAvailable;
}
function closeFilter(){const body=$('filter-body');body.hidden=true;$('filter-toggle').setAttribute('aria-expanded','false')}
$('filter-toggle').onclick=()=>{const body=$('filter-body');if(body.hidden){draftFilters={...appliedFilters};syncFilterUi()}body.hidden=!body.hidden;$('filter-toggle').setAttribute('aria-expanded',String(!body.hidden))};
function chooseFilter(button){
  draftFilters[button.dataset.filter]=button.dataset.value;
  if(button.dataset.filter==='quarter')draftFilters.year=button.dataset.value.slice(0,4);
  if(button.dataset.filter==='year')draftFilters.quarter=availableQuarters.find(q=>q.startsWith(button.dataset.value))??draftFilters.quarter;
  syncFilterUi();
}
document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>chooseFilter(button));
$('filter-cancel').onclick=()=>{draftFilters={...appliedFilters};syncFilterUi();closeFilter()};
$('filter-apply').onclick=()=>{
  Object.assign(appliedFilters,draftFilters);
  if(appliedFilters.period==='year')appliedFilters.quarter=availableQuarters.find(q=>q.startsWith(appliedFilters.year))??appliedFilters.quarter;
  $('quarter').value=appliedFilters.quarter;
  closeFilter();load();
};
$('district').onchange=()=>{syncDistrict($('district').value);populateDongs();load()};
$('map-district').onchange=()=>{syncDistrict($('map-district').value);populateDongs();load()};
$('dong').onchange=selectDong;
$('map-dong').onchange=selectDong;
$('region-card-close').onclick=()=>{$('region-card').hidden=true;selectedCode=null;pinned=false;summaryId++;drawMap()};
document.querySelectorAll('[data-report-tab]').forEach(button=>button.onclick=()=>{
  document.querySelectorAll('[data-report-tab]').forEach(tab=>tab.classList.toggle('selected',tab===button));
  const body=$('report-body'),section=$('report-'+button.dataset.reportTab);
  body.scrollTo({top:body.scrollTop+section.getBoundingClientRect().top-body.getBoundingClientRect().top,behavior:'smooth'});
});
function syncDistrict(name){
  $('district').value=name;$('map-district').value=name;
  drawDistrictOutline();
  if(!map)return;
  if(provider==='leaflet')return focusDistrict(map,name);
  const district=districts.find(([label])=>label===name);
  const outline=districtFeatures.find(feature=>feature.properties?.district===name);
  if(outline){
    const bounds=new kakao.maps.LatLngBounds();
    for(const ring of outline.geometry.coordinates)for(const [lng,lat] of ring)bounds.extend(new kakao.maps.LatLng(lat,lng));
    const leftPadding=sidebar.classList.contains('collapsed')?40:Math.min(sidebar.getBoundingClientRect().width+32,$('map').clientWidth*.4);
    map.setBounds(bounds,40,40,40,leftPadding);
  }else{
    map.setCenter(new kakao.maps.LatLng(district?.[1]??37.5665,district?.[2]??126.978));
    map.setLevel(district?7:9);
  }
}
function populateDongs(){
  const district=$('district').value;
  const features=dongFeatures.filter(feature=>!district||feature.properties?.district===district)
    .sort((a,b)=>a.properties.name.localeCompare(b.properties.name,'ko'));
  for(const select of [$('dong'),$('map-dong')])select.replaceChildren(new Option('전체',''),...features.map(feature=>
    new Option(district?feature.properties.name:`${feature.properties.district} ${feature.properties.name}`,feature.properties.code)));
}
function drawDistrictOutline(){
  districtOutlines.forEach(line=>line.setMap(null));districtOutlines=[];
  const district=$('district').value;
  if(provider!=='kakao'||!district)return;
  const feature=districtFeatures.find(item=>item.properties?.district===district);
  for(const ring of feature?.geometry?.coordinates??[]){
    const path=ring.map(([lng,lat])=>new kakao.maps.LatLng(lat,lng));
    const line=new kakao.maps.Polyline({map,path,strokeWeight:4,strokeColor:'#d82d72',strokeOpacity:.95,strokeStyle:'solid',zIndex:4});
    districtOutlines.push(line);
  }
}
async function selectDong(event){
  const code=event.target.value;
  $('dong').value=code;$('map-dong').value=code;
  if(!code){selectedCode=null;pinned=false;hoveredCode=null;$('region-card').hidden=true;syncDistrict($('district').value);drawMap();return}
  const feature=dongFeatures.find(item=>String(item.properties?.code)===code);
  if(!feature)return;
  kind='dong';select('[data-kind]',document.querySelector('[data-kind="dong"]'));
  const district=feature.properties.district;
  if($('district').value!==district){syncDistrict(district);populateDongs();$('dong').value=code;$('map-dong').value=code}
  await load();
  try{
    const summary=await api('/api/rising/summary?'+new URLSearchParams({kind:'dong',code:feature.properties.code,quarter:$('quarter').value}));
    const item=summary?.metrics?.[metric];
    if(!item)return;
    const coordinates=feature.geometry.type==='Polygon'?feature.geometry.coordinates[0]:feature.geometry.coordinates[0][0];
    const [lng,lat]=coordinates[Math.floor(coordinates.length/2)];
    focusRegion({code:feature.properties.code,name:feature.properties.name,district,value:item.value,change:item.change,lat,lng});
  }catch(error){$('status').textContent=error.message}
}
function format(value,which=metric){return which==='sales'?(value/1e8).toLocaleString('ko-KR',{maximumFractionDigits:1})+'억 원':which==='footfall'?Math.round(value/1e4).toLocaleString('ko-KR')+'만 명':Math.round(value).toLocaleString('ko-KR')+(which==='stores'?'개':'명')}
function changeText(value){return value==null?'비교 자료 없음':`${value>=0?'+':''}${(value*100).toFixed(1)}%`}
function rankingComparison(row){return appliedFilters.criterion==='highest'?'':appliedFilters.criterion==='absolute'?(row.delta==null?'—':`${row.delta>=0?'+':''}${format(row.delta)}`):changeText(row.change)}
function html(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function boundaryPaths(geometry){
  if(!geometry)return [];
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
  return polygons.map(rings=>rings.map(ring=>ring.map(([lng,lat])=>new kakao.maps.LatLng(lat,lng))));
}
function updateBoundaryStyles(){
  for(const {polygon,code} of boundaryPolygons){
    const active=pinned&&code===selectedCode,hovered=code===hoveredCode;
    polygon.setOptions({
      strokeColor:active?'#4b25a9':hovered?'#0879ce':'#7645c2',
      strokeWeight:active?2:hovered?1.5:1,
      strokeStyle:active?'shortdash':'solid',
      strokeOpacity:active||hovered?.9:.001,
      fillColor:active?'#7950dc':hovered?'#8c68e8':'#ae94e9',
      fillOpacity:active?.36:hovered?.22:.001
    });
    polygon.setZIndex(active?3:hovered?2:0);
  }
  for(const [code,element] of markerElements){
    element.classList.toggle('region-hovered',code===hoveredCode);
    element.querySelector('.rank-badge')?.classList.toggle('active',pinned&&code===selectedCode);
  }
}
function setHover(code){hoveredCode=code;updateBoundaryStyles()}
function drawBoundaries(){
  hoverLabel?.setMap(null);hoveredCode=null;
  boundaryPolygons.forEach(({polygon})=>polygon.setMap(null));boundaryPolygons=[];
  if(provider!=='kakao')return;
  const ranked=new Map(rows.map((row,i)=>[String(row.code),{row,rank:i+1}]));
  const district=$('district').value;
  for(const feature of boundaryFeatures){
    const code=String(feature.properties?.code??''),match=ranked.get(code);
    if(district&&feature.properties?.district!==district)continue;
    for(const path of boundaryPaths(feature.geometry)){
      if(!path[0]||path[0].length<3)continue;
      const polygon=new kakao.maps.Polygon({map,path,strokeStyle:'solid',strokeOpacity:.001,fillOpacity:.001,zIndex:0});
      boundaryPolygons.push({polygon,code});
      kakao.maps.event.addListener(polygon,'mouseover',event=>{
        setHover(code);
        hoverLabel.setContent(`<div class="boundary-hover-label">${html(feature.properties?.district??'')} ${html(feature.properties?.name??'')}</div>`);
        hoverLabel.setPosition(event.latLng);hoverLabel.setMap(map);
        if(match)showSummary(match.row,match.rank);
      });
      kakao.maps.event.addListener(polygon,'mousemove',event=>hoverLabel.setPosition(event.latLng));
      kakao.maps.event.addListener(polygon,'mouseout',()=>{if(hoveredCode===code){setHover(null);hoverLabel.setMap(null)}});
      if(match)kakao.maps.event.addListener(polygon,'click',()=>focusRegion(match.row));
    }
  }
  updateBoundaryStyles();
}

function drawMap(){
  if(!map)return;
  if(provider==='kakao'){badges.forEach(overlay=>overlay.setMap(null));badges=[];markerElements=new Map();drawBoundaries();drawDistrictOutline()}
  else badges.clearLayers();
  $('map-legend').textContent=provider==='kakao'&&!boundaryFeatures.length
    ?'지역 경계 데이터가 없습니다. 순위 원을 선택해 보고서를 열 수 있습니다.'
    :'지역에 마우스를 올리면 경계가 표시됩니다. 원이나 순위 지역을 선택하면 보고서가 열립니다.';
  rows.forEach((row,i)=>{
    if(!Number.isFinite(row.lat)||!Number.isFinite(row.lng))return;
    const active=selectedCode===row.code;
    const content=`<div class="rank-badge ${active?'active':''} ${i<3?'top-rank':''}"><span class="badge-number">${i+1}</span><span class="badge-name">${html(row.name)}</span><span class="badge-value">${html(format(row.value))}</span></div>`;
    if(provider==='kakao'){
      const element=document.createElement('button');
      element.type='button';element.className='rank-marker kakao-rank-marker';element.innerHTML=content;
      element.setAttribute('aria-label',`${i+1}위 ${row.district} ${row.name} ${format(row.value)}`);
      let overlay;
      element.onmouseenter=()=>{setHover(String(row.code));showSummary(row,i+1);overlay.setZIndex(2000)};
      element.onmouseleave=()=>{if(hoveredCode===String(row.code))setHover(null);overlay.setZIndex(pinned&&selectedCode===row.code?1000:10-i)};
      element.onfocus=()=>showSummary(row,i+1);
      element.onclick=()=>focusRegion(row);
      markerElements.set(String(row.code),element);
      overlay=new kakao.maps.CustomOverlay({position:new kakao.maps.LatLng(row.lat,row.lng),content:element,yAnchor:.5,zIndex:active?1000:10-i});
      overlay.setMap(map);badges.push(overlay);
    }else{
      L.marker([row.lat,row.lng],{icon:L.divIcon({className:'rank-marker',html:content,iconSize:[82,82],iconAnchor:[41,41]}),zIndexOffset:active?1000:10-i})
        .bindTooltip(`${row.district} ${row.name} · ${format(row.value)}`,{direction:'top',offset:[0,-40]})
        .on('mouseover',()=>showSummary(row,i+1)).on('click',()=>focusRegion(row)).addTo(badges);
    }
  });
}
function focusRegion(row){
  pinned=true;showSummary(row,rows.indexOf(row)>=0?rows.indexOf(row)+1:null,true);
  $('region-card').classList.remove('collapsed');reportToggle.textContent='❯';reportToggle.setAttribute('aria-label','보고서 접기');reportToggle.setAttribute('aria-expanded','true');drawMap();
  if(!map)return;
  if(Number.isFinite(row.lat)&&Number.isFinite(row.lng)){
    if(provider==='kakao'){map.setCenter(new kakao.maps.LatLng(row.lat,row.lng));map.setLevel(4)}
    else map.setView([row.lat,row.lng],16);
  }
}
async function showSummary(row,rank,clicked=false){
  if(pinned&&!clicked)return;
  if(selectedCode!==row.code){$('report-body').scrollTop=0;document.querySelectorAll('[data-report-tab]').forEach(tab=>tab.classList.toggle('selected',tab.dataset.reportTab==='overview'))}
  selectedCode=row.code;$('region-card').hidden=false;
  updateBoundaryStyles();
  $('region-type').textContent=kind==='dong'?'뜨는 동네':'뜨는 상권';
  $('region-title').textContent=`${row.district} ${row.name}`;
  $('region-rank').textContent=`${labels[metric]}${rank==null?'':` 순위 ${rank}위`} · ${format(row.value)}${appliedFilters.criterion==='highest'?'':` · ${appliedFilters.period==='year'?'전년':appliedFilters.comparison==='same'?'전년 동분기':'전분기'} 대비 ${rankingComparison(row)}`}`;
  $('report-overview').textContent='지역 데이터를 불러오는 중…';
  for(const tab of ['industry','sales','population','hinterland'])$('report-'+tab).textContent='';
  $('region-pdf').href='/pages/rising/report.html?'+new URLSearchParams({kind,code:row.code,quarter:$('quarter').value,rank:String(rank??''),metric});
  const current=++summaryId,key=`${$('quarter').value}:${kind}:${row.code}`;
  try{
    let summary=summaryCache.get(key);
    if(!summary){summary=await api('/api/rising/report?'+new URLSearchParams({quarter:$('quarter').value,kind,code:row.code}));summaryCache.set(key,summary)}
    if(current!==summaryId||!summary)return;
    for(const tab of ['overview','industry','sales','population','hinterland'])renderReportTab($('report-'+tab),summary,tab);
    if(clicked){
      try{const analysis=await api('/api/rising/analysis?'+new URLSearchParams({kind,code:row.code,quarter:$('quarter').value}));if(current===summaryId)renderReportTab($('report-overview'),summary,'overview',analysis)}
      catch(error){if(current===summaryId)renderReportTab($('report-overview'),summary,'overview',{mode:'data',lines:[],note:error.message})}
    }
  }catch(error){if(current===summaryId)$('report-overview').textContent=error.message}
}
function render(list){
  $('ranking').replaceChildren(...list.map((row,i)=>{
    const li=document.createElement('li'),rank=document.createElement('span'),name=document.createElement('span'),value=document.createElement('strong'),change=document.createElement('span');
    rank.textContent=i+1;name.textContent=`${row.district} ${row.name}`;value.textContent=format(row.value);
    change.textContent=rankingComparison(row);change.className='change '+((appliedFilters.criterion==='absolute'?row.delta:row.change)>=0?'up':'down');
    li.append(rank,name,value,change);li.tabIndex=0;
    li.onmouseenter=()=>showSummary(row,i+1);li.onfocus=()=>showSummary(row,i+1);
    li.onclick=()=>focusRegion(row);li.onkeydown=e=>{if(e.key==='Enter')focusRegion(row)};return li;
  }));drawMap();
}
function updateSource(rankingSource){
  const scope=kind==='dong'?'행정동별':'상권별';
  const notes={stores:'업종별 전체 점포 수 합계',sales:'업종별 당월 추정매출액 합계',footfall:`${scope} 분기 유동인구 수`,residents:`${scope} 상주인구 수`};
  $('rank-metric').textContent=labels[metric]+' 기준';
  $('source-note').textContent=`자료: 서울시 상권분석서비스 ${kind==='dong'?'행정동별':'상권별'} 원본 CSV · ${notes[metric]}. ${rankingSource==='official'?`순위와 증감률은 서울시 화면 기준${metric==='sales'?'이며 매출액도 서울시 표시값을 따릅니다':''}.`:'선택한 상세조건으로 원본 CSV를 집계한 순위입니다.'}`;
}
async function api(url){const response=await fetch(url),data=await response.json();if(!response.ok)throw Error(data.error||'데이터 조회 실패');return data}
async function init(){
  try{
    await initializeMap();
    const filters=await api('/api/filters');populateDistricts($('district'));populateDistricts($('map-district'));
    try{const dongs=await api('/api/rising/boundaries?kind=dong');dongFeatures=dongs.features??[];boundaryCache.set('dong',dongs);populateDongs()}catch(error){$('status').textContent='행정동 목록을 불러오지 못했습니다: '+error.message}
    try{const outlines=await api('/pages/rising/district-boundaries.geojson');districtFeatures=outlines.features??[]}catch(error){$('status').textContent='자치구 경계를 불러오지 못했습니다: '+error.message}
    availableQuarters=filters.quarters;
    $('quarter').replaceChildren(...availableQuarters.map(q=>new Option(`${q.slice(0,4)}년 ${q.slice(4)}분기`,q)));
    appliedFilters.quarter=availableQuarters[0]??'';appliedFilters.year=appliedFilters.quarter.slice(0,4);draftFilters={...appliedFilters};
    $('filter-quarters').replaceChildren(...availableQuarters.slice(0,5).map(q=>{const button=document.createElement('button');button.type='button';button.dataset.filter='quarter';button.dataset.value=q;button.textContent=`${q.slice(0,4)}년 ${q.slice(4)}분기`;return button}));
    const years=Array.from({length:4},(_,i)=>String(Number(appliedFilters.year)-3+i));
    $('filter-years').replaceChildren(...years.map(y=>{const button=document.createElement('button');button.type='button';button.dataset.filter='year';button.dataset.value=y;button.textContent=`${y}년`;button.disabled=!availableQuarters.some(q=>q.startsWith(y));return button}));
    document.querySelectorAll('#filter-quarters [data-filter],#filter-years [data-filter]').forEach(button=>button.onclick=()=>chooseFilter(button));
    syncFilterUi();
    await load();
    drawMap();
  }catch(error){$('status').textContent=error.message}
}
async function load(){
  const current=++requestId,params=new URLSearchParams({kind,metric,district:$('district').value,criterion:appliedFilters.criterion,comparison:appliedFilters.comparison,industry:appliedFilters.industry,period:appliedFilters.period,year:appliedFilters.year});
  if($('quarter').value)params.set('quarter',$('quarter').value);
  $('status').textContent='SQLite에서 데이터를 읽는 중…';
  try{
    const data=await api('/api/rankings?'+params);if(current!==requestId)return;
    rows=data.rows;selectedCode=null;hoveredCode=null;pinned=false;summaryId++;$('region-card').hidden=true;
    if(provider==='kakao'){
      try{
        if(!boundaryCache.has(kind))boundaryCache.set(kind,await api('/api/rising/boundaries?kind='+kind));
        if(current!==requestId)return;
        boundaryFeatures=boundaryCache.get(kind).features??[];
      }catch(error){boundaryFeatures=[];$('map-legend').textContent='지역 경계를 불러오지 못했습니다: '+error.message}
    }
    render(rows);updateSource(data.rankingSource);
    $('rank-scope').textContent=$('district').value||'전체';
    $('period').textContent=data.quarter?`${appliedFilters.period==='year'?`${appliedFilters.year}년`:`${data.quarter.slice(0,4)}년 ${data.quarter.slice(4)}분기`} 기준${appliedFilters.criterion==='highest'?'':` (${appliedFilters.period==='year'?'전년':appliedFilters.comparison==='same'?'전년 동분기':'전분기'} 대비)`}`:'데이터 없음';
    $('status').textContent=!data.available?'data/raw/seoul_public_data.zip을 넣고 npm run import:raw를 실행하세요.':data.rows.length?'':'선택한 조건의 데이터가 없습니다.';
  }catch(error){if(current===requestId)$('status').textContent=error.message}
}
init();
