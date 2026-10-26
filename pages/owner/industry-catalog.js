// UI groups for the available licence categories, not an automatic CS-code join.
export const industryCatalog = [
  {id:'korean',label:'한식음식점',category:'외식업',types:['일반음식점 · 한식','일반음식점 · 냉면집','일반음식점 · 탕류(보신용)','일반음식점 · 복어취급','일반음식점 · 식육(숯불구이)']},
  {id:'chinese',label:'중식음식점',category:'외식업',types:['일반음식점 · 중국식']},
  {id:'japanese',label:'일식음식점',category:'외식업',types:['일반음식점 · 일식','일반음식점 · 횟집']},
  {id:'western',label:'양식음식점',category:'외식업',types:['일반음식점 · 경양식','일반음식점 · 패밀리레스트랑','일반음식점 · 뷔페식']},
  {id:'bakery',label:'제과점',category:'외식업',types:['휴게음식점 · 과자점','제과점영업 · 제과점영업','제과점영업 · 푸드트럭']},
  {id:'fastfood',label:'패스트푸드점',category:'외식업',types:['일반음식점 · 패스트푸드','휴게음식점 · 패스트푸드']},
  {id:'chicken',label:'치킨전문점',category:'외식업',types:['일반음식점 · 통닭(치킨)'],note:'호프/통닭 혼합 업태는 기타음식점에 포함.'},
  {id:'snack',label:'분식전문점',category:'외식업',types:['일반음식점 · 분식','일반음식점 · 김밥(도시락)','휴게음식점 · 일반조리판매']},
  {id:'pub',label:'호프·간이주점',category:'외식업',types:['일반음식점 · 정종/대포집/소주방','일반음식점 · 감성주점']},
  {id:'coffee',label:'커피·음료',category:'외식업',types:['휴게음식점 · 커피숍','휴게음식점 · 다방','휴게음식점 · 전통찻집','휴게음식점 · 떡카페','일반음식점 · 까페','일반음식점 · 커피숍','일반음식점 · 전통찻집']},
  {id:'other',label:'기타음식점',category:'외식업',other:true},
  ...[
    ['일반교습학원','CS200001',['학원교습소 · 일반교습학원']],['외국어학원','CS200002',['학원교습소 · 외국어학원']],
    ['스포츠 강습','CS200005',['스포츠강습 · 체육도장업','스포츠강습 · 무도학원업','스포츠강습 · 수영장업','스포츠강습 · 태권도','스포츠강습 · 권투','스포츠강습 · 합기도','스포츠강습 · 검도','스포츠강습 · 유도','스포츠강습 · 레슬링','스포츠강습 · 우슈']],
    ['일반의원','CS200006',['의원 · 의원']],['치과의원','CS200007',['의원 · 치과의원']],['한의원','CS200008',['의원 · 한의원']],['동물병원','CS200009',['동물병원 · 동물병원']],
    ['법무관련 서비스업',null,[]],['세무사사무소','CS200015',[]],['미용실','CS200028',['미용업 · 일반미용업','미용업 · 일반이용업']],['네일숍','CS200029',['미용업 · 네일아트업']],['세탁소','CS200031',['세탁업 · 일반세탁업','세탁업 · 빨래방업','세탁업 · 운동화전문세탁업','세탁업 · 세탁업 기타']]
  ].map(([label,officialCode,types],i)=>({id:`service-${i}`,label,officialCode,types,category:'서비스업',unavailable:!types.length})),
  {id:'service-art',label:'예술학원',category:'서비스업',officialCode:'CS200003',types:['학원교습소 · 예술학원']},
  {id:'service-computer',label:'컴퓨터학원',category:'서비스업',officialCode:'CS200004',types:['학원교습소 · 컴퓨터학원']},
  {id:'service-study',label:'독서실',category:'서비스업',officialCode:'CS200038',types:['학원교습소 · 독서실']},
  {id:'service-golf',label:'골프연습장',category:'서비스업',officialCode:'CS200017',types:['스포츠강습 · 골프연습장업']},
  {id:'service-gym',label:'스포츠클럽',category:'서비스업',officialCode:'CS200024',types:['스포츠강습 · 체력단련장업']},
  {id:'service-skin',label:'피부관리실',category:'서비스업',officialCode:'CS200030',types:['미용업 · 피부미용업']},
  {id:'service-other',label:'기타 확보 서비스',category:'서비스업',prefixes:['미용업 ·','의원 ·'],otherService:true,types:[]},
  ...[
    ['슈퍼마켓','CS300001',[]],['편의점','CS300002',[]],['의약품','CS300018',['약국 · 약국']],['의료기기','CS300019',['의료기기판매 · 의료기기판매']],['일반의류','CS300011',[]],['신발','CS300014',[]],['안경','CS300016',['안경업 · 안경업']],['가방','CS300015',[]],['시계·귀금속','CS300017',[]],['화장품','CS300022',[]],['문구','CS300021',[]],['애완동물','CS300029',['동물판매업 · 동물판매업']]
  ].map(([label,officialCode,types],i)=>({id:`retail-${i}`,label,officialCode,types,category:'소매업',unavailable:!types.length})),
  {id:'retail-facility',label:'대규모점포(시설)',category:'소매업',prefixes:['대규모점포 ·'],types:[],note:'쇼핑센터·백화점·대형마트 등 시설 단위입니다. 입점 점포수나 슈퍼마켓 전체 통계와 다릅니다.'}
];
const grouped=new Set(industryCatalog.flatMap(g=>g.types||[]));
export function matchesIndustry(row,id) {
  if(id==='all')return true;
  const group=industryCatalog.find(g=>g.id===id);
  if(!group||group.unavailable)return false;
  if(group.other)return /^(일반음식점|휴게음식점|제과점영업) ·/.test(row.industry)&&!grouped.has(row.industry);
  if(group.otherService)return group.prefixes.some(prefix=>row.industry.startsWith(prefix))&&!grouped.has(row.industry);
  return group.types?.includes(row.industry)||group.prefixes?.some(prefix=>row.industry.startsWith(prefix))||false;
}
export function groupFor(row) {return industryCatalog.find(g=>matchesIndustry(row,g.id))||{id:'unclassified',label:'기타 미분류',category:'기타'};}
