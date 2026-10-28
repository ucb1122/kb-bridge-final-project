import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../../../shared/finance/'+name,import.meta.url),'utf8'));
const base=read('products.json'),files=['details-bank-a.json','details-bank-b.json','details-policy.json'].map(read),items=files.flatMap(file=>file.products);
test('every catalog item has one local detailed record including rates repayment documents and process',()=>{
 assert.equal(new Set(items.map(item=>item.id)).size,items.length);
 assert.deepEqual(new Set(items.map(item=>item.id)),new Set(base.products.map(item=>item.id)));
 for(const item of items){assert.ok(item.rate.summary);assert.ok(item.repayment.summary);assert.ok(item.documents.summary);assert.ok(item.applicationSteps.length);assert.ok(item.sources.length);}
});
test('document scopes and common-guide references remain distinct and historical examples retain dates and conditions',()=>{
 const guides=new Map(files.flatMap(file=>file.documentGuides||[]).map(guide=>[guide.id,guide]));
 for(const item of items){
  assert.ok(['explicit','electronic','common-guidance','not-published'].includes(item.documents.mode));
  const common=(item.documents.commonGuideIds||[]).map(id=>{assert.ok(guides.has(id),id);return guides.get(id);});
  const documents=[...(item.documents.items||[]),...common.flatMap(guide=>guide.items||[])];assert.ok(documents.length,item.id);
  for(const doc of documents){assert.ok(doc.name);assert.ok(['published','electronic','conditional','confirm'].includes(doc.requirement));}
  for(const example of item.rate.examples||[]){assert.ok(example.range);assert.match(example.asOf,/^\d{4}-\d{2}-\d{2}$/);assert.ok(example.conditions);}
  for(const source of item.sources){const url=new URL(source.url);assert.equal(url.protocol,'https:');assert.ok(source.title);}
 }
});
test('public branch snapshot and policy contact support internal selection without a guessed destination',()=>{
 const branches=read('kb-branches.json');assert.equal(branches.count,branches.branches.length);assert.equal(new Set(branches.branches.map(branch=>branch.id)).size,branches.count);
 assert.ok(branches.branches.every(branch=>branch.name&&branch.address));
 const contact=read('details-policy.json').consultation;assert.match(contact.phone,/^[0-9-]+$/);assert.equal(new URL(contact.sourceUrl).protocol,'https:');
});
