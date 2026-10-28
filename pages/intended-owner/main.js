import {initRecoveryPlanner} from './recovery-planner.js?v=kind-2';
import {createMap} from './commercial-map.js';
import {calculateImpact} from './impact-model.js';
import {validateHeatResults,classificationFor,HEAT_LABELS} from './heat-adapter.js';
import {escapeHTML as esc,regionKey,pointInGeometry,filterRegions} from './navigator-model.js';
import {initCooperation} from './cooperation-view.js?v=20261027-3';
import {validateClosureRisk,riskRows,riskDetail,criteriaHTML} from './closure-risk.js';

const $=id=>document.getElementById(id),SEOUL=[37.5665,126.978],fmt=n=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(n);
const state={role:new URLSearchParams(location.search).get('role')==='landlord'?'landlord':'tenant',kind:'area',district:'',query:'',heat:'all',selected:null};
const freshDraft=()=>({rentChangePercent:'0',rateEnabled:false,vacancyEnabled:false,example:false});
const drafts={tenant:freshDraft(),landlord:freshDraft()};
let snapshot=null,features=[],view=null,baseLayer=null,selectedLayer=null,selectionRenderer=null,lastResult=null,heatState=validateHeatResults(null),heatConnectionError='';
let closureData=null,rankLayer=null,closureLoading=true;
const regionByKey=new Map(),featureByKey=new Map();
const draft=()=>drafts[state.role];
const setStatus=text=>{$('region-status').textContent=text;};
function financeURL({category='',q=''}={}){const params=new URLSearchParams({role:state.role});if(category)params.set('category',category);if(q)params.set('q',q);if(state.selected)params.set('region',state.selected.name);return '/pages/guide/?'+params;}

