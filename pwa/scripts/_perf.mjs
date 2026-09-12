import fs from "node:fs"; import path from "node:path"; import { chromium } from "playwright";
const root = path.resolve(import.meta.dirname, "..");
const env = Object.fromEntries(fs.readFileSync(path.join(root,".env.local"),"utf8").split("\n")
  .filter(l=>l.includes("=")&&!l.trim().startsWith("#"))
  .map(l=>{const a=l.indexOf("=");return [l.slice(0,a).trim(),l.slice(a+1).trim()];}));
const url=env.NEXT_PUBLIC_SUPABASE_URL, ref=new URL(url).hostname.split(".")[0];
const link=await (await fetch(`${url}/auth/v1/admin/generate_link`,{method:"POST",
  headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,"Content-Type":"application/json"},
  body:JSON.stringify({type:"magiclink",email:"masa@team-armada.jp"})})).json();
const s=await (await fetch(`${url}/auth/v1/verify`,{method:"POST",
  headers:{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,"Content-Type":"application/json"},
  body:JSON.stringify({type:"magiclink",token_hash:link.hashed_token})})).json();
const value="base64-"+Buffer.from(JSON.stringify(s)).toString("base64url");
const name=`sb-${ref}-auth-token`;
const common={domain:"amd-os-pwa.vercel.app",path:"/",httpOnly:false,secure:true,sameSite:"Lax"};
const cookies=value.length<=3180?[{name,value,...common}]
  :value.match(/.{1,3180}/g).map((p,i)=>({name:`${name}.${i}`,value:p,...common}));
const cookieHeader=cookies.map(c=>`${c.name}=${c.value}`).join("; ");

// 1) API単体の往復時間（3回ずつ、2回目以降は温まった状態）
console.log("=== APIの往復時間（ms） ===");
for (const ep of ["workspace-bundle","question-tree","question-tree?view=points"]) {
  const ts=[];
  for (let i=0;i<3;i++){
    const t0=Date.now();
    const r=await fetch(`https://amd-os-pwa.vercel.app/api/project/p21/${ep}`,{headers:{cookie:cookieHeader}});
    await r.text();
    ts.push(Date.now()-t0);
  }
  console.log(`  ${ep}: ${ts.join(" / ")}`);
}

// 2) 画面を開いてから木が出るまで
const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:1440,height:900}});
await ctx.addCookies(cookies); const page=await ctx.newPage();
const timings=[];
page.on("response",async r=>{
  if(!r.url().includes("/api/"))return;
  const t=r.timing();
  timings.push({u:r.url().replace("https://amd-os-pwa.vercel.app/api/",""),ms:Math.round(t.responseEnd-t.requestStart)});
});
console.log("=== 画面を開いてから ===");
const t0=Date.now();
await page.goto("https://amd-os-pwa.vercel.app/project/p21/cockpit?tab=issues",{waitUntil:"domcontentloaded",timeout:120000});
const domMs=Date.now()-t0;
await page.waitForSelector('[data-action-row]',{timeout:120000});
const treeMs=Date.now()-t0;
console.log(`  DOM到達 ${domMs}ms / 木の行が出るまで ${treeMs}ms`);
console.log("=== そのとき飛んだAPI ===");
timings.sort((a,b)=>b.ms-a.ms).slice(0,8).forEach(t=>console.log(`  ${t.ms}ms  ${t.u.slice(0,70)}`));
await browser.close();
