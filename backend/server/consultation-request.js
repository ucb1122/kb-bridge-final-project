import fs from 'node:fs';
import path from 'node:path';

const dateInSeoul=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function saveConsultationRequest(db,root,user,body){
  if(!user)throw Object.assign(Error('로그인 후 상담서를 저장해 주세요.'),{status:401});
  const banks=JSON.parse(fs.readFileSync(path.join(root,'frontend/shared/finance/kb-branches.json'),'utf8'));
  const branch=banks.branches.find(item=>item.id===String(body.branchId||''));
  const region=body.region||{},form=body.form||{};
  const phone=String(form.phone||'').replace(/[\s-]/g,'');
  const date=String(form.date||''),parsed=new Date(`${date}T00:00:00Z`),today=dateInSeoul();
  const limit=`${Number(today.slice(0,4))+2}${today.slice(4)}`;
  if(!branch||!['visit','phone'].includes(form.channel)||form.channel==='visit'&&!branch.visitConsultation||
    !/^0\d{8,10}$/.test(phone)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed.getTime())||
    parsed.toISOString().slice(0,10)!==date||date<today||date>limit||!['오전','오후'].includes(form.time)||
    form.consent!==true||String(form.name||'').length>40||String(form.businessName||'').length>80||
    String(form.email||'').length>254||form.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)||
    (body.region&&(!['area','dong'].includes(region.kind)||!/^\d{5,12}$/.test(String(region.code||''))||!/^20\d{2}[1-4]$/.test(String(region.quarter||'')))))
    throw Object.assign(Error('상담 요청 내용을 확인해 주세요.'),{status:400});
  db.exec(`CREATE TABLE IF NOT EXISTS consultation_requests (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
    region_kind TEXT, region_code TEXT, region_quarter TEXT,
    branch_id TEXT NOT NULL, branch_name TEXT NOT NULL, channel TEXT NOT NULL,
    preferred_date TEXT NOT NULL, preferred_time TEXT NOT NULL, phone TEXT NOT NULL,
    applicant_name TEXT, business_name TEXT, email TEXT, concern TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const result=db.prepare(`INSERT INTO consultation_requests
    (user_id,region_kind,region_code,region_quarter,branch_id,branch_name,channel,preferred_date,preferred_time,phone,applicant_name,business_name,email,concern)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(user.id,region.kind??null,region.code==null?null:String(region.code),region.quarter==null?null:String(region.quarter),branch.id,branch.name,form.channel,date,form.time,phone,
      String(form.name||''),String(form.businessName||''),String(form.email||''),String(body.concern||'').slice(0,1000));
  return {id:Number(result.lastInsertRowid),saved:true};
}
