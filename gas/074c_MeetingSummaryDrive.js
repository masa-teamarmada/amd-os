/**
 * 074c_MeetingSummaryDrive.js
 *
 * Drive 議事録ファイル (Google Docs 中心) を MTG サマリに変換して
 * project_meeting_summaries に upsert する backfill 関数群。
 *
 * 074b (Slack) と同じ pattern:
 *  - 各 continue ポイントで items.push して可視化
 *  - 例外は握り潰さず error を items に含める
 *  - system prompt は llm_prompts.meeting_extract.drive から取得 (AGENTS ルール)
 *
 * PJ folder = projects.drive_folder_id。
 * meeting_id = "drive-{fileId}" 形式。
 *
 * 議事録ファイルの identify 基準:
 *  - mimeType = application/vnd.google-apps.document (Google Docs) のみ (本実装)
 *  - ファイル名に「議事録 / meeting / 打ち合わせ / 定例 / MTG / kickoff / 報告会 / 検討会」を含む
 *  - 更新日 (modifiedTime) が指定期間内
 *
 * 公開関数:
 *  - nav_meeting_extractDriveForProjectYm_(projectId, ym, opts)
 *  - nav_meeting_backfillDriveAllActive_(opts)
 */

/** Drive Docs かどうか */
function _meeting_drive_isMinuteLikeFile_(file) {
  if (!file) return false;
  try {
    if (file.getMimeType() !== "application/vnd.google-apps.document") return false;
    const name = String(file.getName() || "");
    const re = /(議事録|meeting|打.合わせ|打合せ|定例|MTG|kickoff|キックオフ|報告会|検討会|分科会)/i;
    return re.test(name);
  } catch (e) { return false; }
}

/** Drive folder 配下を再帰せず直下のみ scan (= 過剰 fetch 防止)、modifiedTime で filter */
function _meeting_drive_listMinuteFiles_(folderId, startDate, endDate) {
  if (!folderId) return { files: [], err: "no_folder_id" };
  let folder = null;
  try { folder = DriveApp.getFolderById(folderId); } catch (e) { return { files: [], err: "folder_404: " + String(e).slice(0, 120) }; }
  const out = [];
  try {
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      if (!_meeting_drive_isMinuteLikeFile_(f)) continue;
      const mod = f.getLastUpdated();
      if (mod < startDate || mod > endDate) continue;
      out.push({
        fileId: f.getId(),
        name: f.getName(),
        url: f.getUrl(),
        modifiedAt: mod.toISOString(),
      });
    }
  } catch (e) { return { files: out, err: "list_throw: " + String(e).slice(0, 120) }; }
  return { files: out, err: null };
}

/** Google Docs 本文を text として取得 (= 80KB 上限で切る) */
function _meeting_drive_loadDocBody_(fileId) {
  try {
    const doc = DocumentApp.openById(fileId);
    const text = doc.getBody().getText() || "";
    return { ok: true, text: text.slice(0, 80000) };
  } catch (e) {
    return { ok: false, text: "", error: "doc_open: " + String(e).slice(0, 120) };
  }
}

/** llm_prompts から prompt body を取得 (= AGENTS ルール) */
function _meeting_loadSystemPrompt_(promptKey) {
  try {
    const pRes = supa_select("llm_prompts", {
      select: "body,is_active",
      filter: "prompt_key=eq." + encodeURIComponent(promptKey) + "&is_active=eq.true",
      limit: 1,
    });
    if (pRes && pRes.ok && pRes.rows && pRes.rows.length > 0 && pRes.rows[0].body) {
      return String(pRes.rows[0].body || "");
    }
  } catch (e) { /* fall through */ }
  return "";
}

/** PJ の drive_folder_id を Supabase から取得 */
function _meeting_getProjectDriveFolder_(projectId) {
  try {
    const r = supa_select("projects", {
      select: "drive_folder_id",
      filter: "project_id=eq." + encodeURIComponent(projectId),
      limit: 1,
    });
    if (r && r.ok && r.rows && r.rows.length > 0) {
      return String(r.rows[0].drive_folder_id || "").trim();
    }
  } catch (e) { /* skip */ }
  return "";
}

