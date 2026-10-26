import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {loadEnv} from '../server/config.js';
const root=path.resolve(import.meta.dirname,'..');
loadEnv(root);
const input=path.resolve(root,process.argv[2]||'data/csv');
const output=path.resolve(root,process.env.DB_PATH||'data/commerce.sqlite');
function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
    else if(ch===','&&!quoted){row.push(cell);cell=''}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell=''}
    else cell+=ch;
  }
  if(quoted)throw Error('닫히지 않은 CSV 따옴표가 있습니다.');
  row.push(cell);if(row.some(x=>x!==''))rows.push(row);return rows;
}
if(!fs.existsSync(input))throw Error(`CSV 경로를 찾을 수 없습니다: ${input}`);
const files=fs.statSync(input).isDirectory()?fs.readdirSync(input).filter(x=>x.toLowerCase().endsWith('.csv')).map(x=>path.join(input,x)):[input];
if(!files.length)throw Error('CSV 파일이 없습니다.');
fs.mkdirSync(path.dirname(output),{recursive:true});
const db=new DatabaseSync(output);
db.exec(`CREATE TABLE IF NOT EXISTS observations(
 quarter TEXT NOT NULL,kind TEXT NOT NULL,metric TEXT NOT NULL,region_code TEXT NOT NULL,
 region_name TEXT NOT NULL,district TEXT NOT NULL DEFAULT '',value REAL NOT NULL,
 lat REAL,lng REAL,PRIMARY KEY(quarter,kind,metric,region_code));
 CREATE INDEX IF NOT EXISTS idx_observations_filter ON observations(quarter,kind,metric,district);`);
const insert=db.prepare('INSERT OR REPLACE INTO observations(quarter,kind,metric,region_code,region_name,district,value,lat,lng) VALUES(?,?,?,?,?,?,?,?,?)');
let count=0;
try{
  db.exec('BEGIN');
  for(const file of files){
    const [header,...rows]=parseCsv(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
    const required=['quarter','kind','metric','region_code','region_name','district','value'];
    if(!header||required.some(x=>!header.includes(x)))throw Error(`${file}: 필수 열은 ${required.join(', ')}입니다.`);
    const index=Object.fromEntries(header.map((x,i)=>[x.trim(),i]));
    for(const [i,row] of rows.entries()){
      const get=k=>(row[index[k]]||'').trim();
      const quarter=get('quarter'),kind=get('kind'),metric=get('metric'),value=Number(get('value').replaceAll(',',''));
      if(!/^20\d{2}[1-4]$/.test(quarter)||!['dong','area'].includes(kind)||!['stores','sales','footfall','residents'].includes(metric)||!get('region_code')||!get('region_name')||!Number.isFinite(value))throw Error(`${file} ${i+2}행: 값이 올바르지 않습니다.`);
      const lat=get('lat'),lng=get('lng');
      insert.run(quarter,kind,metric,get('region_code'),get('region_name'),get('district'),value,lat?Number(lat):null,lng?Number(lng):null);
      count++;
    }
  }
  db.exec('COMMIT');console.log(`${count}개 행을 ${output}에 저장했습니다.`);
}catch(error){db.exec('ROLLBACK');throw error}finally{db.close()}
