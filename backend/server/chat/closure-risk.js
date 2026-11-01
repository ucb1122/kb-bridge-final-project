import fs from 'node:fs/promises';
import path from 'node:path';

let cached;

export async function closureRiskReply(root,question){
  const normalized=String(question).replace(/\s+/g,'');
  const asksRisk=/(?:폐업|위험)/.test(normalized);
  const asksHighest=/(?:가장높|제일높|최고|1위|일등|높은곳|높은상권|높은지역)/.test(normalized);
  const asksReason=/(?:왜|이유|근거|원인|기준|어째서)/.test(normalized);
  if(!asksRisk||(!asksHighest&&!asksReason))return null;
  if(/(?:2025|현재|실제).*폐업률|폐업률.*(?:2025|현재|실제)/.test(normalized)&&!/예측|추정|회복플래너/.test(normalized))return null;

  cached??=fs.readFile(path.join(root,'frontend/pages/intended-owner/assets/closure-risk.json'),'utf8').then(JSON.parse);
  const data=await cached;
  if(data.kind!=='closure-risk-priority')return null;
  if(asksReason){
    const market=data.results.find(row=>normalized.includes(row.name.replace(/\s+/g,''))&&row.status==='candidate');
    if(market){
      const current=market.currentClosureRate.toFixed(1);
      const predicted=market.predictedClosureRate.toFixed(1);
      const stores=market.averageStores.toFixed(1);
      return {
        text:`**${market.district} ${market.name}이 폐업 위험 순위 ${market.rank}위인 근거**는 ${data.inputYear}년 상권 자료로 계산한 ${data.targetYear}년 예측 폐업률 **${predicted}%**입니다.\n- **관측된 폐업 현황:** ${data.inputYear}년 폐업 점포 ${market.closedStores}개, 연평균 점포 ${stores}개로 계산한 폐업률은 ${current}%입니다.\n- **예측 방법:** 이 폐업률에 점포 규모와 상권 유형(${market.type})을 함께 넣은 회귀모형으로 ${data.targetYear}년 값을 추정하고, 대상 상권을 높은 순서로 정렬했습니다.\n- **해석할 때 주의:** ${predicted}%는 상권 단위 예측치입니다. 개별 가게가 폐업할 확률이나 확정된 미래 수치는 아닙니다. 재개발 같은 현장 사정은 이 자료만으로 확인할 수 없습니다.`,
        source:{source:'frontend/pages/intended-owner/assets/closure-risk.json',title:`${market.name} ${data.targetYear}년 폐업 위험 예측 근거`},
      };
    }
  }
  if(!asksHighest)return null;
  const first=data.results.find(row=>row.rank===1&&row.status==='candidate');
  if(!first||!Number.isFinite(first.predictedClosureRate))return null;
  const rate=first.predictedClosureRate.toFixed(1);
  return {
    text:`우리 가게 회복 플래너의 **예측 폐업률 1위는 ${first.district} ${first.name}**입니다.\n- **2027년 예측 폐업률:** ${rate}%\n- **기준:** ${data.inputYear}년 자료를 사용해 ${data.targetYear}년을 추정한 상권 단위 순위입니다.\n- 이 수치는 지역의 참고 지표이며, 개별 가게의 폐업 확률을 뜻하지 않습니다.`,
    source:{source:'frontend/pages/intended-owner/assets/closure-risk.json',title:`${data.targetYear}년 예측 폐업률 상권 순위`},
  };
}
