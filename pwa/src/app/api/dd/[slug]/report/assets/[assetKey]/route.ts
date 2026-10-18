import {NextResponse} from 'next/server';
import {resolveDdPackageAccess} from '@/lib/dd-access';
import {ddReportAsset,loadDdReportEdition} from '@/lib/dd-report-server';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{slug:string;assetKey:string}>}) {
  const {slug,assetKey}=await params,access=await resolveDdPackageAccess(slug);if(!access)return new NextResponse(null,{status:404});
  const edition=await loadDdReportEdition(access);if(!edition)return new NextResponse(null,{status:404});
  if(!/^[a-f0-9]{64}\.(png|jpg|jpeg|webp|svg)$/.test(assetKey))return new NextResponse(null,{status:404});
  const asset=await ddReportAsset(edition.id,assetKey);if(!asset)return new NextResponse(null,{status:404});
  return new NextResponse(new Uint8Array(asset.bytes),{headers:{'Content-Type':asset.meta.mime_type,'Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox",'X-Content-Type-Options':'nosniff'}});
}
