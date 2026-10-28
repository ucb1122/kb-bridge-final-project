import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {productInformationSections} from '../detail-view.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../../../shared/finance/'+name,import.meta.url)));
const catalog=read('products.json'),files=['details-bank-a.json','details-bank-b.json','details-policy.json'].map(read);
const guides=new Map(files.flatMap(f=>f.documentGuides||[]).map(g=>[g.id,g]));
const details=new Map(files.flatMap(f=>f.products).map(d=>[d.id,{...d,documents:{...d.documents,guides:(d.documents.commonGuideIds||[]).map(id=>guides.get(id)).filter(Boolean)}}]));
test('all 28 entries keep target rates repayment documents and process in five information sections',()=>{
 for(const product of catalog.products){const sections=productInformationSections(product,details.get(product.id),product.roles[0]);assert.equal(sections.length,5);assert.deepEqual(sections.map(s=>s.key),['overview','rates','repayment','documents','process']);for(const s of sections)assert.ok(s.html.length>0);const html=sections.map(s=>s.html).join('');assert.doesNotMatch(html,/inline-consultation|consultation-call|data-document=|type="checkbox"/);for(const example of details.get(product.id).rate.examples||[]){assert.ok(sections[1].html.includes(example.range));assert.ok(sections[1].html.includes(example.asOf));}}
});
test('consultation modal and module bindings are absent and real tab panels start hidden',()=>{
 const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');const view=fs.readFileSync(new URL('../detail-view.js',import.meta.url),'utf8');
 assert.doesNotMatch(page,/product-consultation|consultation-call|quick-routes/);assert.doesNotMatch(main,/consultation\.js|initProductConsultation|openConsultation/);assert.match(view,/role="tabpanel"/);assert.match(view,/hidden=!active/);
});
