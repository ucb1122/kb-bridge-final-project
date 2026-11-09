import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('.vercel/output/static');
const {default:handler}=await import('../../.vercel/output/functions/api.func/index.mjs');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf','.geojson':'application/geo+json'};
http.createServer(async(req,res)=>{
 if(req.url.startsWith('/api/'))return handler(req,res);
 try{
  let pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/')pathname='/pages/rising/';if(pathname.endsWith('/'))pathname+='index.html';
  const file=path.resolve(root,'.'+decodeURIComponent(pathname));if(!file.startsWith(root+path.sep))throw Error('Forbidden');
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT||5180),'127.0.0.1',()=>console.log('Public demo preview: http://localhost:'+(process.env.PORT||5180)));
