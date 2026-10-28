import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRequest} from '../appointment-request.js';
const branch={id:'example',visitConsultation:true};
const request={channel:'visit',phone:'010-0000-0000',email:'',date:'2026-10-29',time:'오전',consent:true};
test('request preview requires branch, reachable contact, future preference and explicit preview consent',()=>{
 assert.equal(validateRequest({},null,'2026-10-27').length,5);
 assert.deepEqual(validateRequest(request,branch,'2026-10-27'),[]);
 assert.equal(validateRequest({...request,consent:false},branch,'2026-10-27').length,1);
});
test('unknown visit support permits phone requests but never claims visit availability',()=>{
 assert.equal(validateRequest(request,{...branch,visitConsultation:false},'2026-10-27').length,1);
 assert.deepEqual(validateRequest({...request,channel:'phone'},{...branch,visitConsultation:false},'2026-10-27'),[]);
});
test('past and impossible dates and malformed contact are rejected',()=>{
 for(const date of ['2026-10-26','2026-02-30','2026-13-01'])assert.ok(validateRequest({...request,date},branch,'2026-10-27').length);
 assert.ok(validateRequest({...request,phone:'123',email:'bad-address'},branch,'2026-10-27').length>=2);
});
