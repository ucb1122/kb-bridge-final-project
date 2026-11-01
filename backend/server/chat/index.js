import {loadKnowledge,findKnowledge,documentFallback} from './knowledge.js';
import {ollamaReply} from './ollama.js';
import {regionReply,regionDetail} from './region.js';
import {conversationalReply} from './conversation.js';
import {financeReply} from './finance.js';

let cache;
const send=(res,item)=>res.write(`${JSON.stringify(item)}\n`);

export async function handleChat(req,res,root){
  if(req.method!=='POST'){res.writeHead(405,{'Allow':'POST'});return res.end()}
  if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){res.writeHead(403);return res.end()}
  let raw='';
  for await(const piece of req){raw+=piece;if(raw.length>9000){res.writeHead(413);return res.end()}}
  let input;
  try{input=JSON.parse(raw)}catch{res.writeHead(400);return res.end()}
  const question=String(input.question||'').trim();
  const history=Array.isArray(input.history)?input.history.slice(-4):[];
  if(!question||question.length>800||history.some(item=>!['user','assistant'].includes(item?.role)||typeof item.content!=='string'||item.content.length>800)){
    res.writeHead(400,{'Content-Type':'application/json; charset=utf-8'});return res.end(JSON.stringify({error:'질문을 800자 이내로 입력해 주세요.'}));
  }
  const conversational=conversationalReply(question);
  if(conversational){
    res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    send(res,{type:'delta',text:conversational});send(res,{type:'done',mode:'conversation'});return res.end();
  }
  const finance=financeReply(question);
  if(finance){
    res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    send(res,{type:'sources',sources:[finance.source]});send(res,{type:'delta',text:finance.text});send(res,{type:'done',mode:'catalog'});return res.end();
  }
  const detail=regionDetail(question,history);
  if(detail){
    res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    send(res,{type:'sources',sources:[detail.source]});send(res,{type:'delta',text:detail.fallback});send(res,{type:'done',mode:'data'});return res.end();
  }
  const region=regionReply(question);
  if(region){
    res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    send(res,{type:'sources',sources:[region.source]});send(res,{type:'delta',text:region.text});send(res,{type:'done',mode:'data'});return res.end();
  }
  cache??=await loadKnowledge(root);
  const previousQuestion=/^(?:좀|더|그거|그것).{0,20}(?:자세히|설명|알려)|^왜\??$/.test(question)
    ? history.filter(item=>item.role==='user').at(-1)?.content : null;
  const hits=findKnowledge(cache,previousQuestion?`${previousQuestion} ${question}`:question);
  res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  send(res,{type:'sources',sources:hits.map(({source,title})=>({source,title}))});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),180000);
  res.on('close',()=>controller.abort());
  let produced=false;
  try{
    for await(const delta of ollamaReply({question,hits,history,signal:controller.signal})){
      produced=true;send(res,{type:'delta',text:delta});
    }
    if(!produced)throw Error('빈 응답');
    send(res,{type:'done',mode:'ai'});
  }catch{
    if(!res.destroyed){
      send(res,{type:'replace',text:documentFallback(hits)});
      send(res,{type:'done',mode:'document'});
    }
  }finally{clearTimeout(timer);res.end()}
}
