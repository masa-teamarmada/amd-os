/**
 * send-payout-notice
 * 支払通知書を「メンバーごと（複数PJを1枚にまとめる）」で生成・送付する Edge Function。
 *
 * リクエスト: { memberId: string, ym: string, mode?: "preview" | "send" }
 *
 * mode="preview":
 *   そのメンバー × ym の全PJ配賦を集約してPDFを生成し、URLを返す（メールは送らない）。
 *   PDF はGASの一時フォルダに置かれ、24h or 同一member×ymの新規生成時に自動削除される。
 *
 * mode="send" (default):
 *   PDFを恒久フォルダに保存し、メンバーにメール添付で送付。
 *   payout_notices に sent_at を記録し、当該メンバーが配賦されてる全PJの
 *   billing_cycles.payout_notice_uploaded_at も更新（Step 6 完了マーク）。
 *
 * Required secrets: GAS_MAIN_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional secrets: GAS_API_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

type Mode = "preview" | "send";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      memberId?: string;
      ym?: string;
      mode?: Mode;
    };

    const memberId = String(body.memberId || "").trim();
    const ym       = String(body.ym       || "").trim();
    const reqMode: Mode = (body.mode === "preview") ? "preview" : "send";

    if (!memberId) return json({ ok: false, message: "memberId が必要" }, 400);
    if (!/^\d{6}$/.test(ym)) return json({ ok: false, message: "ym invalid（yyyymm）" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const gasMainUrl  = Deno.env.get("GAS_MAIN_URL");
    const gasApiKey   = Deno.env.get("GAS_API_KEY") ?? "";

    if (!gasMainUrl) {
      return json({ ok: false, message: "GAS_MAIN_URL が未設定" }, 500);
    }

    const db = createClient(supabaseUrl, serviceKey);

    type CycleRow = {
      project_id: string;
      ym: string;
      member_allocations_json: Record<string, number> | null;
    };
    const { data: cycles, error: cycleErr } = await db
      .from("billing_cycles")
      .select("project_id, ym, member_allocations_json")
      .eq("ym", ym);

    if (cycleErr) {
      return json({ ok: false, message: `billing_cycles 取得失敗: ${cycleErr.message}` }, 500);
    }

    const memberCycles: { projectId: string; yen: number }[] = [];
    for (const c of (cycles ?? []) as CycleRow[]) {
      const yen = Number(c.member_allocations_json?.[memberId] ?? 0);
      if (!yen || yen <= 0) continue;
      memberCycles.push({ projectId: c.project_id, yen });
    }

    if (memberCycles.length === 0) {
      return json({ ok: false, message: "このメンバーの当月配賦が見つかりません" }, 400);
    }

    const projectIds = memberCycles.map((c) => c.projectId);
    const { data: projects } = await db
      .from("projects")
      .select("project_id, project_name")
      .in("project_id", projectIds);

    const projectNameMap: Record<string, string> = {};
    for (const p of (projects ?? [])) {
      projectNameMap[p.project_id] = p.project_name ?? p.project_id;
    }

    // 明細の表示名は「<PJ名> <稼働月>月稼働分」に統一
    const ymMonth = parseInt(ym.slice(4, 6), 10);
    const breakdown = memberCycles
      .map((c) => ({
        projectName: `${projectNameMap[c.projectId] ?? c.projectId} ${ymMonth}月稼働分`,
        yen:         Math.round(c.yen),
      }))
      .sort((a, b) => a.projectName.localeCompare(b.projectName, "ja"));

    // 通知書番号: 「PN{ym}-{3桁通し番号}」
    // - 既に (memberId, ym) で通知書を作ってたら同じ番号を使い回す（再送付対応）
    // - 新規なら「その ym で発行されてる通知書数 + 1」を 3桁ゼロ埋め
    let noticeNo: string;
    {
      const { data: existingForMember } = await db
        .from("payout_notices")
        .select("notice_no")
        .eq("member_id", memberId)
        .eq("ym", ym)
        .maybeSingle();
      if (existingForMember?.notice_no) {
        noticeNo = existingForMember.notice_no;
      } else {
        const { count } = await db
          .from("payout_notices")
          .select("*", { count: "exact", head: true })
          .eq("ym", ym);
        const seq = (count ?? 0) + 1;
        noticeNo = `PN${ym}-${String(seq).padStart(3, "0")}`;
      }
    }

    // GAS pwaApi を呼んで PDF 生成
    // GAS 側 doGet ルーティングが params.mode = "pwaApi" を見るため、
    // このアクション用の preview/send は別キー "previewOrSend" で渡す。
    const gasParams = new URLSearchParams({
      mode:          "pwaApi",
      action:        "generatePayoutNoticeForMember",
      memberId,
      ym,
      breakdownJson: JSON.stringify(breakdown),
      previewOrSend: reqMode,
      noticeNo,
    });
    if (gasApiKey) gasParams.set("key", gasApiKey);

    let gasJson: { ok: boolean; data?: any; error?: string };
    try {
      const gasRes = await fetch(`${gasMainUrl}?${gasParams.toString()}`, {
        method:   "GET",
        redirect: "follow",
      });
      if (!gasRes.ok) {
        return json({ ok: false, message: `GAS HTTP ${gasRes.status}` }, 502);
      }
      gasJson = await gasRes.json();
    } catch (e) {
      return json({ ok: false, message: `GAS 呼び出し失敗: ${(e as Error).message}` }, 502);
    }

    if (!gasJson.ok || !gasJson.data?.ok) {
      return json({
        ok:      false,
        message: gasJson.error ?? gasJson.data?.message ?? "GAS エラー",
      }, 500);
    }

    const result = gasJson.data as {
      pdfUrl:       string;
      pdfBase64?:   string;
      noticeNo:     string;
      payeeName:    string;
      sentTo?:      string;
      issuedAtJst?: string;
      totalYen:     number;
    };

    // send モードのみ：DBに送付済を記録
    if (reqMode === "send") {
      const sentAt = new Date().toISOString();
      await db
        .from("payout_notices")
        .upsert({
          member_id: memberId,
          ym,
          sent_at:   sentAt,
          notice_no: result.noticeNo,
          pdf_url:   result.pdfUrl,
          total_yen: result.totalYen,
        }, { onConflict: "member_id,ym" });

      // このメンバーが配賦されているPJの payout_notice_uploaded_at を埋める
      // ルール：当該PJの全配賦メンバーが payout_notices に揃ったらPJ単位完了をマーク
      const { data: sentRows } = await db
        .from("payout_notices")
        .select("member_id")
        .eq("ym", ym);
      const sentSet = new Set((sentRows ?? []).map((r) => r.member_id));

      for (const c of (cycles ?? []) as CycleRow[]) {
        const allocMembers = Object.entries(c.member_allocations_json ?? {})
          .filter(([_, yen]) => Number(yen) > 0)
          .map(([mid]) => mid);
        if (allocMembers.length === 0) continue;
        if (allocMembers.every((mid) => sentSet.has(mid))) {
          await db
            .from("billing_cycles")
            .update({ payout_notice_uploaded_at: sentAt })
            .eq("project_id", c.project_id)
            .eq("ym", ym);
        }
      }
    }

    return json({
      ok:        true,
      mode:      reqMode,
      memberId,
      payeeName: result.payeeName,
      pdfUrl:    result.pdfUrl,
      pdfBase64: result.pdfBase64 ?? "",
      noticeNo:  result.noticeNo,
      sentTo:    result.sentTo ?? "",
      totalYen:  result.totalYen,
      breakdown,
      message:   reqMode === "preview"
        ? `プレビューPDFを生成しました（${result.payeeName}）`
        : `${result.payeeName} に送付しました`,
    });
  } catch (e) {
    return json({ ok: false, message: String((e as Error).message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
