/** 155_L2KnowledgeExtractor.gs — Phase 4 L2 ⑤④② 毎時 polling 抽出
 *
 * 仕様正本:
 *   pwa/design/member_knowledge.md  (⑤)
 *   pwa/design/project_knowledge.md (④)
 *   pwa/design/amd_protocol.md      (②)
 *
 * ─────────────────────────────────────────────
 * このファイルが扱う 3 つの L2
 * ─────────────────────────────────────────────
 * ⑤ member_knowledge   — 各メンバーの強み/性格/コミュニケーション/関心 等を Supabase に upsert
 * ④ project_knowledge  — 各 PJ の人物/技術/IP/組織/資金/市場/競合/戦略/用語 を upsert
 * ② protocols          — 各 PJ の経営判断 (分岐点/判断材料/アクション/結果・学習) を upsert
 *
 * ─────────────────────────────────────────────
 * 入力ソース (本 Phase = "二次集約" 版、5 生データ直結は将来の Phase 4.x 改善案)
 * ─────────────────────────────────────────────
 * ⑤ member: member_activities (直近 90 日) + projects に紐づく project_meeting_summaries
 * ④ project: 当月 + 前月の monthly_reports + project_meeting_summaries (decided/progress/next_actions)
 * ② protocol: 当月 + 前月の project_meeting_summaries (decided 中心) + monthly_reports
 *
 * source_hash 差分検知 + l2_extract_state (PK: l2_kind, target_id, scope_key) で
 * 同じ入力なら LLM 呼ばずスキップ。
 *
 * ─────────────────────────────────────────────
 * 動作 (毎時 0 分 / 15 分 / 30 分 trigger)
 * ─────────────────────────────────────────────
 * 1. setup: 一度だけ `nav_l2_setupAllL2HourlyTriggers_` を実行
 *    → 3 trigger (member 0分, project 15分, protocol 30分) が作られる
 * 2. 各時刻に対応する pollAll が呼ばれる
 *    a) target list 構築
 *    b) l2_extract_state.last_processed_at 古い順 (NULL 優先) sort
 *    c) maxItems で打ち切り、LLM 呼び出し → upsert → state upsert
 *
 * ─────────────────────────────────────────────
 * 依存
 * ─────────────────────────────────────────────
 * - 163_LlmRouter.js: llm_callJson("default", systemPrompt, userPrompt)
 *     (Gemini Flash を使う想定。プロトコル別 usageKey は将来追加可能)
 * - 180_SupabaseClient.js: supa_upsert / supa_select
 *
 * ScriptProperties: SUPABASE_URL / SUPABASE_SERVICE_KEY / GEMINI_API_KEY (既設定)
 */

// ============================================================
// 公開関数 ─ ⑤ member_knowledge
// ============================================================

/** アクティブメンバー全員 × global を target に毎時 polling
 *  @param {Object} [opts] {maxItems?: number, force?: boolean}
 */
function nav_member_knowledge_pollAll(opts) {
  opts = opts || {};
  const maxItems = Number(opts.maxItems || 5);
  const force = !!opts.force;

  // 1) アクティブメンバー取得
  const memRes = supa_select("members", {
    select: "code_name,member_id,status",
    filter: "status=eq.active",
    limit: 100
  });
  if (!memRes.ok) return { ok: false, message: "members select failed", body: memRes.body };
  const members = (memRes.rows || []).filter(function (m) { return String(m.code_name || "").trim(); });
  if (!members.length) return { ok: true, message: "no active members", processed: 0 };

  // 2) state map 取得 (member_knowledge / scope='global')
  const stateMap = _l2_loadStateMap_("member_knowledge", members.map(function (m) { return m.code_name; }), ["global"]);

  // 3) sort by last_processed_at (NULL 優先 = 古い順)
  const targets = members.map(function (m) {
    const k = m.code_name + "|global";
    const st = stateMap[k];
    return {
      codeName: m.code_name,
      memberId: m.member_id,
      lastProcessedAt: st ? st.last_processed_at : null
    };
  });
  targets.sort(function (a, b) {
    const av = a.lastProcessedAt ? new Date(a.lastProcessedAt).getTime() : 0;
    const bv = b.lastProcessedAt ? new Date(b.lastProcessedAt).getTime() : 0;
    return av - bv;
  });

  // 4) loop
  const items = [];
  let llmCalls = 0, processed = 0, unchanged = 0, errors = 0, hasMore = false;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (llmCalls >= maxItems) { hasMore = true; items.push({ codeName: t.codeName, action: "deferred_maxItems" }); continue; }
    let r;
    try {
      r = nav_member_knowledge_extractOne_(t.codeName, t.memberId, { force: force });
    } catch (e) {
      r = { ok: false, message: String(e && e.message ? e.message : e) };
    }
    if (r && r.ok) {
      if (r.unchanged) unchanged++;
      else llmCalls++;
      processed++;
      items.push({ codeName: t.codeName, action: r.action || (r.unchanged ? "unchanged" : "saved"), saved: r.saved || 0 });
    } else {
      errors++;
      items.push({ codeName: t.codeName, action: "error", message: (r && r.message) || "" });
    }
  }
  Logger.log("[nav_member_knowledge_pollAll] " + JSON.stringify({ processed: processed, llmCalls: llmCalls, unchanged: unchanged, errors: errors, hasMore: hasMore }));
  return { ok: true, processed: processed, llmCalls: llmCalls, unchanged: unchanged, errors: errors, hasMore: hasMore, items: items };
}

