import {getRankings} from '../data.js';

const storeQuestion=text=>/점포\s*수|점포수|가게\s*수/.test(text)
  && /가장|자장|제일|1위|많은|높은|최대|순위|상위/.test(text)
  && !/증가율|증가량|감소율|성장률/.test(text);

export function storeRankingReply(question,history=[]){
  const previous=history.filter(item=>item?.role==='user').at(-1)?.content||'';
  const followUp=/^(?:그냥\s*)?(?:가장\s*)?(?:최신|최근)(?:\s*(?:자료|분기|기준|으로|걸로|정보))?[!?.\s]*$/.test(question);
  const target=storeQuestion(question)?question:followUp&&storeQuestion(previous)?previous:null;
  if(!target)return null;

  const kind=/공식\s*상권|골목\s*상권|발달\s*상권|전통\s*시장/.test(target)?'area':'dong';
  const ranking=getRankings({kind,metric:'stores',criterion:'highest'});
  if(!ranking.available||!ranking.rows.length)return null;
  const top=ranking.rows[0];
  const period=`${ranking.quarter.slice(0,4)}년 ${ranking.quarter.slice(4)}분기`;
  const scope=kind==='dong'?'행정동':'공식 상권';
  return {
    text:`**${period} 서울시 ${scope}의 점포 수 1위는 ${top.district} ${top.name}으로, ${Number(top.value).toLocaleString('ko-KR')}개입니다.**\n\n- 기준: 전체 업종의 점포 수 원본값을 높은 순서로 정렬했습니다.\n- 이 순위는 점포 수 기준입니다. 점포 증가율 순위와는 다릅니다.`,
    source:{source:'data/commerce.sqlite',title:`서울시 상권분석서비스 ${period} ${scope} 점포 수 순위`},
  };
}
