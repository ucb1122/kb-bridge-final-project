import {parseAmount,fundingSummary,nearestBranches,founderSupport} from './model.js';
import {loadKakaoMaps} from '../../../../shared/kakao-bootstrap.js';
import {buildFounderReviewPDF} from './review-pdf.js?v=5';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const kind=params.get('kind'),code=params.get('code'),quarter=params.get('quarter'),industry=params.get('industry')||'all';
const origin={lat:null,lng:null};
let report,branches=[],support=[],branchMeta,financeMeta,chosenBranch=null,purpose='startup',category='all',step=1,maxStepReached=1,map,branchMarkers=[],routePolyline,routeRequest=0,walkingRoute=null;
const routeCache=new Map();
let reviewPdfUrl='',reviewGeneration=0,reviewDialog=null,downloadDialog=null,requestDialog=null;
const pickedSupport=new Map();
const money=n=>n===null?'미입력':`${n.toLocaleString('ko-KR',{maximumFractionDigits:2})}만원`;
const add=(parent,tag,value,className)=>{const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;parent.append(el);return el};
const amountInputs=[...document.querySelectorAll('[data-amount]')];
function validateAmountInput(input){
  const invalid=Number.isNaN(parseAmount(input.value.trim()));
  input.setAttribute('aria-invalid',String(invalid));
  input.closest('label').querySelector('.amount-field-error').hidden=!invalid;
  return !invalid;
}
function showAmountNotice(){
  const dialog=$('amount-notice');
  if(!dialog.open)dialog.showModal();
  $('amount-notice-confirm').focus();
}
function validateAmounts(){
  const invalid=amountInputs.filter(input=>!validateAmountInput(input));
  if(!invalid.length)return true;
  showAmountNotice();
  return false;
}

