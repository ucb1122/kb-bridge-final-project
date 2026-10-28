import {makeAnalysisContext,launchConsultation,readAnalysis,ANALYSIS_KEY} from '../owner/consultation-data.js';
import {attachCustomArea} from './custom-area.js';
import {createMap} from '../owner/commercial-map.js';
import {districts,populateDistricts,focusDistrict} from '../../shared/districts.js';
import {officialFood,rankAreas,metricValue,quarterLabel} from '../owner/regional.js';
import {buildReports,renderReportHTML,downloadReports,downloadOneReport,htmlEscape as esc} from '../owner/reports.js';
import {inGeometry} from '../owner/analysis.js';
import {moveToNearbyBank} from '../owner/bank-locator.js';
const $=id=>document.getElementById(id),fmt=n=>n==null?'자료 없음':Number(n).toLocaleString('ko-KR');
const state={data:null,geo:null,category:'all',industry:{code:'all',label:'전체'},metric:'stores',ranked:[],market:null,reportTab:'summary',reports:[],analysisContext:null};
let view,markers,selectedLayer,custom;
function status(text){$('founder-status').textContent=text;}
try{view=createMap();view.map.panBy([-110,80],{animate:false});markers=L.layerGroup().addTo(view.map);selectedLayer=L.layerGroup().addTo(view.map);
 view.map.on('click',e=>{if(!state.data||$('ranking-stage').hidden||custom?.active)return;const found=state.geo.features.filter(f=>inGeometry([e.latlng.lng,e.latlng.lat],f.geometry)).sort((a,b)=>Number(a.properties.RELM_AR)-Number(b.properties.RELM_AR))[0];if(found)selectMarket(state.data.areas[found.properties.TRDAR_CD]);else status('이 위치에는 확보된 공식 상권이 없습니다. 지도 표식이나 목록에서 선택해 주세요.');});
 }catch(error){status(error.message);}
