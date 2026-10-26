export async function loadBusinesses(){
 const load=async file=>{const r=await fetch(new URL('./assets/'+file,import.meta.url));if(!r.ok)throw Error('인허가 자료 불러오기 실패');return r.json();};
 const [base,extra]=await Promise.all([load('businesses.json'),load('additional-businesses.json')]);
 return [...base.rows.map(r=>Object.fromEntries(base.columns.map((k,i)=>[k,r[i]]))),...extra.rows.map(r=>Object.fromEntries(extra.columns.map((k,i)=>[k,r[i]])))];
}
