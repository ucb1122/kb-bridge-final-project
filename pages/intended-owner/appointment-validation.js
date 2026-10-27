const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export {today};
export function validateRequest(value,branch,currentDay=today()){
 const errors=[];
 if(!branch)errors.push('상담할 영업점을 선택해 주세요.');
 if(value.channel==='visit'&&branch&&!branch.visitConsultation)errors.push('이 영업점의 방문 상담 정보를 확인할 수 없어 전화 상담으로 선택해 주세요.');
 if(!/^0\d{8,10}$/.test((value.phone||'').replace(/[\s-]/g,'')))errors.push('연락받을 전화번호를 확인해 주세요.');
 if(value.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))errors.push('이메일 주소를 확인해 주세요.');
 const date=String(value.date||''),parsed=new Date(date+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||date<currentDay)errors.push('오늘 이후의 희망 상담일을 선택해 주세요.');
 if(!['오전','오후'].includes(value.time))errors.push('희망 상담 시간대를 선택해 주세요.');
 if(!value.consent)errors.push('PDF 상담서에 연락처를 포함하는 데 동의해 주세요.');
 return errors;
}
