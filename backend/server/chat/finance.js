import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const catalog=JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../frontend/shared/finance/products.json'),'utf8'));
const normalize=value=>String(value).toLowerCase().replace(/[\s·()\-]/g,'');

export function financeReply(question){
  const query=normalize(question);
  const product=catalog.products.find(item=>normalize(item.name).replace(/직접대출|대리대출/g,'')&&query.includes(normalize(item.name).replace(/직접대출|대리대출/g,'')));
  if(!product)return null;
  const lines=[`${product.name}은 ${product.summary}`];
  if(product.eligibility?.length)lines.push(`• 확인할 대상: ${product.eligibility.slice(0,2).join('; ')}`);
  if(product.limitText)lines.push(`• 안내된 한도: ${product.limitText}`);
  if(product.termText)lines.push(`• 기간: ${product.termText}`);
  lines.push('현재 접수 여부와 본인의 신청 가능 여부는 공식 안내에서 확인해 주세요.');
  return {text:lines.join('\n'),source:{source:'frontend/shared/finance/products.json',title:product.sourceTitle||product.provider,url:product.sourceUrl,verifiedAt:product.verifiedAt}};
}