const inputIds={rentAmount:'rent-amount',rentChangePercent:'rent-change-value',loanBalance:'loan-balance',rateChangePp:'rate-change-value',vacancySharePercent:'vacancy-share',vacancyMonths:'vacancy-months',currentMonthlyCashflow:'current-cashflow'};
function renderRole(){
 const landlord=state.role==='landlord',d=draft();
 for(const button of document.querySelectorAll('[data-role]'))button.setAttribute('aria-pressed',String(button.dataset.role===state.role));
 for(const [key,id]of Object.entries(inputIds))$(id).value=d[key]??'';
 $('rent-change').value=d.rentChangePercent??'0';$('rate-enabled').checked=!!d.rateEnabled;$('vacancy-enabled').checked=!!d.vacancyEnabled;
 $('rate-fields').hidden=!d.rateEnabled;$('vacancy-option').hidden=!landlord;$('vacancy-fields').hidden=!d.vacancyEnabled;
 $('simulator-heading').textContent=landlord?'월세를 올려도, 임대수입은 줄 수 있을까요?':'월세가 바뀌면, 부담은 얼마나 달라질까요?';
 $('simulator-description').textContent=landlord?'인상 효과를 먼저 보고, 일부 공실이 생기는 경우도 비교해요.':'월세와 인상률만으로 먼저 확인해요.';
 $('rent-amount-label').textContent=landlord?'현재 월 임대수입':'현재 월세';$('rent-amount').placeholder=landlord?'예: 800':'예: 180';
 $('rent-change-label').textContent=landlord?'임대료 변동률':'월세 변동률';
 $('mechanism-heading').textContent=landlord?'일부 호실의 공실이 길어지면, 인상 이익이 사라질 수 있어요.':'더 내는 월세만큼, 남는 돈은 줄 수 있어요.';
 $('mechanism-description').textContent=landlord?'공실 발생을 예측하지 않습니다. 어느 정도 수입 손실까지 감당할 수 있는지 조건별로 비교해요.':'매출·운영비를 모두 입력할 필요 없이, 월세와 선택한 금리 변화의 영향만 확인해요.';
 const paths=landlord?[['기존 대출 상환조건','business',''],['임대사업 관련 대출','business','일사천리'],['기업대출 상세정보','corporate','']]:[['기존 대출 조건 상담','business','119'],['운영자금·보증 확인','business','보증'],['정책자금 상세정보','policy','']];
 $('finance-path-list').innerHTML=paths.map(([label,category,q])=>`<a href="${esc(financeURL({category,q}))}">${esc(label)} →</a>`).join('');
 $('finance-catalog').href=financeURL();$('map-finance-link').href=financeURL();$('open-simulator').textContent='지도와 상생 조건 함께 비교 →';renderSimulation();
}
function rentBars(items){
 const max=Math.max(1,...items.map(item=>Math.abs(item[1]))),fmtMoney=n=>fmt(n)+'만원';
 return '<div class="rent-bars">'+items.map(([label,value])=>`<div class="rent-bar-row"><span>${esc(label)}</span><div class="rent-track"><i style="width:${Math.max(0,value/max*100)}%"></i></div><strong>${esc(fmtMoney(value))}</strong></div>`).join('')+'</div>';
}
function renderSimulation(){
 const d=draft(),landlord=state.role==='landlord';lastResult=calculateImpact({...d,role:state.role});const r=lastResult;
 $('input-mode').textContent=d.example?'설명용 예시':'직접 입력';$('input-mode').classList.toggle('example',!!d.example);
 for(const [key,id]of Object.entries(inputIds))$(id).setAttribute('aria-invalid',String(r.errors.some(error=>error.field===key)));
 $('calculation-assumptions').innerHTML=r.assumptions.map(text=>'<li>'+esc(text)+'</li>').join('');
 $('calculation-status').classList.toggle('invalid',r.status==='invalid');
 $('baseline-label').textContent=landlord?'현재 월 임대수입':'현재 월세';$('scenario-label').textContent=landlord?(d.vacancyEnabled?'부분 공실 반영 월평균':'변경 후 월 임대수입'):'변경 후 월세';
 $('difference-label').textContent=landlord?(d.rateEnabled?'월평균 수입·지출 변화':'월평균 임대수입 변화'):'한 달 지출 변화';
 $('optional-cashflow').hidden=true;$('landlord-insight').hidden=true;
 if(r.status!=='ready'){
  $('baseline-value').textContent='—';$('scenario-value').textContent='—';$('difference-value').textContent='금액을 입력해 주세요';
  $('difference-card').classList.remove('positive');
  $('calculation-status').textContent=r.errors[0]?.message||(r.missing.includes('rentAmount')?'현재 금액 하나만 입력하면 비교를 시작할 수 있어요.':'선택한 추가 항목의 빈칸을 채우거나 선택을 꺼 주세요.');
  $('cashflow-chart').innerHTML='<div class="chart-empty">월세·임대수입의 변화를 보여드려요.</div>';$('cashflow-breakdown').textContent='입력하지 않은 고객 정보는 추정하지 않습니다.';
  $('rent-change-summary').textContent='현재 금액을 입력해 주세요.';return;
 }
 const diff=r.monthlyDifference;
 $('baseline-value').textContent=fmt(r.rentAmount)+'만원';$('scenario-value').textContent=fmt(landlord?r.monthlyRentAfterVacancy:r.scenarioRent)+'만원';
 $('difference-value').textContent=diff===0?'변동 없음':fmt(Math.abs(diff))+'만원 '+(landlord?(diff>0?'증가':'감소'):(diff>0?'감소':'증가'));
 $('difference-card').classList.toggle('positive',diff>=0);
 $('calculation-status').textContent=landlord?(d.vacancyEnabled?`추가 공실: 임대수입 ${fmt(Number(d.vacancySharePercent))}%에 ${fmt(Number(d.vacancyMonths))}개월만 반영 · 12개월 평균`:'추가 공실은 반영하지 않은 비교예요. 표시한 금액은 잔여현금이 아닌 임대수입입니다.'):(d.rateEnabled?'월세와 추가 이자에 따른 지출 변화입니다. 원금 상환액은 그대로인 가정이에요.':'월세 변화만 반영했어요. 매출이나 현재 남는 돈을 추정하지 않습니다.');
 $('rent-change-summary').textContent=fmt(r.rentAmount)+' → '+fmt(r.scenarioRent)+'만원'+(landlord?' · 공실 반영 전':'');
 const bars=[['현재',r.rentAmount],['임대료 변경',r.scenarioRent]];if(landlord&&d.vacancyEnabled)bars.push(['부분 공실 반영',r.monthlyRentAfterVacancy]);
 $('cashflow-chart').innerHTML=rentBars(bars);
 if(r.currentMonthlyCashflow!==null){$('optional-cashflow').hidden=false;$('optional-cashflow').innerHTML='<span>직접 입력한 월 잔여현금</span><strong>'+esc(fmt(r.currentMonthlyCashflow))+' → '+esc(fmt(r.scenarioMonthlyCashflow))+'만원</strong><small>현재 잔여현금에 위 수입·지출 변화만 반영했습니다.</small>';}
 $('cashflow-breakdown').innerHTML='<p>임대료 변화: 월 '+esc(fmt(r.rentChangeAmount))+'만원<br>금리 변화: '+(d.rateEnabled?'월 이자 '+esc(fmt(r.monthlyInterestChange))+'만원 변화':'비교에 포함하지 않음')+(landlord?'<br>추가 공실 손실: '+(d.vacancyEnabled?'연 '+esc(fmt(r.annualVacancyLoss))+'만원':'비교에 포함하지 않음'):'')+'<br>연간 수입·지출 차이: '+esc(fmt(r.annualDifference))+'만원</p>';
 if(landlord){
  $('landlord-insight').hidden=false;
  $('landlord-insight').innerHTML=r.rentOnlyBreakEvenLossPercent!==null?'<strong>인상 후 연 임대수입의 '+esc(fmt(r.rentOnlyBreakEvenLossPercent))+'%가 줄면, 월세 인상 이익이 사라져요.</strong><p>금리·비용 제외 · 공실 예측이 아닌 조건 비교입니다.</p>':'임대료 인상률을 정하면, 인상 이익을 상쇄하는 수입 손실 비중도 볼 수 있어요.';
 }
}
function fillExample(){drafts[state.role]=state.role==='tenant'?{...freshDraft(),rentAmount:'180',rentChangePercent:'10',example:true}:{...freshDraft(),rentAmount:'800',rentChangePercent:'10',example:true};$('more-options').open=false;renderRole();}
function resetInputs(){drafts[state.role]=freshDraft();$('more-options').open=false;renderRole();}
for(const button of document.querySelectorAll('[data-role]'))button.onclick=()=>{state.role=button.dataset.role;$('more-options').open=false;renderRole();};
for(const [key,id]of Object.entries(inputIds))$(id).addEventListener('input',()=>{draft()[key]=$(id).value;draft().example=false;if(key==='rentChangePercent')$('rent-change').value=$(id).value;renderSimulation();});
$('rent-change').oninput=()=>{draft().rentChangePercent=$('rent-change').value;$('rent-change-value').value=$('rent-change').value;renderSimulation();};
for(const [key,id,target]of[['rateEnabled','rate-enabled','rate-fields'],['vacancyEnabled','vacancy-enabled','vacancy-fields']])$(id).onchange=()=>{draft()[key]=$(id).checked;$(target).hidden=!$(id).checked;renderSimulation();};
$('cashflow-form').onsubmit=event=>event.preventDefault();$('fill-example').onclick=fillExample;$('clear-inputs').onclick=resetInputs;

