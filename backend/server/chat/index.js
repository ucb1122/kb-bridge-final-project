import {loadKnowledge,findKnowledge,documentFallback} from './knowledge.js';
import {ollamaReply} from './ollama.js';

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
  cache??=await loadKnowledge(root);
  const hits=findKnowledge(cache,question);
  res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  send(res,{type:'sources',sources:hits.map(({source,title})=>({source,title}))});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),90000);
  res.on('close',()=>controller.abort());
  let produced=false;
  try{
    if(hits.length){
      for await(const delta of ollamaReply({question,hits,history,signal:controller.signal})){
        produced=true;send(res,{type:'delta',text:delta});
      }
    }else{send(res,{type:'delta',text:documentFallback(hits)});produced=true}
    if(!produced)throw Error('빈 응답');
    send(res,{type:'done',mode:hits.length?'ai':'document'});
  }catch{
    if(!res.destroyed){
      if(!produced)send(res,{type:'delta',text:documentFallback(hits)});
      else send(res,{type:'delta',text:'\n\n답변 연결이 중단됐어요. 다시 질문해 주세요.'});
      send(res,{type:'done',mode:'document'});
    }
  }finally{clearTimeout(timer);res.end()}
}
