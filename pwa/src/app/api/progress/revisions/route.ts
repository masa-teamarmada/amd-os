import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, requireAuth } from "@/lib/supabase/api-auth";
import { syncRewardSummaryForCycle } from "@/lib/reward-summary";

const GAS_BASE_URL = process.env.NEXT_PUBLIC_GAS_WEBAPP_URL || "";
const GAS_API_KEY = process.env.NEXT_PUBLIC_GAS_API_KEY || "";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function wantsGmailExtraction(text: string) {
  return /gmail|メール|mail|先方|やりとり|抽出/i.test(text);
}

function toYmDate(ym: string, fallback?: string | null) {
  if (fallback) {
    const d = new Date(fallback);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01T00:00:00.000Z`;
}

async function collectSourceDataViaGas(
  supabase: ReturnType<typeof getServiceClient>,
  projectId: string,
  ym: string
) {
  if (!GAS_BASE_URL) {
    return { ok: false, message: "GAS_BASE_URL not set", saved: 0 };
  }

  try {
    const url = new URL(GAS_BASE_URL);
    url.searchParams.set("mode", "pwaApi");
    url.searchParams.set("key", GAS_API_KEY);
    url.searchParams.set("action", "collectGmail");
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("ym", ym);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return { ok: false, message: `GAS ${res.status}`, saved: 0 };

    const json = await res.json();
    const activities = json?.data?.activities || json?.activities || {};
    const gmail = activities.gmail || json?.data?.gmail || json?.gmail;
    const threads = Array.isArray(gmail?.threads) ? gmail.threads : [];
    if (!threads.length) {
      return { ok: !!gmail?.success, message: gmail?.note || gmail?.error || "no gmail threads", saved: 0 };
    }

    const rows = threads.map((thread: any) => {
      const itemId = String(thread.thread_id || thread.threadId || thread.id || thread.subject || crypto.randomUUID());
      const preview = String(thread.preview || "");
      const subject = String(thread.subject || "(no subject)");
      const content = [
        `件名: ${subject}`,
        thread.first_message_jst || thread.firstMessageJst ? `最初: ${thread.first_message_jst || thread.firstMessageJst}` : "",
        thread.last_message_jst || thread.lastMessageJst ? `最後: ${thread.last_message_jst || thread.lastMessageJst}` : "",
        thread.from ? `From: ${thread.from}` : "",
        thread.to ? `To: ${thread.to}` : "",
        "",
        preview,
      ].filter(Boolean).join("\n");

      return {
        cache_id: `gas-gmail-${projectId}-${itemId}`,
        project_id: projectId,
        ym,
        source: "gmail",
        item_id: itemId,
        title: subject,
        item_date: toYmDate(ym, thread.last_message_jst || thread.lastMessageJst || thread.first_message_jst || thread.firstMessageJst),
        content_text: content,
        char_count: content.length,
        metadata_json: thread,
        collected_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase
      .from("source_cache")
      .upsert(rows, { onConflict: "project_id,source,item_id" });
    if (error) return { ok: false, message: error.message, saved: 0 };
    return { ok: true, message: `gmail ${rows.length} threads`, saved: rows.length };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error), saved: 0 };
  }
}

function toRevision(row: any, messages: any[]) {
  return {
    id: row.id,
    projectId: row.project_id,
    milestoneId: row.milestone_id,
    ym: row.ym,
    currentPct: row.current_pct == null ? null : Number(row.current_pct),
    currentNote: row.current_note ?? null,
    revisedPct: row.revised_pct == null ? null : Number(row.revised_pct),
    revisedNote: row.revised_note ?? null,
    status: row.status,
    requestedBy: row.requested_by ?? null,
    confirmedBy: row.confirmed_by ?? null,
    confirmedAt: row.confirmed_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    messages: messages.map((m) => ({
      id: m.id,
      revisionId: m.revision_id,
      senderKind: m.sender_kind,
      body: m.body,
      createdAt: m.created_at ?? null,
    })),
  };
}

function parseSuggestionText(text: string, fallbackPct: number) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { revisedPct: fallbackPct, revisedNote: text.trim() };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const pct = Math.max(0, Math.min(100, Number(parsed.revised_pct ?? parsed.revisedPct ?? fallbackPct)));
    const note = String(parsed.revised_note ?? parsed.revisedNote ?? parsed.note ?? "").trim();
    return { revisedPct: pct, revisedNote: note || text.trim() };
  } catch {
    return { revisedPct: fallbackPct, revisedNote: text.trim() };
  }
}

async function suggestRevision(input: {
  milestoneTitle: string;
  currentPct: number;
  currentNote: string;
  requestText: string;
  evidence: string;
}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      revisedPct: input.currentPct > 0 ? input.currentPct : 10,
      revisedNote: `PM修正を反映: ${input.requestText}`,
    };
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 900,
    temperature: 0.2,
    system: [
      "あなたはAMD OSのアシスタントAI「つくよみ」。PMからMS進捗や仕事要約の修正依頼を受け、PMの意図を汲み取った修正提案を返す。",
      "重要: PMの修正依頼は信頼できる一次情報として扱う。単に依頼文を繰り返してはいけない。",
      "重要: 現在メモがMSと無関係だと指摘された場合は、その内容を採用せず、PMが示した正しい業務内容へ置き換える。",
      "重要: 外部データ（例: Gmail）がDB内の根拠に無い場合でも、PMが述べた進行状況は提案に反映し、追加抽出が必要な点をnoteに短く書く。",
      "進捗率は累積0-100%。PMが『進めている』『やりとり中』『着手済み』と言う場合、現在0%なら原則5-20%の範囲で着手進捗を提案する。完了表現がある場合だけ高めにする。",
      "必ずJSONだけを返す。",
    ].join("\n"),
    messages: [{
      role: "user",
      content: [
        `MS: ${input.milestoneTitle}`,
        `現在の累積進捗: ${input.currentPct}%`,
        `現在のメモ: ${input.currentNote || "(なし)"}`,
        `PMからの修正依頼: ${input.requestText}`,
        "",
        `DB内の参考情報:\n${input.evidence || "(該当なし)"}`,
        "",
        "返答形式:",
        "{\"revised_pct\": 0-100の数値, \"revised_note\": \"置き換え後の仕事内容と進捗根拠。必要なら追加抽出事項も1文で含める\"}",
      ].join("\n"),
    }],
  });
  const text = msg.content
    .map((part) => part.type === "text" ? part.text : "")
    .join("")
    .trim();
  return parseSuggestionText(text, input.currentPct);
}

async function buildRevisionEvidence(
  supabase: ReturnType<typeof getServiceClient>,
  projectId: string,
  milestoneId: string,
  ym: string
) {
  const [memberActivitiesRes, msActivitiesRes, sourceCacheRes, reportRes, progressRes] = await Promise.all([
    supabase
      .from("member_activities")
      .select("source, title, content_preview, item_date")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .eq("milestone_id", milestoneId)
      .limit(20),
    supabase
      .from("member_ms_activities")
      .select("member_id, narrative, learned_addendum")
      .eq("milestone_id", milestoneId)
      .eq("ym", ym)
      .limit(20),
    supabase
      .from("source_cache")
      .select("source, item_id, title, item_date, content_text")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .order("item_date", { ascending: false })
      .limit(40),
    supabase
      .from("monthly_reports")
      .select("final_content, draft_content")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .limit(1),
    supabase
      .from("milestone_monthly_progress")
      .select("progress_pct, source, note")
      .eq("milestone_key", milestoneId)
      .lte("ym", ym)
      .order("ym", { ascending: false })
      .limit(5),
  ]);

  const lines: string[] = [];
  for (const a of memberActivitiesRes.data || []) {
    lines.push(`活動(${a.source || "unknown"}): ${a.title || ""} ${a.content_preview || ""}`.trim());
  }
  for (const a of msActivitiesRes.data || []) {
    if (a.narrative) lines.push(`MS活動(${a.member_id}): ${a.narrative}`);
    if (a.learned_addendum) lines.push(`学習(${a.member_id}): ${a.learned_addendum}`);
  }
  for (const s of sourceCacheRes.data || []) {
    lines.push(`Source(${s.source || "unknown"}): ${s.title || ""} ${String(s.content_text || "").slice(0, 800)}`.trim());
  }
  for (const p of progressRes.data || []) {
    lines.push(`既存進捗: ${Number(p.progress_pct || 0)}% source=${p.source || ""} note=${p.note || ""}`);
  }
  const report = reportRes.data?.[0];
  const reportText = String(report?.final_content || report?.draft_content || "").slice(0, 1200);
  if (reportText) lines.push(`月次レポート抜粋: ${reportText}`);
  return lines.join("\n").slice(0, 5000);
}

async function extractActivitiesFromRevision(input: {
  supabase: ReturnType<typeof getServiceClient>;
  projectId: string;
  milestoneId: string;
  ym: string;
  revisionId: string;
  requestText: string;
  revisedNote: string;
  evidence: string;
}) {
  const { supabase, projectId, milestoneId, ym, revisionId, requestText, revisedNote, evidence } = input;
  const { data: respRows } = await supabase
    .from("milestone_responsibility")
    .select("member_id")
    .eq("milestone_id", milestoneId);
  const responsibleIds = [...new Set((respRows || []).map((r) => r.member_id))];

  const { data: projectMemberRows } = await supabase
    .from("project_members")
    .select("member_id")
    .eq("project_id", projectId)
    .eq("is_active", true);
  const memberIds = [...new Set([...(projectMemberRows || []).map((r) => r.member_id), ...responsibleIds])];
  const { data: memberRows } = await supabase
    .from("members")
    .select("member_id, code_name")
    .in("member_id", memberIds.length > 0 ? memberIds : ["__none__"]);
  const members = memberRows || [];
  if (members.length === 0) return [];

  const source = /gmail|メール|mail/i.test(`${requestText}\n${evidence}`) ? "gmail" : "inferred";
  let activities: Array<{ memberId: string; title: string; contentPreview: string; itemDate?: string | null }> = [];

  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      temperature: 0.1,
      system: [
        "あなたはAMD OSの活動抽出器。PMの修正依頼と利用可能な根拠から、member_activitiesに保存する活動レコードを作る。",
        "PMが『きよがGmailで進めている』のように明示した場合、Gmail本文がDBに無くても暫定活動として抽出する。",
        "ただし本文には『Gmail本文未取得』など、根拠の限界を短く含める。",
        "必ずJSONだけを返す。",
      ].join("\n"),
      messages: [{
        role: "user",
        content: [
          `projectId: ${projectId}`,
          `ym: ${ym}`,
          `milestoneId: ${milestoneId}`,
          `メンバー候補: ${members.map((m) => `${m.member_id}:${m.code_name}`).join(", ")}`,
          `PM修正依頼: ${requestText}`,
          `つくよみ修正提案: ${revisedNote}`,
          `根拠:\n${evidence || "(DB内根拠なし)"}`,
          "",
          "返答形式:",
          "{\"activities\":[{\"memberId\":\"候補内のmember_id\",\"title\":\"20字以内\",\"contentPreview\":\"50-120字\",\"itemDate\":null}]}",
        ].join("\n"),
      }],
    });
    const text = res.content.map((part) => part.type === "text" ? part.text : "").join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        activities = Array.isArray(parsed.activities) ? parsed.activities : [];
      } catch {
        activities = [];
      }
    }
  }

  if (activities.length === 0) {
    const requestAndNote = `${requestText}\n${revisedNote}`;
    const explicitMember = members.find((m) => requestAndNote.includes(String(m.code_name || "")))
      || members.find((m) => responsibleIds.includes(m.member_id))
      || members[0];
    activities = [{
      memberId: explicitMember.member_id,
      title: source === "gmail" ? "Gmail進行確認" : "修正依頼反映",
      contentPreview: revisedNote || requestText,
      itemDate: null,
    }];
  }

  const validMemberIds = new Set(members.map((m) => m.member_id));
  const rows = activities
    .filter((a) => validMemberIds.has(a.memberId) && String(a.contentPreview || "").trim())
    .slice(0, 5)
    .map((a, index) => ({
      member_id: a.memberId,
      project_id: projectId,
      ym,
      source,
      source_item_id: `ms-revision-${revisionId}-${index}`,
      milestone_id: milestoneId,
      title: String(a.title || (source === "gmail" ? "Gmail進行確認" : "修正依頼反映")).slice(0, 40),
      content_preview: String(a.contentPreview).slice(0, 240),
      item_date: a.itemDate || null,
      raw_metadata: { revisionId, requestText, extractedBy: "tsukuyomi_revision" },
    }));

  if (rows.length === 0) return [];
  const { data, error } = await supabase
    .from("member_activities")
    .upsert(rows, { onConflict: "member_id,project_id,source,source_item_id" })
    .select("*");
  if (error) {
    console.error("extractActivitiesFromRevision:", error.message);
    return [];
  }
  return (data || []).map((r) => ({
    id: r.id,
    memberId: r.member_id,
    projectId: r.project_id,
    ym: r.ym,
    source: r.source,
    sourceItemId: r.source_item_id,
    milestoneId: r.milestone_id,
    title: r.title,
    contentPreview: r.content_preview,
    itemDate: r.item_date,
    extractedAt: r.extracted_at,
  }));
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const ym = searchParams.get("ym");
  const milestoneId = searchParams.get("milestoneId");
  if (!projectId || !ym) {
    return NextResponse.json({ error: "projectId and ym required" }, { status: 400 });
  }

  const supabase = getServiceClient();
  let query = supabase
    .from("ms_progress_revisions")
    .select("*")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .order("created_at", { ascending: false });
  if (milestoneId) query = query.eq("milestone_id", milestoneId);

  const { data: revisions, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (revisions || []).map((r) => r.id);
  const { data: messages } = ids.length > 0
    ? await supabase
        .from("ms_revision_messages")
        .select("*")
        .in("revision_id", ids)
        .order("created_at", { ascending: true })
    : { data: [] };

  const messagesByRevision = new Map<string, any[]>();
  for (const message of messages || []) {
    const rows = messagesByRevision.get(message.revision_id) || [];
    rows.push(message);
    messagesByRevision.set(message.revision_id, rows);
  }

  return NextResponse.json({
    ok: true,
    revisions: (revisions || []).map((r) => toRevision(r, messagesByRevision.get(r.id) || [])),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json();
  const {
    projectId,
    milestoneId,
    ym,
    requestText,
    currentPct = 0,
    currentNote = "",
    milestoneTitle = milestoneId,
    revisionId,
  } = body;
  if (!projectId || !milestoneId || !ym || !String(requestText || "").trim()) {
    return NextResponse.json({ error: "projectId, milestoneId, ym and requestText required" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const request = String(requestText).trim();
  const collection = wantsGmailExtraction(request)
    ? await collectSourceDataViaGas(supabase, projectId, ym)
    : { ok: false, message: "skipped", saved: 0 };
  const evidence = await buildRevisionEvidence(supabase, projectId, milestoneId, ym);
  const suggestion = await suggestRevision({
    milestoneTitle: String(milestoneTitle || milestoneId),
    currentPct: Math.max(0, Math.min(100, Number(currentPct || 0))),
    currentNote: String(currentNote || ""),
    requestText: request,
    evidence,
  });

  const revisionPayload = {
    project_id: projectId,
    milestone_id: milestoneId,
    ym,
    current_pct: Math.max(0, Math.min(100, Number(currentPct || 0))),
    current_note: String(currentNote || ""),
    revised_pct: suggestion.revisedPct,
    revised_note: suggestion.revisedNote,
    status: "pending",
    requested_by: auth.user.email,
  };

  const { data: revision, error: revisionError } = revisionId
    ? await supabase
        .from("ms_progress_revisions")
        .update(revisionPayload)
        .eq("id", revisionId)
        .select()
        .single()
    : await supabase
        .from("ms_progress_revisions")
        .insert(revisionPayload)
        .select()
        .single();

  if (revisionError) return NextResponse.json({ error: revisionError.message }, { status: 500 });

  await supabase.from("ms_revision_messages").insert([
    { revision_id: revision.id, sender_kind: "pm", body: request },
    { revision_id: revision.id, sender_kind: "tsukuyomi", body: suggestion.revisedNote },
  ]);

  const extractedActivities = await extractActivitiesFromRevision({
    supabase,
    projectId,
    milestoneId,
    ym,
    revisionId: revision.id,
    requestText: request,
    revisedNote: suggestion.revisedNote,
    evidence,
  });

  await supabase.from("tsukuyomi_learnings").insert({
    scope: "msActivity",
    scope_key: projectId,
    content: `MS修正依頼: ${request}`,
    source: "ms_revision_request",
    source_ref: revision.id,
    created_by: auth.user.email,
  });

  return NextResponse.json({
    ok: true,
    revisionId: revision.id,
    activities: extractedActivities,
    collection,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { revisionId, action } = await req.json();
  if (!revisionId || !["confirm", "discard"].includes(action)) {
    return NextResponse.json({ error: "revisionId and action required" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const now = new Date().toISOString();

  if (action === "discard") {
    const { error } = await supabase
      .from("ms_progress_revisions")
      .update({ status: "discarded", confirmed_by: auth.user.email, confirmed_at: now })
      .eq("id", revisionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { data: revision, error: revisionError } = await supabase
    .from("ms_progress_revisions")
    .select("*")
    .eq("id", revisionId)
    .single();
  if (revisionError || !revision) {
    return NextResponse.json({ error: revisionError?.message || "revision not found" }, { status: 404 });
  }

  const { data: msRows } = await supabase
    .from("value_milestones")
    .select("points")
    .eq("milestone_id", revision.milestone_id)
    .limit(1);
  const points = Number(msRows?.[0]?.points || 0);
  const revisedPct = Math.max(0, Math.min(100, Number(revision.revised_pct || 0)));
  const consumedPt = Math.round(points * revisedPct / 100 * 100) / 100;
  const revisedNote = String(revision.revised_note || "");

  const { error: progressError } = await supabase
    .from("milestone_monthly_progress")
    .upsert(
      {
        milestone_key: revision.milestone_id,
        ym: revision.ym,
        progress_pct: revisedPct,
        consumed_pt: consumedPt,
        source: "tsukuyomi_revision",
        confirmed_at: now,
        note: revisedNote,
      },
      { onConflict: "milestone_key,ym" }
    );
  if (progressError) return NextResponse.json({ error: progressError.message }, { status: 500 });

  await supabase
    .from("ms_progress_revisions")
    .update({ status: "confirmed", confirmed_by: auth.user.email, confirmed_at: now })
    .eq("id", revisionId);

  await supabase.from("tsukuyomi_learnings").insert({
    scope: "msActivity",
    scope_key: revision.project_id,
    content: revisedNote || `MS ${revision.milestone_id} の修正提案を採用`,
    source: "ms_revision_confirmed",
    source_ref: revision.id,
    created_by: auth.user.email,
  });

  const { data: respRows } = await supabase
    .from("milestone_responsibility")
    .select("member_id")
    .eq("milestone_id", revision.milestone_id);
  for (const resp of respRows || []) {
    const { data: existing } = await supabase
      .from("member_ms_activities")
      .select("learned_addendum")
      .eq("member_id", resp.member_id)
      .eq("milestone_id", revision.milestone_id)
      .eq("ym", revision.ym)
      .maybeSingle();
    const current = String(existing?.learned_addendum || "").trim();
    const addendum = `つくよみ修正学習: ${revisedNote}`.trim();
    await supabase
      .from("member_ms_activities")
      .upsert(
        {
          member_id: resp.member_id,
          milestone_id: revision.milestone_id,
          ym: revision.ym,
          learned_addendum: current ? `${current}\n${addendum}` : addendum,
          generated_at: now,
        },
        { onConflict: "member_id,milestone_id,ym" }
      );
  }

  let rewardSummary: unknown = null;
  let rewardSyncError: string | null = null;
  try {
    const result = await syncRewardSummaryForCycle(supabase, revision.project_id, revision.ym);
    rewardSummary = result.rewardSummary;
  } catch (err) {
    rewardSyncError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    ok: true,
    progress: {
      milestoneKey: revision.milestone_id,
      ym: revision.ym,
      progressPct: revisedPct,
      consumedPt,
      source: "tsukuyomi_revision",
      note: revisedNote,
    },
    rewardSummary,
    rewardSyncError,
  });
}
