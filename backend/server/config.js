import fs from 'node:fs';
import path from 'node:path';
export function loadEnv(root){
  for(const filename of ['.env','.env.example']){
    try{for(const line of fs.readFileSync(path.join(root,filename),'utf8').split(/\r?\n/)){
      const match=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      if(match&&!process.env[match[1]])process.env[match[1]]=match[2];
    }}catch(error){if(error.code!=='ENOENT')throw error}
  }
}
