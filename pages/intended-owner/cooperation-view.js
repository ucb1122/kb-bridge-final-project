import {compareCooperation} from './cooperation-model.js';
const fmt=value=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(value);
const money=value=>fmt(Math.abs(value))+'만원';
export function initCooperation() {
  const $=id=>document.getElementById(id);
  let example=false;
  const draft=()=>({rent:$('coop-rent').value,requestedPercent:$('coop-requested').value,agreedPercent:$('coop-agreed').value,vacancyEnabled:$('coop-mode').value==='vacancy',vacancyMonths:$('coop-vacancy').value});
  function render(){
    const input=draft(),result=compareCooperation(input);
    $('coop-vacancy-wrap').hidden=!input.vacancyEnabled;
    $('coop-mode-label').textContent=example?'설명용 예시':'직접 입력한 조건';
    $('coop-empty').hidden=result.status==='ready';$('coop-results').hidden=result.status!=='ready';
    if(result.status!=='ready'){$('coop-empty').textContent=result.status==='invalid'?'금액·인상률·기간의 입력 범위를 확인해 주세요.':'같은 점포의 현재 월세와 두 인상률을 입력하면 양쪽의 변화를 함께 보여드려요.';return;}
    $('coop-tenant').textContent=money(result.tenantMonthlySaving)+(result.tenantMonthlySaving>0?' 덜 내요':result.tenantMonthlySaving<0?' 더 내요':' · 차이 없음');
    $('coop-landlord').textContent=money(result.landlordAnnualDifference)+(result.landlordAnnualDifference>0?' 더 받아요':result.landlordAnnualDifference<0?' 덜 받아요':' · 차이 없음');
    $('coop-status').textContent=result.mutualBenefit?'입주가 유지된다면 두 사람이 함께 검토할 수 있는 조건이에요.':'인상률과 공실 가정을 바꾸며 서로 감당할 조건을 찾아보세요.';
    $('coop-status').classList.toggle('mutual',result.mutualBenefit);
    $('coop-tenant-bars').innerHTML=bars([['요청안',result.requestedRent],['협의안',result.agreedRent]]);
    $('coop-landlord-bars').innerHTML=bars([['요청안',result.requestedAnnual],['협의안',result.agreedAnnual]]);
    $('coop-boundary').textContent=result.breakEvenVacancyMonths===null?'같은 점포를 12개월 기준으로 비교합니다.':`요청안에 공실 ${fmt(result.breakEvenVacancyMonths)}개월이 생기는 경우와 협의안의 12개월 임대수입이 같아요.`;
    $('coop-scenario').textContent=input.vacancyEnabled?`요청안: 공실 ${fmt(result.vacancyMonths)}개월 가정 · 협의안: 12개월 입주 유지 가정`:'두 안 모두 12개월 입주 유지 가정';
    $('coop-summary').textContent=`같은 점포 월세 ${fmt(result.rent)}만원\n요청안 월세 ${fmt(result.requestedRent)}만원 / 연 임대수입 ${fmt(result.requestedAnnual)}만원\n협의안 월세 ${fmt(result.agreedRent)}만원 / 연 임대수입 ${fmt(result.agreedAnnual)}만원\n${$('coop-scenario').textContent}\n공실은 예측값이 아닌 직접 정한 조건이며, 세금·금리·공사비·새 임차인의 월세는 제외한 비교입니다.`;
  }
  function bars(rows){const max=Math.max(1,...rows.map(row=>row[1]));return rows.map(([label,value])=>`<div class="cooperation-bar"><span>${label}</span><i style="width:${Math.max(0,value/max*100)}%"></i><strong>${fmt(value)}</strong></div>`).join('');}
  for(const id of ['coop-rent','coop-requested','coop-agreed','coop-vacancy','coop-mode'])$(id).addEventListener('input',()=>{example=false;render();});
  $('coop-example').onclick=()=>{$('coop-rent').value='180';$('coop-requested').value='10';$('coop-agreed').value='3';$('coop-mode').value='vacancy';$('coop-vacancy').value='1';example=true;render();};
  $('coop-clear').onclick=()=>{for(const id of ['coop-rent','coop-requested','coop-agreed','coop-vacancy'])$(id).value='';$('coop-mode').value='occupied';example=false;render();};
  for(const button of document.querySelectorAll('[data-comparison-view]'))button.onclick=()=>{
    const individual=button.dataset.comparisonView==='individual';$('cooperation-comparison').hidden=individual;$('individual-comparison').hidden=!individual;
    $('simulator-dialog').setAttribute('aria-labelledby',individual?'simulator-heading':'cooperation-heading');
    for(const item of document.querySelectorAll('[data-comparison-view]'))item.setAttribute('aria-pressed',String(item===button));
  };
  render();
}
