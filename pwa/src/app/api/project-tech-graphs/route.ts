import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";
import { requireProjectContentEditor } from "@/lib/project-surface-access";
import { amieReadEffluentExperiment } from "@/lib/amie-effluent-experiments";

export const runtime = "nodejs";
const BUCKET = "project-tech-graphs";
const MAX_BYTES = 8 * 1024 * 1024;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

/** 原画像はDD/sharedの権限で取得できない。社内memberの行閲覧権限を毎回確認。 */
export async function GET(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;
  const id = req.nextUrl.searchParams.get("entryId");
  const index = Number(req.nextUrl.searchParams.get("index"));
  if (!id || !Number.isInteger(index) || index < 0 || index >= 12) return NextResponse.json({error:"invalid_graph"},{status:400});
  const { data: row, error } = await auth.supabase.from("project_tech_entries").select("project_id,tech_entry_id,experiment").eq("tech_entry_id",id).maybeSingle();
  const graph = amieReadEffluentExperiment(row?.experiment)?.graphs[index];
  if (error || !row || !graph || !graph.path.startsWith(`${row.project_id}/${row.tech_entry_id}/`)) return NextResponse.json({error:"Not found"},{status:404});
  const signed = await createAdminClient().storage.from(BUCKET).createSignedUrl(graph.path,60);
  if (signed.error || !signed.data?.signedUrl) return NextResponse.json({error:"画像の読込みに失敗"},{status:500});
  return NextResponse.redirect(signed.data.signedUrl,{status:302,headers});
}

export async function POST(req: NextRequest) {
  const member = await requireMember();
  if (!member.ok) return member.errorResponse;
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) return NextResponse.json({ok:false,error:"画像は8MB以下で保存して"},{status:413});
  const form = await req.formData().catch(()=>null);
  const id = form?.get("entryId");
  if (typeof id !== "string") return NextResponse.json({ok:false,error:"廃液の指定が必要"},{status:400});
  const db = createAdminClient();
  const { data: row } = await db.from("project_tech_entries").select("project_id,tech_entry_id,experiment,source_ref,updated_at").eq("tech_entry_id",id).maybeSingle();
  if (!row) return NextResponse.json({ok:false,error:"Not found"},{status:404});
  const auth = await requireProjectContentEditor(req,row.project_id);
  if (!auth.ok) return auth.errorResponse;
  const experiment = amieReadEffluentExperiment(row.experiment);
  if (!experiment) return NextResponse.json({ok:false,error:"廃液実験の行へ保存して"},{status:400});
  if (experiment.graphs.length >= 12) return NextResponse.json({ok:false,error:"グラフは1行に12枚まで"},{status:400});
  const file = form?.get("file"), caption = String(form?.get("caption") ?? "").trim(), source = String(form?.get("source") ?? row.source_ref ?? "").trim();
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES || !caption || caption.length > 500 || !source || source.length > 4000) return NextResponse.json({ok:false,error:"8MB以下の画像、図の説明と出典が必要"},{status:400});
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png" : bytes[0]===255 && bytes[1]===216 && bytes[2]===255 ? "image/jpeg" : bytes.toString("ascii",0,4)==="RIFF" && bytes.toString("ascii",8,12)==="WEBP" ? "image/webp" : null;
  if (!mime || mime !== file.type) return NextResponse.json({ok:false,error:"PNG・JPEG・WebPの画像を選んで"},{status:400});
  const extension = mime==="image/png" ? "png" : mime==="image/jpeg" ? "jpg" : "webp";
  const path = `${row.project_id}/${row.tech_entry_id}/${createHash("sha256").update(bytes).digest("hex")}.${extension}`;
  if (experiment.graphs.some(g=>g.path===path)) return NextResponse.json({ok:true,duplicate:true},{headers});
  const upload = await db.storage.from(BUCKET).upload(path,bytes,{contentType:mime,upsert:false});
  if (upload.error && !/already exists|Duplicate/i.test(upload.error.message)) return NextResponse.json({ok:false,error:"画像の保存に失敗"},{status:500});
  const update = await db.from("project_tech_entries").update({experiment:{...experiment,graphs:[...experiment.graphs,{path,caption,source_ref:source}]},updated_at:new Date().toISOString(),updated_by:auth.user.email}).eq("tech_entry_id",id).eq("updated_at",row.updated_at).select("tech_entry_id").maybeSingle();
  if (update.error || !update.data) return NextResponse.json({ok:false,error:"別の更新が入った。最新の行を開いてもう一度保存して"},{status:409});
  return NextResponse.json({ok:true},{headers});
}