/** 1 メンバーぶん抽出 + member_knowledge upsert
 *  @param {string} codeName
 *  @param {string} [memberId] (任意)
 *  @param {Object} [opts] {force?}
 */
function nav_member_knowledge_extractOne_(codeName, memberId, opts) {
  codeName = String(codeName || "").trim();
  if (!codeName) return { ok: false, message: "codeName empty" };
  opts = opts || {};
  const force = !!opts.force;

  // a) 入力ソース: 直近 90 日の member_activities + そのメンバーが居る PJ の最近 meeting summaries
  const sinceIso = _l2_isoDaysAgo_(90);
  const actsRes = supa_select("member_activities", {
    select: "code_name,project_id,activity_text,kind,created_at,milestone_id",
    filter: "code_name=eq." + encodeURIComponent(codeName) + "&created_at=gte." + encodeURIComponent(sinceIso),
    order: "created_at.desc",
    limit: 200
  });
  const acts = actsRes.ok ? (actsRes.rows || []) : [];

  // 関連 PJ ids 取得 → meeting summaries (直近 60 日)
  let projectIds = [];
  if (memberId) {
    const pmRes = supa_select("project_members", {
      select: "project_id,is_active",
      filter: "member_id=eq." + encodeURIComponent(memberId) + "&is_active=is.true",
      limit: 50
    });
    if (pmRes.ok) projectIds = (pmRes.rows || []).map(function (r) { return r.project_id; });
  }
  let summaries = [];
  if (projectIds.length) {
    const inFilter = "project_id=in.(" + projectIds.map(function (p) { return encodeURIComponent(p); }).join(",") + ")";
    const since60 = _l2_isoDaysAgo_(60);
    const sumRes = supa_select("project_meeting_summaries", {
      select: "project_id,meeting_date,title,summary_short,decided,progress,next_actions",
      filter: inFilter + "&meeting_date=gte." + since60.slice(0, 10) + "&source_kinds=neq.none",
      order: "meeting_date.desc",
      limit: 80
    });
    if (sumRes.ok) summaries = sumRes.rows || [];
  }

  // b) source_hash
  const inputJson = JSON.stringify({
    cn: codeName,
    acts: acts.map(function (a) { return { p: a.project_id, k: a.kind, t: String(a.activity_text || "").slice(0, 600) }; }),
    sums: summaries.map(function (s) { return { p: s.project_id, d: s.meeting_date, ss: String(s.summary_short || ""), dec: s.decided || [] }; })
  });
  const newHash = _l2_sha256_(inputJson);

  const existing = _l2_loadOneState_("member_knowledge", codeName, "global");
  if (!force && existing && existing.source_hash === newHash) {
    _l2_touchState_("member_knowledge", codeName, "global");
    return { ok: true, unchanged: true, action: "skipped_unchanged", codeName: codeName };
  }

  // c) 入力テキストが薄すぎたらスキップ
  if (acts.length === 0 && summaries.length === 0) {
    _l2_upsertState_({ l2_kind: "member_knowledge", target_id: codeName, scope_key: "global", source_hash: newHash, saved_count: 0, total_count: 0, llm_model: null, message: "no input" });
    return { ok: true, action: "no_input", codeName: codeName, saved: 0 };
  }

  // d) Gemini に渡すテキスト構築
  const inputText = [
    "=== member_activities (直近 90 日, max 200) ===",
    acts.slice(0, 100).map(function (a) {
      return "[" + (a.created_at || "").slice(0, 10) + " " + (a.project_id || "") + "/" + (a.kind || "") + "] " + String(a.activity_text || "").slice(0, 400);
    }).join("\n"),
    "",
    "=== project_meeting_summaries (直近 60 日, source_kinds!=none) ===",
    summaries.slice(0, 40).map(function (s) {
      const dec = Array.isArray(s.decided) ? s.decided.join(" / ") : "";
      return "[" + (s.meeting_date || "") + " " + (s.project_id || "") + "] " + (s.title || "") + " :: " + (s.summary_short || "") + (dec ? " | decided: " + dec : "");
    }).join("\n")
  ].join("\n").slice(0, 18000);

  const systemPrompt = [
    "あなたはチームメンバーの活動ログから、その人物像を構造化して抽出するアシスタントです。",
    "出力は JSON のみ:",
    '{ "categories": [ { "category": "skills|personality|communication_style|growth_areas|work_style|interests|episodes", "summary": "100字以内の日本語要約" } ] }',
    "ルール:",
    "- category は 7 種から複数選択可。確証のあるものだけ出す",
    "- summary は箇条書きでなく自然文 100 字以内",
    "- 入力に書かれてない推測は禁止 (= 各 category 0-5 件)",
    "- 名前 (code_name) を summary に含めない (テーブル別カラムで管理されるため)"
  ].join("\n");

  const userPrompt = "code_name: " + codeName + "\n\n" + inputText;
  let parsed = null;
  try { parsed = llm_callJson("default", systemPrompt, userPrompt, { maxTokens: 2048, temperature: 0.2 }); } catch (e) { parsed = null; }
  if (!parsed || !Array.isArray(parsed.categories)) {
    return { ok: false, action: "error_llm", codeName: codeName, message: "LLM parse failed" };
  }

  // e) upsert (UNIQUE(code_name, category))
  const allowedCats = ["skills", "personality", "communication_style", "growth_areas", "work_style", "interests", "episodes"];
  let saved = 0;
  for (let i = 0; i < parsed.categories.length; i++) {
    const c = parsed.categories[i] || {};
    const cat = String(c.category || "").trim();
    const sum = String(c.summary || "").trim();
    if (allowedCats.indexOf(cat) < 0 || !sum) continue;
    const up = supa_upsert("member_knowledge", {
      code_name: codeName,
      category: cat,
      summary: sum.slice(0, 500),
      source: "l2_hourly_extract",
      updated_at: new Date().toISOString()
    }, "code_name,category");
    if (up.ok) saved++;
  }

  _l2_upsertState_({
    l2_kind: "member_knowledge", target_id: codeName, scope_key: "global",
    source_hash: newHash, saved_count: saved, total_count: parsed.categories.length,
    llm_model: "gemini-2.5-flash", message: null
  });

  // 通知 (saved > 0 のときだけ)
  if (saved > 0) {
    try {
      const cats = parsed.categories.slice(0, saved).map(function (c) { return c.category; }).filter(function (c) { return !!c; });
      _l2_insertNotification_({
        l2_kind: "member_knowledge",
        target_id: codeName,
        scope_key: "global",
        title: "👤 " + codeName + " のメンバーナレッジ更新 (" + saved + "件)",
        summary: cats.join(" / "),
        saved_count: saved,
        total_count: parsed.categories.length,
        importance: 1
      });
    } catch (e) { Logger.log("[member_knowledge] notify error: " + e); }
  }

  return { ok: true, action: "saved", codeName: codeName, saved: saved, total: parsed.categories.length };
}

