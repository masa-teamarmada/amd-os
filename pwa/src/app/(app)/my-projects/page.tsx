import Link from 'next/link';
import {createAdminClient} from '@/lib/supabase/admin';
import {getCurrentMemberAccess} from '@/lib/project-workspace';
import {memberSurfacePermission} from '@/lib/project-surface-permissions';
export default async function MyProjectsPage() {
 const access=await getCurrentMemberAccess();
 const ids=[...new Set([...(access?.projects.map(p=>p.projectId)??[]),...(access?.surfaceGrants?.map(g=>g.project_id)??[])])];
 const db=createAdminClient();
 const [projects,packages]=await Promise.all([ids.length?db.from('projects').select('project_id,project_name').in('project_id',ids):Promise.resolve({data:[]}),ids.length?db.from('dd_packages').select('project_id,slug,status').in('project_id',ids):Promise.resolve({data:[]})]);
 return <main className="min-w-0 p-4"><h1 className="text-lg font-semibold">参加しているプロジェクト</h1><p className="mb-3 mt-1 text-xs text-muted-foreground">所属と個別に付与された権限に応じて、各スペースを開ける。</p><div className="max-w-full overflow-x-auto"><table className="w-full min-w-[550px] text-left text-sm"><thead className="bg-muted text-xs text-muted-foreground"><tr><th className="p-2">PJ</th><th className="p-2">コックピット</th><th className="p-2">ワークスペース</th><th className="p-2">DDパッケージ</th></tr></thead><tbody>{access&&(projects.data??[]).map(p=>{const pkg=packages.data?.find(d=>d.project_id===p.project_id);return <tr className="border-b border-border" key={p.project_id}><td className="p-2 font-medium">{p.project_name}</td>{(['cockpit','workspace','dd'] as const).map(s=>{const permission=memberSurfacePermission(access,p.project_id,s);const allowed=permission&&(s!=='dd'||pkg&&(access.isAdmin||pkg.status==='open'||pkg.status==='draft'&&permission==='edit'));return <td key={s} className="p-2">{allowed?<Link className="inline-flex min-h-11 items-center text-primary underline" href={s==='dd'?`/dd/${encodeURIComponent(pkg!.slug)}`:`/project/${encodeURIComponent(p.project_id)}/${s}`}>開く</Link>:<span className="text-xs text-muted-foreground">—</span>}</td>;})}</tr>;})}</tbody></table></div>{!ids.length&&<p className="mt-3 text-sm text-muted-foreground">参加設定・個別付与されたPJはまだない。</p>}</main>;
}
