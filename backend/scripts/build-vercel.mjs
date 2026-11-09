import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createGunzip,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import readline from 'node:readline';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'.vercel/output'),fn=path.join(output,'functions/api.func');
// Only this generated output is replaced. Local source and databases stay intact.
const reuse=process.argv.includes('--reuse-db');
if(!reuse)await fs.rm(output,{recursive:true,force:true});
await fs.mkdir(path.join(fn,'data'),{recursive:true});
const snapshot=path.join(root,'data/public-snapshot');
const manifest=JSON.parse(await fs.readFile(path.join(snapshot,'manifest.json'),'utf8'));
if(!reuse){
const db=new DatabaseSync(path.join(fn,'data/commerce.sqlite'));
db.exec('PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;');
for(const table of manifest.tables){
 const bytes=await fs.readFile(path.join(snapshot,table.file));
 if(createHash('sha256').update(bytes).digest('hex')!==table.sha256)throw Error('Snapshot checksum: '+table.name);
 const lines=readline.createInterface({input:createReadStream(path.join(snapshot,table.file)).pipe(createGunzip()),crlfDelay:Infinity});
 let meta,statement,count=0;
 db.exec('BEGIN');
 for await(const line of lines){
  const value=JSON.parse(line);
  if(!meta){meta=value;db.exec(meta.schema);continue;}
  statement??=db.prepare(`INSERT INTO ${table.name} VALUES (${value.map(()=>'?').join(',')})`);
  statement.run(...value);count++;
 }
 if(count!==table.rows)throw Error('Snapshot rows: '+table.name);
 for(const index of meta.indexes)db.exec(index);
 db.exec('COMMIT');console.log(table.name,count);
}
db.exec('VACUUM');db.close();
}
for(const name of ['commerce.geojson','commerce-dong.geojson'])await fs.writeFile(path.join(fn,'data',name),gunzipSync(await fs.readFile(path.join(snapshot,name+'.gz'))));
for(const name of (await fs.readdir(path.join(root,'data'))).filter(x=>x.startsWith('official-')&&x.endsWith('.json')))await fs.copyFile(path.join(root,'data',name),path.join(fn,'data',name));
await fs.cp(path.join(root,'backend/server'),path.join(fn,'backend/server'),{recursive:true});
for(const name of ['server.js','static-files.js'])await fs.cp(path.join(root,'backend',name),path.join(fn,'backend',name));
await fs.mkdir(path.join(fn,'docs'),{recursive:true});
for(const name of ['CHATBOT-KNOWLEDGE.md','DATA-MODEL.md','OWNER-FOUNDER-CONSULTATION.md'])await fs.copyFile(path.join(root,'docs',name),path.join(fn,'docs',name));
await fs.copyFile(path.join(root,'README.md'),path.join(fn,'README.md'));
await fs.cp(path.join(root,'frontend/shared/finance'),path.join(fn,'frontend/shared/finance'),{recursive:true});
await fs.mkdir(path.join(fn,'frontend/pages/intended-owner/assets'),{recursive:true});
await fs.copyFile(path.join(root,'frontend/pages/intended-owner/assets/closure-risk.json'),path.join(fn,'frontend/pages/intended-owner/assets/closure-risk.json'));
await fs.writeFile(path.join(fn,'package.json'),JSON.stringify({type:'module'}));
await fs.writeFile(path.join(fn,'index.mjs'),`process.env.PUBLIC_DEMO='1';process.env.NODE_ENV='production';process.env.DB_PATH='data/commerce.sqlite';\nconst {handleRequest}=await import('./backend/server.js');export default handleRequest;\n`);
await fs.writeFile(path.join(fn,'.vc-config.json'),JSON.stringify({runtime:'nodejs22.x',handler:'index.mjs',launcherType:'Nodejs',maxDuration:30}));
const excluded=relative=>/\/(analysis|sources)\//.test('/'+relative)||/\.(csv|zip|ipynb|sqlite|py|md|pptx|docx)$/i.test(relative)||relative==='pages/owner/assets/businesses.json';
const frontend=path.join(root,'frontend');
await fs.cp(frontend,path.join(output,'static'),{recursive:true,filter:source=>!excluded(path.relative(frontend,source).replaceAll('\\','/'))});
// Public deployment marker is injected at build time, leaving local pages unchanged.
async function inject(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await inject(p);else if(e.name.endsWith('.html')){let html=await fs.readFile(p,'utf8');html=html.replace('</head>','<script>window.KOB_PUBLIC_DEMO=true</script><script src="/shared/public-demo.js" defer></script></head>');await fs.writeFile(p,html);}}}
await inject(path.join(output,'static'));
await fs.writeFile(path.join(output,'config.json'),JSON.stringify({version:3,routes:[{src:'/api/.*',dest:'/api'},{src:'/',dest:'/pages/rising/index.html'},{src:'(/pages/.*)/',dest:'$1/index.html'},{handle:'filesystem'}]},null,2));
async function size(dir){let n=0;for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);n+=e.isDirectory()?await size(p):(await fs.stat(p)).size;}return n;}
const bytes=await size(fn);if(bytes>245*1024*1024)throw Error('Function bundle too large: '+bytes);
console.log('Function MB:',(bytes/1024/1024).toFixed(1),'static MB:',((await size(path.join(output,'static')))/1024/1024).toFixed(1));