// ============================================================
// 公開関数 ─ ④ project_knowledge
// ============================================================

function nav_project_knowledge_pollAll(opts) {
  opts = opts || {};
  const maxItems = Number(opts.maxItems || 4);
  const force = !!opts.force;

  const projRes = supa_select("projects", {
    select: "project_id,status",
    filter: "status=eq.active",
    limit: 100
  });
  if (!projRes.ok) return { ok: false, message: "projects select failed", body: projRes.body };
  const projects = (projRes.rows || []).map(function (p) { return p.project_id; }).filter(Boolean);
  if (!projects.length) return { ok: true, message: "no active projects", processed: 0 };

  const ymList = [_l2_currentYmJST_(), _l2_prevYm_(_l2_currentYmJST_())];
  const stateMap = _l2_loadStateMap_("project_knowledge", projects, ymList);

  const targets = [];
  for (let i = 0; i < projects.length; i++) {
    for (let j = 0; j < ymList.length; j++) {
      const k = projects[i] + "|" + ymList[j];
      targets.push({ projectId: projects[i], ym: ymList[j], lastProcessedAt: stateMap[k] ? stateMap[k].last_processed_at : null });
    }
  }
  targets.sort(function (a, b) {
    const av = a.lastProcessedAt ? new Date(a.lastProcessedAt).getTime() : 0;
    const bv = b.lastProcessedAt ? new Date(b.lastProcessedAt).getTime() : 0;
    return av - bv;
  });

  const items = []; let llmCalls = 0, processed = 0, unchanged = 0, errors = 0, hasMore = false;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (llmCalls >= maxItems) { hasMore = true; items.push({ projectId: t.projectId, ym: t.ym, action: "deferred_maxItems" }); continue; }
    let r;
    try { r = nav_project_knowledge_extractOneForYm_(t.projectId, t.ym, { force: force }); }
    catch (e) { r = { ok: false, message: String(e && e.message ? e.message : e) }; }
    if (r && r.ok) {
      if (r.unchanged) unchanged++;
      else llmCalls++;
      processed++;
      items.push({ projectId: t.projectId, ym: t.ym, action: r.action || (r.unchanged ? "unchanged" : "saved"), saved: r.saved || 0 });
    } else {
      errors++;
      items.push({ projectId: t.projectId, ym: t.ym, action: "error", message: (r && r.message) || "" });
    }
  }
  Logger.log("[nav_project_knowledge_pollAll] " + JSON.stringify({ processed: processed, llmCalls: llmCalls, unchanged: unchanged, errors: errors, hasMore: hasMore }));
  return { ok: true, processed: processed, llmCalls: llmCalls, unchanged: unchanged, errors: errors, hasMore: hasMore, items: items };
}