async function getJson(url){const response=await fetch(url);if(!response.ok)throw Error(`자료를 불러오지 못했습니다 (${response.status}).`);return response.json()}
function showError(message){$('app').hidden=true;$('load-error').hidden=false;$('load-error').querySelector('p').textContent=message}
function setStep(next){step=next;maxStepReached=Math.max(maxStepReached,next);document.querySelectorAll('[data-page]').forEach(el=>el.hidden=Number(el.dataset.page)!==next);document.querySelectorAll('[data-step]').forEach(el=>{const n=Number(el.dataset.step);el.classList.toggle('active',n===Math.min(next,3));el.classList.toggle('done',n<next);el.querySelector('b').textContent=n<next?'✓':String(n);const button=el.querySelector('button');button.disabled=n>maxStepReached;button.setAttribute('aria-current',n===Math.min(next,3)?'step':'false')});window.scrollTo({top:0,behavior:'smooth'})}
function renderSupport(){
  const list=$('support-list');list.replaceChildren();
  const preparing=founderSupport(support);
  const afterRegistration=support.filter(item=>['kb-ontact','kb-owner-overdraft','kb-policy-loan'].includes(item.id));
  const available=[...preparing,...afterRegistration].filter(x=>category==='all'||x.categories?.includes(category));
  const pickedBar=add(list,'div','','support-picked-bar');add(pickedBar,'span',`상담서에 담은 지원 ${pickedSupport.size}개`);add(pickedBar,'small',pickedSupport.size?'영업점 상담 때 함께 확인해요':'상담 때 물어볼 지원을 담아 보세요');
  if(!available.length){add(list,'p','이 종류의 창업 전 안내는 확인된 자료에 없습니다.');return}
  for(const item of available){
    const card=add(list,'article','', 'support-item');const stage=item.businessTypes.includes('preparing')?'창업 전 상담 안내':'사업자등록 후 조건 확인';add(card,'small',`${stage} · ${item.categories.join(' · ')}`,'tag');add(card,'h3',item.name);add(card,'p',item.summary);
    const picked=pickedSupport.has(item.id);card.classList.toggle('picked',picked);
    const pick=add(card,'button',picked?'✓ 상담서에 담았어요':'+ 상담서에 추가','support-add');pick.type='button';pick.setAttribute('aria-pressed',String(picked));
    pick.onclick=()=>{if(pickedSupport.has(item.id))pickedSupport.delete(item.id);else pickedSupport.set(item.id,item.name);renderSupport()};
    const checks=add(card,'details','');add(checks,'summary','추가로 확인할 조건');const ul=add(checks,'ul','');for(const check of item.checks||[])add(ul,'li',check);
    const link=add(card,'a','공식 안내에서 현재 조건 확인');link.href=item.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';
    add(card,'p',`자료 확인일 ${item.verifiedAt||financeMeta.verifiedAt} · 신청 가능 여부는 별도 확인`,'source');
  }
}
function updateFunding(){
  const values=[...document.querySelectorAll('[data-amount]')].map(el=>el.value.trim());
  const result=fundingSummary(values);$('total-cost').textContent=money(result.total);$('needed-cost').textContent=money(result.needed);return result;
}
function renderBranches(){
  const list=$('branch-list');list.replaceChildren();
  $('reset-branch').disabled=!chosenBranch;
  for(const bank of branches){
    const card=add(list,'div','', 'branch-card');
    const label=add(card,'label','', 'branch-option');const input=document.createElement('input');input.type='radio';input.name='branch';input.value=bank.id;input.checked=bank.id===chosenBranch?.id;label.append(input);
    const details=add(label,'span','','branch-details');
    add(details,'strong',`KB국민은행 ${bank.name}`);
    add(details,'small',bank.address);add(details,'small',`${bank.phone||'전화번호 확인 필요'} · ${bank.hours||'운영시간 확인 필요'}`);
    const status=add(label,'span','','branch-route-status');status.setAttribute('role','status');
    const route=routeCache.get(bank.id);
    if(route?.distanceMeters&&route?.durationSeconds){status.classList.add('route-ready');status.textContent=`약 ${(route.distanceMeters/1000).toFixed(1)}km · 약 ${Math.max(1,Math.round(route.durationSeconds/60))}분`}
    else{status.textContent=`직선 약 ${bank.distanceKm.toFixed(1)}km`;status.title='도보 경로 확인 전'}
    input.onchange=()=>showWalkingRoute(bank);
  }
}
async function fetchWalkingRoute(bank){
  if(routeCache.has(bank.id))return routeCache.get(bank.id);
  const url='/api/owner/walking-route?'+new URLSearchParams({kind,code,quarter,industry,branchId:bank.id});
  const pending=(async()=>{const response=await fetch(url);const result=await response.json();if(!response.ok)throw Error(result.error||'도보 경로를 불러오지 못했습니다.');return result})();
  routeCache.set(bank.id,pending);
  try{const result=await pending;routeCache.set(bank.id,result);return result}catch(error){routeCache.delete(bank.id);throw error}
}
async function orderBranchesByWalkingTime(){
  const candidates=[...branches];
  await Promise.allSettled(candidates.map(fetchWalkingRoute));
  branches.sort((a,b)=>{
    const first=routeCache.get(a.id)?.durationSeconds,second=routeCache.get(b.id)?.durationSeconds;
    if(Number.isFinite(first)&&Number.isFinite(second))return first-second;
    if(Number.isFinite(first))return -1;if(Number.isFinite(second))return 1;
    return a.distanceKm-b.distanceKm;
  });
  renderBranches();
}
function clearWalkingRoute(){
  routeRequest++;
  walkingRoute=null;
  if(routePolyline){routePolyline.setMap(null);routePolyline=null}
  $('map-route-summary')?.remove();
}
async function showWalkingRoute(bank){
  chosenBranch=bank;clearWalkingRoute();showBranch(bank);renderBranches();
  const card=[...document.querySelectorAll('.branch-card')].find(item=>item.querySelector('input')?.value===bank.id);
  const status=card.querySelector('.branch-route-status');
  const request=routeRequest;
  status.hidden=false;status.classList.remove('route-ready');status.textContent='카카오 도보 경로를 불러오는 중입니다.';
  try{
    if(!map)throw Error('지도를 불러오지 못해 경로를 표시할 수 없습니다.');
    const result=await fetchWalkingRoute(bank);
    if(request!==routeRequest)return;
    walkingRoute={branchId:bank.id,...result};
    const maps=kakao.maps;
    const path=result.points.map(([lng,lat])=>new maps.LatLng(lat,lng));
    routePolyline=new maps.Polyline({map,path,strokeWeight:6,strokeColor:'#1164c8',strokeOpacity:.9,strokeStyle:'solid'});
    const bounds=new maps.LatLngBounds();path.forEach(point=>bounds.extend(point));branches.forEach(item=>bounds.extend(new maps.LatLng(item.lat,item.lng)));map.setBounds(bounds,48,48,48,48);
    status.textContent=`약 ${(result.distanceMeters/1000).toFixed(1)}km · 약 ${Math.max(1,Math.round(result.durationSeconds/60))}분`;
    status.classList.add('route-ready');
    const summary=add($('consult-map'),'div',status.textContent,'map-route-summary');summary.id='map-route-summary';summary.setAttribute('role','status');
  }catch(error){if(request===routeRequest)status.textContent=error.message}
}
function showBranch(bank){
  if(!map||!window.kakao?.maps)return;
  for(const marker of branchMarkers)marker.setMap(null);branchMarkers=[];
  const maps=kakao.maps;
  showBranchMarkers();
  const bounds=new maps.LatLngBounds();bounds.extend(new maps.LatLng(origin.lat,origin.lng));branches.forEach(item=>bounds.extend(new maps.LatLng(item.lat,item.lng)));map.setBounds(bounds,40,40,40,40);
}
function showBranchMarkers(){
  if(!map||!window.kakao?.maps)return;
  for(const marker of branchMarkers)marker.setMap(null);branchMarkers=[];
  for(const bank of branches){
    const badge=document.createElement('button');badge.type='button';badge.className='branch-map-pin'+(bank.id===chosenBranch?.id?' selected':'');badge.title=`KB국민은행 ${bank.name}`;badge.setAttribute('aria-label',`KB국민은행 ${bank.name} 선택`);
    const symbol=document.createElement('img');symbol.src='/shared/finance/kb-branch-symbol.png';symbol.alt='';badge.append(symbol);badge.addEventListener('click',()=>showWalkingRoute(bank));
    branchMarkers.push(new kakao.maps.CustomOverlay({map,position:new kakao.maps.LatLng(bank.lat,bank.lng),content:badge,yAnchor:1,zIndex:10}));
  }
}
async function setupMap(){
  try{
    const maps=await loadKakaoMaps();
    const center=new maps.LatLng(origin.lat,origin.lng);
    map=new maps.Map($('consult-map'),{center,level:4});
    const pulse=document.createElement('span');pulse.className='founder-origin-pulse';pulse.setAttribute('aria-hidden','true');
    new maps.CustomOverlay({map,position:center,content:pulse,xAnchor:.5,yAnchor:.5,zIndex:999});
    new maps.Marker({map,position:center,title:`현재 위치: ${report.district} ${report.name}`,zIndex:1000});
    showBranchMarkers();if(chosenBranch)showBranch(chosenBranch);else{const bounds=new maps.LatLngBounds();bounds.extend(center);branches.forEach(item=>bounds.extend(new maps.LatLng(item.lat,item.lng)));map.setBounds(bounds,40,40,40,40)}
  }catch(error){$('consult-map').classList.add('map-error');$('consult-map').textContent=`카카오 지도를 표시하지 못했습니다. ${error.message}`}
}
function reviewRow(dl,label,value){const row=add(dl,'div','', 'review-row');add(row,'dt',label,'review-row-label');add(row,'dd',value)}
function reviewSection(parent,title){const section=add(parent,'section','','review-section');add(section,'h3',title);const dl=add(section,'dl','','review-list');return dl}
function renderReview(personalUser){
  const box=$('review-content');box.replaceChildren();const paper=add(box,'article','','review-paper');
  add(paper,'p','KO-B · 영업점 상담 준비서','review-kicker');
  add(paper,'h3','상담 전에 확인할 내용','review-paper-title');
  if(personalUser){const applicant=reviewSection(paper,'01 · 신청인 정보');reviewRow(applicant,'이름',personalUser.name);reviewRow(applicant,'이메일',personalUser.email);reviewRow(applicant,'전화번호',personalUser.phone||'미등록');reviewRow(applicant,'아이디',personalUser.loginId)}
  const place=reviewSection(paper,personalUser?'02 · 선택한 상권':'01 · 선택한 상권');
  reviewRow(place,'지역',`${report.district} ${report.name}`);
  reviewRow(place,'기준 분기',`${quarter.slice(0,4)}년 ${quarter.slice(4)}분기`);
  reviewRow(place,'업종',$('industry').textContent);
  reviewRow(place,'필요한 도움',document.querySelector(`[data-purpose="${purpose}"]`).textContent);
  const costs=reviewSection(paper,personalUser?'03 · 예상 창업 자금':'02 · 예상 창업 자금');
  const inputs=[...document.querySelectorAll('[data-amount]')];const names=['임차보증금','인테리어·시설비','초도물품비','초기 운영비','준비한 자기자금'];
  inputs.forEach((input,i)=>reviewRow(costs,names[i],input.value.trim()?money(Number(input.value.trim())):'미입력'));
  const result=updateFunding();const totals=add(paper,'div','','review-totals');
  const total=add(totals,'div','');add(total,'span','합계 비용');add(total,'strong',money(result.total));
  const needed=add(totals,'div','');add(needed,'span','추가로 준비할 금액');add(needed,'strong',money(result.needed));
  const consult=reviewSection(paper,personalUser?'05 · 영업점과 상담 메모':'04 · 영업점과 상담 메모');
  const routeText=walkingRoute?.branchId===chosenBranch?.id?`약 ${(walkingRoute.distanceMeters/1000).toFixed(1)}km · 약 ${Math.max(1,Math.round(walkingRoute.durationSeconds/60))}분`:'도보 경로 확인 전';
  reviewRow(consult,'상담할 영업점',chosenBranch?`KB국민은행 ${chosenBranch.name}\n${routeText}\n${chosenBranch.address}\n${chosenBranch.phone||''}`:'선택하지 않음');
  reviewRow(consult,'상담서에 담은 지원',[...pickedSupport.values()].join('\n')||'선택하지 않음');
  reviewRow(consult,'상담에서 물어볼 내용',$('memo').value.trim()||'미입력');
}
async function showReviewPDF(){
  let personalUser=null;
  if($('include-personal-info').checked){
    try{const response=await fetch('/api/auth/me',{cache:'no-store'});if(!response.ok)throw Error();personalUser=(await response.json()).user;if(!personalUser)throw Error()}
    catch{$('personal-info-message').textContent='계정 정보를 포함하려면 먼저 로그인해 주세요.';$('personal-info-message').hidden=false;return}
  }
  $('personal-info-message').hidden=true;
  renderReview(personalUser);
  const box=$('review-content');
  const sections=[...box.querySelectorAll('.review-section')].map(section=>({title:section.querySelector('h3').textContent,rows:[...section.querySelectorAll('.review-row')].map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent])}));
  const totals=[...box.querySelectorAll('.review-totals>div')].map(item=>[item.querySelector('span').textContent,item.querySelector('strong').textContent]);
  sections.splice(personalUser?3:2,0,{title:personalUser?'04 · 자금 합계':'03 · 자금 합계',rows:totals});
  box.replaceChildren();const status=add(box,'p','PDF 상담서를 만드는 중입니다.','review-loading');status.setAttribute('role','status');$('print').disabled=true;
  const modalPages=reviewDialog.querySelector('.founder-review-pages');modalPages.replaceChildren();
  const modalStatus=add(modalPages,'p','PDF 상담서를 만드는 중입니다.','review-loading');modalStatus.setAttribute('role','status');
  if(!reviewDialog.open)reviewDialog.showModal();
  const current=++reviewGeneration;
  try{
    const result=await buildFounderReviewPDF(sections);
    if(current!==reviewGeneration)return;
    if(reviewPdfUrl)URL.revokeObjectURL(reviewPdfUrl);
    reviewPdfUrl=URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'}));
    box.replaceChildren();const preview=add(box,'div','','review-pdf-preview');
    result.preview.forEach((src,index)=>{const image=document.createElement('img');image.src=src;image.alt=`KB 영업점 상담 준비서 ${index+1}쪽 미리보기`;preview.append(image)});
    modalPages.replaceChildren();
    result.preview.forEach((src,index)=>{const image=document.createElement('img');image.src=src;image.alt=`KB 영업점 상담 준비서 ${index+1}쪽`;modalPages.append(image)});
    if(!reviewDialog.open)reviewDialog.showModal();
    $('print').textContent='PDF 내려받기';
    $('print').disabled=false;
  }catch(error){if(current===reviewGeneration){status.textContent=`PDF를 만들지 못했습니다. ${error.message}`;modalStatus.textContent=status.textContent}}
}
function openBranchRequest(){
  const recipient=$('request-recipient');recipient.replaceChildren();
  $('request-done').hidden=true;$('request-error').textContent='';
  if(!chosenBranch){
    recipient.className='branch-request-missing';
    add(recipient,'p','상담서를 받을 영업점을 아직 고르지 않았어요. STEP 3에서 가까운 영업점을 먼저 골라 주세요.');
    const back=add(recipient,'button','영업점 고르러 가기');back.type='button';back.onclick=()=>setStep(3);
    $('request-summary').hidden=true;$('request-form').hidden=true;setStep(5);return;
  }
  recipient.className='branch-request-recipient';
  const routeText=walkingRoute?.branchId===chosenBranch.id?` · 도보 약 ${(walkingRoute.distanceMeters/1000).toFixed(1)}km · 약 ${Math.max(1,Math.round(walkingRoute.durationSeconds/60))}분`:'';
  add(recipient,'small','상담서를 받을 영업점');add(recipient,'strong',`KB국민은행 ${chosenBranch.name}`);add(recipient,'p',`${chosenBranch.address}${routeText}`);
  const result=updateFunding();
  const summary=$('request-summary-list');summary.replaceChildren();
  reviewRow(summary,'분석 지역',`${report.district} ${report.name} · ${quarter.slice(0,4)}년 ${quarter.slice(4)}분기`);
  reviewRow(summary,'필요한 도움',document.querySelector(`[data-purpose="${purpose}"]`).textContent);
  reviewRow(summary,'상담서에 담은 지원',[...pickedSupport.values()].join(' · ')||'선택하지 않음');
  reviewRow(summary,'추가로 준비할 금액',result.needed===null?'미입력':`${money(result.needed)} (합계 ${money(result.total)})`);
  $('request-summary').hidden=false;$('request-form').hidden=false;
  setStep(5);
}
function submitBranchRequest(event){
  event.preventDefault();
  const phoneInput=$('request-phone'),digits=phoneInput.value.trim().replace(/[-\s]/g,'');
  let message='';
  if(!/^01[016789]\d{7,8}$/.test(digits))message='연락받을 휴대폰 번호를 확인해 주세요.';
  else if(!$('request-consent').checked)message='영업점에 보내는 것에 동의해 주세요.';
  phoneInput.setAttribute('aria-invalid',String(message.startsWith('연락받을')));
  $('request-error').textContent=message;
  if(message){(message.startsWith('연락받을')?phoneInput:$('request-consent')).focus();return}
  const branchName=`KB국민은행 ${chosenBranch.name}`;
  $('request-form').hidden=true;
  $('request-done-message').textContent=`${branchName}에서 내용을 확인 후 연락드릴게요.`;
  $('request-done').hidden=false;
  requestDialog.querySelector('p').replaceChildren(`${branchName}에서`,document.createElement('br'),'내용을 확인 후 연락드릴게요.');
  requestDialog.showModal();
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
    $('place').textContent=`${report.district} ${report.name}`;
    const group=report.scopeIndustry||industry;$('industry').textContent=({all:'전체 업종',CS1:'외식업',CS2:'서비스업',CS3:'소매업'})[group]||group;
    $('quarter').textContent=`${quarter.slice(0,4)}년 ${quarter.slice(4)}분기`;
    $('branch-source').textContent=`출처: KB국민은행 공식 지점검색 · ${banks.retrievedAt.slice(0,10)} 조회`;
    $('app').hidden=false;setupMap();renderSupport();renderBranches();orderBranchesByWalkingTime();
  }catch(error){showError(error.message)}
}

