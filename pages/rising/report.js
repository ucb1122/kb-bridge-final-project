import {quarter} from './report-view.js';
import {renderReportTab} from './full-report.js';
const params=new URLSearchParams(location.search),query=new URLSearchParams({kind:params.get('kind')||'',code:params.get('code')||'',quarter:params.get('quarter')||''});
const $=id=>document.getElementById(id);
$('print').onclick=()=>window.print();
async function api(path){const response=await fetch(path+'?'+query),data=await response.json();if(!response.ok||!data)throw Error(data?.error||'지역 자료를 찾을 수 없습니다.');return data}
try{
  const report=await api('/api/rising/report');
  $('title').textContent=`${report.district} ${report.name} 분석 보고서`;
  $('meta').textContent=`${report.kind==='dong'?'뜨는 동네':'뜨는 상권'} · ${quarter(report.quarter)} · ${params.get('rank')||'—'}위`;
  document.title=`${report.district} ${report.name} 분석 보고서`;
  for(const tab of ['overview','industry','sales','population','hinterland'])renderReportTab($(tab),report,tab);
  try{renderReportTab($('overview'),report,'overview',await api('/api/rising/analysis'))}catch(error){renderReportTab($('overview'),report,'overview',{mode:'data',lines:[],note:error.message})}
  $('print').disabled=false;
}catch(error){$('meta').textContent=error.message}