function nav_project_knowledge_extractOneForYm_(projectId, ym, opts) {
  projectId = String(projectId || "").trim();
  ym = String(ym || "").trim();
  if (!projectId || !/^\d{6}$/.test(ym)) return { ok: false, message: "projectId/ym invalid" };
  opts = opts || {};
  const force = !!opts.force;

  // 入力: 当月 monthly_reports + 当月 + 前月 project_meeting_summaries
  const repRes = supa_select("monthly_reports", {
    select: "project_id,ym,final_content,draft_content,status",
    filter: "project_id=eq." + encodeURIComponent(projectId) + "&ym=eq." + encodeURIComponent(ym),
    limit: 1
  });
  const report = repRes.ok && repRes.rows && repRes.rows[0] ? repRes.rows[0] : null;
  const reportBody = report ? String(report.final_content || report.draft_content || "") : "";

  const sumRes = supa_select("project_meeting_summaries", {
    select: "meeting_date,title,summary_short,decided,progress,next_actions,risks",
    filter: "project_id=eq." + encodeURIComponent(projectId) + "&ym=eq." + encodeURIComponent(ym) + "&source_kinds=neq.none",
    order: "meeting_date.desc",
    limit: 30
  });
  const summaries = sumRes.ok ? (sumRes.rows || []) : [];

  const inputJson = JSON.stringify({
    p: projectId, ym: ym,
    rb: reportBody.slice(0, 12000),
    sums: summaries.map(function (s) { return { d: s.meeting_date, t: s.title, ss: s.summary_short, dec: s.decided || [] }; })
  });
  const newHash = _l2_sha256_(inputJson);

  const existing = _l2_loadOneState_("project_knowledge", projectId, ym);
  if (!force && existing && existing.source_hash === newHash) {
    _l2_touchState_("project_knowledge", projectId, ym);
    return { ok: true, unchanged: true, action: "skipped_unchanged", projectId: projectId, ym: ym };
  }
  if (!reportBody && summaries.length === 0) {
    _l2_upsertState_({ l2_kind: "project_knowledge", target_id: projectId, scope_key: ym, source_hash: newHash, saved_count: 0, total_count: 0, llm_model: null, message: "no input" });
    return { ok: true, action: "no_input", projectId: projectId, ym: ym, saved: 0 };
  }

  const inputText = [
    "=== monthly_report (status=" + (report ? report.status : "n/a") + ") ===",
    reportBody.slice(0, 12000),
    "",
    "=== meeting_summaries ===",
    summaries.slice(0, 30).map(function (s) {
      const dec = Array.isArray(s.decided) ? s.decided.join(" / ") : "";
      return "[" + (s.meeting_date || "") + "] " + (s.title || "") + " :: " + (s.summary_short || "") + (dec ? " | decided: " + dec : "");
    }).join("\n")
  ].join("\n").slice(0, 18000);

  const systemPrompt = [
    "あなたはプロジェクトに関する事実情報を構造化して抽出するアシスタントです。",
    "出力は JSON のみ:",
    '{ "items": [ { "category": "people|tech|ip|org|funding|market|competitor|strategy|term", "entity_name": "対象名", "fact_text": "事実の説明 (200字以内)", "confidence": "high|medium|low" } ] }',
    "ルール:",
    "- category は 9 種から選ぶ",
    "- entity_name は固有名詞・組織名・技術名など",
    "- fact_text は入力に書かれていることだけ。推測禁止",
    "- 同じ entity_name は category 別なら別行 OK"
  ].join("\n");

  const userPrompt = "project_id: " + projectId + " / ym: " + ym + "\n\n" + inputText;
  let parsed = null;
  try { parsed = llm_callJson("default", systemPrompt, userPrompt, { maxTokens: 3072, temperature: 0.2 }); } catch (e) { parsed = null; }
  if (!parsed || !Array.isArray(parsed.items)) {
    return { ok: false, action: "error_llm", projectId: projectId, ym: ym, message: "LLM parse failed" };
  }

  const allowedCats = ["people", "tech", "ip", "org", "funding", "market", "competitor", "strategy", "term"];
  let saved = 0;
  for (let i = 0; i < parsed.items.length; i++) {
    const it = parsed.items[i] || {};
    const cat = String(it.category || "").trim();
    const ent = String(it.entity_name || "").trim();
    const fact = String(it.fact_text || "").trim();
    if (allowedCats.indexOf(cat) < 0 || !ent || !fact) continue;
    // project_knowledge には UNIQUE 制約が無い → SELECT で既存確認後 INSERT/UPDATE
    const exRes = supa_select("project_knowledge", {
      select: "id,fact_text",
      filter: "project_id=eq." + encodeURIComponent(projectId) +
              "&category=eq." + encodeURIComponent(cat) +
              "&entity_name=eq." + encodeURIComponent(ent),
      limit: 1
    });
    const exRow = exRes.ok && exRes.rows && exRes.rows[0] ? exRes.rows[0] : null;
    let up;
    if (exRow && exRow.id) {
      // PostgREST PATCH equivalent via upsert with id is tricky; re-INSERT skipped, UPDATE via REST PATCH
      up = _l2_patchProjectKnowledge_(exRow.id, {
        fact_text: fact.slice(0, 1500),
        confidence: String(it.confidence || "medium"),
        source: "l2_hourly_extract",
        updated_at: new Date().toISOString()
      });
    } else {
      up = supa_upsert("project_knowledge", {
        project_id: projectId,
        category: cat,
        entity_name: ent.slice(0, 200),
        fact_text: fact.slice(0, 1500),
        confidence: String(it.confidence || "medium"),
        source: "l2_hourly_extract",
        status: "active",
        updated_at: new Date().toISOString()
      });
    }
    if (up && up.ok) saved++;
  }

  _l2_upsertState_({
    l2_kind: "project_knowledge", target_id: projectId, scope_key: ym,
    source_hash: newHash, saved_count: saved, total_count: parsed.items.length,
    llm_model: "gemini-2.5-flash", message: null
  });

  if (saved > 0) {
    try {
      const pjName = _l2_resolvePjName_(projectId);
      const top = parsed.items.slice(0, 3).map(function (it) { return (it.category || "") + ":" + (it.entity_name || ""); }).join(" / ");
      _l2_insertNotification_({
        l2_kind: "project_knowledge",
        target_id: projectId,
        scope_key: ym,
        title: "🗂️ " + pjName + " (" + ym + ") PJナレッジ更新 (" + saved + "件)",
        summary: top + (parsed.items.length > 3 ? " 他" : ""),
        saved_count: saved,
        total_count: parsed.items.length,
        importance: 1
      });
    } catch (e) { Logger.log("[project_knowledge] notify error: " + e); }
  }

  return { ok: true, action: "saved", projectId: projectId, ym: ym, saved: saved, total: parsed.items.length };
}

