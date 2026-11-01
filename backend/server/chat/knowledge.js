import fs from 'node:fs/promises';
import path from 'node:path';

const sources=['docs/CHATBOT-KNOWLEDGE.md','README.md','docs/DATA-MODEL.md','docs/OWNER-FOUNDER-CONSULTATION.md'];
const stop=new Set(['그리고','어떻게','있나요','있어','우리','상권','상권브릿지','알려줘','해주세요','대한','무엇','어디','이거','저거','합니다','사용자','기능','뭐야','무슨','설명','자세히']);

export function terms(text){
  return [...new Set((String(text).toLowerCase().match(/[가-힣a-z0-9]{2,}/g)||[]).filter(word=>!stop.has(word)))];
}

export function splitMarkdown(markdown,source){
  const chunks=[];let heading='',lines=[];
  const flush=()=>{const body=lines.join(' ').replace(/\s+/g,' ').trim();if(body.length>=24)chunks.push({source,title:heading||source,text:body.slice(0,1200)});lines=[]};
  for(const line of markdown.split(/\r?\n/)){
    const match=line.match(/^#{1,3}\s+(.+)/);
    if(match){flush();heading=match[1].trim();continue}
    if(!line.trim()){flush();continue}
    if(!line.startsWith('![')&&!line.startsWith('```')&&!line.startsWith('|'))lines.push(line.trim());
  }
  flush();return chunks;
}

export async function loadKnowledge(root){
  const all=[];
  for(const source of sources){
    const content=await fs.readFile(path.join(root,source),'utf8');
    all.push(...splitMarkdown(content,source));
  }
  return all;
}

export function findKnowledge(chunks,question,limit=3){
  const normalized=String(question).replace(/뜨는\s*동네/g,'뜨는 상권');
  const query=terms(normalized);
  const scored=chunks.map(chunk=>{
    const title=terms(chunk.title),body=terms(chunk.text);
    const score=query.reduce((sum,word)=>sum+(title.some(item=>item.includes(word)||word.includes(item))?4:0)+(body.some(item=>item.includes(word)||word.includes(item))?1:0),0);
    return {...chunk,score};
  }).filter(chunk=>chunk.score>0).sort((a,b)=>b.score-a.score||a.text.length-b.text.length);
  if(!scored.length)return [];
  const best=scored[0].score;
  const seen=new Set();
  return scored.filter(chunk=>{
    if(chunk.score<Math.max(4,best-1))return false;
    const key=`${chunk.source}:${chunk.title}`;
    if(seen.has(key))return false;
    seen.add(key);return true;
  }).slice(0,limit);
}

export function quickGuideReply(chunks,question){
  const query=String(question).replace(/\s+/g,'').replace(/[?!。.]/g,'');
  const guides=[
    {pattern:/^(?:뜨는상권|뜨는동네)(?:기능)?(?:이|은)?(?:뭐야|무엇인가요|어떤기능이야|어떻게써|어떻게사용해)$/,title:'뜨는 상권은 무엇인가요?'},
    {pattern:/^내상권분석(?:기능)?(?:이|은)?(?:뭐야|무엇인가요|어떤기능이야|어떻게써|어떻게사용해)$/,title:'내 상권 분석은 어떻게 사용하나요?'},
    {pattern:/^우리가게회복플래너(?:기능)?(?:이|은)?(?:뭐야|무엇인가요|어떤기능이야|어떻게써|어떻게사용해)$/,title:'우리 가게 회복 플래너는 무엇을 하나요?'},
    {pattern:/^금융상품안내(?:기능)?(?:이|은)?(?:뭐야|무엇인가요|어떤기능이야|어떻게써|어떻게사용해)$/,title:'금융상품 조건과 신청 가능 여부는 어디서 보나요?'},
  ];
  const guide=guides.find(item=>item.pattern.test(query));
  if(!guide)return null;
  const hit=chunks.find(item=>item.source==='docs/CHATBOT-KNOWLEDGE.md'&&item.title===guide.title);
  if(!hit)return null;
  return {text:hit.text.replace(/\[([^\]]+)\]\([^)]+\)/g,'$1'),source:{source:hit.source,title:hit.title}};
}

export function documentFallback(hits){
  if(!hits.length)return '이 질문에 맞는 자료를 찾지 못했어요. 지역이나 기능 이름을 조금 더 구체적으로 적어 주세요.';
  const best=hits[0].text.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1').replace(/\s+/g,' ');
  const short=best.slice(0,260).replace(/\s+\S*$/,'').trim();
  return `• ${short}${best.length>260?'…':''}\n• 자세한 내용은 해당 화면에서 확인해 주세요.`;
}
