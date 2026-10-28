import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const page=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(page,'DATA-MANIFEST.json'),'utf8'));
for(const item of manifest.files){const file=path.resolve(page,item.path);if(!file.startsWith(page))throw Error('잘못된 manifest 경로');const bytes=fs.readFileSync(file);if(bytes.length!==item.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('원본·가공 데이터 불일치: '+item.path);}
console.log(`동봉 데이터 ${manifest.files.length}개 SHA-256·용량 검증 완료`);