// ============================================================
// 公開関数 ─ ② protocols (AMDプロトコル)
// ============================================================

function nav_protocol_pollAll(opts) {
  opts = opts || {};
  const maxItems = Number(opts.maxItems || 4);
  const force = !!opts.force;

  const projRes = supa_select("projects", {
    select: "project_id,status",
    filter: "status=eq.active",
    limit: 100
  });
  if (!projRes.ok) return { ok: false, message: "projects select failed", body: projRes.body };
  const projects = (projRes.rows || []).map(function (p) { return p.project_id; }).filter(Boolean);
  if (!projects.length) return { ok: true, message: "no active projects", processed: 0 };

  const ymList = [_l2_currentYmJST_(), _l2_prevYm_(_l2_currentYmJST_())];
  const stateMap = _l2_loadStateMap_("protocols", projects, ymList);

  const targets = [];
  for (let i = 0; i < projects.length; i++) {
    for (let j = 0; j < ymList.length; j++) {
      const k = projects[i] + "|" + ymList[j];
      targets.push({ projectId: projects[i], ym: ymList[j], lastProcessedAt: stateMap[k] ? stateMap[k].last_processed_at : null });
    }
  }
  targets.sort(function (a, b) {
    const av = a.lastProcessedAt ? new Date(a.lastProcessedAt).getTime() : 0;
    const bv = b.lastProcessedAt ? new Date(b.lastProcessedAt).getTime() : 0;
    return av - bv;
  });

  const items = []; let llmCalls = 0, processed = 0, unchanged = 0, errors = 0, hasMore = false;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (llmCalls >= maxItems) { hasMore = true; items.push({ projectId: t.projectId, ym: t.ym, action: "deferred_maxItems" }); continue; }
    let r;
    try { r = nav_protocol_extractOneForYm_(t.projectId, t.ym, { force: force }); }
    catch (e) { r = { ok: false, message: String(e && e.message ? e.message : e) }; }
    if (r && r.ok) {
      if (r.unchanged) unchanged++;
      else llmCalls++;
      processed++;
      items.push({ projectId: t.projectId, ym: t.ym, action: r.action || (r.unchanged ? "unchanged" : "saved"), saved: r.saved || 0 });
    } else {
      errors++;
      items.push({ projectId: t.projectId, ym: t.ym, action: "error", message: (r && r.message) || "" });
    }
  }
  Logger.log("[nav_protocol_pollAll] " + JSON.stringify({ processed: processed, llmCalls: llmCalls, unchanged: unchanged, errors: errors, hasMore: hasMore }));
  return { ok: true, processed: processed, llmCalls: llmCalls, unchanged: unchanged, errors: errors, hasMore: hasMore, items: items };
}

