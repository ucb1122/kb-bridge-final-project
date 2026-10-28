import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pointInGeometry,filterRegions,regionKey,cashflowBars} from '../navigator-model.js';

test('지도 클릭은 다각형의 빈 공간과 떨어진 여러 영역을 구분한다',()=>{
 const outer=[[0,0],[10,0],[10,10],[0,10],[0,0]],hole=[[3,3],[7,3],[7,7],[3,7],[3,3]];
 const geometry={type:'Polygon',coordinates:[outer,hole]};
 assert.equal(pointInGeometry([1,1],geometry),true);
 assert.equal(pointInGeometry([5,5],geometry),false);
 assert.equal(pointInGeometry([20,20],geometry),false);
 assert.equal(pointInGeometry([NaN,1],geometry),false);
 assert.equal(pointInGeometry([21,21],{type:'MultiPolygon',coordinates:[[outer,hole],[[[20,20],[22,20],[22,22],[20,22],[20,20]]]]}),true);
});

test('검색은 순위와 무관하며 없는 분류를 비과열로 바꾸지 않는다',()=>{
 const rows=[{code:'1',kind:'area',name:'우리집 앞',district:'성동구',dong:'성수동'},{code:'2',kind:'area',name:'우리집 앞 시장',district:'성동구'},{code:'1',kind:'dong',name:'성수동',district:'성동구'}];
 assert.equal(filterRegions(rows,{query:'성동구 우리집'}).length,2);
 assert.equal(filterRegions(rows,{heat:'not_overheated'}).length,0);
 assert.equal(filterRegions(rows,{heat:'unknown'}).length,2);
 assert.equal(filterRegions(rows,{kind:'dong',query:'성수'}).length,1);
 const classifications=new Map([['1',{classification:'not_overheated'}]]);
 assert.deepEqual(filterRegions(rows,{heat:'not_overheated',classifications}).map(r=>r.code),['1']);
});

test('배포 JSON의 지역·경계 키가 일대일로 연결되고 공식 상권 1650곳을 포함한다',()=>{
 const read=name=>JSON.parse(fs.readFileSync(new URL('../assets/'+name,import.meta.url),'utf8'));
 const data=read('regions.json'),boundaries=read('boundaries.json');
 const keys=data.regions.map(regionKey),featureKeys=boundaries.features.map(f=>regionKey(f.properties));
 assert.equal(new Set(keys).size,keys.length);
 assert.deepEqual(new Set(featureKeys),new Set(keys));
 assert.equal(data.regions.filter(r=>r.kind==='area').length,1650);
 assert.equal(data.regions.filter(r=>r.kind==='dong').length,422);
 for(const row of data.regions)for(const value of Object.values(row.metrics))assert.ok(value===null||Number.isFinite(value));
 assert.equal(read('heat-connection.json').resultFile,null,'실제 팀 분석 전 임의 분류 결과를 배포하지 않는다');
});

test('잔여현금이 적자여도 그래프가 음수를 그대로 설명한다',()=>{
 const svg=cashflowBars(50,-30);
 assert.match(svg,/현재 50만원, 조건 변경 후 -30만원/);
 assert.ok(!svg.includes('NaN'));
 assert.equal(cashflowBars(null,30),'');
});
