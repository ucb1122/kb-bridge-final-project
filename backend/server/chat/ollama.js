import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const instructions=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'runtime-instructions.md'),'utf8');
export function buildMessages({question,hits,history=[]}){
  const context=hits.slice(0,2).map((hit,index)=>`[${index+1}] ${hit.title} (${hit.source})\n${hit.text.slice(0,800)}`).join('\n\n');
  return [
    {role:'system',content:instructions},
    {role:'system',content:`참고 문서 발췌:\n${context}`},
    ...history.slice(-4).map(item=>({role:item.role,content:item.content})),
    {role:'user',content:question},
  ];
}
export async function* ollamaReply({question,hits,history=[],signal,onMetrics}){
  const base=new URL(process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434');
  const model=process.env.OLLAMA_MODEL||'gemma4:e2b';
  const messages=buildMessages({question,hits,history});
  const detailed=/자세|상세|비교|단계별|길게|구체적/.test(question);
  const numPredict=detailed?600:320;
  const response=await fetch(new URL('/api/chat',base),{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model,messages,stream:true,think:false,keep_alive:process.env.OLLAMA_KEEP_ALIVE||'30m',options:{temperature:0.2,num_ctx:4096,num_predict:numPredict}}),signal,
  });
  if(!response.ok)throw Error(`Ollama 응답 ${response.status}`);
  const decoder=new TextDecoder();let buffer='';
  for await(const piece of response.body){
    buffer+=decoder.decode(piece,{stream:true});
    let index;
    while((index=buffer.indexOf('\n'))>=0){
      const line=buffer.slice(0,index).trim();buffer=buffer.slice(index+1);
      if(!line)continue;
      const item=JSON.parse(line);
      if(item.error)throw Error(item.error);
      if(item.done)onMetrics?.({loadMs:Math.round((item.load_duration||0)/1e6),promptMs:Math.round((item.prompt_eval_duration||0)/1e6),generateMs:Math.round((item.eval_duration||0)/1e6),promptTokens:item.prompt_eval_count||0,outputTokens:item.eval_count||0});
      if(item.message?.content)yield item.message.content;
    }
  }
}