function nav_protocol_extractOneForYm_(projectId, ym, opts) {
  projectId = String(projectId || "").trim();
  ym = String(ym || "").trim();
  if (!projectId || !/^\d{6}$/.test(ym)) return { ok: false, message: "projectId/ym invalid" };
  opts = opts || {};
  const force = !!opts.force;

  // 入力: 当月 project_meeting_summaries (decided 中心)
  const sumRes = supa_select("project_meeting_summaries", {
    select: "meeting_id,meeting_date,title,summary_short,decided,risks,next_actions",
    filter: "project_id=eq." + encodeURIComponent(projectId) + "&ym=eq." + encodeURIComponent(ym) + "&source_kinds=neq.none",
    order: "meeting_date.desc",
    limit: 50
  });
  const summaries = sumRes.ok ? (sumRes.rows || []) : [];

  const inputJson = JSON.stringify({
    p: projectId, ym: ym,
    sums: summaries.map(function (s) { return { mid: s.meeting_id, d: s.meeting_date, t: s.title, ss: s.summary_short, dec: s.decided || [], rk: s.risks || [], na: s.next_actions || [] }; })
  });
  const newHash = _l2_sha256_(inputJson);

  const existing = _l2_loadOneState_("protocols", projectId, ym);
  if (!force && existing && existing.source_hash === newHash) {
    _l2_touchState_("protocols", projectId, ym);
    return { ok: true, unchanged: true, action: "skipped_unchanged", projectId: projectId, ym: ym };
  }
  if (summaries.length === 0) {
    _l2_upsertState_({ l2_kind: "protocols", target_id: projectId, scope_key: ym, source_hash: newHash, saved_count: 0, total_count: 0, llm_model: null, message: "no input" });
    return { ok: true, action: "no_input", projectId: projectId, ym: ym, saved: 0 };
  }

  const inputText = summaries.slice(0, 30).map(function (s) {
    const dec = Array.isArray(s.decided) ? s.decided.join(" / ") : "";
    const rk = Array.isArray(s.risks) ? s.risks.join(" / ") : "";
    const na = Array.isArray(s.next_actions) ? s.next_actions.join(" / ") : "";
    return "[" + (s.meeting_date || "") + "] " + (s.title || "") + "\n  summary: " + (s.summary_short || "") +
           (dec ? "\n  decided: " + dec : "") +
           (rk ? "\n  risks: " + rk : "") +
           (na ? "\n  next_actions: " + na : "");
  }).join("\n\n").slice(0, 16000);

  const systemPrompt = [
    "あなたは経営判断ログ (AMDプロトコル) を構造化抽出するアシスタントです。",
    "AMDプロトコルの 4 要素: ① 分岐点 (どんな選択肢があったか) ② 判断材料 (どんな情報で判断したか) ③ アクション (何をやることに決めたか) ④ 結果・学習 (やってみてどうだったか)",
    "出力は JSON のみ:",
    '{ "protocols": [ { "title": "20-40字の見出し", "content": "上記 4 要素を含む 200-400字の本文 (markdown 可)", "importance": 1|2|3, "tags": ["tag1","tag2"] } ] }',
    "ルール:",
    "- 月次の最重要 1-3 件だけ抽出。瑣末な決定は含めない",
    "- importance: 1=軽微, 2=中, 3=重大 (経営方針・契約・採用 等)",
    "- tags は 2-5 個 (例: 'pricing', 'partnership', 'scope_change', 'risk')",
    "- 入力に書かれてない推測は禁止",
    "- 4 要素全て埋まらない場合は確証ある要素だけ書く"
  ].join("\n");

  const userPrompt = "project_id: " + projectId + " / ym: " + ym + "\n\n" + inputText;
  let parsed = null;
  try { parsed = llm_callJson("default", systemPrompt, userPrompt, { maxTokens: 2048, temperature: 0.3 }); } catch (e) { parsed = null; }
  if (!parsed || !Array.isArray(parsed.protocols)) {
    return { ok: false, action: "error_llm", projectId: projectId, ym: ym, message: "LLM parse failed" };
  }

  let saved = 0;
  for (let i = 0; i < parsed.protocols.length; i++) {
    const p = parsed.protocols[i] || {};
    const title = String(p.title || "").trim().slice(0, 200);
    const content = String(p.content || "").trim();
    const imp = Math.max(1, Math.min(3, Math.round(Number(p.importance || 1))));
    const tags = Array.isArray(p.tags) ? p.tags.map(function (s) { return String(s || "").trim(); }).filter(Boolean) : [];
    if (!title || !content) continue;
    // protocol_id は (project_id + ym + sha8(title)) で作って同タイトル再抽出時の重複を抑止
    const protocolId = "p4-" + projectId + "-" + ym + "-" + _l2_sha256_(title).slice(0, 8);
    const up = supa_upsert("protocols", {
      protocol_id: protocolId,
      project_id: projectId,
      title: title,
      content: content.slice(0, 4000),
      status: "candidate",
      importance: imp,
      source: "l2_hourly_extract",
      tags: tags.slice(0, 8).join(","),
      updated_at: new Date().toISOString()
    }, "protocol_id");
    if (up.ok) saved++;
  }

  _l2_upsertState_({
    l2_kind: "protocols", target_id: projectId, scope_key: ym,
    source_hash: newHash, saved_count: saved, total_count: parsed.protocols.length,
    llm_model: "gemini-2.5-flash", message: null
  });

  if (saved > 0) {
    try {
      const pjName = _l2_resolvePjName_(projectId);
      const titles = parsed.protocols.slice(0, 3).map(function (p) { return String(p.title || "").trim(); }).filter(Boolean).join(" / ");
      const maxImp = parsed.protocols.reduce(function (m, p) { return Math.max(m, Number(p.importance || 1)); }, 1);
      _l2_insertNotification_({
        l2_kind: "protocols",
        target_id: projectId,
        scope_key: ym,
        title: "⚖️ " + pjName + " (" + ym + ") AMDプロトコル candidate (" + saved + "件)",
        summary: titles + (parsed.protocols.length > 3 ? " 他" : ""),
        saved_count: saved,
        total_count: parsed.protocols.length,
        importance: maxImp
      });
    } catch (e) { Logger.log("[protocols] notify error: " + e); }
  }

  return { ok: true, action: "saved", projectId: projectId, ym: ym, saved: saved, total: parsed.protocols.length };
}