function makeRegionButton(row,{place=false}={}){
 const button=document.createElement('button');button.type='button';button.className='region-result';
 if(!place)button.setAttribute('aria-current',String(state.selected&&regionKey(state.selected)===regionKey(row)));
 const classification=!place&&row.kind==='area'?classificationFor(heatState,row.code)?.classification:null;
 button.innerHTML=`<span><strong>${esc(row.name)}</strong><small>${esc(place?(row.line||'역 주변 상권 찾기'):row.district+' · '+(row.type||'상권'))}</small></span><span class="result-badge">${esc(place?'장소':classification?HEAT_LABELS[classification]:state.kind==='area'?'결과 없음':'행정동')}</span>`;
 button.onclick=()=>place?selectPlace(row):selectRegion(row);return button;
}
function renderSearch(){
 if(closureLoading&&!closureData){$('region-results').replaceChildren();setStatus('Python 분석 결과를 불러오는 중입니다.');return;}
 if(closureData){
  const target=$('region-results');target.replaceChildren();target.classList.add('risk-list');
  const rows=riskRows(snapshot.regions,closureData,state);
  for(const [i,row]of rows.slice(0,10).entries()){
   const result=closureData.byCode.get(row.code),button=document.createElement('button');button.type='button';button.className='region-result';button.setAttribute('aria-current',String(state.selected&&regionKey(state.selected)===regionKey(row)));
   button.innerHTML=`<span class="risk-rank">${i+1}</span><span><strong>${esc(row.name)}</strong><small>${esc(row.district+' · '+(row.type||'행정동'))}${result?.rank?' · 서울 '+result.rank+'위':''}</small></span><span class="risk-score">${result?.predictedClosureRate===null||!result?'—':fmt(result.predictedClosureRate)+'%'}<small>${result?.status==='insufficient'?'자료미비':state.kind==='area'?'예측 폐업률':'분류 없음'}</small></span>`;
   button.onclick=()=>selectRegion(row);target.append(button);
  }
  if(!rows.length)target.innerHTML='<p class="region-empty">조건에 맞는 상권이 없습니다. 전체 평가 상권으로 바꾸거나 검색 조건을 확인하세요.</p>';
  $('risk-ranking-title').textContent=state.kind==='dong'?'행정동 찾기':state.heat==='unknown'?'자료미비 상권':state.heat==='all'?'예측 폐업률 상위 10곳':'폐업 위험이 높은 상권';
  setStatus(`${rows.length.toLocaleString('ko-KR')}개 중 ${Math.min(10,rows.length)}개 표시 · 2025 입력 → 2027 추정`);
  return;
 }
 const target=$('region-results');target.replaceChildren();if(!snapshot)return;
 const rows=filterRegions(snapshot.regions,{...state,classifications:heatState.results});
 const places=state.query&&state.heat==='all'?snapshot.places.filter(place=>state.query.trim().split(/\s+/).every(word=>(place.name+' '+(place.line||'')).includes(word))).slice(0,3):[];
 for(const row of rows.slice(0,8))target.append(makeRegionButton(row));for(const row of places)target.append(makeRegionButton(row,{place:true}));
 if(!rows.length&&!places.length)target.innerHTML='<div class="region-empty">일치하는 지역이 없습니다. 다른 이름이나 자치구로 찾아보세요.</div>';
 setStatus(`${rows.length.toLocaleString('ko-KR')}개 지역${state.query?' 검색됨':' · 이름순 일부 표시'}${!heatState.ready?' · 과열 분류 결과 미연결':''}`);
}
function renderHeat(){
 if(closureLoading&&!closureData){$('heat-title').textContent='폐업 위험 분석을 불러오는 중';$('heat-badge').textContent='로딩 중';$('heat-description').textContent='상권별 계산 결과와 선정 기준을 확인하고 있습니다.';return;}
 if(closureData){
  const detail=riskDetail(closureData,state.selected);$('heat-filter').disabled=state.kind!=='area';
  $('heat-title').textContent=detail.title;$('heat-badge').textContent=detail.badge;$('heat-badge').className='badge';$('heat-description').textContent=detail.description;
  $('heat-evidence').innerHTML=detail.html;$('heat-evidence').hidden=!detail.html;
  document.querySelector('.classification-box').classList.toggle('closure-candidate',closureData.byCode.get(state.selected?.code)?.status==='candidate');
  for(const el of document.querySelectorAll('[data-classified]'))el.hidden=false;
  $('map-connection-title').textContent='Python 폐업률 분석 연결 완료';$('map-connection-note').textContent='2025년 원자료 → 2027년 예측 폐업률 · G지수는 보조정보';
  return;
 }
 $('heat-filter').disabled=state.kind!=='area';
 const row=state.selected?.kind==='area'?classificationFor(heatState,state.selected.code):null;
 $('heat-evidence').hidden=true;$('heat-evidence').replaceChildren();$('heat-badge').className='badge';
 for(const item of document.querySelectorAll('[data-classified]'))item.hidden=!heatState.ready;
 $('map-connection-title').textContent=heatState.ready?'검토된 상권 분류 결과 연결됨':'과열 분석결과 연결 대기';
 $('map-connection-note').textContent=heatState.ready?'분류 색상과 근거를 확인해 주세요. 지역 분류는 개별 가게의 폐업 예측이 아닙니다.':'지금은 상권 경계와 공개 통계를 볼 수 있어요. 결과 없는 지역은 비과열이 아닙니다.';

 if(!heatState.ready){$('heat-title').textContent=heatState.status==='invalid'?'분석결과 확인 필요':'분석결과 연결 대기';$('heat-badge').textContent='미연결';$('heat-description').textContent=heatConnectionError||'팀의 기준·분석결과가 연결되지 않았습니다. 결과 없는 지역은 비과열로 보지 않습니다.';return;}
 $('heat-title').textContent=state.selected?state.selected.name:'상권 분류 결과 연결됨';
 $('heat-badge').textContent=row?HEAT_LABELS[row.classification]:'결과 없음';if(row)$('heat-badge').classList.add(row.classification);
 $('heat-description').textContent=state.selected?.kind==='dong'?'현재 분석결과는 개별 상권 단위입니다. 행정동으로 바꾸어 분류하지 않습니다.':row?row.reason:'선택한 상권의 결과가 없습니다. 비과열로 해석하지 않습니다.';
 if(row){const meta=heatState.metadata;$('heat-evidence').hidden=false;$('heat-evidence').innerHTML='<p>'+esc(`${meta.scope==='forecast'?'예측':'관측 분류'} · ${meta.asOfDate} · ${meta.analysisVersion}`)+'</p>'+row.evidence.map(e=>'<p>'+esc(e.label+': '+(e.value===null?'자료 없음':fmt(e.value)+' '+e.unit)+' · '+e.period)+'</p>').join('');}
}
function drawBoundaries(){
 if(closureData&&view&&features.length){
  baseLayer.clearLayers();if(!rankLayer)rankLayer=L.layerGroup().addTo(view.map);rankLayer.clearLayers();
  const rows=riskRows(snapshot.regions,closureData,{...state,query:''}),codes=new Set(rows.map(r=>regionKey(r)));
  const collection={type:'FeatureCollection',features:features.filter(f=>codes.has(regionKey(f.properties)))};
  L.geoJSON(collection,{style:f=>{const r=closureData.byCode.get(String(f.properties.code)),candidate=state.kind==='area'&&r?.status==='candidate';return{color:candidate?'#cf6c78':'#8b98a6',weight:candidate?1.7:.8,fillColor:candidate?'#f0a9b1':'#b9c2cc',fillOpacity:candidate?.36:.06,opacity:.8,dashArray:r?.status==='insufficient'?'3 4':null};},onEachFeature(f,layer){const region=regionByKey.get(regionKey(f.properties)),r=closureData.byCode.get(String(f.properties.code));layer.bindTooltip((region?.name||f.properties.name)+(state.kind==='area'&&r?.predictedClosureRate!==null&&r?' · 예측 폐업률 '+fmt(r.predictedClosureRate)+'%':''),{sticky:true});layer.on('click',event=>{L.DomEvent.stopPropagation(event);if(region)selectRegion(region);});}}).addTo(baseLayer);
  if(state.kind==='area')for(const [i,r]of riskRows(snapshot.regions,closureData,state).filter(r=>closureData.byCode.get(r.code)?.rank!==null).slice(0,10).entries()){
   L.marker([r.lat,r.lng],{zIndexOffset:500,title:r.name,icon:L.divIcon({className:'risk-rank-marker',html:`<div class="risk-rank-pin"><b>${i+1}</b><span>${esc(r.name)}</span></div>`,iconSize:[30,30],iconAnchor:[15,15]})}).bindTooltip(esc(r.name),{direction:'top'}).addTo(rankLayer).on('click',()=>selectRegion(r));
  }
  selectedLayer.bringToFront?.();return;
 }
 if(!view||!features.length)return;baseLayer.clearLayers();
 const collection={type:'FeatureCollection',features:features.filter(feature=>feature.properties.kind===state.kind&&(!state.district||feature.properties.district===state.district)&&(state.heat==='all'||(classificationFor(heatState,feature.properties.code)?.classification||'unknown')===state.heat))};
 L.geoJSON(collection,{style:feature=>{const row=state.kind==='area'?classificationFor(heatState,feature.properties.code):null,col=row?.classification==='overheated'?'#d76725':row?.classification==='not_overheated'?'#438aab':'#8b98a6';return{color:col,weight:row?.classification&&row.classification!=='unknown'?1.6:.9,opacity:.75,fillColor:col,fillOpacity:row?.classification&&row.classification!=='unknown'?.25:.075};},onEachFeature(feature,layer){const row=regionByKey.get(regionKey(feature.properties));layer.bindTooltip(row?.name||feature.properties.name,{sticky:true});layer.on('click',event=>{L.DomEvent.stopPropagation(event);if(row)selectRegion(row);});}}).addTo(baseLayer);
 selectedLayer.bringToFront?.();
}
function selectRegion(region){
 if(!region)return;state.selected=region;document.dispatchEvent(new CustomEvent('bridge:region-selected',{detail:{...region,risk:closureData?.byCode.get(String(region.code))}}));$('clear-selection').disabled=false;selectedLayer?.clearLayers();
 const feature=featureByKey.get(regionKey(region));if(view&&feature){const layer=L.geoJSON(feature,{renderer:selectionRenderer,style:{color:'#d89c00',weight:3,fillColor:'#ffcc30',fillOpacity:.23},interactive:false}).addTo(selectedLayer);view.map.fitBounds(layer.getBounds(),{padding:[24,24],maxZoom:14.75,animate:false});}
 $('map-title').textContent=region.name;document.querySelector('.map-caption').textContent='서울특별시 › '+region.district;$('simulator-region-name').textContent=region.district+' · '+region.name+' · 직접 입력 비교';$('map-finance-link').href=financeURL();$('finance-catalog').href=financeURL();view?.show([{lat:region.lat,lng:region.lng,name:region.name}]);$('selected-name').textContent=region.name;$('selected-detail').textContent=region.district+' · '+(region.type||'행정동')+' · '+region.quarter.slice(0,4)+'년 '+region.quarter.slice(4)+'분기';
 const metric=(value,unit)=>typeof value==='number'&&Number.isFinite(value)?fmt(value)+unit:'자료 없음';
 $('region-metrics').hidden=false;$('region-metrics').innerHTML=[['전체 업종 점포수',metric(region.metrics.stores,'개')],['분기 상권 추정매출',metric(region.metrics.sales===null?null:region.metrics.sales/1e8,'억원')],['분기 유동인구 집계',metric(region.metrics.floating,'명')],['직장인구(지역 집계)',metric(region.metrics.worker,'명')]].map(([label,val])=>'<div><span>'+esc(label)+'</span><strong>'+esc(val)+'</strong></div>').join('');

 const url=new URL('/pages/rising/report.html',location.origin);url.searchParams.set('kind',region.kind);url.searchParams.set('code',region.code);url.searchParams.set('quarter',region.quarter);url.searchParams.set('industry','all');$('analysis-link').href=url.pathname+url.search;$('analysis-link').textContent='선택 지역 상세보고서 →';
 $('map-note').textContent=region.name+' · 노랑은 선택 지역, 연한 빨강은 폐업 위험 관찰 상권';renderHeat();renderSearch();
}
function matchingRegions(lat,lng){const visible=closureData?new Set(riskRows(snapshot.regions,closureData,{...state,query:''}).map(regionKey)):null;return features.filter(feature=>feature.properties.kind===state.kind&&(!state.district||feature.properties.district===state.district)&&(!visible||visible.has(regionKey(feature.properties)))&&pointInGeometry([lng,lat],feature.geometry)).map(feature=>regionByKey.get(regionKey(feature.properties))).filter(Boolean);}
function chooseMatches(rows){if(rows.length===1){selectRegion(rows[0]);return;}if(!rows.length){setStatus('이 위치의 공식 지역을 찾지 못했습니다. 자치구·지역 단위를 바꾸거나 이름으로 검색해 주세요.');return;}const target=$('region-results');target.replaceChildren(...rows.map(row=>makeRegionButton(row)));setStatus('겹치는 지역이 있습니다. 목록에서 상권을 선택해 주세요.');}
function selectPlace(place){view?.map.setView([place.lat,place.lng],14,{animate:false});chooseMatches(matchingRegions(place.lat,place.lng));}
function clearRegion(){state.selected=null;document.dispatchEvent(new CustomEvent('bridge:region-selected',{detail:null}));$('clear-selection').disabled=true;selectedLayer?.clearLayers();view?.show([]);$('map-title').textContent=state.district||'서울특별시 전체';document.querySelector('.map-caption').textContent='서울시 상권 지도';$('simulator-region-name').textContent='지역 미선택 · 직접 입력 비교';$('map-finance-link').href=financeURL();$('finance-catalog').href=financeURL();$('selected-name').textContent='관심 지역을 선택해 주세요';$('selected-detail').textContent='검색 또는 지도에서 지역을 선택할 수 있습니다.';$('region-metrics').hidden=true;$('analysis-link').href='/pages/owner/';$('analysis-link').textContent='내 상권 분석 열기 →';$('map-note').textContent='검색하거나 지도에서 상권 경계를 눌러보세요.';renderHeat();renderSearch();}
$('region-search-form').onsubmit=event=>{event.preventDefault();state.query=$('region-search').value;renderSearch();if(closureData)drawBoundaries();};$('region-search').oninput=()=>{state.query=$('region-search').value;renderSearch();if(closureData)drawBoundaries();};
$('region-kind').onchange=()=>{state.kind=$('region-kind').value;state.heat='all';$('heat-filter').value='all';clearRegion();drawBoundaries();};
$('district').onchange=()=>{state.district=$('district').value;clearRegion();drawBoundaries();const bounds=baseLayer?.getBounds();if(view&&bounds?.isValid())view.map.fitBounds(bounds,{padding:[40,40],maxZoom:13,animate:false});};$('heat-filter').onchange=()=>{state.heat=$('heat-filter').value;renderSearch();drawBoundaries();};
$('clear-region').onclick=()=>{state.query='';state.district='';state.heat=closureData?'candidate':'all';$('region-search').value='';$('district').value='';$('heat-filter').value=state.heat;clearRegion();drawBoundaries();view?.map.setView(SEOUL,11.25,{animate:false});};$('seoul-view').onclick=()=>view?.map.setView(SEOUL,11.25,{animate:false});
async function jsonAsset(name){const response=await fetch(new URL('./assets/'+name,import.meta.url));if(!response.ok)throw Error(name+' 불러오기 실패');return response.json();}
async function loadClosure(){
 try{
  closureData=validateClosureRisk(await jsonAsset('closure-risk.json'),new Set(snapshot.regions.filter(r=>r.kind==='area').map(r=>r.code)));closureLoading=false;
  state.heat='candidate';$('heat-filter').innerHTML='<option value="candidate">폐업 위험 관찰 상권 · 상위 10%</option><option value="all">전체 평가·자료미비 상권</option><option value="unknown">자료미비 · 별도 확인</option>';
  $('analysis-criteria-body').innerHTML=criteriaHTML(closureData);$('risk-ranking-heading').hidden=false;$('risk-period').hidden=false;
  document.querySelector('[data-classified] .heat-dot').parentElement.lastChild.textContent='폐업 위험 관찰 상권';document.querySelector('[data-classified] .nonheat-dot').parentElement.lastChild.textContent='그 외 평가 상권';
  document.querySelector('.map-legend .unknown-dot').parentElement.lastChild.textContent='자료미비';
  $('region-total-note').textContent=`평가 ${closureData.eligibleCount.toLocaleString('ko-KR')}개 · 관찰 ${closureData.candidateCount}개 · 자료미비 ${closureData.unavailableCount}개`;
  renderHeat();renderSearch();drawBoundaries();
 }catch(error){closureLoading=false;console.error('[폐업 위험 분석]',error);$('heat-title').textContent='폐업 위험 분석 연결 확인 필요';$('heat-description').textContent='분석 파일을 검증하지 못했습니다. 지역 분류를 표시하지 않습니다.';setStatus('분석 결과를 확인하지 못했습니다.');}
}
async function loadHeat(){try{const connection=await jsonAsset('heat-connection.json');if(connection.resultFile){if(!/^[a-zA-Z0-9_.-]+\.json$/.test(connection.resultFile))throw Error('결과 파일 이름을 확인해 주세요.');const raw=await jsonAsset(connection.resultFile);heatState=validateHeatResults(raw,new Set(snapshot.regions.filter(row=>row.kind==='area').map(row=>row.code)));if(heatState.errors.length)console.error('[상생 네비게이터 분석결과]',heatState.errors);}}catch(error){console.error(error);heatConnectionError='분석결과 파일을 확인하지 못했습니다. 과열 분류는 표시하지 않습니다.';}for(const option of $('heat-filter').options)if(['overheated','not_overheated'].includes(option.value)){option.disabled=!heatState.ready;option.textContent=HEAT_LABELS[option.value]+(heatState.ready?'':' · 결과 연결 후');}renderHeat();renderSearch();drawBoundaries();}
async function loadRegions(){try{const [data,boundaries]=await Promise.all([jsonAsset('regions.json'),jsonAsset('boundaries.json')]);snapshot=data;features=boundaries.features;for(const row of data.regions)regionByKey.set(regionKey(row),row);for(const feature of features)featureByKey.set(regionKey(feature.properties),feature);for(const district of [...new Set(data.regions.map(row=>row.district))].sort((a,b)=>a.localeCompare(b,'ko'))){const option=document.createElement('option');option.value=district;option.textContent=district;$('district').append(option);}$('district').disabled=false;$('region-search').disabled=false;renderSearch();drawBoundaries();await loadClosure();}catch(error){console.error('[상생 네비게이터 지역자료]',error);setStatus('지역 자료를 불러오지 못했습니다. 시뮬레이터는 계속 이용할 수 있습니다.');$('map-note').textContent='지역 자료를 확인해 주세요.';}}
try{view=createMap();view.map.setView(SEOUL,11.25,{animate:false});baseLayer=L.featureGroup().addTo(view.map);selectedLayer=L.featureGroup().addTo(view.map);selectionRenderer=L.svg({padding:.2});view.map.on('click',event=>{if(snapshot)chooseMatches(matchingRegions(event.latlng.lat,event.latlng.lng));});new ResizeObserver(()=>view.map.invalidateSize()).observe($('map'));}catch(error){console.error(error);$('map-note').textContent='지도를 불러오지 못했습니다. 지역 검색으로 계속 이용할 수 있습니다.';}

