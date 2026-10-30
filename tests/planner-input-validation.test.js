import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlannerNumber,validatePlannerMonth} from '../frontend/pages/intended-owner/planner-input-validation.js';
import {validateRequest} from '../frontend/pages/intended-owner/appointment-validation.js';

test('금액과 기간의 잘못된 입력을 구분한다',()=>{
  assert.equal(validatePlannerNumber('rrBalance','3007'),null);
  assert.equal(validatePlannerNumber('rrSales',''),null);
  assert.match(validatePlannerNumber('rrBalance','-1'),/남은 대출 원금/);
  assert.match(validatePlannerNumber('rrMonths','36.5'),/정수/);
  assert.match(validatePlannerNumber('rrRate','5',true),/숫자를 올바르게/);
});

test('비정상적인 연도는 재점검 월과 상담일에서 거부한다',()=>{
  const now=new Date(2026,9,30);
  assert.equal(validatePlannerMonth('2026-12',now),null);
  assert.match(validatePlannerMonth('142142-12',now),/올바르게/);
  assert.match(validatePlannerMonth('2030-01',now),/2년 이내/);
  const form={channel:'phone',phone:'010-1234-5678',email:'',date:'142142-12-21',time:'오전',consent:true};
  assert.match(validateRequest(form,{visitConsultation:true},'2026-10-30').join(' '),/희망 상담일/);
});
