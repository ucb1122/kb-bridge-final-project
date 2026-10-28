import {ratePresentation,feeHeadline} from './rate-model.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = values => Array.isArray(values) ? values.filter(value => typeof value === 'string' && value.trim()) : [];
const str = (value, fallback='확인 필요') => typeof value === 'string' && value.trim() ? value : fallback;
const list = values => `<ul class="info-list">${clean(values).map(value=>`<li>${esc(value)}</li>`).join('')}</ul>`;
const safe = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
const labels = {business:'사업자대출',corporate:'기업대출',property:'부동산담보',policy:'정책자금'};
const documentLabels = {published:'공식 안내',electronic:'전자 수집',conditional:'해당 시',confirm:'추가 확인'};
const koreanDate = value => String(value || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, year, month, day) => `${year}년 ${Number(month)}월 ${Number(day)}일`);

function examplesFor(product, detail) {
  const examples = Array.isArray(detail?.rate?.examples) ? detail.rate.examples : [];
  const usable = examples.filter(example => example?.range && example.asOf && example.conditions);
  return usable.length ? usable : product.rateExample ? [product.rateExample] : [];
}

function rateHero(product,detail){
 const p=ratePresentation(product,detail);
 if(p.kind==='comparison')return `<div class="rate-comparison"><article><span>${esc(p.beforeLabel)}</span><strong>${esc(p.before)}</strong></article><article><span>${esc(p.afterLabel)}</span><strong>${esc(p.after)}</strong></article></div><p class="rate-reduction">${esc(p.reductionText)}</p><details class="rate-basis"><summary>${esc(p.asOf)} 기준 · 공시 조건과 계산 보기</summary><p>${esc(p.conditions)}</p><div class="rate-benchmark-table">${p.rows.map(r=>`<div><span>${esc(r.label)}</span><b>${r.before.toFixed(2)}% → ${r.after.toFixed(2)}%</b></div>`).join('')}</div><p>${esc(p.note)}</p></details>`;
 const policy=product.category==='policy';
 return `<div class="rate-comparison published-only"><article><span>${policy?'정책자금 공시 금리':'공시 금리'}</span><strong class="${String(p.range).length>24?'long-rate':''}">${esc(p.range)}</strong></article><article><span>우대 조건</span><strong class="benefit-number">${esc(p.benefit?.headline||'상품별 확인')}</strong><small>${p.benefit?'우대 전·후 범위는 별도 미공시':'미공시 수치를 임의로 계산하지 않아요'}</small></article></div><details class="rate-basis"><summary>${esc(p.asOf||'자료 기준')} · 조건과 우대 항목</summary><p>${esc(p.conditions||detail?.rate?.summary||product.rateText)}</p>${list(p.benefit?.items)}${p.benefit?.note?`<p>${esc(p.benefit.note)}</p>`:''}<p>공시 시점의 조건별 안내이며 현재 개인 적용금리가 아닙니다.</p></details>`;
}

function feeCards(detail){const fees=(detail?.fees||[]).filter(f=>f?.label&&f.text);return fees.length?`<div class="fee-cards">${fees.slice(0,3).map(f=>`<article><span>${esc(f.label)}</span><strong>${esc(feeHeadline(f))}</strong>${f.numericNote?`<small>${esc(f.numericNote)}</small>`:''}</article>`).join('')}</div>`:'';}

function overview(product, detail, role) {
 const short=value=>str(value).split(' · ')[0];
 const audience=product.presentation?.audience||product.eligibility[0]||'대상 조건 확인 필요';
 const eligibility=product.eligibility.filter(v=>role==='landlord'||!v.startsWith('임대인에게는'));
 const p=ratePresentation(product,detail);
 const rate=p.kind==='comparison'?`${esc(p.after)} <small>우대·이자지원 반영 계산 참고값</small>`:`${p.range}`;
 return `<div class="simple-product-rate"><span>공시 금리</span><strong >${p.kind==='comparison'?rate:esc(rate)}</strong><small>${p.asOf?`${esc(koreanDate(p.asOf))} 기준이며, `:''}최신 금리·조건은 변경되었을 수 있으니 공식 안내에서 확인해 주세요. 개인 적용금리가 아닙니다.</small></div><div class="simple-product-facts"><div><span>한도</span><strong>${esc(product.presentation?.limit||short(product.limitText))}</strong></div><div><span>기간</span><strong>${esc(product.presentation?.term||short(product.termText))}</strong></div></div><p class="simple-product-audience">${esc(audience)}</p><p class="simple-product-next">우대 전후·수수료는 <button type="button" data-open-info="rates">금리·비용</button>에서 확인하세요.</p><details class="plain-disclosure"><summary>상세 대상·한도 조건</summary>${list(eligibility)}<p>${esc(product.limitText)}</p><p>${esc(product.termText)}</p></details>`;
}

