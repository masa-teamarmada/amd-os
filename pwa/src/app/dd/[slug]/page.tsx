import {projectPageActor} from '@/lib/project-canonical-page-server';
import {projectPageSource,readProjectPage} from '@/lib/project-page-server';
import {projectPageForChapter} from '@/lib/project-page-registry';
import {ProjectSurfaceView} from '@/components/project-pages/ProjectSurfaceView';
import {ProjectCanonicalPage} from '@/components/project-space/ProjectCanonicalPage';
import {canonicalPageForChapter} from '@/lib/project-canonical-pages';
import {loadProjectCanonicalPage} from '@/lib/project-canonical-page-server';
import {ddReportOutputState,queueDdReportPdf} from '@/lib/dd-report-output-state';
import { DdEntryGate } from "@/components/dd/DdEntryGate";
import { loadDdNdaContext, hasDdNdaConfirmation } from "@/lib/dd-nda-server";
import { ddNdaReturnPath } from "@/lib/dd-nda";
import { ddContentHash } from "@/lib/dd-confidentiality-server";
import { notFound, redirect } from "next/navigation";
import { requireDdPageSession } from "@/lib/dd-page-session";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { loadDdPackageView, recordDdAccessEvent } from "@/lib/dd-package-server";
import { DdViewerShell } from "@/components/dd/DdViewerShell";
import { DdPackageTop } from "@/components/dd/DdPackageTop";
import { hasDdCapability, isDdSlug } from "@/lib/dd-package-core";
import { DD_PAGE_KEYS, type DdPageKey } from "@/lib/dd-pages";
import { loadDdProjectPage } from "@/lib/dd-project-pages-server";
import { canEditProjectSurface } from "@/lib/project-surface-access";
import {evaluatedDdReportChapter,loadDdReportChapter,loadDdReportChapterIndex,loadDdReportEdition,loadDdReportReleases,loadDdReportModel,loadDdLegacySnapshot,redactDdReport} from '@/lib/dd-report-server';
import {DdReportReader} from '@/components/dd/report/DdReportReader';
import {DdReportNavigation} from '@/components/dd/report/DdReportNavigation';
import type {DdLiveProjectPage} from '@/lib/dd-project-page-types';
import {ddReportDownloadEdition,ddReportDownloadRelease} from '@/lib/dd-report-download-policy';

export const dynamic = "force-dynamic";
export const maxDuration=300;