if(view)custom=attachCustomArea(view,()=>({industry:state.industry,data:state.data,geo:state.geo}),(reports,point,area)=>{
 state.reports=reports;state.market=point;state.analysisContext=custom?.context||null;$('report-location').textContent='위치 '+point.name;$('report-industry').textContent='업종 '+state.industry.label;$('report-area').textContent=area.label;$('report-quarter').textContent=quarterLabel(state.data.quarter);renderReport();$('report-panel').hidden=false;$('open-report').hidden=true;
},status);
populateDistricts($('map-district'));populateDistricts($('ranking-district'));$('ranking-district').options[0].text='서울시 전체';
function renderIndustries(){
 document.querySelectorAll('[data-category]').forEach(b=>{const active=b.dataset.category===state.category;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 let entries=[];
 if(state.category==='food')entries=officialFood;
 else if(state.category!=='all'&&state.data){const prefix=state.category==='service'?'CS2':'CS3';entries=Object.entries(state.data.industries).filter(([c])=>c.startsWith(prefix)).sort((a,b)=>a[1].localeCompare(b[1],'ko'));}
 $('industry-grid').replaceChildren();
 for(const [code,label] of entries){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.industry=code;b.classList.toggle('active',state.industry.code===code);b.setAttribute('aria-pressed',String(state.industry.code===code));b.onclick=()=>{state.industry={code,label};renderIndustries();};$('industry-grid').append(b);}
}
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{state.category=b.dataset.category;const labels={all:'전체',food:'외식업 전체',service:'서비스업 전체',retail:'소매업 전체'};state.industry={code:state.category,label:labels[state.category]};renderIndustries();});
$('confirm-industry').onclick=()=>{if(!state.data)return;$('industry-stage').hidden=true;$('ranking-stage').hidden=false;$('breadcrumb').textContent=(state.category==='all'?'전체':{food:'외식업',service:'서비스업',retail:'소매업'}[state.category])+' › '+state.industry.label;renderRanking();};
function reset(){sessionStorage.removeItem(ANALYSIS_KEY);state.analysisContext=null;custom?.reset();state.category='all';state.industry={code:'all',label:'전체'};state.market=null;state.reports=[];$('industry-stage').hidden=false;$('ranking-stage').hidden=true;$('report-panel').hidden=true;$('open-report').hidden=true;$('map-district').value='';$('ranking-district').value='';populateDongs();markers?.clearLayers();selectedLayer?.clearLayers();view?.map.setView([37.5665,126.978],12.25);renderIndustries();status('');}
$('start-over').onclick=reset;$('reset-map').onclick=reset;
function populateDongs(){const district=$('map-district').value;const names=state.data?[...new Set(Object.values(state.data.areas).filter(a=>!district||a.district===district).map(a=>a.dong))].sort((a,b)=>a.localeCompare(b,'ko')):[];$('map-dong').replaceChildren(new Option('전체',''),...names.map(n=>new Option(n,n)));}
function districtChanged(value){$('map-district').value=value;$('ranking-district').value=value;populateDongs();if(view)focusDistrict(view.map,value);if(!$('ranking-stage').hidden)renderRanking();}
$('map-district').onchange=()=>districtChanged($('map-district').value);
$('ranking-district').onchange=()=>districtChanged($('ranking-district').value);
$('map-dong').onchange=()=>{if(!$('ranking-stage').hidden)renderRanking();};
const metricNames={stores:'점포수',sales:'매출',floating:'유동인구',resident:'주거인구'};
const unit=m=>m==='stores'?'개':m==='sales'?'원':'명';
function displayValue(n,m){return m==='sales'&&n>=1e8?(n/1e8).toFixed(1)+'억원':fmt(n)+unit(m);}
document.querySelectorAll('[data-metric]').forEach(b=>b.onclick=()=>{state.metric=b.dataset.metric;document.querySelectorAll('[data-metric]').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',String(t===b));});renderRanking();});
function renderRanking(){
 if(!state.data)return;
 state.ranked=rankAreas(state.data,{district:$('ranking-district').value,dong:$('map-dong').value,industry:state.industry.code,metric:state.metric});
 $('ranking-title').textContent=metricNames[state.metric]+' 상승 지역';$('ranking-quarter').textContent=quarterLabel(state.data.quarter);
 $('ranking-list').replaceChildren();
 state.ranked.slice(0,10).forEach((a,i)=>{const b=document.createElement('button');b.type='button';b.className='ranking-row';b.innerHTML=`<span>${i+1}</span><span class="ranking-place"><b>${esc(a.district+' '+a.dong)}</b><small>${esc(a.name)}</small></span><b>${displayValue(a.value,state.metric)}</b><span class="${a.change>=0?'increase':'decrease'}">${a.change>0?'+':''}${a.change.toFixed(2)}% ${a.change>=0?'↑':'↓'}</span>`;b.onclick=()=>selectMarket(a);$('ranking-list').append(b);});
 if(!state.ranked.length)$('ranking-list').innerHTML='<p class="empty-ranking">비교 가능한 상권 자료가 없습니다. 다른 업종 또는 지역을 선택해 주세요.</p>';
 status(`${state.ranked.length}개 상권 · 전분기 값이 있는 상권의 증감률 순위입니다.`);drawMarkers();
}
function drawMarkers(){
 if(!view)return;markers.clearLayers();const rows=$('show-all-regions').checked?state.ranked:state.ranked.slice(0,10);
 rows.forEach((a,i)=>{const b=document.createElement('button');b.type='button';b.className='rank-pin';b.setAttribute('aria-label',`${i+1}위 ${a.name} 분석`);b.innerHTML=`<span class="rank-flag">${i+1}</span><strong>${esc(a.name)}</strong><small>${displayValue(a.value,state.metric)}</small>`;const m=L.marker([a.lat,a.lng],{icon:L.divIcon({className:'ranking-marker',html:b,iconSize:[132,126],iconAnchor:[66,85]}),zIndexOffset:1000-i}).addTo(markers);m.on('click',()=>selectMarket(a));});
 if(rows.length&&!state.market){const bounds=L.latLngBounds(rows.map(a=>[a.lat,a.lng]));view.map.fitBounds(bounds,{paddingTopLeft:[480,130],paddingBottomRight:[150,100],maxZoom:13});}
}
$('show-all-regions').onchange=drawMarkers;
function selectMarket(area){
 if(!area||!view)return;state.market=area;
 const feature=state.geo.features.find(f=>String(f.properties.TRDAR_CD)===area.code);selectedLayer.clearLayers();
 if(feature){const polygon=L.geoJSON(feature,{style:{color:'#b58b63',weight:3,dashArray:'8 7',fillColor:'#b58b63',fillOpacity:.08}}).addTo(selectedLayer);const size=view.map.getSize();view.map.fitBounds(polygon.getBounds(),{paddingTopLeft:[Math.min(440,size.x*.25),100],paddingBottomRight:[size.x*.5+25,70],maxZoom:16});}
 const context={location:{name:area.name,lat:area.lat,lng:area.lng,district:area.district},industry:state.industry,area:{label:area.type+' · 공식 상권영역',area:area.area,kind:'official'},regional:state.data,market:area};state.reports=buildReports(context);state.analysisContext=makeAnalysisContext({...context,mode:'founder'});
 $('report-location').textContent='위치 '+area.name;$('report-industry').textContent='업종 '+state.industry.label;$('report-area').textContent='기준분기 '+quarterLabel(state.data.quarter);$('report-quarter').textContent=quarterLabel(state.data.quarter);
 renderReport();$('report-panel').hidden=false;$('open-report').hidden=true;$('bank-status').textContent='';
}
function renderReport(){const report=state.reports.find(r=>r.id===state.reportTab);if(report)$('report-content').innerHTML=renderReportHTML(report);}
document.querySelectorAll('[data-report]').forEach((b,i,list)=>{b.onclick=()=>{state.reportTab=b.dataset.report;list.forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-selected',String(t===b));});$('report-content').setAttribute('aria-labelledby',b.id);renderReport();};b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?list.length-1:(i+(e.key==='ArrowRight'?1:-1)+list.length)%list.length;list[next].click();list[next].focus();}};});
$('close-report').onclick=()=>{$('report-panel').hidden=true;$('open-report').hidden=!state.market;};$('open-report').onclick=()=>{$('report-panel').hidden=false;$('open-report').hidden=true;};
async function exportPDF(all){const buttons=[$('download-pdfs'),$('download-pdf')];buttons.forEach(b=>b.disabled=true);try{if(all)await downloadReports(state.reports,t=>$('pdf-status').textContent=t);else{await downloadOneReport(state.reports.find(r=>r.id===state.reportTab));$('pdf-status').textContent='현재 항목의 PDF를 저장했습니다.';}}catch(e){$('pdf-status').textContent=e.message;console.error(e);}finally{buttons.forEach(b=>b.disabled=false);}}
$('download-pdfs').onclick=()=>exportPDF(true);$('download-pdf').onclick=()=>exportPDF(false);
$('finance-link').onclick=()=>{if(state.analysisContext)launchConsultation(state.analysisContext);else status('상권 분석을 먼저 선택해 주세요.');};
$('nearby-bank').onclick=()=>{if(state.market)moveToNearbyBank(view,state.market,t=>$('bank-status').textContent=t);};
$('collapse-picker').onclick=()=>{$('founder-picker').hidden=true;$('expand-picker').hidden=false;};$('expand-picker').onclick=()=>{$('founder-picker').hidden=false;$('expand-picker').hidden=true;};
$('help-button').onclick=()=>{$('info-dialog').showModal();};$('info-close').onclick=()=>$('info-dialog').close();
async function load(){try{const json=async file=>{const r=await fetch(new URL('../owner/assets/'+file,import.meta.url));if(!r.ok)throw Error('상권 자료 불러오기 실패');return r.json();};[state.data,state.geo]=await Promise.all([json('regional-data.json'),json('boundaries.geojson')]);populateDongs();renderIndustries();$('confirm-industry').disabled=false;status('');const saved=readAnalysis(sessionStorage);if(saved?.mode==='founder'&&(saved.area.kind!=='official'||state.data.areas[saved.market?.code])){state.category=saved.industry.code==='food'||saved.industry.code?.startsWith('CS1')?'food':saved.industry.code==='service'||saved.industry.code?.startsWith('CS2')?'service':saved.industry.code==='retail'||saved.industry.code?.startsWith('CS3')?'retail':'all';state.industry={...saved.industry};renderIndustries();$('confirm-industry').click();districtChanged(saved.market?.district||'');if(saved.area.kind!=='official'&&custom)await custom.restore(saved);else selectMarket(state.data.areas[saved.market.code]);}}catch(error){status(error.message+' · 새로고침해 주세요.');}}
load();
