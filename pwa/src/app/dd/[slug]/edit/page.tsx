import { requireDdPageSession } from "@/lib/dd-page-session";
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {resolveDdPackageAccess} from '@/lib/dd-access';
import {hasDdCapability, isDdSlug} from '@/lib/dd-package-core';
import {DdProjectTab} from '@/components/dd/DdProjectTab';
export default async function DdEditPage({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params;
 if (!isDdSlug(slug)) notFound();
 await requireDdPageSession(`/dd/${encodeURIComponent(slug)}/edit`);
 const access=await resolveDdPackageAccess(slug);
 if (!access) notFound();
 if (!hasDdCapability(access,"dd.edit")) notFound();
 return <main className="min-w-0 p-4"><div className="mb-3 flex flex-wrap items-center gap-3"><h1 className="text-lg font-semibold">DD掲載項目の編集</h1><Link className="text-sm text-primary underline" href={`/dd/${encodeURIComponent(slug)}`}>DDパッケージへ戻る</Link></div><DdProjectTab projectId={access.projectId} endpoint={`/api/dd/${encodeURIComponent(slug)}/edit`} contentOnly /></main>;
}