function rates(product, detail) {
 const examples=examplesFor(product,detail),fees=(detail?.fees||[]).filter(f=>f?.label&&f.text);
 return `${rateHero(product,detail)}${feeCards(detail)}<details class="plain-disclosure"><summary>금리 구조·기준일별 원문 요약</summary><p>${esc(str(detail?.rate?.summary,product.rateText))}</p>${list(detail?.rate?.details)}${examples.map(e=>`<article class="published-rate"><span class="example-label">${esc(e.asOf)} 기준</span><strong>${esc(e.range)}</strong><p>${esc(e.conditions)}</p>${e.formula?`<p>${esc(e.formula)}</p>`:''}<small>${esc(e.note||'현재 개인 적용금리가 아닙니다.')}</small></article>`).join('')}</details><h4>수수료·보증료 상세</h4>${fees.length?`<dl class="fee-list">${fees.map(f=>`<div><dt>${esc(f.label)} <b>${esc(feeHeadline(f))}</b></dt><dd>${esc(f.text)}</dd>${f.brackets?`<details class="stamp-brackets"><summary>인지세 구간별 고객 부담액</summary>${f.brackets.map(([band,value])=>`<div><span>${esc(band)}</span><strong>${esc(value)}</strong></div>`).join('')}<p>${esc(f.bracketsNote)}</p></details>`:''}</div>`).join('')}</dl>`:'<p class="small-notice">개별 수수료·보증료 숫자는 확인 필요합니다. 미공시를 면제로 보지 않습니다.</p>'}`;
}

function repayment(product, detail) {
  const plans = Array.isArray(product.repaymentOptions) ? product.repaymentOptions.filter(plan=>plan?.name && plan.plainText && plan.term) : [];
  return `<p class="section-lead">${esc(str(detail?.repayment?.summary, product.repaymentText))}</p><p class="term-banner">${esc(product.termText)}</p>${list(detail?.repayment?.details)}${plans.length ? `<div class="repayment-switch" role="group" aria-label="상환 방식 설명">${plans.map((plan,index)=>`<button type="button" data-repayment="${index}" aria-pressed="${index===0}">${esc(plan.name)}</button>`).join('')}</div><div id="repayment-plan"></div>` : ''}<details class="plain-disclosure"><summary>상환 용어를 쉽게 설명하면 <span aria-hidden="true">＋</span></summary><div class="disclosure-content"><p>만기일시상환: 매월 이자를 내고 마지막에 원금을 한 번에 갚는 방식입니다.</p><p>원금균등분할상환: 같은 금액의 원금과 남은 원금에 대한 이자를 나누어 내는 방식입니다.</p><p>이 설명은 용어 안내입니다. 실제 선택 가능한 방식은 해당 상품의 조건을 따릅니다.</p></div></details>`;
}

function documents(product,detail){
 const guide=detail?.documents;
 const own=(guide?.items||[]).filter(item=>item?.name);
 const common=(guide?.guides||[]).flatMap(g=>g.items||[]);
 const items=own.length?own:common.length?common:clean(product.documents).map(name=>({name,requirement:'published'}));
 const groupNames={published:'기본 제출·확인',electronic:'동의 후 전자 수집',conditional:'해당하는 경우',confirm:'기관에 추가 확인'};
 const groups=Object.entries(groupNames).map(([key,label])=>({label,items:items.filter(item=>(item.requirement||'published')===key)})).filter(g=>g.items.length);
 return `<p class="document-scope">${own.length?'해당 상품의 공개 안내':common.length?'기관 공통 안내 · 최종 제출목록과 구분':'확인된 준비자료'}</p><div class="document-groups">${groups.map(g=>`<article><h4>${g.label}<span>${g.items.length}</span></h4>${g.items.map(item=>`<div class="document-row"><strong>${esc(item.name)}</strong>${item.note?`<p>${esc(item.note)}</p>`:''}</div>`).join('')}</article>`).join('')}</div><details class="plain-disclosure"><summary>제출 방식과 추가 안내</summary><p>${esc(str(guide?.summary,'제출 범위와 발급일 조건은 기관별 확인이 필요합니다.'))}</p>${list(guide?.notes)}${own.length&&common.length?`<h4>기관 공통 참고자료</h4>${list(common.map(i=>i.name+' · '+(i.note||'')))}`:''}</details>`;
}

function process(product, detail) {
  const steps = clean(detail?.applicationSteps);
  return `${steps.length ? `<div class="process-intro"><span>신청부터 이용까지</span><h3>${steps.length}단계로 확인하세요</h3><p>확인된 상품별 절차를 순서대로 정리했어요.</p></div><ol class="application-steps readable-process">${steps.map((step,i)=>`<li><span class="process-number" aria-hidden="true">${i+1}</span><div><span class="process-step-label">STEP ${String(i+1).padStart(2,'0')}</span><h4>${esc(step)}</h4></div></li>`).join('')}</ol>` : '<p class="section-lead">공개된 개별 신청 절차는 추가 확인이 필요합니다.</p>'}<details class="plain-disclosure process-checks"><summary>신청 전에 확인할 것</summary>${list(product.checks)}</details>`;
}

