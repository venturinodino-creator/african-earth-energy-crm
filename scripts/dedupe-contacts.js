#!/usr/bin/env node
/* Merge exact duplicate contacts.

     node scripts/dedupe-contacts.js [--dry-run]

   Written 2026-09-19 when the finder's Accept and a direct CSV import had
   created the same person twice on the same account (one c_ row, one con_
   row). Merge exact duplicate contacts: same account, same normalised name.
   Keeps the row with an email, then phone, then the finder-linked con_ row,
   then the oldest; folds notes and blank fields into the survivor; deletes
   the rest. --dry-run prints and writes nothing. Backup to OS temp. */
const fs=require('fs'), os=require('os'), path=require('path');
for (const line of fs.readFileSync('.env','utf8').split(/\r?\n/)) { const m=/^\s*([A-Za-z_]\w*)\s*=\s*(.*)$/.exec(line); if(m&&process.env[m[1]]===undefined) process.env[m[1]]=m[2].trim().replace(/^["']|["']$/g,''); }
const BASE='https://pkzfazjtpswqjmnzzrgt.supabase.co', KEY='sb_publishable_jqCjOPRXZEIKjgNDVsL3uw_ldx-I-tO';
const DRY=process.argv.includes('--dry-run');
const email = process.env.AEE_EMAIL.includes('@') ? process.env.AEE_EMAIL : process.env.AEE_EMAIL+'@aeeg.co.za';
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z]+/g,' ').trim();
(async()=>{
  const r=await fetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password:process.env.AEE_PASSWORD})});
  const t=(await r.json()).access_token; const h={apikey:KEY,Authorization:'Bearer '+t,'Content-Type':'application/json',Prefer:'return=representation'};
  const all=await (await fetch(BASE+'/rest/v1/aee_contacts?select=*',{headers:h})).json();
  const groups={}; for(const c of all){const k=(c.offtaker_id||'')+'|'+norm(c.first)+' '+norm(c.last); (groups[k]=groups[k]||[]).push(c);}
  const dups=Object.values(groups).filter(g=>g.length>1);
  const score=c=>(c.email?8:0)+(c.phone?4:0)+(c.id.startsWith('con_')?2:0)+(c.linkedin?1:0);
  const backup=path.join(os.tmpdir(),'aee-removed-duplicate-contacts-'+Date.now()+'.jsonl');
  let removed=0;
  for(const g of dups){
    g.sort((a,b)=>score(b)-score(a)||String(a.updated_at).localeCompare(String(b.updated_at)));
    const keep=g[0], drop=g.slice(1);
    const patch={}; 
    for(const f of ['email','phone','linkedin','dept','title']) if(!keep[f]) { const d=drop.find(x=>x[f]); if(d) patch[f]=d[f]; }
    const extra=drop.map(d=>(d.notes||'').trim()).filter(n=>n&&n!==(keep.notes||'').trim());
    if(extra.length) patch.notes=((keep.notes||'').trim()+' Merged duplicate 2026-09-19: '+extra.join(' | ')).trim();
    const rk={decision:3,technical:2,influencer:1,gatekeeper:0}; const best=drop.reduce((b,d)=>(rk[d.role]||0)>(rk[b]||0)?d.role:b,keep.role); if(best!==keep.role) patch.role=best;
    if(keep.priority!=='high'&&drop.some(d=>d.priority==='high')) patch.priority='high';
    console.log((DRY?'[dry] ':'')+keep.first+' '+keep.last+' @ '+keep.offtaker_id+' | keep '+keep.id+(keep.email?' (email)':'')+' | drop '+drop.map(d=>d.id).join(',')+(Object.keys(patch).length?' | fill '+Object.keys(patch).join(','):''));
    if(DRY) continue;
    for(const d of drop) fs.appendFileSync(backup,JSON.stringify(d)+'\n');
    if(Object.keys(patch).length){ patch.updated_at=new Date().toISOString(); const u=await fetch(BASE+'/rest/v1/aee_contacts?id=eq.'+keep.id,{method:'PATCH',headers:h,body:JSON.stringify(patch)}); if(!u.ok) throw new Error('patch '+u.status); }
    for(const d of drop){ const x=await fetch(BASE+'/rest/v1/aee_contacts?id=eq.'+d.id,{method:'DELETE',headers:h}); if(!x.ok) throw new Error('delete '+x.status); removed++; }
  }
  console.log('groups',dups.length,'| rows to remove',dups.reduce((n,g)=>n+g.length-1,0),'| removed',removed,DRY?'':'| backup '+backup);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
