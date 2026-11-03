import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {PROJECT_CANONICAL_PAGES} from '../src/lib/project-canonical-pages.ts';
import {projectPageDefinition,projectPageForChapter,projectPageId} from '../src/lib/project-page-registry.ts';
import {projectSurfacePageGroups} from '../src/lib/project-page-visibility.ts';
const require=createRequire(import.meta.url),ts=require('typescript');
const root=path.resolve(import.meta.dirname,'..');
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
const ast=(file:string)=>ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
const failures:string[]=[];
function check(value:unknown,message:string){if(!value)failures.push(message);}
const shells=['src/components/cockpit/CockpitView.tsx','src/components/project-workspace/SxWeeklyControlDashboard.tsx','src/components/project-space/ProjectCanonicalPage.tsx'];
for(const shell of shells){
 const source=read(shell);check(source.includes('ProjectSurfaceView'),shell+': 共通入口へ渡す');
 check(!/\b(fetch|useEffect|createAdminClient|loadProject\w+)\s*\(/.test(source),shell+': 本文の取得処理を持たない');
 check(!/<(?:Cockpit(?:Technology|CostTab|CapitalPlan|BusinessPlan)|SxPartnerPipeline|ProjectContractList|DdReportReader)\b/.test(source),shell+': 個別の本文を描画しない');
 check(!/children\s*[:?]/.test(source),shell+': 別本文の差し込み口を持たない');
}
for(const file of ['src/components/project-pages/ProjectPageBody.tsx','src/components/project-pages/ProjectOperationsPage.tsx','src/components/project-pages/ProjectControlPage.tsx','src/lib/project-page-server.ts','src/lib/project-page-record-server.ts']){
 let forbidden=false;
 function visit(n:any){if(ts.isIdentifier(n)&&['surface','surfaceName','currentSpace'].includes(n.text))forbidden=true;ts.forEachChild(n,visit);}
 visit(ast(file));check(!forbidden,file+': スペース名を持たない');
}
const host=read('src/components/project-pages/ProjectPageBody.tsx');
check(!/children\s*[:?]/.test(host),'共通本体へ別の本体を注入できない');
const surface=read('src/components/project-pages/ProjectSurfaceView.tsx');
check((surface.match(/<ProjectPageBody\b/g)||[]).length===1,'入口の描画先は共通本体１つ');
const permitted=new Set(['ProjectPageEnvironmentContext.Provider','ProjectPageTitle','ProjectSpaceLayout','ProjectSurfaceNav','InternalProjectSurfaceNav','ProjectPageMenu','ProjectPageBody','p','header','h1']);
function shellTags(n:any){if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))check(permitted.has(n.tagName.getText()),'入口へ別の本文を追加できない: '+n.tagName.getText());ts.forEachChild(n,shellTags);}
shellTags(ast('src/components/project-pages/ProjectSurfaceView.tsx'));
check(read('src/components/dd/DdProjectPageBody.tsx').includes('ProjectRecordSnapshot'),'保存版も共通本体へ委譲する');
check(read('src/lib/dd-project-pages-server.ts').includes('loadProjectPageRecord('),'旧取得口も共通の管理記録取得へ委譲する');
const getter=read('src/lib/project-canonical-page-server.ts');
check(getter.includes('return readProjectReportPage('),'旧取得口は共通取得へ委譲する');
check(!getter.includes('loadDdProjectPage('),'旧取得口からDD専用の取得へ戻らない');
const catalogFlag=process.argv.indexOf('--catalog');
const catalog=catalogFlag>=0?JSON.parse(fs.readFileSync(process.argv[catalogFlag+1],'utf8')):[];
const chapters=[...new Set([...Object.values(PROJECT_CANONICAL_PAGES).flatMap(p=>p.chapters),...catalog.map((c:{slug:string})=>c.slug)])] as string[];
for(const chapter of chapters){
 const id=projectPageForChapter(chapter),definition=projectPageDefinition(id);
 check(Boolean(definition?.chapters.includes(chapter)),chapter+': 登録元の１ページへ解決できる');
 check(projectPageId('report:'+chapter)===id,chapter+': 旧URLも別ページを作らない');
}
for(const type of ['su','new_business','ecosystem','amd'] as const)for(const surface of ['cockpit','workspace','dd'] as const){
 const groups=projectSurfacePageGroups(surface,type,chapters.map(slug=>({slug,title:slug})) as never,true);
 const ids=groups.flatMap(g=>g.children.map(c=>c.key));
 check(new Set(ids).size===ids.length,type+'/'+surface+': ページIDが重複しない');
 for(const id of ids)check(Boolean(projectPageDefinition(id)),id+': 未登録ページを出さない');
}
for(const file of ['src/app/(app)/project/[projectId]/cockpit/page.tsx','src/app/(shared-workspace)/project/[projectId]/workspace/page.tsx']){
 const source=read(file);check(source.includes('projectSurfaceEntry('),file+': 共通入口で取得する');
 check(!/fetchCockpitFromSupabase|getProjectWorkspaceBundle\(/.test(source),file+': スペース専用の取得を持たない');
}
assert.match(read("src/components/dd/DdViewerShell.tsx"),/!unifiedPage\s*&&\s*<ProjectPageTitle/,"共通ページのタイトル監視を外枠で重複させない");
assert.deepEqual(failures,[]);
console.log(JSON.stringify({passed:true,pageBodies:1,recordOwners:1,shells:shells.length,registeredChapterAliases:chapters.length,method:'入口→唯一のページ本体・取得処理への所有関係を検査。ページ同士の比較はしない。'}));