function sources(product, detail) {
  const commonSources = (detail?.documents?.guides || []).flatMap(guide=>Array.isArray(guide.sources)?guide.sources:[]);
  const values = [{title:product.sourceTitle,url:product.sourceUrl,scope:'기본 상품 안내'},...(Array.isArray(detail?.sources)?detail.sources:[]),...commonSources,...[detail?.rate?.comparison,detail?.rate?.benefit].filter(v=>v?.sourceUrl).map(v=>({title:'금리 범위·우대조건 근거',url:v.sourceUrl})),...(detail?.fees||[]).filter(f=>f.bracketsSource).map(f=>({title:'인지세 구간표 근거',url:f.bracketsSource}))];
  const seen = new Set();
  const sources = values.filter(item=>item?.title && safe(item.url) && !seen.has(item.url) && seen.add(item.url));
  return `<details class="information-sources"><summary>출처·자료 기준 확인 <span aria-hidden="true">＋</span></summary><p>상세 확인: ${esc(detail?.confirmedAt || product.detailVerifiedAt || product.verifiedAt || '확인 필요')}. 공시 금리의 기준일은 상품별 금리 안내에서 확인해 주세요.</p>${sources.map(source=>`<p><a href="${esc(safe(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ↗</a>${source.scope ? `<small>${esc(source.scope)}</small>`:''}</p>`).join('')}</details>`;
}

export function productInformationSections(product,detail,role){
 return [
  {key:'overview',label:'요약',title:'핵심 조건',html:overview(product,detail,role)},
  {key:'rates',label:'금리·비용',title:'금리와 수수료',html:rates(product,detail)},
  {key:'repayment',label:'상환',title:'기간과 갚는 방법',html:repayment(product,detail)},
  {key:'documents',label:'서류',title:'필요 서류',html:documents(product,detail)},
  {key:'process',label:'절차',title:'이용 절차',html:process(product,detail)},
 ];
}

export function renderProductDetails({element,product,detail,role}) {
 if(!product){element.innerHTML='<div class="detail-empty"><h2 id="detail-heading">상품 상세정보</h2><p>목록에서 상품을 선택하세요.</p></div>';return;}
 const sections=productInformationSections(product,detail,role);
 element.innerHTML=`<p class="detail-eyebrow">상품 상세정보</p><h2 id="detail-heading" class="detail-title">${esc(product.name)}</h2><p class="detail-provider">${esc(labels[product.category])} · ${esc(product.provider)}</p><div class="detail-tabs compact-info-tabs" role="tablist" aria-label="상품 세부정보">${sections.map((section,i)=>`<button type="button" role="tab" id="info-tab-${section.key}" data-info-tab="${section.key}" aria-selected="${i===0}" aria-controls="product-section-${section.key}" tabindex="${i===0?'0':'-1'}">${section.label}</button>`).join('')}</div><div id="detail-content" class="detail-body compact-product-info">${sections.map((section,i)=>`<section id="product-section-${section.key}" class="product-info-section" role="tabpanel" aria-labelledby="info-tab-${section.key}" tabindex="0" ${i?'hidden':''}><h3 class="sr-only">${section.title}</h3>${section.html}</section>`).join('')}${sources(product,detail)}</div>`;
 const plans=Array.isArray(product.repaymentOptions)?product.repaymentOptions.filter(plan=>plan?.name&&plan.plainText&&plan.term):[];
 function setPlan(index){const plan=plans[index];if(!plan)return;element.querySelectorAll('[data-repayment]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.repayment)===index)));element.querySelector('#repayment-plan').innerHTML=`<div class="repayment-explainer"><p class="plan-term">${esc(plan.term)}</p><p class="plan-plain">${esc(plan.plainText)}</p>${list(plan.conditions)}</div>`;}
 setPlan(0);element.querySelectorAll('[data-repayment]').forEach(button=>button.addEventListener('click',()=>setPlan(Number(button.dataset.repayment))));
 const tabs=[...element.querySelectorAll('[data-info-tab]')];
 function selectTab(button){for(const tab of tabs){const active=tab===button;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;element.querySelector('#product-section-'+tab.dataset.infoTab).hidden=!active;}element.querySelector('#detail-content').scrollTop=0;}
 element.querySelectorAll('[data-open-info]').forEach(button=>button.addEventListener('click',()=>{const tab=tabs.find(t=>t.dataset.infoTab===button.dataset.openInfo);if(tab){selectTab(tab);tab.focus();}}));
 for(const button of tabs){button.addEventListener('click',()=>selectTab(button));button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const i=tabs.indexOf(button);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectTab(tabs[next]);tabs[next].focus();});}
 const sourceDetails=element.querySelector('.information-sources');
 sourceDetails?.addEventListener('toggle',()=>{
  const icon=sourceDetails.querySelector('summary span');
  if(icon)icon.textContent=sourceDetails.open?'－':'＋';
  if(sourceDetails.open)requestAnimationFrame(()=>{const body=element.querySelector('#detail-content');if(body.scrollHeight>body.clientHeight)body.scrollTop+=sourceDetails.getBoundingClientRect().top-body.getBoundingClientRect().top;else sourceDetails.scrollIntoView({block:'nearest'});});
 });
}
