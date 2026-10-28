const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = value => String(value || '').normalize('NFC').toLocaleLowerCase('ko').replace(/\s+/g, '');
const phoneURL = value => /^[0-9()+\s-]+$/.test(String(value || '')) && String(value).replace(/\D/g, '').length >= 8 ? 'tel:' + String(value).replace(/[^+0-9]/g, '') : null;

export function initProductConsultation(getContext, getPolicyContact) {
  const $ = id => document.getElementById(id);
  const dialog = $('product-consultation');
  let branchData = null, loading = null, selectedBranch = null, context = null, limit = 6, channel = 'bank';

  function setContact() {
    const policy = getPolicyContact();
    const phone = channel === 'policy' ? policy?.phone : selectedBranch?.phone;
    const href = phoneURL(phone);
    const button = $('consultation-call');
    if (href) {
      button.href = href; button.removeAttribute('aria-disabled');
      button.textContent = '전화로 상담 연결 ' + phone;
    } else {
      button.removeAttribute('href'); button.setAttribute('aria-disabled', 'true');
      button.textContent = channel === 'policy' ? '상담번호 확인 중' : '먼저 영업점을 선택해 주세요';
    }
    $('selected-contact').textContent = channel === 'policy'
      ? policy ? `${policy.name} · ${policy.phone}` : '정책자금 공식 상담번호를 확인하고 있습니다.'
      : selectedBranch ? `${selectedBranch.name} · ${selectedBranch.phone || '전화번호 확인 필요'}` : '선택한 영업점이 없습니다.';
    updateMemo();
  }

  function updateMemo() {
    if (!context) return;
    const destination = channel === 'policy' ? getPolicyContact()?.name || '정책자금 상담기관' : selectedBranch?.name || '영업점 미선택';
    const note = $('consultation-memo').value.trim();
    $('consultation-preview').textContent = [
      '상담할 상품: ' + context.product.name,
      '고객 유형: ' + (context.role === 'landlord' ? '임대인(건물주)' : '임차인(개인사업자)'),
      '확인할 주제: ' + $('consultation-topic').value,
      '상담 기관: ' + destination,
      ...(note ? ['내 질문: ' + note] : []),
      '상품별 자격·적용금리·준비서류를 확인하고 싶습니다.',
    ].join('\n');
  }

  function renderBranches() {
    const query = normalize($('branch-keyword').value), district = $('branch-district').value;
    const branches = (branchData?.branches || []).filter(branch => {
      if (district && !String(branch.address).includes(district)) return false;
      return !query || normalize(branch.name + branch.address).includes(query);
    }).sort((a,b) => a.name.localeCompare(b.name, 'ko'));
    $('branch-count').textContent = `${branches.length}곳`;
    $('consultation-branches').innerHTML = branches.length ? branches.slice(0, limit).map(branch =>
      `<button type="button" class="consult-branch" data-branch="${escapeHTML(branch.id)}" aria-pressed="${selectedBranch?.id === branch.id}"><strong>${escapeHTML(branch.name)}</strong><span>${escapeHTML(branch.address)}</span><small>${escapeHTML(branch.phone || '전화번호 확인 필요')}</small><b>${selectedBranch?.id === branch.id ? '선택함' : '선택'}</b></button>`
    ).join('') : '<p class="small-notice">이름이나 지역을 바꿔 검색해 주세요.</p>';
    $('branch-more').hidden = branches.length <= limit;
    dialog.querySelectorAll('[data-branch]').forEach(button => button.addEventListener('click', () => {
      selectedBranch = branchData.branches.find(branch => branch.id === button.dataset.branch);
      renderBranches(); setContact();
    }));
  }

  async function loadBranches() {
    if (branchData) return renderBranches();
    if (!loading) loading = fetch('/shared/finance/kb-branches.json', {cache:'no-cache'}).then(async response => {
      if (!response.ok) throw new Error('영업점 자료 연결 실패');
      const data = await response.json();
      if (!Array.isArray(data.branches)) throw new Error('영업점 자료 형식 확인 필요');
      data.branches = data.branches.filter(branch => typeof branch.id === 'string' && branch.name && branch.address);
      branchData = data;
      const districts = [...new Set(data.branches.map(branch => String(branch.address).match(/(?:서울특별시|서울)\s+([가-힣]+구)/)?.[1]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
      $('branch-district').innerHTML = '<option value="">서울시 전체</option>' + districts.map(name => `<option>${escapeHTML(name)}</option>`).join('');
      const date = typeof data.retrievedAt === 'string' ? data.retrievedAt.slice(0,10) : '확인 필요';
      $('branch-provenance').textContent = `KB국민은행 공식 지점검색 · 자료 조회 ${date}. 현재 담당 업무·영업시간·상담 가능 여부는 지점에 확인해 주세요.`;
    }).catch(error => { loading = null; throw error; });
    try { await loading; renderBranches(); }
    catch { $('consultation-branches').innerHTML = '<p class="small-notice" role="alert">영업점 정보를 불러오지 못했어요. 잠시 후 상담 준비를 다시 열어 주세요.</p>'; }
  }

  function setChannel(next) {
    channel = next;
    $('consultation-bank').hidden = next !== 'bank';
    $('consultation-policy').hidden = next !== 'policy';
    dialog.querySelectorAll('[data-channel]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.channel === next)));
    if (next === 'bank') loadBranches();
    else {
      const policy = getPolicyContact();
      $('policy-contact-name').textContent = policy?.name || '정책자금 상담기관';
      $('policy-contact-phone').textContent = policy?.phone || '확인 필요';
      $('policy-contact-note').textContent = policy?.note || '정책자금의 대상·신청 경로·현재 접수 여부를 문의하세요.';
    }
    setContact();
  }

  $('close-consultation').addEventListener('click', () => dialog.close());
  $('consultation-back').addEventListener('click', () => dialog.close());
  $('branch-keyword').addEventListener('input', () => { limit = 6; renderBranches(); });
  $('branch-district').addEventListener('change', () => { limit = 6; renderBranches(); });
  $('branch-more').addEventListener('click', () => { limit += 6; renderBranches(); });
  $('consultation-topic').addEventListener('change', updateMemo);
  $('consultation-memo').addEventListener('input', updateMemo);
  $('consultation-call').addEventListener('click', event => { if (event.currentTarget.getAttribute('aria-disabled') === 'true') event.preventDefault(); });
  dialog.querySelectorAll('[data-channel]').forEach(button => button.addEventListener('click', () => setChannel(button.dataset.channel)));

  return function openConsultation() {
    context = getContext();
    if (!context?.product) return;
    selectedBranch = null; limit = 6;
    $('consultation-product').textContent = context.product.name;
    $('consultation-role').textContent = context.role === 'landlord' ? '임대인(건물주)' : '임차인(개인사업자)';
    $('consultation-memo').value = ''; $('consultation-topic').selectedIndex = 0;
    $('branch-keyword').value = ''; $('branch-district').value = '';
    const isPolicy = context.product.category === 'policy';
    $('policy-channel-button').hidden = !isPolicy;
    $('bank-channel-button').textContent = isPolicy ? '은행 취급 경로 문의' : 'KB 영업점 상담';
    setChannel(isPolicy ? 'policy' : 'bank');
    dialog.showModal();
  };
}