// DDトップ。権限の確認（毎回DBを引き直す）より前に、パッケージの有無が分かる応答を返さない。
export default async function DdPackagePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string; section?: string; returnTo?: string; fresh?: string;chapter?:string;legacy?:string }> }) {
  const { slug } = await params;
  if (!isDdSlug(slug)) notFound();
  const { section, tab, returnTo, fresh,chapter,legacy } = await searchParams;
  const query = new URLSearchParams();
  if (tab) query.set("tab", tab);
  if (section) query.set("section", section);
  if(chapter)query.set('chapter',chapter);
  if(legacy)query.set('legacy',legacy);
  await requireDdPageSession(`/dd/${encodeURIComponent(slug)}${query.size ? `?${query}` : ""}`);
  const access = await resolveDdPackageAccess(slug, { requireNdaConfirmation: false });
  if (!access) notFound();
  if (!await hasDdNdaConfirmation(access)) {
    const nda = await loadDdNdaContext(access);
    return <DdEntryGate slug={slug} title={access.title} {...nda} returnTo={ddNdaReturnPath(slug, returnTo ?? `/dd/${encodeURIComponent(slug)}${query.size ? `?${query}` : ""}`)} />;
  }

  const edition=await loadDdReportEdition(access);
  if(legacy==='1'&&!edition?.legacy_snapshot_path)notFound();
  if((edition||tab==='strategic-resources')&&legacy!=='1'){
    if(tab==='documents')redirect(`/dd/${encodeURIComponent(slug)}/legacy?tab=documents`);
    const actor=await projectPageActor({projectId:access.projectId,surface:'dd',external:access.principal==='workspace_account',canEdit:hasDdCapability(access,'dd.edit'),actorId:access.principal==='workspace_account'?undefined:access.memberId,dd:access});
    const source=await projectPageSource(access.projectId,actor);
    const nativePage=tab==='strategic-resources'?'strategic-resources':null;
    if(!source.edition&&!nativePage)notFound();
    const aliases:Record<string,string>={'execution-plan':'business-development-plan','capital-policy':'capital-plan','monthly-trial':'financial-plan','financial-projection':'financial-plan','cost-model':'unit-economics','poc-list':'poc','market-research':'market','technical-explanation':'technology'};
    const selected=chapter??(tab?aliases[tab]??tab:'source-index');
    const chosen=source.index.find(c=>c.slug===selected)??source.index.find(c=>c.slug==='source-index');if(!chosen&&!nativePage)notFound();
    const runtime=await readProjectPage(access.projectId,nativePage??projectPageForChapter(chosen!.slug),actor,source);
    const releases=source.edition?await loadDdReportReleases(access,source.edition):[];
    await recordDdAccessEvent(access,'dd_package_viewed',{pageKey:nativePage??chosen!.slug,contentHash:nativePage?ddContentHash(runtime.strategicResources):`${source.edition!.source_sha256}:r${source.edition!.revision}`});
    return <DdViewerShell unifiedPage access={access} projectName={access.title} pageKey="company" documentVersion={source.edition?.document_version} releases={releases} reportPageLabel={nativePage?'戦略余力':chosen!.title}><ProjectSurfaceView projectId={access.projectId} projectName={access.title} projectCategory={source.identity.project_category??undefined} surface="dd" slug={slug} external={actor.external} canWorkspace={actor.disclosures.workspace} initialPage={runtime.pageId} initialChapter={nativePage?undefined:chosen!.slug} initialRuntime={runtime}/></DdViewerShell>;
  }
  if (tab === "financial-projection") redirect(`/dd/${encodeURIComponent(access.slug)}${legacy==='1'?'/legacy':''}?tab=monthly-trial`);
  // 認可後、選択された正本ページと監査記録を並行して読む。
  // 旧section URLだけはlive項目からページを解決する互換経路を使う。
  const selectedPage = tab && DD_PAGE_KEYS.includes(tab) ? tab : section ? undefined : "company";
  const [view, initialPage] = await Promise.all([
    loadDdPackageView(access, { mode: selectedPage === "documents" ? "documents" : selectedPage ? "header" : "full" }),
    selectedPage && selectedPage !== "documents" ? loadDdProjectPage(access.projectId, selectedPage, fresh === "1") : Promise.resolve(undefined),
  ]);
  if (!view) notFound();

  const legacyPage = view.sections.find((row) => row.key === section)?.items[0]?.pageKey;
  const pageKey = selectedPage ?? legacyPage ?? "company";
  const snapshot=legacy==='1'&&edition?await loadDdLegacySnapshot(edition):null;
  const snapshotPage=snapshot?.pages[pageKey] as DdLiveProjectPage|undefined;
  const canonicalPage = snapshotPage?await redactDdReport(access.projectId,snapshotPage):initialPage ?? (pageKey === "documents" ? undefined : await loadDdProjectPage(access.projectId, pageKey, fresh === "1"));
  const canEditPocList = legacy!=='1'&&pageKey === "poc-list" && access.principal !== "workspace_account" && hasDdCapability(access, "dd.edit") &&
    (await canEditProjectSurface(access.projectId, "cockpit") || await canEditProjectSurface(access.projectId, "workspace"));

  await recordDdAccessEvent(access, "dd_package_viewed", { pageKey, contentHash: ddContentHash(canonicalPage ?? view.sections) });

  return (
    <DdViewerShell access={access} projectName={legacy==='1'?`${view.projectName} · 旧DDパッケ`:view.projectName} pageKey={pageKey as DdPageKey} legacy={legacy==='1'}>
      <DdPackageTop legacy={legacy==='1'} view={view} slug={access.slug} sectionKey={section} tab={pageKey} canonicalPage={canonicalPage} canEditPocList={canEditPocList} canDownload={hasDdCapability(access, "dd.download")} />
    </DdViewerShell>
  );
}
