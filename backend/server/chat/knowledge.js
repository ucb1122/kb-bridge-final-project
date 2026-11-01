import fs from 'node:fs/promises';
import path from 'node:path';

const sources=['docs/CHATBOT-KNOWLEDGE.md','README.md','docs/DATA-MODEL.md','docs/OWNER-FOUNDER-CONSULTATION.md'];
const stop=new Set(['그리고','어떻게','있나요','있어','우리','상권','상권브릿지','알려줘','해주세요','대한','무엇','어디','이거','저거','합니다','사용자']);

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
  const query=terms(question);
  return chunks.map(chunk=>{
    const title=terms(chunk.title),body=terms(chunk.text);
    const score=query.reduce((sum,word)=>sum+(title.some(item=>item.includes(word)||word.includes(item))?4:0)+(body.some(item=>item.includes(word)||word.includes(item))?1:0),0);
    return {...chunk,score};
  }).filter(chunk=>chunk.score>0).sort((a,b)=>b.score-a.score||a.text.length-b.text.length).slice(0,limit);
}

export function documentFallback(hits){
  if(!hits.length)return '안내 문서에서 해당 질문의 근거를 찾지 못했어요. 메뉴에서 관련 화면을 확인하거나 질문을 조금 더 구체적으로 적어 주세요.';
  const best=hits[0].text.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1 ($2)');
  return `${best}\n\n현재 AI 모델에 연결되지 않아 안내 문서의 관련 내용을 보여드렸어요.`;
}
