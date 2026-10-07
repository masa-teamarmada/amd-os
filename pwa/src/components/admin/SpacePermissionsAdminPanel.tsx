'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {buildSpacePermissionMatrix,canonicalProjectDdPackage,type PermissionLedgerData,type PermissionLedgerRow} from '@/lib/space-permission-ledger';
import {PROJECT_SURFACES,type ProjectSurface,type SurfacePermission} from '@/lib/project-surface-permissions';
const labels={cockpit:'コックピット',workspace:'ワークスペース',dd:'DDパッケージ'};
const input='min-w-0 max-w-full min-h-11 sm:min-h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-primary';
const button='inline-flex min-h-11 sm:min-h-9 items-center justify-center rounded-md border border-input px-3 text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';
export function SpacePermissionsAdminPanel() {
 const [data,setData]=useState<PermissionLedgerData|null>(null),[query,setQuery]=useState(''),[project,setProject]=useState('');
 const [target,setTarget]=useState<{row?:PermissionLedgerRow;surface:ProjectSurface}|null>(null),[person,setPerson]=useState(''),[grantProject,setGrantProject]=useState(''),[permission,setPermission]=useState<SurfacePermission>('view'),[name,setName]=useState(''),[email,setEmail]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{const r=await fetch('/api/admin/space-permissions',{cache:'no-store'});const payload=await r.json();if(!r.ok) throw new Error(payload.error||'一覧を読み込めない');setData(payload);},[]);
 useEffect(()=>{void load().catch(e=>setError(e.message));},[load]);
 const matrix=useMemo(()=>data?buildSpacePermissionMatrix(data):{projects:[],people:[]},[data]);
 const visibleProjects=matrix.projects.filter(p=>!project||p.project_id===project);
 const visiblePeople=matrix.people.filter(p=>`${p.name} ${p.email}`.toLowerCase().includes(query.trim().toLowerCase()));
 function open(row?:PermissionLedgerRow,surface:ProjectSurface='workspace') {setTarget({row,surface});setPerson(row?.memberId?`member:${row.memberId}`:row?.accountId?`account:${row.accountId}`:'');setGrantProject(row?.projectId||project||'');setPermission(row?.permissions[surface].permission||'view');setError('');setNotice('');setName('');setEmail('');}
 async function send(url:string,body:Record<string,unknown>,method='POST') {const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const payload=await r.json().catch(()=>({}));if(!r.ok) { const errors:Record<string,string>={account_suspended:'この人は停止中。外部アクセス画面で利用状態を確認する。',invalid_email:'メールアドレスの形式が不正。',membership_exists:'登録済みの権限。一覧を再読み込みする。',membership_stopped:'停止中の権限。外部アクセス画面で利用状態を確認する。',grant_already_exists:'登録済みの権限。一覧を再読み込みする。'}; throw new Error(errors[payload.error] || (typeof payload.error==='string'&&/[一-龥ぁ-んァ-ン]/.test(payload.error)?payload.error:'保存に失敗。一覧を再読み込みして、もう一度試す。')); }return payload;}
 async function save() {
  if(!data||!target||!grantProject||!person) {setError('PJとメンバーを選択する。');return;}
  const surface=target.surface;setBusy(true);setError('');setNotice('');
  try {
   if(person.startsWith('member:')) await send('/api/admin/space-permissions',{memberId:person.slice(7),projectId:grantProject,surface,permission});
   else {
    if(surface==='cockpit') throw new Error('コックピットは社内メンバーだけに付与できる。');
    const pkg=canonicalProjectDdPackage(data.ddPackages,grantProject);
    if(surface==='dd'&&!pkg) throw new Error('このPJのDDパッケージを先に作成する。');
    let account=data.accounts.find(a=>a.id===person.slice(8));
    if(person==='new') {
     if(!email.trim()||!name.trim()) throw new Error('名前とメールアドレスを入力する。');
     if(data.members.some(m=>m.email.toLowerCase()===email.trim().toLowerCase())) throw new Error('社内メンバーとして登録済み。メンバー欄からその人を選択する。');
     const created=await send('/api/admin/workspace-access',{kind:'account',email:email.trim(),displayName:name.trim()});
     account=data.accounts.find(a=>a.id===created.accountId)||{id:created.accountId,email:email.trim(),display_name:name.trim(),status:'invited'};
    }
    if(!account) throw new Error('対象メンバーを選択する。');
    if(account.status==='suspended') throw new Error('この人は停止中。外部アクセス画面で利用状態を確認する。');
    if(surface==='workspace') {
     const existing=data.projectMemberships.find(m=>m.project_id===grantProject&&m.user_account_id===account!.id);
     if(existing && !['active','invited'].includes(existing.status)) throw new Error('停止・失効した権限は、外部アクセス画面で明示的に再開する。');
     if(existing) await send('/api/admin/workspace-access',{kind:'project_membership',membershipId:existing.id,role:permission==='edit'?'manager':'readonly'},'PATCH');
     else {
      const result=await send('/api/admin/workspace-access',{action:'grant_project_viewer',accountId:account.id,projectId:grantProject});
      if(permission==='edit') await send('/api/admin/workspace-access',{kind:'project_membership',membershipId:result.membershipId,role:'manager'},'PATCH');
     }
    } else {
     const existing=data.ddGrants.find(g=>g.package_id===pkg!.id&&g.user_account_id===account!.id);
     if(existing&&!['active','invited'].includes(existing.status)) throw new Error('停止・失効した権限は、外部アクセス画面で明示的に再開する。');
     const capabilities=['dd.view',...(existing?.capabilities.includes('dd.download')?['dd.download']:[]),...(permission==='edit'?['dd.edit']:[])];
     await send('/api/admin/dd',existing?{action:'update_grant',grantId:existing.id,capabilities}:{action:'create_grant',packageId:pkg!.id,email:account.email,capabilities,createAccount:false});
    }
   }
   await load();setTarget(null);setNotice(`${labels[surface]}の${permission==='edit'?'閲覧・編集':'閲覧'}権限を保存済み。${person==='new'?'新しい外部メンバーは初回ログイン後に一覧へ表示される。':''}`);
  } catch(e) {setError(e instanceof Error?e.message:'保存できない');await load().catch(()=>{});} finally {setBusy(false);}
 }
 if(!data) return <div role={error?'alert':'status'} className="text-sm">{error||'権限を読み込み中…'}{error&&<button className={`${button} ml-2`} onClick={()=>void load().catch(e=>setError(e.message))}>再読み込み</button>}</div>;
 const people=[...data.members.filter(m=>m.status==='active').map(m=>({value:`member:${m.member_id}`,name:`${m.member_name||m.code_name} · 社内`})),...data.accounts.filter(a=>a.status==='active'&&!data.members.some(m=>m.email.toLowerCase()===a.email.toLowerCase())).map(a=>({value:`account:${a.id}`,name:`${a.display_name||a.email} · 外部`}))];
 return <div className="min-w-0 space-y-3">
  <div className="flex flex-wrap items-center gap-2">
   <input aria-label="メンバーを検索" placeholder="名前・メールで検索" value={query} onChange={e=>setQuery(e.target.value)} className={`${input} w-full sm:w-64`}/>
   <select aria-label="PJを絞り込む" className={`${input} w-full sm:w-44`} value={project} onChange={e=>setProject(e.target.value)}><option value="">すべてのアクティブPJ</option>{matrix.projects.map(p=><option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}</select>
   <button className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`} onClick={()=>open()}>権限を付与</button><button className={button} disabled={busy} onClick={()=>void load().catch(e=>setError(e.message))}>再読み込み</button>
  </div>
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
   <span>{visiblePeople.length}人 × {visibleProjects.length} PJ · アクティブのみ</span><span><span className="font-medium text-blue-700 dark:text-blue-400">閲覧</span> / <span className="font-semibold text-red-700 dark:text-red-400">編集</span>（閲覧を含む） / — 未付与</span>
   <Link href="/admin/access" className="text-primary underline">招待待ち・停止中を管理</Link><Link href="/admin/members" className="text-primary underline">社内メンバーを登録</Link>
  </div>
  {notice&&<p role="status" className="text-sm text-primary">{notice}</p>}{error&&!target&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  <div role="region" aria-label="メンバー別PJ権限表・横スクロール可能" tabIndex={0} className="relative isolate max-h-[65dvh] max-w-full overflow-auto rounded-md border border-border focus-visible:outline-2 focus-visible:outline-primary [--member-column:144px] sm:[--member-column:176px]">
   <table className="table-fixed border-separate border-spacing-0 text-xs" style={{width:`calc(var(--member-column) + ${visibleProjects.length*288}px)`}}>
    <caption className="sr-only">１人１行。各PJのコックピット、ワークスペース、DDパッケージの権限。セルを押すと詳細を確認して変更できる。</caption>
    <colgroup><col style={{width:'var(--member-column)'}}/>{visibleProjects.flatMap(p=>PROJECT_SURFACES.map(s=><col key={`${p.project_id}:${s}`} style={{width:96}}/>))}</colgroup>
    <thead>
     <tr><th scope="col" rowSpan={2} className="sticky left-0 top-0 z-30 border-b border-r border-border bg-muted px-3 text-left font-medium">名前</th>{visibleProjects.map(p=><th key={p.project_id} scope="colgroup" colSpan={3} className="sticky top-0 z-20 h-8 border-b border-r border-border bg-muted px-2 text-center font-semibold" title={p.project_name}><span className="block truncate">{p.project_name}</span></th>)}</tr>
     <tr>{visibleProjects.flatMap(p=>PROJECT_SURFACES.map((s,i)=><th key={`${p.project_id}:${s}`} scope="col" className={`sticky top-8 z-20 h-8 border-b border-border bg-muted px-1 text-center text-[11px] font-normal text-muted-foreground ${i===2?'border-r':''}`}>{labels[s]}</th>))}</tr>
    </thead>
    <tbody>{visiblePeople.map(person=><tr key={person.key} className="group">
     <th scope="row" className="sticky left-0 z-10 border-b border-r border-border bg-background px-3 text-left font-medium group-hover:bg-muted" title={`${person.name} · ${person.email}${person.isAdmin?' · 管理者':''}`}><span className="block truncate">{person.name}</span></th>
     {visibleProjects.flatMap(p=>PROJECT_SURFACES.map((s,i)=>{const row=person.projects[p.project_id],cell=row.permissions[s];return <td key={`${p.project_id}:${s}`} className={`border-b border-border p-0 group-hover:bg-muted/40 ${i===2?'border-r':''}`}>
      <button className="flex h-11 w-full items-center justify-center hover:bg-muted focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default" disabled={row.isAdmin||(!row.memberId&&s==='cockpit')} aria-label={`${p.project_name}・${person.name}の${labels[s]}権限を変更`} title={`${labels[s]}：${cell.permission==='edit'?'編集（閲覧を含む）':cell.permission==='view'?'閲覧':'未付与'}${cell.note?` · ${cell.note}`:''}`} onClick={()=>open(row,s)}>
       <span className={cell.permission==='edit'?'font-semibold text-red-700 dark:text-red-400':cell.permission==='view'?'font-medium text-blue-700 dark:text-blue-400':'text-muted-foreground'}>{cell.permission==='edit'?'編集':cell.permission==='view'?'閲覧':'—'}</span>
      </button>
     </td>;}))}
    </tr>)}</tbody>
   </table>
   {(visiblePeople.length===0||visibleProjects.length===0)&&<p className="p-3 text-sm text-muted-foreground">該当するアクティブなメンバー・PJがない。</p>}
  </div>
  <p className="text-xs text-muted-foreground">横にスクロールしてPJを比較。セルを押すと権限の詳細と変更画面が開く。</p>
  <p className="text-xs leading-5 text-muted-foreground">社内メンバーの編集はPJの共有情報・資料、外部ワークスペースの編集は共有資料の追加・編集、DDの編集は掲載項目の編集。権限の再付与、全社設定、報酬・契約確定は管理者だけ。既存の管理者・社内・所属権限は個別付与とは別に維持される。</p>
  <Dialog open={!!target} onOpenChange={v=>{if(!v&&!busy)setTarget(null);}}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>閲覧・編集権限を付与</DialogTitle><DialogDescription>PJ・メンバー・スペースを指定して保存する。招待メールは送信されない。</DialogDescription></DialogHeader>
   {target?.row&&<p className="text-xs text-muted-foreground">現在の権限：{target.row.permissions[target.surface].permission==='edit'?'編集（閲覧を含む）':target.row.permissions[target.surface].permission==='view'?'閲覧':'未付与'}{target.row.permissions[target.surface].note&&` · ${target.row.permissions[target.surface].note}`}</p>}
   <div className="grid min-w-0 gap-3"><label className="grid min-w-0 gap-1 text-xs">PJ<select className={`${input} w-full`} disabled={busy||!!target?.row} value={grantProject} onChange={e=>setGrantProject(e.target.value)}><option value="">PJを選択</option>{matrix.projects.map(p=><option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}</select></label><label className="grid min-w-0 gap-1 text-xs">メンバー<select className={`${input} w-full`} disabled={busy||!!target?.row} value={person} onChange={e=>setPerson(e.target.value)}><option value="">メンバーを選択</option>{people.map(p=><option key={p.value} value={p.value}>{p.name}</option>)}<option value="new">新しい外部メンバーを登録</option></select></label>
   {person==='new'&&<div className="grid gap-2 sm:grid-cols-2"><label className="grid min-w-0 gap-1 text-xs">名前<input className={`${input} w-full`} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label><label className="grid min-w-0 gap-1 text-xs">メールアドレス<input type="email" className={`${input} w-full`} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label></div>}
   <label className="grid min-w-0 gap-1 text-xs">スペース<select className={`${input} w-full`} disabled={busy||!!target?.row} value={target?.surface||'workspace'} onChange={e=>setTarget({surface:e.target.value as ProjectSurface})}>{PROJECT_SURFACES.map(s=><option key={s} value={s} disabled={s==='cockpit'&&!person.startsWith('member:')}>{labels[s]}</option>)}</select></label>
   <p className="text-xs text-muted-foreground">個別付与は既存の所属・社内権限に追加される。閲覧のみを選んでも、既存の編集権限は下がらない。</p><fieldset disabled={busy} className="flex gap-3 text-sm"><legend className="mb-1 text-xs text-muted-foreground">付与する権限</legend>{(['view','edit'] as const).map(p=><label key={p} className="flex min-h-11 items-center gap-2"><input type="radio" name="permission" checked={permission===p} onChange={()=>setPermission(p)}/>{p==='view'?'閲覧のみ':'閲覧・編集'}</label>)}</fieldset>
   {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<button className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`} disabled={busy||!person||!grantProject} onClick={()=>void save()}>{busy?'保存中…':'権限を保存'}</button></div>
  </DialogContent></Dialog>
 </div>;
}