function summaryRows(){const r=lastResult,d=draft(),ready=r?.status==='ready';return[['고객 유형',state.role==='tenant'?'임차인(개인사업자)':'임대인(건물주)'],['관심 지역',state.selected?state.selected.district+' '+state.selected.name:'선택하지 않음'],['입력 구분',d.example?'설명용 예시':'고객 직접 입력'],['현재 월세·임대수입',ready?fmt(r.rentAmount)+'만원':'입력하지 않음'],['임대료 변동 가정',String(d.rentChangePercent??'').trim()?d.rentChangePercent+'%':'입력하지 않음'],['월 수입·지출 영향',ready?fmt(r.monthlyDifference)+'만원 (잔여현금에 미치는 변화)':'계산하지 않음'],['현재 월 잔여현금',ready&&r.currentMonthlyCashflow!==null?fmt(r.currentMonthlyCashflow)+'만원':'입력하지 않음'],['변경 후 월 잔여현금',ready&&r.scenarioMonthlyCashflow!==null?fmt(r.scenarioMonthlyCashflow)+'만원':'계산하지 않음'],['금리 변화',d.rateEnabled?(String(d.rateChangePp??'').trim()?d.rateChangePp+'%p':'입력 필요'):'선택하지 않음'],...(state.role==='landlord'?[['추가 공실 가정',d.vacancyEnabled?'임대수입 '+(d.vacancySharePercent??'미입력')+'% / '+(d.vacancyMonths??'미입력')+'개월':'선택하지 않음']]:[])];}
$('prepare-consultation').onclick=()=>{const panel=document.querySelector('.finance-details');panel.open=true;panel.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});};
$('download-summary').onclick=()=>{const content='상권브릿지 상담 준비 메모 (은행 미접수)\n\n'+summaryRows().map(([label,value])=>label+': '+value).join('\n')+'\n\n입력한 가정에 따른 단순 비교입니다. 실제 매출·상환 이력은 검증되지 않았고 은행에 전송되지 않았습니다.';const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='상생네비게이터_상담준비.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function setComparison(open){$('simulator-dialog').hidden=!open;document.querySelector('.map-workspace').classList.toggle('comparison-open',open);$('open-simulator').setAttribute('aria-expanded',String(open));requestAnimationFrame(()=>view?.map.invalidateSize());}
$('open-simulator').onclick=()=>setComparison(true);
$('close-comparison').onclick=()=>setComparison(false);
$('clear-selection').onclick=()=>{clearRegion();$('clear-selection').disabled=true;};
let panelsVisible=true;
$('toggle-panels').onclick=()=>{panelsVisible=!panelsVisible;document.querySelector('.map-workspace').classList.toggle('panels-collapsed',!panelsVisible);$('toggle-panels').setAttribute('aria-expanded',String(panelsVisible));$('toggle-panels').textContent=panelsVisible?'지도 넓게 보기':'검색·지역 정보 보기';view?.map.invalidateSize();};
$('show-evidence').onclick=()=>$('evidence-dialog').showModal();$('show-help').onclick=()=>$('help-dialog').showModal();for(const button of document.querySelectorAll('[data-close-dialog]'))button.onclick=()=>button.closest('dialog').close();
initCooperation();
initRecoveryPlanner();
document.addEventListener('bridge:restore-region',event=>{const region=snapshot?.regions.find(row=>row.kind==='area'&&row.code===event.detail.code);if(region)selectRegion(region);});
renderRole();renderHeat();loadRegions();
