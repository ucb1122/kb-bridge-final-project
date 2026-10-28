import test from 'node:test';
import assert from 'node:assert/strict';
import {amount,comparePlans,recommendedOptions,reviewPlan,compareConcern} from '../recovery-model.js';
test('missing inputs stay missing, including incomplete scenarios',()=>{
 assert.equal(amount(''),null);assert.equal(amount(' '),null);assert.equal(amount(-1),null);assert.equal(amount(Infinity),null);assert.equal(amount(0),0);
 assert.equal(comparePlans({revenue:'1200',cost:'',payment:'200'}),null);
 assert.deepEqual(comparePlans({revenue:1200,cost:1100,payment:200}),{current:-100,adjusted:null,combined:null});
});
test('current, adjusted and combined use only explicitly supplied assumptions',()=>{
 assert.deepEqual(comparePlans({revenue:1200,cost:1100,payment:200,adjusted:140,target:1060}),{current:-100,adjusted:-40,combined:0});
 assert.deepEqual(comparePlans({revenue:0,cost:0,payment:0,adjusted:0,target:0}),{current:0,adjusted:0,combined:0});
});
test('safety and lease follow answers without auto selecting household financial products',()=>{
 assert.deepEqual(recommendedOptions({safety:'no',lease:'expiry'}),{safety:true,household:false,restart:false,lease:true});
 assert.deepEqual(recommendedOptions({safety:'yes',lease:'no'}),{safety:false,household:false,restart:false,lease:false});
});
test('monthly recheck compares actual versus plan; never imputes empty fields',()=>{
 assert.deepEqual(reviewPlan(0,1170,1060,140),{actual:-30,difference:-30});
 assert.equal(reviewPlan(0,1170,'',140),null);
 assert.deepEqual(reviewPlan(null,1170,1060,140),{actual:-30,difference:null});
});
test('focused payment comparison needs only the selected two amounts and preserves unknown cashflow',()=>{
 assert.deepEqual(compareConcern({payment:200,adjusted:140},'repayment'),{before:200,after:140,saved:60,currentCashflow:null,afterCashflow:null});
 assert.deepEqual(compareConcern({payment:200,adjusted:140,net:-100},'repayment'),{before:200,after:140,saved:60,currentCashflow:-100,afterCashflow:-40});
 assert.equal(compareConcern({payment:200,adjusted:''},'repayment'),null);
});
test('rent increases worsen cashflow, zero remains a real value, and restart has no invented calculation',()=>{
 assert.deepEqual(compareConcern({rent:180,nextRent:225,net:0},'lease'),{before:180,after:225,saved:-45,currentCashflow:0,afterCashflow:-45});
 assert.equal(compareConcern({cost:100,target:-1},'sales'),null);
 assert.equal(compareConcern({cost:100,target:0},'sales').saved,100);
 assert.equal(compareConcern({},'restart'),null);
});