function nav_meeting_extractDriveForProjectYm_(projectId, ym, opts) {
  projectId = String(projectId || "").trim();
  ym = String(ym || "").trim();
  if (!projectId || !/^\d{6}$/.test(ym)) return { ok: false, message: "projectId/ym invalid" };
  opts = opts || {};

  const folderId = _meeting_getProjectDriveFolder_(projectId);
  if (!folderId) return { ok: true, action: "no_drive_folder", projectId: projectId, ym: ym, saved: 0 };

  const systemPrompt = _meeting_loadSystemPrompt_("meeting_extract.drive");
  if (!systemPrompt) {
    return { ok: false, action: "missing_prompt", projectId: projectId, ym: ym, saved: 0,
             message: "llm_prompts.meeting_extract.drive (is_active=TRUE) が空" };
  }

  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  const ymStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const ymEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59));

  const scan = _meeting_drive_listMinuteFiles_(folderId, ymStart, ymEnd);
  if (scan.files.length === 0) {
    return { ok: true, action: scan.err ? "list_err" : "no_files", projectId: projectId, ym: ym,
             folder_id: folderId, saved: 0, scan_err: scan.err };
  }

  let existing = {};
  try {
    existing = (typeof _meeting_loadExistingForProjectYm_ === "function")
      ? (_meeting_loadExistingForProjectYm_(projectId, ym) || {}) : {};
  } catch (_e) { existing = {}; }
  const existingCount = Object.keys(existing).length;

  const maxLlmCalls = Number(opts.maxLlmCalls || 4);
  let saved = 0;
  let llmCalls = 0;
  const items = [];

  for (const f of scan.files) {
    if (llmCalls >= maxLlmCalls) { items.push({ action: "stop_max_llm_reached" }); break; }
    const meetingId = "drive-" + f.fileId;
    if (existing[meetingId]) { items.push({ meetingId: meetingId, action: "skipped_existing" }); continue; }

    const body = _meeting_drive_loadDocBody_(f.fileId);
    if (!body.ok || body.text.trim().length < 80) {
      items.push({ meetingId: meetingId, action: "skipped_short_or_unreadable", message: body.error || "body<80" });
      continue;
    }

    const aliasBlock = (typeof nameAlias_buildBlock === "function") ? nameAlias_buildBlock() : "";
    const userPrompt = "project_id: " + projectId + " / ym: " + ym + "\n" +
      "drive_file: " + f.name + " (updated " + f.modifiedAt + ")\n\n" +
      (aliasBlock ? aliasBlock + "\n\n" : "") +
      "# Drive doc body:\n" + body.text.slice(0, 16000);

    let parsed = null;
    try {
      parsed = llm_callJson("meeting_extract", systemPrompt, userPrompt, { maxTokens: 1800, temperature: 0.2 });
      llmCalls++;
    } catch (e) { items.push({ meetingId: meetingId, action: "llm_err", message: String(e).slice(0, 200) }); continue; }
    if (!parsed || typeof parsed !== "object") { items.push({ meetingId: meetingId, action: "llm_parse_failed" }); continue; }
    if (!parsed.title || String(parsed.title).trim() === "") { items.push({ meetingId: meetingId, action: "skipped_chitchat" }); continue; }

    try {
      const meetingDate = f.modifiedAt.slice(0, 10);
      const up = supa_upsert("project_meeting_summaries", {
        meeting_id: meetingId,
        project_id: projectId,
        ym: ym,
        meeting_date: meetingDate,
        title: String(parsed.title || "").slice(0, 200),
        summary_short: String(parsed.summary_short || "").slice(0, 2000),
        decided: Array.isArray(parsed.decided) ? parsed.decided.slice(0, 20).map(String) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 20).map(String) : [],
        next_actions: Array.isArray(parsed.next_actions) ? parsed.next_actions.slice(0, 20).map(String) : [],
        source_kinds: "drive",
        source_url: f.url,
        updated_at: new Date().toISOString(),
      }, "meeting_id");
      if (up.ok) { saved++; items.push({ meetingId: meetingId, action: "saved", title: String(parsed.title).slice(0, 60) }); }
      else { items.push({ meetingId: meetingId, action: "upsert_err", status: up.status, message: String(up.body || "").slice(0, 200) }); }
    } catch (e) { items.push({ meetingId: meetingId, action: "upsert_throw", message: String(e).slice(0, 200) }); }
  }
  return { ok: true, projectId: projectId, ym: ym, folder_id: folderId,
           files_found: scan.files.length, existing_count: existingCount,
           saved: saved, llm_calls: llmCalls, scan_err: scan.err, items: items.slice(0, 40) };
}

function nav_meeting_backfillDriveAllActive_(opts) {
  opts = opts || {};
  const monthsBack = Number(opts.monthsBack || 6);
  const maxLlmCallsPerRun = Number(opts.maxLlmCallsPerRun || 24);
  const maxLlmPerCall = Number(opts.maxLlmPerCall || 3);
  const projRes = supa_select("projects", { select: "project_id,status", filter: "status=in.(active,sales)" });
  const projects = projRes.ok ? (projRes.rows || []) : [];
  const yms = [];
  const now = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    yms.push(String(d.getFullYear()) + ("0" + String(d.getMonth() + 1)).slice(-2));
  }
  const summary = [];
  let totalSaved = 0;
  let llmTotal = 0;
  for (const pj of projects) {
    if (llmTotal >= maxLlmCallsPerRun) break;
    for (const ym of yms) {
      if (llmTotal >= maxLlmCallsPerRun) break;
      try {
        const r = nav_meeting_extractDriveForProjectYm_(pj.project_id, ym, { maxLlmCalls: maxLlmPerCall });
        if (r && r.saved) totalSaved += r.saved;
        if (r && r.llm_calls) llmTotal += r.llm_calls;
        summary.push({ pj: pj.project_id, ym: ym, saved: r.saved || 0, files: r.files_found || 0,
                       existing: r.existing_count == null ? null : r.existing_count, action: r.action || "ok" });
      } catch (e) { summary.push({ pj: pj.project_id, ym: ym, error: String(e).slice(0, 200) }); }
    }
  }
  return { ok: true, projects: projects.length, months_back: monthsBack,
           total_saved: totalSaved, llm_calls: llmTotal, summary: summary };
}
