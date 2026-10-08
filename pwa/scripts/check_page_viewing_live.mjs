import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const base=process.argv[2]||'http://localhost:3108';
const request=async(path,options={})=>fetch(base+path,options);
assert.equal((await request('/api/page-viewing?pathname=/dashboard&pageLabel=')).status,404);
assert.equal((await request('/api/page-viewing',{method:'POST',headers:{Origin:'https://foreign.example','Content-Type':'application/json'},body:'{}'})).status,403);
assert.equal((await request('/api/page-viewing?pathname=%2Fdashboard%3Ftoken%3Dx')).status,400);
assert.equal((await request('/api/page-viewing',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'null'})).status,400);
assert.equal((await request('/api/page-viewing',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({padding:'x'.repeat(2100)})})).status,400);
// Existing invited/suspended accounts remain denied. No permissions or account states are changed.
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const {data:accounts,error}=await db.from('workspace_user_accounts').select('id,email_normalized').in('status',['invited','suspended']).limit(1);assert.ifError(error);
if(accounts?.length){const a=accounts[0];const encoded=Buffer.from(JSON.stringify({version:1,accountId:a.id,email:a.email_normalized,expiresAt:Math.floor(Date.now()/1000)+600})).toString('base64url');const signature=createHmac('sha256',process.env.WORKSPACE_SESSION_SECRET).update(`amd_os_workspace_session:v1:${encoded}`).digest('base64url');const headers={Cookie:`amd_os_workspace_session=${encoded}.${signature}`};assert.equal((await request('/api/page-viewing?pathname=/dashboard&pageLabel=',{headers})).status,404);}
console.log('PASS: live API anonymous, foreign-origin, raw-URL, null/oversized body, invited/suspended external-account denial');
