import {escapeHTML as esc} from './navigator-model.js';
import {nearestBranches} from './customer-flow-model.js';
import {buildConsultationPDF,renderPagePreviews} from './consultation-pdf.js?v=20261102-brand';
import {validateRequest,today} from './appointment-validation.js';
let branches=[],form={branch:'',phone:'',email:'',date:'',time:'',name:'',businessName:'',channel:'visit',consent:false},preview=false,pdfUrl='',previewPages=[],previewDialog=null,pdfDialog=null,sentDialog=null,generation=0,savedRequestId=null,loading=false,loadError='',context=()=>'',getRegion=()=>null,walking=null,walkingState='',walkingRequest=0,nearbyRequest=0,nearbyRoutes=new Map(),nearbyLoading=false;
const selected=()=>branches.find(b=>b.id===form.branch);
const sortedNearby=()=>nearestBranches(branches,getRegion(),3).sort((a,b)=>{
 const ar=nearbyRoutes.get(a.id),br=nearbyRoutes.get(b.id);
 return (ar?.distanceMeters??Infinity)-(br?.distanceMeters??Infinity)||a.distance-b.distance;
});
const notifyBranches=()=>document.dispatchEvent(new CustomEvent('bridge:nearby-branches',{detail:{branches:sortedNearby(),selectedId:form.branch}}));
function walkingQuery(branch,region){return new URLSearchParams({kind:region.kind,code:String(region.code),quarter:String(region.quarter),industry:'all',branchId:String(branch.id)});}
async function fetchWalkingRoute(branch,region){const response=await fetch(`/api/owner/walking-route?${walkingQuery(branch,region)}`,{cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(data.error||'경로를 확인할 수 없습니다.');return data;}
async function loadNearbyRoutes(){
 const request=++nearbyRequest;walkingRequest++;const region=getRegion(),near=nearestBranches(branches,region,3);nearbyRoutes=new Map();nearbyLoading=!!near.length;walking=null;walkingState='';
 document.dispatchEvent(new CustomEvent('bridge:walking-route',{detail:null}));notifyBranches();refresh();
 if(!near.length)return;
 await Promise.all(near.map(async branch=>{try{const route=await fetchWalkingRoute(branch,region);if(request!==nearbyRequest)return;nearbyRoutes.set(branch.id,route);if(form.branch===branch.id){walking=route;document.dispatchEvent(new CustomEvent('bridge:walking-route',{detail:{branchId:branch.id,...route}}));}}catch(error){if(request===nearbyRequest)nearbyRoutes.set(branch.id,{error:error.message});}}));
 if(request!==nearbyRequest)return;nearbyLoading=false;notifyBranches();refresh();
}
async function loadWalkingRoute(){
 const branch=selected(),region=getRegion(),request=++walkingRequest;walking=null;walkingState='';
 document.dispatchEvent(new CustomEvent('bridge:walking-route',{detail:null}));
 if(!branch||!region)return;
 const cached=nearbyRoutes.get(branch.id);if(cached&&!cached.error){walking=cached;document.dispatchEvent(new CustomEvent('bridge:walking-route',{detail:{branchId:branch.id,...cached}}));refresh();return;}
 walkingState='카카오 도보 경로를 확인하는 중이에요.';refresh();
 try{const data=await fetchWalkingRoute(branch,region);if(request!==walkingRequest)return;walking=data;nearbyRoutes.set(branch.id,data);walkingState='';notifyBranches();document.dispatchEvent(new CustomEvent('bridge:walking-route',{detail:{branchId:branch.id,...data}}));}
 catch(error){if(request!==walkingRequest)return;walkingState=`도보 경로를 확인하지 못했습니다. ${error.message}`;}
 refresh();
}
export function invalidateRequest(){generation++;savedRequestId=null;preview=false;previewPages=[];previewDialog?.close();pdfDialog?.close();sentDialog?.close();if(pdfUrl){URL.revokeObjectURL(pdfUrl);pdfUrl='';}}
function openPreviewDialog(mode='send'){
 const dialog=mode==='pdf'?pdfDialog:previewDialog;
 if(!dialog||!pdfUrl)return;
 const actions=mode==='pdf'?'<button type="button" data-preview-close>닫기</button><a href="/pages/intended-owner/" data-preview-home>처음으로 돌아가기</a>':'<button type="button" data-preview-send>상담 요청 저장</button>';
 dialog.innerHTML=`<div class="request-modal-head"><h2 id="${mode==='pdf'?'request-pdf-title':'request-modal-title'}">상담서 확인</h2><button type="button" data-preview-close aria-label="닫기">×</button></div><div class="request-modal-pages">${previewPages.map((src,i)=>`<img src="${src}" alt="PDF 상담서 ${i+1}쪽 미리보기">`).join('')}</div><p class="request-status" role="status" data-preview-status></p><div class="request-modal-actions ${mode==='pdf'?'request-modal-pdf-actions':''}"><a href="${pdfUrl}" download="우리 가게_영업점 상담서.pdf">PDF 저장</a>${actions}</div>`;
 if(!dialog.open)dialog.showModal();
}
function branchChoices(){const near=sortedNearby();return `<div class="nearby-branches">${near.map(b=>{const route=nearbyRoutes.get(b.id);return `<button type="button" data-branch="${esc(b.id)}" aria-pressed="${form.branch===b.id}"><span><strong>KB국민은행 ${esc(b.name)}</strong><small>${esc(b.address)}</small></span><b>${route&&!route.error?`도보 약 ${(route.distanceMeters/1000).toFixed(1)}km · 약 ${Math.ceil(route.durationSeconds/60)}분`:nearbyLoading?'도보 경로 확인 중':`직선 약 ${b.distance.toFixed(1)}km · 도보 경로 미확인`}</b></button>`}).join('')}</div>${walkingState?`<p class="walking-status" role="status">${esc(walkingState)}</p>`:''}${!getRegion()?'<p>지도에서 상권을 고르면 가까운 영업점을 먼저 보여드려요.</p>':''}`;}

function branchOptions(query=''){const rows=branches.filter(b=>(b.name+' '+b.address).includes(query)||b.id===form.branch);return '<option value="">영업점을 선택해 주세요</option>'+rows.map(b=>`<option value="${esc(b.id)}" ${b.id===form.branch?'selected':''}>${esc(b.name)} · ${esc(b.address)}</option>`).join('');}
export function appointmentHTML(){const b=selected();
 return `<section class="appointment" id="appointment-body"><h3>${getRegion()?'선택한 상권 근처 영업점':'상담할 영업점을 골라주세요'}</h3>${branchChoices()}${loading?'<p role="status">공식 공개 영업점 목록을 불러오는 중이에요.</p>':''}${loadError?`<p role="alert">${esc(loadError)}</p>`:''}<details class="branch-search"><summary>다른 영업점 찾기</summary><label>지점명·지역 검색<input id="branch-search" type="search" placeholder="예: 청량리, 동대문구"></label><label>검색한 영업점<select data-request="branch">${branchOptions()}</select></label></details>${b?`<div class="chosen-branch"><strong>선택: KB국민은행 ${esc(b.name)}</strong><p>${esc(b.address)}<br>${esc(b.phone)} · 공개 영업시간 ${esc(b.hours)}</p>${!b.visitConsultation?'<small>방문 상담 정보 미확인 · 전화 상담 희망으로 선택해 주세요.</small>':''}</div>`:''}<div class="request-schedule-head"><strong>상담 희망 일정</strong><button type="button" data-fill-schedule>예시 사용하기</button></div><div class="request-grid"><label>상담 방법<select data-request="channel"><option value="visit" ${form.channel==='visit'?'selected':''}>방문 상담 희망</option><option value="phone" ${form.channel==='phone'?'selected':''}>전화 상담 희망</option></select></label><label>희망 상담일<input type="date" min="${today()}" max="${Number(today().slice(0,4))+2}${today().slice(4)}" data-request="date" value="${esc(form.date)}"></label><label>희망 시간대<select data-request="time"><option value="">시간대 선택</option><option ${form.time==='오전'?'selected':''}>오전</option><option ${form.time==='오후'?'selected':''}>오후</option></select></label><label>연락받을 전화번호<input type="tel" autocomplete="off" data-request="phone" value="${esc(form.phone)}" placeholder="010-0000-0000"></label></div><fieldset class="request-identity"><legend>상담서에 담을 신청인 정보 <small>(선택)</small> <button type="button" class="request-account-fill" data-fill-account>내 정보 불러오기</button></legend><div class="request-grid"><label>상호<input type="text" maxlength="80" data-request="businessName" value="${esc(form.businessName)}" placeholder="예: 서교식당"></label><label>성명<input type="text" maxlength="40" data-request="name" value="${esc(form.name)}" placeholder="예: 홍길동"></label><label>이메일<input type="email" autocomplete="off" data-request="email" value="${esc(form.email)}" placeholder="name@example.com"></label></div></fieldset><label class="request-consent"><input type="checkbox" data-request="consent" ${form.consent?'checked':''}> 연락처·신청인 정보를 포함한 상담서를 만들고, 보내기를 선택하면 서비스 DB에 저장해요.</label><p class="request-status">미리보기에서 상담 요청 저장을 누르면 이 서비스의 DB에 저장됩니다. KB국민은행 영업점에는 전송되지 않으며 실제 예약은 아닙니다.</p><p id="request-errors" role="alert"></p><button class="request-primary" type="button" data-request-review>상담서 확인</button><small class="branch-source">영업점 출처: KB국민은행 공식 지점검색 · 2026-10-22 수집</small></section>`;
}
function refresh(){const el=document.getElementById('appointment-body');if(el){const host=document.getElementById('rp-content'),scroll=host.scrollTop;el.outerHTML=appointmentHTML();host.scrollTop=scroll;}}
async function fillFromAccount(overwrite=false){
 try{
  const response=await fetch('/api/auth/me',{cache:'no-store'});
  if(!response.ok)throw Error('계정 정보를 확인하지 못했습니다.');
  const {user}=await response.json();
  if(!user){if(overwrite){const status=document.getElementById('request-errors');if(status)status.textContent='로그인 후 내 정보를 불러올 수 있습니다.'}return}
  for(const [key,value] of Object.entries({name:user.name,email:user.email,phone:user.phone,businessName:user.businessName})){
   if(value&&(overwrite||!form[key]))form[key]=value;
  }
  invalidateRequest();refresh();
 }catch{if(overwrite){const status=document.getElementById('request-errors');if(status)status.textContent='계정 정보를 불러오지 못했습니다. 다시 시도해 주세요.'}}
}

export async function reviewRequest(mode='send'){
 if(preview&&pdfUrl){openPreviewDialog(mode);return;}
 const status=document.getElementById('request-errors'),errors=validateRequest(form,selected());
 if(errors.length){if(status)status.textContent=errors.join(' ');document.dispatchEvent(new CustomEvent('bridge:invalid-input',{detail:{message:errors[0]}}));return;}
 const current=++generation;if(status)status.textContent='한글 PDF 상담서를 만들고 있어요…';
 try{let images=[];const bytes=await buildConsultationPDF({summary:context(),branch:{...selected()},form:{...form}},{onPreview:async(pages,font)=>{images=await renderPagePreviews(pages,font);}});if(current!==generation)return;previewPages=images;pdfUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));preview=true;if(status)status.textContent='';openPreviewDialog(mode);}
 catch(error){if(current===generation&&status)status.textContent='PDF를 만들지 못했어요. 입력 내용은 유지됩니다. 다시 시도해 주세요.';console.error('상담서 PDF 생성 실패',error);}
}
async function saveRequest(button){
 if(button.disabled)return;
 if(savedRequestId){previewDialog.close();sentDialog.showModal();return;}
 const status=previewDialog.querySelector('[data-preview-status]');
 button.disabled=true;status.textContent='상담 요청을 저장하고 있어요…';
 try{
  const region=getRegion();
  const response=await fetch('/api/consultation-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({branchId:form.branch,region:region?{kind:region.kind,code:region.code,quarter:region.quarter}:null,concern:context(),form})});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'상담 요청을 저장하지 못했습니다.');
  savedRequestId=data.id;
  previewDialog.close();sentDialog.showModal();
 }catch(error){status.textContent=error.message;button.disabled=false;}
}
export function initAppointment(getContext,regionProvider){context=getContext;getRegion=regionProvider||(()=>null);loading=true;
 previewDialog=document.createElement('dialog');previewDialog.className='request-preview-dialog';previewDialog.setAttribute('aria-labelledby','request-modal-title');document.body.append(previewDialog);
 pdfDialog=document.createElement('dialog');pdfDialog.className='request-preview-dialog';pdfDialog.setAttribute('aria-labelledby','request-pdf-title');document.body.append(pdfDialog);
 sentDialog=document.createElement('dialog');sentDialog.className='request-sent-dialog';sentDialog.setAttribute('aria-labelledby','request-sent-title');sentDialog.innerHTML=`<div class="request-sent-body"><button type="button" class="request-sent-close" data-sent-close aria-label="닫기">×</button><img src="/shared/characters/kobi-wow.png" alt="기뻐하는 코비"><h2 id="request-sent-title">상담 요청 저장 완료</h2><p>상담 요청을 서비스 DB에 저장했습니다. 영업점 전송 및 예약은 진행되지 않았습니다.</p><button type="button" class="request-sent-confirm" data-sent-close>확인</button></div>`;document.body.append(sentDialog);
 previewDialog.addEventListener('click',event=>{if(event.target===previewDialog||event.target.closest('[data-preview-close]'))previewDialog.close();const send=event.target.closest('[data-preview-send]');if(send)saveRequest(send);});
 pdfDialog.addEventListener('click',event=>{if(event.target===pdfDialog||event.target.closest('[data-preview-close]'))pdfDialog.close();});
 sentDialog.addEventListener('click',event=>{if(event.target===sentDialog||event.target.closest('[data-sent-close]'))sentDialog.close();});
 fetch(new URL('/shared/finance/kb-branches.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('영업점 목록 오류');return r.json();}).then(data=>{branches=data.branches.sort((a,b)=>a.name.localeCompare(b.name,'ko'));loading=false;loadNearbyRoutes();}).catch(()=>{loading=false;loadError='영업점 목록을 불러오지 못했어요. 새로고침 후 다시 확인해 주세요.';refresh();});
 fillFromAccount();
 const panel=document.getElementById('recovery-panel');
 panel.addEventListener('input',event=>{if(event.target.id==='branch-search'){const el=panel.querySelector('[data-request="branch"]');if(el)el.innerHTML=branchOptions(event.target.value.trim());return;}const key=event.target.dataset.request;if(key){form[key]=key==='consent'?event.target.checked:event.target.value;invalidateRequest();}});
 panel.addEventListener('change',event=>{const key=event.target.dataset.request;if(key){form[key]=key==='consent'?event.target.checked:event.target.value;invalidateRequest();if(key==='branch'){if(!selected()?.visitConsultation)form.channel='phone';notifyBranches();loadWalkingRoute();refresh();}}});
 panel.addEventListener('focusout',event=>{const el=event.target,key=el.dataset.request;if(!['date','phone','email'].includes(key)||!el.value)return;let message='';if(key==='date'){const date=el.value,limit=`${Number(today().slice(0,4))+2}${today().slice(4)}`;if(el.validity.badInput||date<today()||date>limit)message='희망 상담일은 오늘부터 2년 이내의 날짜로 선택해 주세요.';}if(key==='phone'&&!/^0\d{8,10}$/.test(el.value.replace(/[\s-]/g,'')))message='연락받을 전화번호를 확인해 주세요.';if(key==='email'&&!el.validity.valid)message='이메일 주소를 확인해 주세요.';if(message)document.dispatchEvent(new CustomEvent('bridge:invalid-input',{detail:{message}}));});
 panel.addEventListener('click',event=>{if(event.target.closest('[data-fill-account]'))fillFromAccount(true);if(event.target.closest('[data-fill-schedule]')){const sample=new Date(today()+'T12:00:00+09:00');sample.setDate(sample.getDate()+7);form.channel=selected()?.visitConsultation===false?'phone':'visit';form.date=sample.toISOString().slice(0,10);form.time='오전';invalidateRequest();refresh();}const branch=event.target.closest('[data-branch]');if(branch){form.branch=branch.dataset.branch;if(!selected()?.visitConsultation)form.channel='phone';invalidateRequest();notifyBranches();loadWalkingRoute();refresh();}if(event.target.closest('[data-request-review]'))reviewRequest();if(event.target.closest('[data-request-edit]')){invalidateRequest();refresh();}});
 document.addEventListener('bridge:region-selected',()=>queueMicrotask(()=>{form.branch='';loadNearbyRoutes();}));
 document.addEventListener('bridge:consultation-example',()=>{if(form.businessName)return;form.businessName='길동식당';invalidateRequest();refresh();});
 document.addEventListener('bridge:map-branch-selected',event=>{form.branch=event.detail.id;invalidateRequest();notifyBranches();loadWalkingRoute();refresh();});
 window.addEventListener('pagehide',invalidateRequest);
}
