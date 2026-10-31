import {fundingSummary,nearestBranches,founderSupport} from './model.js';
import {loadKakaoMaps} from '../../../../shared/kakao-bootstrap.js';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const kind=params.get('kind'),code=params.get('code'),quarter=params.get('quarter'),industry=params.get('industry')||'all';
const origin={lat:null,lng:null};
let report,branches=[],support=[],branchMeta,financeMeta,chosenBranch=null,purpose='startup',category='all',step=1,map,branchMarker;
const money=n=>n===null?'미입력':`${n.toLocaleString('ko-KR',{maximumFractionDigits:2})}만원`;
const add=(parent,tag,value,className)=>{const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;parent.append(el);return el};

async function getJson(url){const response=await fetch(url);if(!response.ok)throw Error(`자료를 불러오지 못했습니다 (${response.status}).`);return response.json()}
function showError(message){$('app').hidden=true;$('load-error').hidden=false;$('load-error').querySelector('p').textContent=message}
function setStep(next){step=next;document.querySelectorAll('[data-page]').forEach(el=>el.hidden=Number(el.dataset.page)!==next);document.querySelectorAll('[data-step]').forEach(el=>{const n=Number(el.dataset.step);el.classList.toggle('active',n===Math.min(next,3));el.classList.toggle('done',n<next)});window.scrollTo({top:0,behavior:'smooth'})}
function renderSupport(){
  const list=$('support-list');list.replaceChildren();
  const preparing=founderSupport(support);
  const afterRegistration=support.filter(item=>['kb-ontact','kb-owner-overdraft','kb-policy-loan'].includes(item.id));
  const available=[...preparing,...afterRegistration].filter(x=>category==='all'||x.categories?.includes(category));
  if(!available.length){add(list,'p','이 종류의 창업 전 안내는 확인된 자료에 없습니다.');return}
  for(const item of available){
    const card=add(list,'article','', 'support-item');const stage=item.businessTypes.includes('preparing')?'창업 전 상담 안내':'사업자등록 후 조건 확인';add(card,'small',`${stage} · ${item.categories.join(' · ')}`,'tag');add(card,'h3',item.name);add(card,'p',item.summary);
    const checks=add(card,'details','');add(checks,'summary','추가로 확인할 조건');const ul=add(checks,'ul','');for(const check of item.checks||[])add(ul,'li',check);
    const link=add(card,'a','공식 안내에서 현재 조건 확인 ↗');link.href=item.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';
    add(card,'p',`자료 확인일 ${item.verifiedAt||financeMeta.verifiedAt} · 신청 가능 여부는 별도 확인`,'source');
  }
}
function updateFunding(){
  const values=[...document.querySelectorAll('[data-amount]')].map(el=>el.value.trim());
  const result=fundingSummary(values);$('total-cost').textContent=money(result.total);$('needed-cost').textContent=money(result.needed);return result;
}
function renderBranches(){
  const list=$('branch-list');list.replaceChildren();
  for(const bank of branches){
    const label=add(list,'label','', 'branch-option');const input=document.createElement('input');input.type='radio';input.name='branch';input.value=bank.id;input.checked=bank.id===chosenBranch?.id;label.append(input);
    add(label,'strong',`KB국민은행 ${bank.name} · 직선 약 ${bank.distanceKm.toFixed(2)}km`);add(label,'small',bank.address);add(label,'small',`${bank.phone||'전화번호 확인 필요'} · ${bank.hours||'운영시간 확인 필요'}`);
    input.onchange=()=>{chosenBranch=bank;showBranch(bank)};
  }
}
function showBranch(bank){if(!map||!window.kakao?.maps)return;if(branchMarker)branchMarker.setMap(null);const maps=kakao.maps;const point=new maps.LatLng(bank.lat,bank.lng);branchMarker=new maps.Marker({map,position:point,title:`KB국민은행 ${bank.name}`});const bounds=new maps.LatLngBounds();bounds.extend(new maps.LatLng(origin.lat,origin.lng));bounds.extend(point);map.setBounds(bounds,40,40,40,40)}
async function setupMap(){try{const maps=await loadKakaoMaps();const center=new maps.LatLng(origin.lat,origin.lng);map=new maps.Map($('consult-map'),{center,level:4});new maps.Marker({map,position:center,title:`${report.district} ${report.name}`});if(chosenBranch)showBranch(chosenBranch)}catch(error){$('consult-map').classList.add('map-error');$('consult-map').textContent=`카카오 지도를 표시하지 못했습니다. ${error.message}`}}
function reviewRow(dl,label,value){const row=add(dl,'div','', 'review-row');add(row,'dt',label,'review-row-label');add(row,'dd',value)}
function renderReview(){
  const box=$('review-content');box.replaceChildren();const dl=add(box,'dl','');dl.className='review-list';
  reviewRow(dl,'선택한 상권',`${report.district} ${report.name} · ${quarter.slice(0,4)}년 ${quarter.slice(4)}분기`);
  reviewRow(dl,'업종', $('industry').textContent);
  reviewRow(dl,'필요한 도움',document.querySelector(`[data-purpose="${purpose}"]`).textContent);
  const inputs=[...document.querySelectorAll('[data-amount]')];const names=['임차보증금','인테리어·시설비','초도물품비','초기 운영비','준비한 자기자금'];
  inputs.forEach((input,i)=>reviewRow(dl,names[i],input.value.trim()?`${input.value.trim()}만원`:'미입력'));
  const result=updateFunding();reviewRow(dl,'합계 비용',money(result.total));reviewRow(dl,'추가로 준비할 금액',money(result.needed));
  reviewRow(dl,'상담할 영업점',chosenBranch?`KB국민은행 ${chosenBranch.name}\n${chosenBranch.address}\n${chosenBranch.phone||''}`:'선택하지 않음');
  reviewRow(dl,'상담에서 물어볼 내용',$('memo').value.trim()||'미입력');
  reviewRow(dl,'자료 출처',`서울시 상권분석서비스 공개자료 · KB국민은행 공식 지점검색 (${branchMeta.retrievedAt.slice(0,10)})`);
}
async function init(){
  if(!['area','dong'].includes(kind)||!/^\d{5,12}$/.test(code||'')||!/^20\d{2}[1-4]$/.test(quarter||'')){showError('지역 또는 기준분기가 올바르지 않습니다.');return}
  try{
    const [region,banks,catalog]=await Promise.all([getJson('/api/rising/report?'+new URLSearchParams({kind,code,quarter,industry})),getJson('/shared/finance/kb-branches.json'),getJson('/shared/finance/founder-support.json')]);
    if(!region||region.code!==code||region.quarter!==quarter)throw Error('선택한 지역의 공개 자료를 찾지 못했습니다.');
    if(!Number.isFinite(region.lat)||!Number.isFinite(region.lng))throw Error('선택한 지역의 지도 좌표가 공개 자료에 없습니다.');
    origin.lat=region.lat;origin.lng=region.lng;
    report=region;branchMeta=banks;financeMeta=catalog;support=catalog.items;
    branches=nearestBranches(banks.branches,origin,3);if(!branches.length)throw Error('좌표가 확인된 공식 KB 영업점이 없습니다.');
    $('place').textContent=`${report.district} ${report.name}`;$('scope').textContent=kind==='dong'?'행정동 전체':'공식 상권';
    const group=report.scopeIndustry||industry;$('industry').textContent=({all:'전체 업종',CS1:'외식업',CS2:'서비스업',CS3:'소매업'})[group]||group;
    $('quarter').textContent=`${quarter.slice(0,4)}년 ${quarter.slice(4)}분기`;
    $('branch-source').textContent=`출처: KB국민은행 공식 지점검색 · ${banks.retrievedAt.slice(0,10)} 조회`;
    $('app').hidden=false;setupMap();renderSupport();renderBranches();
  }catch(error){showError(error.message)}
}

document.querySelectorAll('[data-purpose]').forEach(button=>button.onclick=()=>{purpose=button.dataset.purpose;document.querySelectorAll('[data-purpose]').forEach(el=>el.classList.toggle('selected',el===button))});
document.querySelectorAll('[data-category]').forEach(button=>button.onclick=()=>{category=button.dataset.category;document.querySelectorAll('[data-category]').forEach(el=>el.classList.toggle('selected',el===button));renderSupport()});
document.querySelectorAll('[data-back]').forEach(button=>button.onclick=()=>setStep(Number(button.dataset.back)));
$('next-1').onclick=()=>{try{updateFunding();$('amount-error').textContent='';setStep(2)}catch(error){$('amount-error').textContent=error.message}};
$('next-2').onclick=()=>setStep(3);
$('review').onclick=()=>{renderReview();setStep(4)};
$('print').onclick=()=>window.print();
init();