document.querySelectorAll('[data-purpose]').forEach(button=>button.onclick=()=>{purpose=button.dataset.purpose;document.querySelectorAll('[data-purpose]').forEach(el=>el.classList.toggle('selected',el===button))});
document.querySelectorAll('[data-category]').forEach(button=>button.onclick=()=>{category=button.dataset.category;document.querySelectorAll('[data-category]').forEach(el=>el.classList.toggle('selected',el===button));renderSupport()});
document.querySelectorAll('[data-back]').forEach(button=>button.onclick=()=>setStep(Number(button.dataset.back)));
$('amount-notice-confirm').onclick=()=>$('amount-notice').close();
$('amount-notice').onclick=event=>{if(event.target===event.currentTarget)event.currentTarget.close()};
$('fill-sample').onclick=()=>{
  const sampleAmounts=['3000','2000','300','600','3000'];
  amountInputs.forEach((input,index)=>{input.value=sampleAmounts[index];validateAmountInput(input)});
};
$('fill-memo').onclick=()=>{
  $('memo').value='현재 직장에 다니고 있고, 약 6개월 뒤 선택한 지역에서 15평 안팎의 한식 식당을 열어 점심 장사를 시작하려고 합니다. 처음에는 가족 2명이 운영할 생각입니다. 주변 직장인 수요가 실제로 어느 정도인지, 점심 매출만으로 월세와 인건비를 감당할 수 있을지 확신이 없어 입지와 예상 손익을 먼저 점검하고 싶습니다.\n\n임차보증금 3,000만원, 인테리어·주방 설비 2,000만원, 초도물품 300만원, 초기 운영비 600만원으로 총 5,900만원을 예상합니다. 모아 둔 자기자금은 3,000만원이고, 나머지 2,900만원을 어떻게 준비할지 고민입니다. 특히 개업 직후 매출이 자리 잡기 전까지 재료비와 월세를 낼 여유자금을 얼마나 남겨 둬야 하는지 알고 싶습니다.\n\n사업자등록과 임대차계약을 하기 전에 받을 수 있는 상담이 있는지, 창업자금 대출이나 보증을 검토하려면 어떤 서류와 자기자금 증빙이 필요한지 궁금합니다. 대출이 가능하더라도 금리와 상환 기간에 따라 매달 얼마를 갚아야 하는지, 매출이 예상보다 낮을 때도 감당할 수 있는 수준인지 함께 확인하고 싶습니다.';
  $('memo').focus();
};
$('clear-amounts').onclick=()=>{amountInputs.forEach(input=>{input.value='';validateAmountInput(input)})};
amountInputs.forEach(input=>{
  input.addEventListener('input',()=>{validateAmountInput(input)});
  input.addEventListener('blur',()=>{if(!validateAmountInput(input))showAmountNotice()});
});
$('reset-branch').onclick=()=>{chosenBranch=null;clearWalkingRoute();showBranchMarkers();renderBranches();if(map){const bounds=new kakao.maps.LatLngBounds();bounds.extend(new kakao.maps.LatLng(origin.lat,origin.lng));branches.forEach(item=>bounds.extend(new kakao.maps.LatLng(item.lat,item.lng)));map.setBounds(bounds,40,40,40,40)}};
document.querySelectorAll('[data-step] button').forEach(button=>button.onclick=()=>{const target=Number(button.closest('[data-step]').dataset.step);if(target<=maxStepReached)setStep(target)});
$('next-1').onclick=()=>{if(!validateAmounts())return;updateFunding();setStep(2)};
$('next-2').onclick=()=>setStep(3);
reviewDialog=document.createElement('dialog');reviewDialog.className='founder-review-dialog';reviewDialog.setAttribute('aria-labelledby','founder-review-title');reviewDialog.innerHTML='<div class="founder-review-head"><h2 id="founder-review-title">준비 내용 확인</h2><button type="button" data-review-close aria-label="닫기">×</button></div><div class="founder-review-pages"></div><div class="founder-review-actions"><button type="button" data-review-close>닫기</button><button type="button" data-review-save>PDF 저장</button><button type="button" data-review-request>영업점에 상담 신청 →</button></div>';document.body.append(reviewDialog);
reviewDialog.addEventListener('click',event=>{if(event.target===reviewDialog||event.target.closest('[data-review-close]'))reviewDialog.close();if(event.target.closest('[data-review-save]'))$('print').click();if(event.target.closest('[data-review-request]')){reviewDialog.close();openBranchRequest()}});
downloadDialog=document.createElement('dialog');downloadDialog.className='founder-download-dialog';downloadDialog.setAttribute('aria-labelledby','founder-download-title');downloadDialog.innerHTML='<div class="founder-download-body"><button type="button" class="founder-download-close" data-download-close aria-label="닫기">×</button><img src="/shared/characters/kobi-wow.png" alt="기뻐하는 코비"><h2 id="founder-download-title">PDF 다운로드 완료</h2><p>상담 준비서를 저장했습니다.</p><a href="/pages/owner/">처음으로 돌아가기</a></div>';document.body.append(downloadDialog);
downloadDialog.addEventListener('click',event=>{if(event.target===downloadDialog||event.target.closest('[data-download-close]'))downloadDialog.close()});
requestDialog=document.createElement('dialog');requestDialog.className='founder-download-dialog';requestDialog.setAttribute('aria-labelledby','founder-request-title');requestDialog.innerHTML='<div class="founder-download-body"><button type="button" class="founder-download-close" data-request-close aria-label="닫기">×</button><img src="/shared/characters/kobi-wow.png" alt="기뻐하는 코비"><h2 id="founder-request-title">영업점 상담 신청완료</h2><p></p><button type="button" class="founder-request-confirm" data-request-close>확인</button></div>';document.body.append(requestDialog);
requestDialog.addEventListener('click',event=>{if(event.target===requestDialog||event.target.closest('[data-request-close]'))requestDialog.close()});
$('branch-request-open').onclick=openBranchRequest;
$('request-form').addEventListener('submit',submitBranchRequest);
$('request-pdf').onclick=()=>{if(reviewPdfUrl)$('print').click();else showReviewPDF()};
$('review').onclick=showReviewPDF;
$('print').onclick=()=>{if(!reviewPdfUrl)return;const link=document.createElement('a');link.href=reviewPdfUrl;link.download='KB_영업점_상담_준비서.pdf';link.click();reviewDialog?.close();downloadDialog?.showModal()};
window.addEventListener('pagehide',()=>{if(reviewPdfUrl)URL.revokeObjectURL(reviewPdfUrl)});
init();
setStep(1);
