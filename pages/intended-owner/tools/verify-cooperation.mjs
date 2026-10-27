import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCooperation} from '../cooperation-model.js';
test('blank contract values remain incomplete',()=>{assert.equal(compareCooperation({}).status,'incomplete');});
test('rent concession has a landlord cost when both plans remain occupied',()=>{const r=compareCooperation({rent:180,requestedPercent:10,agreedPercent:3});assert.ok(Math.abs(r.tenantMonthlySaving-12.6)<1e-9);assert.ok(Math.abs(r.landlordAnnualDifference+151.2)<1e-9);assert.equal(r.mutualBenefit,false);});
test('one month hypothetical vacancy changes the comparison without predicting vacancy',()=>{const r=compareCooperation({rent:180,requestedPercent:10,agreedPercent:3,vacancyEnabled:true,vacancyMonths:1});assert.ok(Math.abs(r.landlordAnnualDifference-46.8)<1e-9);assert.equal(r.mutualBenefit,true);assert.ok(Math.abs(r.breakEvenVacancyMonths-12*(1-1.03/1.1))<1e-9);});
test('enabled vacancy cannot silently turn a blank into zero',()=>{assert.equal(compareCooperation({rent:180,requestedPercent:10,agreedPercent:3,vacancyEnabled:true,vacancyMonths:''}).status,'incomplete');});
test('invalid ranges and a higher agreed rent never create false mutual benefit',()=>{assert.equal(compareCooperation({rent:180,requestedPercent:10,agreedPercent:3,vacancyEnabled:true,vacancyMonths:13}).status,'invalid');const r=compareCooperation({rent:180,requestedPercent:3,agreedPercent:10});assert.equal(r.mutualBenefit,false);assert.equal(r.breakEvenVacancyMonths,null);});
