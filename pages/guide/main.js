import {ratePresentation} from './rate-model.js';
import { renderProductDetails } from './detail-view.js?v=20261028-process-1';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const CATEGORY_LABELS = { business: '사업자대출', corporate: '기업대출', property: '부동산담보', policy: '정책자금' };
const FALLBACK = '공식 조건 확인 필요';
const params = new URLSearchParams(location.search);
const state = {
  role: params.get('role') === 'landlord' || params.get('audience') === 'landlord' ? 'landlord' : 'tenant',
  category: Object.hasOwn(CATEGORY_LABELS, params.get('category')) ? params.get('category') : 'all',
  query: (params.get('q') || '').slice(0, 120),
  purpose: '', provider: '', selected: null, detailTab: 'overview', repaymentIndex: 0, quickRoute: null,
};
let catalog = null;
let products = [];
let financeDetails = new Map();
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const text = (value, fallback = FALLBACK) => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const strings = (values) => Array.isArray(values) ? values.filter((value) => typeof value === 'string' && value.trim()) : [];
const normalize = (value) => String(value ?? '').normalize('NFC').toLocaleLowerCase('ko').replace(/\s+/g, '');
const safeURL = (value) => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };

const entryCount = (items) => items.filter((item) => item.entryType !== 'overview').length;
const overviewCount = (items) => items.filter((item) => item.entryType === 'overview').length;

function productFacts(product) {
  const short = (value) => text(value).split(' · ')[0];
  const displayRate=ratePresentation(product,financeDetails.get(product.id));
  return {
    audience: text(product.presentation?.audience, product.eligibility[0] || FALLBACK),
    limit: text(product.presentation?.limit, short(product.limitText)),
    term: text(product.presentation?.term, short(product.termText)),
    rate: displayRate.kind==='comparison'?displayRate.after+' · 적용 예시':text(financeDetails.get(product.id)?.rate?.examples?.find(e=>e.range&&e.asOf)?.range, product.category==='policy'?short(product.rateText):'상품별 확인'),
    asOf: displayRate.asOf||'',
  };
}

function roleProducts() { return products.filter((product) => product.roles.includes(state.role)); }
function filteredProducts() {
  const query = normalize(state.query);
  return roleProducts().filter((product) => {
    if (state.category !== 'all' && product.category !== state.category) return false;
    if (state.provider && product.provider !== state.provider) return false;
    if (state.purpose && !product.purposes.includes(state.purpose)) return false;
    if (!query) return true;
    return normalize([product.name, product.provider, product.summary, CATEGORY_LABELS[product.category], ...product.purposes, ...product.tags, ...product.eligibility].join(' ')).includes(query);
  });
}

function updateURL() {
  const next = new URL(location.href);
  next.searchParams.set('role', state.role);
  for (const [key, value] of [['q', state.query], ['category', state.category === 'all' ? '' : state.category]]) {
    value ? next.searchParams.set(key, value) : next.searchParams.delete(key);
  }
  history.replaceState(null, '', next);
}

function renderControls() {
  $$('.audience-button').forEach((button) => {
    const active = button.dataset.role === state.role;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    const count = entryCount(products.filter((product) => product.roles.includes(button.dataset.role)));
    button.querySelector('small').textContent = (button.dataset.role === 'landlord' ? '임대사업 관련 정보 ' : '사업 운영 관련 정보 ') + count + '개';
  });
  $$('.category-tabs [role=tab]').forEach((button) => {
    const active = button.dataset.category === state.category;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    const key = button.dataset.category;
    const label = key === 'all' ? '전체' : CATEGORY_LABELS[key];
    const count = entryCount(roleProducts().filter((product) => key === 'all' || product.category === key));
    button.setAttribute('aria-label', label);
    button.innerHTML = label + '<span class="category-count" aria-hidden="true">' + count + '</span>';
  });
  $('#catalog-results').setAttribute('aria-labelledby', `category-${state.category}`);
  $('#keyword').value = state.query;
  const count = entryCount(roleProducts()), total = entryCount(products);
  $('#role-note').textContent = `현재 연결한 ${total}개 상품·자금 중 ${state.role === 'landlord' ? '임대인' : '임차인'} 관련 ${count}개를 모았습니다. ` + (state.role === 'landlord'
    ? '관련 정보이며 부동산임대업의 취급 여부와 허용 용도는 상품별로 확인해야 합니다.'
    : '지원 대상과 현재 접수 여부는 상품별로 확인하세요.');
}