// ============================================================
// trigger setup (1 度実行 / 時間分散)
// ============================================================

function nav_l2_setupAllL2HourlyTriggers_() {
  const out = { ok: true, set: {} };
  out.set.member = _l2_setupHourlyTriggerByName_("nav_member_knowledge_pollAll", 0);
  out.set.project = _l2_setupHourlyTriggerByName_("nav_project_knowledge_pollAll", 15);
  out.set.protocol = _l2_setupHourlyTriggerByName_("nav_protocol_pollAll", 30);
  return out;
}

/** 汎用: 指定の handler 名の trigger を全て (or N-1 個) 削除する。
 *  GAS time-trigger 上限 (1 script 20 個) に達したときの整理用。
 *  @param {string} handlerName 削除対象の handler 関数名
 *  @param {number} [keepCount=0] 残す個数。0 なら全削除、1 なら 1 個だけ残す
 *  @return {Object} {ok, removed, kept}
 */
function nav_l2_pruneDuplicateTriggers(handlerName, keepCount) {
  handlerName = String(handlerName || "").trim();
  if (!handlerName) return { ok: false, message: "handlerName empty" };
  const keep = Math.max(0, Number(keepCount || 0));
  const triggers = ScriptApp.getProjectTriggers();
  const targets = triggers.filter(function (t) {
    return t.getHandlerFunction && t.getHandlerFunction() === handlerName;
  });
  let removed = 0;
  // keep 個を残し、それ以外を削除
  for (let i = keep; i < targets.length; i++) {
    try { ScriptApp.deleteTrigger(targets[i]); removed++; } catch (e) {}
  }
  return { ok: true, handlerName: handlerName, totalFound: targets.length, removed: removed, kept: Math.min(keep, targets.length) };
}

function _l2_setupHourlyTriggerByName_(handlerName, atMinute) {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  for (const t of triggers) {
    if (t.getHandlerFunction && t.getHandlerFunction() === handlerName) {
      try { ScriptApp.deleteTrigger(t); removed++; } catch (e) {}
    }
  }
  // GAS の time-based trigger は分単位指定不可。everyHours(1) で発火し、最初の発火時刻は不定。
  // 「毎時 0 分 / 15 分 / 30 分」をジャストに合わせるなら `at(specificDate)` で初回をセットするが
  // 実用上は 1 時間ごとに均等に走れば十分なので everyHours(1) で 3 trigger 作る (発火時刻は GAS が分散)。
  ScriptApp.newTrigger(handlerName).timeBased().everyHours(1).create();
  return { ok: true, removed: removed, message: handlerName + " hourly trigger set (atMinute hint: " + atMinute + ")" };
}

// ============================================================
// 内部 helper
// ============================================================

function _l2_sha256_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ""), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    const v = (b < 0) ? (b + 256) : b;
    const h = v.toString(16);
    return h.length === 1 ? ("0" + h) : h;
  }).join("");
}

function _l2_isoDaysAgo_(days) {
  return new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString();
}

function _l2_currentYmJST_() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return "" + y + m;
}

function _l2_prevYm_(ym) {
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  const pm = m - 1 < 1 ? 12 : m - 1;
  const py = m - 1 < 1 ? y - 1 : y;
  return "" + py + String(pm).padStart(2, "0");
}

