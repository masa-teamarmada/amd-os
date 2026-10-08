import fs from 'node:fs';
const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const query=fs.readFileSync(new URL('./check_contract_workflow_db.sql',import.meta.url),'utf8');
const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query})});
if(!response.ok){console.error((await response.text()).slice(0,1000));process.exit(1);}console.log('実DBの自己承認・権限分離・重複申請・版変更失効・証跡分離・通知の同時保存: PASS（全てロールバック）');
