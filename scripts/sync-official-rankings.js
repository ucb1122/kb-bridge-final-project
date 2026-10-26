import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new DatabaseSync(path.join(root,'data/commerce.sqlite'),{readOnly:true});
const quarter=process.argv[2]||db.prepare('SELECT MAX(quarter) AS quarter FROM observations').get().quarter;
const latest=db.prepare('SELECT MAX(quarter) AS quarter FROM observations').get().quarter;
if(quarter!==latest)throw Error('원본 사이트의 기본 조회분기와 일치하는 최신 분기만 동기화할 수 있습니다.');
const districts=[{district:'',code:''},...db.prepare("SELECT DISTINCT district,substr(region_code,1,5) AS code FROM observations WHERE quarter=? AND kind='dong' ORDER BY district").all(quarter)];
db.close();
const kinds={dong:'searchCommercialTown',area:'seacrhCommercialArea'};
const metrics={stores:'searchTabStoreCnt',sales:'searchTabSales',footfall:'searchTabFlowPop',residents:'searchTabResiPop'};
const base='https://golmok.seoul.go.kr';
const landing=await fetch(base+'/commercialArea/commercialArea.do');
if(!landing.ok)throw Error(`원본 사이트 접속 실패: ${landing.status}`);
const cookie=landing.headers.get('set-cookie')?.split(';')[0]??'';
const entries={};
const values={};
const areas={};
const rates={};
for(const [kind,searchTab] of Object.entries(kinds)){
  for(const [metric,searchSubTab] of Object.entries(metrics)){
    for(const {district,code} of districts){
      const body=new URLSearchParams({searchTab,searchSubTab,searchParmStandard:'addRate',indutyLclasCd:'',indutyCd:'',searchParmAge:'searchAgeAll',searchParmSex:'G',searchParmQt:'1',searchParmDay:'A',selectSignguCd:code,allAreaTf:'false',xCntsMin:'',xCntsMax:'',yCntsMin:'',yCntsMax:'',stdrSlctQu:'beforeQu',searchYear:'',searchPeriod:'qu',rn:'0'});
      let rows;
      for(let attempt=0;attempt<3;attempt++){
        try{
          const response=await fetch(base+'/common/code/getNewTrdarList.json',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest',Referer:base+'/commercialArea/commercialArea.do',Cookie:cookie},body});
          if(!response.ok)throw Error(`HTTP ${response.status}`);
          rows=await response.json();
          if(!Array.isArray(rows))throw Error('순위 응답 형식이 다릅니다.');
          break;
        }catch(error){if(attempt===2)throw Error(`${kind}/${metric}/${district||'전체'}: ${error.message}`);await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)))}
      }
      const codes=rows.slice(0,10).map(row=>String(row.adstrdCd));
      if(!codes.length||new Set(codes).size!==codes.length)throw Error(`${kind}/${metric}/${district||'전체'}: 순위 코드가 비어 있거나 중복되었습니다.`);
      entries[`${kind}:${metric}:${district}`]=codes;
      for(const row of rows.slice(0,10)){
        const code=String(row.adstrdCd);
        const area=Number(row.relmAr);
        if(Number.isFinite(area)&&area>0)areas[`${kind}:${code}`]=area;
        const raw={stores:row.storCo,sales:row.selngAmt,footfall:row.resultAge,residents:row.totRepopCo}[metric];
        const displayed=Number(raw);
        if(raw!=null&&raw!==''&&Number.isFinite(displayed))values[`${kind}:${metric}:${code}`]=displayed;
        const rate=Number(row.rt);
        if(row.rt!=null&&row.rt!==''&&Number.isFinite(rate))rates[`${kind}:${metric}:${code}`]=rate;
      }
    }
    console.log(`${kind}/${metric}: ${districts.length}개 지역 저장`);
  }
}
const output=path.join(root,'data',`official-rankings-${quarter}.json`);
await fs.writeFile(output,JSON.stringify({quarter,source:base+'/commercialArea/commercialArea.do',entries,values,areas,rates},null,2)+'\n');
console.log(output);