/** l2_extract_state map 一括取得 */
function _l2_loadStateMap_(l2Kind, targetIds, scopeKeys) {
  const map = {};
  if (!targetIds || !targetIds.length) return map;
  const targetIn = "(" + targetIds.map(function (s) { return encodeURIComponent(String(s)); }).join(",") + ")";
  const scopeIn = "(" + scopeKeys.map(function (s) { return encodeURIComponent(String(s)); }).join(",") + ")";
  const filter = "l2_kind=eq." + encodeURIComponent(l2Kind) +
                 "&target_id=in." + targetIn +
                 "&scope_key=in." + scopeIn;
  const res = supa_select("l2_extract_state", {
    select: "target_id,scope_key,source_hash,last_processed_at",
    filter: filter,
    limit: 500
  });
  if (!res.ok) return map;
  const rows = res.rows || [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    map[r.target_id + "|" + r.scope_key] = { source_hash: r.source_hash, last_processed_at: r.last_processed_at };
  }
  return map;
}

function _l2_loadOneState_(l2Kind, targetId, scopeKey) {
  const filter = "l2_kind=eq." + encodeURIComponent(l2Kind) +
                 "&target_id=eq." + encodeURIComponent(targetId) +
                 "&scope_key=eq." + encodeURIComponent(scopeKey);
  const res = supa_select("l2_extract_state", {
    select: "source_hash,last_processed_at",
    filter: filter,
    limit: 1
  });
  if (!res.ok) return null;
  const rows = res.rows || [];
  return rows.length ? rows[0] : null;
}

function _l2_touchState_(l2Kind, targetId, scopeKey) {
  // PATCH for last_processed_at update
  const url = _l2_supaUrl_() + "/rest/v1/l2_extract_state?l2_kind=eq." + encodeURIComponent(l2Kind) +
              "&target_id=eq." + encodeURIComponent(targetId) +
              "&scope_key=eq." + encodeURIComponent(scopeKey);
  const key = _l2_supaKey_();
  try {
    UrlFetchApp.fetch(url, {
      method: "patch",
      contentType: "application/json",
      headers: { "apikey": key, "Authorization": "Bearer " + key, "Prefer": "return=minimal" },
      payload: JSON.stringify({ last_processed_at: new Date().toISOString() }),
      muteHttpExceptions: true
    });
  } catch (e) {}
}

function _l2_upsertState_(row) {
  return supa_upsert("l2_extract_state", {
    l2_kind: row.l2_kind,
    target_id: row.target_id,
    scope_key: row.scope_key,
    source_hash: row.source_hash,
    saved_count: row.saved_count || 0,
    total_count: row.total_count || 0,
    llm_model: row.llm_model || null,
    message: row.message || null,
    last_processed_at: new Date().toISOString()
  }, "l2_kind,target_id,scope_key");
}

/** project_knowledge を id 指定で UPDATE */
function _l2_patchProjectKnowledge_(id, patch) {
  const url = _l2_supaUrl_() + "/rest/v1/project_knowledge?id=eq." + encodeURIComponent(id);
  const key = _l2_supaKey_();
  try {
    const res = UrlFetchApp.fetch(url, {
      method: "patch",
      contentType: "application/json",
      headers: { "apikey": key, "Authorization": "Bearer " + key, "Prefer": "return=minimal" },
      payload: JSON.stringify(patch),
      muteHttpExceptions: true
    });
    const status = res.getResponseCode();
    return { ok: status >= 200 && status < 300, status: status };
  } catch (e) { return { ok: false, message: String(e) }; }
}

function _l2_supaUrl_() {
  return String(PropertiesService.getScriptProperties().getProperty("SUPABASE_URL") || "").trim();
}
function _l2_supaKey_() {
  return String(PropertiesService.getScriptProperties().getProperty("SUPABASE_SERVICE_KEY") || "").trim();
}

/** l2_notifications テーブルに upsert (Swift APNs 通知用)。
 *  内容変わってれば trigger で notified_at=NULL に戻り、Swift 側が再通知する。
 *  saved_count==0 なら呼ばないこと (= 通知不要)。
 *
 *  仕様正本: ios/HANDOFF_l2_notifications.md
 */
function _l2_insertNotification_(payload) {
  const row = {
    l2_kind: String(payload.l2_kind || ""),
    target_id: String(payload.target_id || ""),
    scope_key: String(payload.scope_key || ""),
    title: String(payload.title || "").slice(0, 200),
    summary: String(payload.summary || "").slice(0, 1000),
    saved_count: Number(payload.saved_count || 0),
    total_count: Number(payload.total_count || 0),
    importance: Number(payload.importance || 1)
  };
  if (!row.l2_kind || !row.target_id || !row.scope_key || !row.title) return { ok: false, message: "required fields missing" };
  return supa_upsert("l2_notifications", row, "l2_kind,target_id,scope_key");
}

/** project_id → 表示用 PJ 名 (memo cache) */
const _l2_pjNameCache = {};
function _l2_resolvePjName_(projectId) {
  if (_l2_pjNameCache[projectId]) return _l2_pjNameCache[projectId];
  const res = supa_select("projects", {
    select: "project_id,project_name",
    filter: "project_id=eq." + encodeURIComponent(projectId),
    limit: 1
  });
  const name = res.ok && res.rows && res.rows[0] && res.rows[0].project_name ? res.rows[0].project_name : projectId;
  _l2_pjNameCache[projectId] = name;
  return name;
}
