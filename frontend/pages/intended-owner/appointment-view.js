import {escapeHTML as esc} from './navigator-model.js';
import {nearestBranches} from './customer-flow-model.js';
import {buildConsultationPDF,renderPagePreviews} from './consultation-pdf.js?v=20261028-rr5';
import {validateRequest,today} from './appointment-validation.js';
let branches=[],form={branch:'',phone:'',email:'',date:'',time:'',name:'',businessName:'',channel:'visit',consent:false},preview=false,pdfUrl='',previewPages=[],generation=0,loading=false,loadError='',context=()=>'',getRegion=()=>null,walking=null,walkingState='',walkingRequest=0,nearbyRequest=0,nearbyRoutes=new Map(),nearbyLoading=false;
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
export function invalidateRequest(){generation++;preview=false;previewPages=[];if(pdfUrl){URL.revokeObjectURL(pdfUrl);pdfUrl='';}}
function branchChoices(){const near=sortedNearby();return `<div class="nearby-branches">${near.map(b=>{const route=nearbyRoutes.get(b.id);return `<button type="button" data-branch="${esc(b.id)}" aria-pressed="${form.branch===b.id}"><span><strong>KB국민은행 ${esc(b.name)}</strong><small>${esc(b.address)}</small></span><b>${route&&!route.error?`도보 약 ${(route.distanceMeters/1000).toFixed(1)}km · 약 ${Math.ceil(route.durationSeconds/60)}분`:nearbyLoading?'도보 경로 확인 중':`직선 약 ${b.distance.toFixed(1)}km · 도보 경로 미확인`}</b></button>`}).join('')}</div>${walkingState?`<p class="walking-status" role="status">${esc(walkingState)}</p>`:''}${!getRegion()?'<p>지도에서 상권을 고르면 가까운 영업점을 먼저 보여드려요.</p>':''}`;}

