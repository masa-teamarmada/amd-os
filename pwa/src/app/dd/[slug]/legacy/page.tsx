import DdPackagePage from '../page';
import {resolveDdPackageAccess} from '@/lib/dd-access';
import {requireDdPageSession} from '@/lib/dd-page-session';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function LegacyDdPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{tab?:string;section?:string;returnTo?:string}>}) {
  const {slug}=await params;
  await requireDdPageSession(`/dd/${encodeURIComponent(slug)}/legacy`);
  const access=await resolveDdPackageAccess(slug,{requireNdaConfirmation:false});if (!access) notFound();
  return DdPackagePage({params,searchParams:searchParams.then(query=>({...query,legacy:'1'}))});
}
