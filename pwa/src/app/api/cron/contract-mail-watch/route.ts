import {NextRequest,NextResponse} from 'next/server';
import {scanContractMail,dispatchWorkflowAlerts} from '@/lib/contract-mail-watch';
export const runtime='nodejs';export const maxDuration=240;
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({ok:false,error:'unauthorized'},{status:401});
 const deadline=Date.now()+210_000;
 const dryRun=req.nextUrl.searchParams.get('dryRun')==='1';
 let scan:unknown;let scanError:string|null=null;
 try{scan=await scanContractMail(dryRun);}catch(e){scanError=e instanceof Error?e.message:'メール監視を確認が必要';}
 try{const delivery=await dispatchWorkflowAlerts(dryRun,deadline);return NextResponse.json({ok:!scanError,scan,scanError,delivery},{status:scanError?503:200});}catch{return NextResponse.json({ok:false,scan,scanError,error:'Slackの配信を確認が必要'},{status:503});}
}