function populateFilters() {
  const current = roleProducts();
  const fill = (selector, values) => {
    $(selector).innerHTML = '<option value="">전체</option>' + [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ko')).map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join('');
  };
  fill('#purpose', current.flatMap((product) => product.purposes));
  fill('#provider', current.map((product) => product.provider));
  $('#purpose').value = state.purpose;
  $('#provider').value = state.provider;
}

function renderResults() {
  const shown = filteredProducts();
  if (!shown.some((product) => product.id === state.selected)) {
    state.selected = (shown.find(p=>p.id==='kb-soho-credit')||shown.find(p=>p.entryType!=='overview')||shown[0])?.id || null;
    state.detailTab = 'overview'; state.repaymentIndex = 0;
  }
  $('#result-count').textContent = `${entryCount(shown)}개 상품·자금` + (overviewCount(shown) ? ` · 종합안내 ${overviewCount(shown)}건` : '');
  $('#catalog-results').setAttribute('aria-busy', 'false');
  if (!shown.length) {
    const emptyMessage = state.role === 'landlord' && state.category === 'policy'
      ? text(catalog?.missingPolicyNotice, '부동산임대업에 적용할 수 있는 정책자금을 현재 목록에서 확인하지 못했습니다. 최신 공식 공고에서 업종 조건을 확인하세요.')
      : '검색어나 상세 조건을 바꿔보세요. 목록에 없다는 이유로 지원 대상이 아닌 것은 아닙니다.';
    $('#product-list').innerHTML = `<div class="empty-state"><strong>확인된 상품이 없어요.</strong>${escapeHTML(emptyMessage)}<br><button type="button" class="button button-outline" id="clear-results">조건 다시 설정하기</button></div>`;
    $('#clear-results').addEventListener('click', resetFilters);
  } else {
    $('#product-list').innerHTML = shown.map((product) => {
      const facts = productFacts(product);
      return `<article class="product-card"><button class="product-select" type="button" data-product-id="${escapeHTML(product.id)}" aria-pressed="${product.id === state.selected}" aria-controls="product-detail"><span class="product-tag ${product.category}">${product.entryType === 'overview' ? '종합안내' : CATEGORY_LABELS[product.category]}</span><span class="product-copy"><h3>${escapeHTML(product.name)}</h3><p>${escapeHTML(text(product.summary, '공식 안내에서 대상과 조건을 확인하세요.'))}</p><span class="card-facts"><span><small>한도</small>${escapeHTML(facts.limit)}</span><span><small>기간</small>${escapeHTML(facts.term)}</span></span><span class="product-provider">${escapeHTML(product.provider)}</span></span><span class="product-open">살펴보기<span aria-hidden="true">›</span></span></button></article>`;
    }).join('');
    $$('#product-list [data-product-id]').forEach((button) => button.addEventListener('click', () => {
      state.selected = button.dataset.productId;
      state.detailTab = 'overview'; state.repaymentIndex = 0;
      $$('#product-list [data-product-id]').forEach((item) => item.setAttribute('aria-pressed', String(item.dataset.productId === state.selected)));
      renderDetail();
      if (matchMedia('(max-width:1050px)').matches) $('#product-detail').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }));
  }
  renderControls();
  renderDetail();
  updateURL();
}

function renderDetail() {
  const product = products.find(item => item.id === state.selected);
  renderProductDetails({element:$('#product-detail'),product,detail:product ? financeDetails.get(product.id) : null,role:state.role});
}

function keyboardTabs(tabList) {
  tabList.addEventListener('keydown', (event) => {
    const tab = event.target.closest('[role=tab]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...tabList.querySelectorAll('[role=tab]')];
    let index = tabs.indexOf(tab);
    if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = tabs.length - 1;
    else index = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[index].click();
    if (tabList.isConnected) tabs[index].focus();
  });
}

function resetFilters() {
  state.query = ''; state.category = 'all'; state.purpose = ''; state.provider = ''; state.quickRoute = null;
  populateFilters(); renderResults();
}

function bindEvents() {
  $$('.audience-button').forEach((button) => button.addEventListener('click', () => {
    state.role = button.dataset.role; state.category = 'all'; state.query = ''; state.purpose = ''; state.provider = ''; state.selected = null; state.quickRoute = null;
    populateFilters(); renderResults();
  }));
  $$('.category-tabs [role=tab]').forEach((button) => button.addEventListener('click', () => {
    if (state.quickRoute !== null) { state.purpose = ''; state.quickRoute = null; populateFilters(); }
    state.category = button.dataset.category; renderResults();
  }));
  keyboardTabs($('.category-tabs'));
  $('#search-form').addEventListener('submit', (event) => { event.preventDefault(); state.query = $('#keyword').value.trim().slice(0, 120); renderResults(); });
  $('#keyword').addEventListener('search', () => { if (!$('#keyword').value) { state.query = ''; renderResults(); } });
  $('#filter-form').addEventListener('submit', (event) => { event.preventDefault(); state.purpose = $('#purpose').value; state.provider = $('#provider').value; renderResults(); });
  $('#reset-filters').addEventListener('click', resetFilters);
}

async function init() {
  bindEvents(); renderControls();
  try {
    const response = await fetch('/shared/finance/products.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`상품정보 응답 오류: ${response.status}`);
    catalog = await response.json();
    if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.products)) throw new Error('상품정보 파일 형식을 확인하세요.');
    const ids = new Set();
    products = catalog.products.filter((product) => {
      if (!product || typeof product.id !== 'string' || ids.has(product.id) || typeof product.name !== 'string' || !Object.hasOwn(CATEGORY_LABELS, product.category) || !strings(product.roles).some((role) => ['tenant', 'landlord'].includes(role))) return false;
      ids.add(product.id); return true;
    }).map((product) => ({ ...product, provider: text(product.provider, '제공기관 확인 필요'), roles: strings(product.roles), purposes: strings(product.purposes), eligibility: strings(product.eligibility), tags: strings(product.tags), checks: strings(product.checks), documents: strings(product.documents) }));
    if (catalog.products.length && !products.length) throw new Error('표시할 수 있는 상품정보가 없습니다.');
    const detailFiles = ['details-bank-a.json','details-bank-b.json','details-policy.json'];
    const detailResults = await Promise.allSettled(detailFiles.map(async file => {
      const result = await fetch('/shared/finance/'+file, {cache:'no-cache'});
      if (!result.ok) throw new Error('상세자료 연결 확인 필요');
      const data = await result.json();
      if (!Array.isArray(data.products)) throw new Error('상세자료 형식 확인 필요');
      return data;
    }));
    const guides = new Map();
    for (const result of detailResults) if (result.status==='fulfilled') {
      for (const guide of result.value.documentGuides || []) if (guide?.id) guides.set(guide.id,guide);
    }
    const validIds = new Set(products.map(product=>product.id));
    for (const result of detailResults) if (result.status==='fulfilled') {
      for (const detail of result.value.products) {
        if (!validIds.has(detail?.id) || financeDetails.has(detail.id)) continue;
        const documents = detail.documents ? {...detail.documents,guides:(detail.documents.commonGuideIds || []).map(id=>guides.get(id)).filter(Boolean)} : null;
        financeDetails.set(detail.id,{...detail,documents});
      }
    }
    if (typeof catalog.notice === 'string') $('#catalog-notice').textContent = catalog.notice;
    if (typeof catalog.sourceNotice === 'string') $('#catalog-source').textContent = catalog.sourceNotice;
    else $('#catalog-source').textContent = `출처: 상품별 공식 안내 · 출처 확인 ${text(catalog.verifiedAt, '확인 필요')}`;
    populateFilters(); renderResults();
  } catch (error) {
    console.error('[금융상품 안내] 상품정보 로딩 실패', error);
    $('#catalog-results').setAttribute('aria-busy', 'false');
    $('#result-count').textContent = '연결 확인 필요';
    $('#product-list').innerHTML = '<div class="empty-state" role="alert"><strong>상품정보를 불러오지 못했어요.</strong>잠시 후 다시 확인해 주세요.<br><button id="retry-load" type="button" class="button button-outline">다시 불러오기</button></div>';
    $('#retry-load').addEventListener('click', () => location.reload());
    $('#catalog-source').textContent = '공식 상품정보 파일 연결을 확인해야 합니다.';
  }
}

init();