function branchOptions(query=''){const rows=branches.filter(b=>(b.name+' '+b.address).includes(query)||b.id===form.branch);return '<option value="">영업점을 선택해 주세요</option>'+rows.map(b=>`<option value="${esc(b.id)}" ${b.id===form.branch?'selected':''}>${esc(b.name)} · ${esc(b.address)}</option>`).join('');}
export function appointmentHTML(){const b=selected();
 if(preview&&pdfUrl)return `<section class="appointment pdf-preview" id="appointment-body"><span class="request-status">전송 전 확인 · 은행 미접수</span><h3>상담서 내용을 PDF로 확인해 주세요</h3><p>선택한 고민·금액 비교·노란우산 요청·영업점 일정이 담겨 있어요.</p><div class="pdf-paper-preview">${previewPages.map((src,i)=>`<img src="${src}" alt="PDF 상담서 ${i+1}쪽 미리보기">`).join('')}</div><div class="pdf-actions"><a href="${pdfUrl}" download="우리 가게_영업점 상담서.pdf">PDF 내려받기</a><button type="button" data-request-edit>내용 수정하기</button></div><p>같은 내용의 PDF 파일을 내려받을 수 있어요. 시연 화면에서는 전송 흐름을 확인할 수 있어요. 실제 은행 접수·예약은 진행되지 않아요.</p><button type="button" class="request-primary" data-request-send>영업점에 상담서 보내기 →</button><p id="request-demo-status" role="status"></p></section>`;
 return `<section class="appointment" id="appointment-body"><h3>${getRegion()?'선택한 상권 근처 영업점':'상담할 영업점을 골라주세요'}</h3>${branchChoices()}${loading?'<p role="status">공식 공개 영업점 목록을 불러오는 중이에요.</p>':''}${loadError?`<p role="alert">${esc(loadError)}</p>`:''}<details class="branch-search"><summary>다른 영업점 찾기</summary><label>지점명·지역 검색<input id="branch-search" type="search" placeholder="예: 청량리, 동대문구"></label><label>검색한 영업점<select data-request="branch">${branchOptions()}</select></label></details>${b?`<div class="chosen-branch"><strong>선택: KB국민은행 ${esc(b.name)}</strong><p>${esc(b.address)}<br>${esc(b.phone)} · 공개 영업시간 ${esc(b.hours)}</p>${!b.visitConsultation?'<small>방문 상담 정보 미확인 · 전화 상담 희망으로 선택해 주세요.</small>':''}</div>`:''}<div class="request-grid"><label>상담 방법<select data-request="channel"><option value="visit" ${form.channel==='visit'?'selected':''}>방문 상담 희망</option><option value="phone" ${form.channel==='phone'?'selected':''}>전화 상담 희망</option></select></label><label>희망 상담일<input type="date" min="${today()}" max="${Number(today().slice(0,4))+2}${today().slice(4)}" data-request="date" value="${esc(form.date)}"></label><label>희망 시간대<select data-request="time"><option value="">시간대 선택</option><option ${form.time==='오전'?'selected':''}>오전</option><option ${form.time==='오후'?'selected':''}>오후</option></select></label><label>연락받을 전화번호<input type="tel" autocomplete="off" data-request="phone" value="${esc(form.phone)}" placeholder="010-0000-0000"></label></div><fieldset class="request-identity"><legend>상담서에 담을 신청인 정보 <small>(선택) · 비워 두면 빈칸으로 나와요</small> <button type="button" class="request-account-fill" data-fill-account>내 정보 불러오기</button></legend><div class="request-grid"><label>상호<input type="text" maxlength="80" data-request="businessName" value="${esc(form.businessName)}" placeholder="예: 서교식당"></label><label>성명<input type="text" maxlength="40" data-request="name" value="${esc(form.name)}" placeholder="예: 홍길동"></label><label>이메일<input type="email" autocomplete="off" data-request="email" value="${esc(form.email)}" placeholder="name@example.com"></label></div></fieldset><label class="request-consent"><input type="checkbox" data-request="consent" ${form.consent?'checked':''}> 연락처·신청인 정보를 포함한 PDF 상담서를 만들게요.</label><p class="request-status">현재는 PDF 확인까지 가능해요. 연락처는 서버에 저장·전송하지 않습니다.</p><p id="request-errors" role="alert"></p><button class="request-primary" type="button" data-request-review>PDF 상담서 확인 →</button><small class="branch-source">영업점 출처: KB국민은행 공식 지점검색 · 2026-10-22 수집</small></section>`;
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

export async function reviewRequest(){
 if(preview&&pdfUrl){document.getElementById('appointment-body')?.scrollIntoView({block:'start'});return;}
 const status=document.getElementById('request-errors'),errors=validateRequest(form,selected());
 if(errors.length){if(status)status.textContent=errors.join(' ');document.dispatchEvent(new CustomEvent('bridge:invalid-input',{detail:{message:errors[0]}}));return;}
 const current=++generation;if(status)status.textContent='한글 PDF 상담서를 만들고 있어요…';
 try{let images=[];const bytes=await buildConsultationPDF({summary:context(),branch:{...selected()},form:{...form}},{onPreview:async(pages,font)=>{images=await renderPagePreviews(pages,font);}});if(current!==generation)return;previewPages=images;pdfUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));preview=true;refresh();document.getElementById('appointment-body')?.scrollIntoView({block:'start'});}
 catch(error){if(current===generation&&status)status.textContent='PDF를 만들지 못했어요. 입력 내용은 유지됩니다. 다시 시도해 주세요.';console.error('상담서 PDF 생성 실패',error);}
}
export function initAppointment(getContext,regionProvider){context=getContext;getRegion=regionProvider||(()=>null);loading=true;
 fetch(new URL('/shared/finance/kb-branches.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('영업점 목록 오류');return r.json();}).then(data=>{branches=data.branches.sort((a,b)=>a.name.localeCompare(b.name,'ko'));loading=false;loadNearbyRoutes();}).catch(()=>{loading=false;loadError='영업점 목록을 불러오지 못했어요. 새로고침 후 다시 확인해 주세요.';refresh();});
 fillFromAccount();
 const panel=document.getElementById('recovery-panel');
 panel.addEventListener('input',event=>{if(event.target.id==='branch-search'){const el=panel.querySelector('[data-request="branch"]');if(el)el.innerHTML=branchOptions(event.target.value.trim());return;}const key=event.target.dataset.request;if(key){form[key]=key==='consent'?event.target.checked:event.target.value;invalidateRequest();}});
 panel.addEventListener('change',event=>{const key=event.target.dataset.request;if(key){form[key]=key==='consent'?event.target.checked:event.target.value;invalidateRequest();if(key==='branch'){if(!selected()?.visitConsultation)form.channel='phone';notifyBranches();loadWalkingRoute();refresh();}}});
 panel.addEventListener('focusout',event=>{const el=event.target,key=el.dataset.request;if(!['date','phone','email'].includes(key)||!el.value)return;let message='';if(key==='date'){const date=el.value,limit=`${Number(today().slice(0,4))+2}${today().slice(4)}`;if(el.validity.badInput||date<today()||date>limit)message='희망 상담일은 오늘부터 2년 이내의 날짜로 선택해 주세요.';}if(key==='phone'&&!/^0\d{8,10}$/.test(el.value.replace(/[\s-]/g,'')))message='연락받을 전화번호를 확인해 주세요.';if(key==='email'&&!el.validity.valid)message='이메일 주소를 확인해 주세요.';if(message)document.dispatchEvent(new CustomEvent('bridge:invalid-input',{detail:{message}}));});
 panel.addEventListener('click',event=>{if(event.target.closest('[data-fill-account]'))fillFromAccount(true);const branch=event.target.closest('[data-branch]');if(branch){form.branch=branch.dataset.branch;if(!selected()?.visitConsultation)form.channel='phone';invalidateRequest();notifyBranches();loadWalkingRoute();refresh();}if(event.target.closest('[data-request-send]')){const st=document.getElementById('request-demo-status');st.classList.add('request-done');st.innerHTML='<strong>영업점 상담 신청완료</strong><span>영업점에서 내용을 확인 후 연락드릴게요.</span>';const sendBtn=event.target.closest('[data-request-send]');sendBtn.remove();if(!document.querySelector('[data-request-recheck]'))st.insertAdjacentHTML('afterend','<button type="button" class="request-recheck" data-request-recheck>상담 요청 내용 다시 확인</button>');st.scrollIntoView({block:'nearest'});}if(event.target.closest('[data-request-recheck]')){document.querySelector('.pdf-paper-preview')?.scrollIntoView({block:'start'});}if(event.target.closest('[data-request-review]'))reviewRequest();if(event.target.closest('[data-request-edit]')){invalidateRequest();refresh();}});
 document.addEventListener('bridge:region-selected',()=>queueMicrotask(()=>{form.branch='';loadNearbyRoutes();}));
 document.addEventListener('bridge:map-branch-selected',event=>{form.branch=event.detail.id;invalidateRequest();notifyBranches();loadWalkingRoute();refresh();});
 window.addEventListener('pagehide',invalidateRequest);
}
