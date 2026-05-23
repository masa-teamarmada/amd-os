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
 * ② protocols          — 各 PJ の経営判断 (分岐点/判断材料/アクション/結果) を upsert
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

var L2_KNOWLEDGE_CRON_DISABLED_20260522 = true;

function nav_l2_disabledCronResponse_(handlerName) {
  return {
    ok: true,
    disabled: true,
    handler: handlerName,
    message: "L2 knowledge background cron is disabled. Use Codex automation/review batches."
  };
}

// ============================================================
// 公開関数 ─ ⑤ member_knowledge
// ============================================================

/** アクティブメンバー全員 × global を target に毎時 polling
 *  @param {Object} [opts] {maxItems?: number, force?: boolean}
 */
function nav_member_knowledge_pollAll(opts) {
  if (L2_KNOWLEDGE_CRON_DISABLED_20260522) return nav_l2_disabledCronResponse_("nav_member_knowledge_pollAll");
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

  // a) 入力ソース: 直近 90 日の member_activities (member_id で正しく filter)
  // ⚠️ 2026-05-09 バグ修正: 過去版は code_name/created_at/activity_text/kind で filter+select していて
  // member_activities の実スキーマ (member_id/extracted_at/title/content_preview/source) と合わず
  // PostgREST エラーで activities がゼロで返ってた → meeting_summaries だけが LLM 入力になり
  // 他人の活動を本人のものと誤抽出していた (BUGS.md 参照)
  if (!memberId) {
    return { ok: false, action: "no_member_id", codeName: codeName, message: "memberId required (column member_id is the FK)" };
  }
  const sinceIso = _l2_isoDaysAgo_(90);
  const actsRes = supa_select("member_activities", {
    select: "member_id,project_id,ym,title,content_preview,source,extracted_at,milestone_id",
    filter: "member_id=eq." + encodeURIComponent(memberId) + "&extracted_at=gte." + encodeURIComponent(sinceIso),
    order: "extracted_at.desc",
    limit: 200
  });
  const acts = actsRes.ok ? (actsRes.rows || []) : [];

  // 関連 PJ ids 取得 → meeting summaries (直近 60 日)
  // ⚠️ meeting_summaries は PJ 全体のサマリで「本人が主体的にやった」とは限らない。
  // LLM プロンプトで「本人 (code_name) が明示的に主体として書かれている事項のみ抽出」と強く指示。
  const pmRes = supa_select("project_members", {
    select: "project_id,is_active",
    filter: "member_id=eq." + encodeURIComponent(memberId) + "&is_active=is.true",
    limit: 50
  });
  const projectIds = pmRes.ok ? (pmRes.rows || []).map(function (r) { return r.project_id; }) : [];
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

  // a-2) 公式の役割分担 (= グラウンドトゥルース): milestone_responsibility WHERE share>0
  //  + value_milestones で title/success_criteria を JOIN + value_plan_cycles で project_id を resolve
  // 列名はすべて design/db_schema.md で確認済 (member_id, milestone_id, share, role, task_description /
  //  milestone_id, plan_cycle_id, title, success_criteria, points, goal_level / plan_cycle_id, project_id)
  let roleAssignments = [];
  const respRes = supa_select("milestone_responsibility", {
    select: "milestone_id,share,role,task_description",
    filter: "member_id=eq." + encodeURIComponent(memberId) + "&share=gt.0",
    limit: 100
  });
  if (respRes.ok && respRes.rows && respRes.rows.length) {
    const msIds = respRes.rows.map(function (r) { return r.milestone_id; });
    const msInFilter = "milestone_id=in.(" + msIds.map(function (s) { return encodeURIComponent(s); }).join(",") + ")";
    const msRes = supa_select("value_milestones", {
      select: "milestone_id,plan_cycle_id,title,points,goal_level,success_criteria,is_active",
      filter: msInFilter + "&is_active=is.true",
      limit: 100
    });
    const msMap = {};
    const planIds = [];
    if (msRes.ok) {
      for (const m of msRes.rows || []) {
        msMap[String(m.milestone_id)] = m;
        if (m.plan_cycle_id && planIds.indexOf(m.plan_cycle_id) < 0) planIds.push(m.plan_cycle_id);
      }
    }
    // plan_cycle_id → project_id resolve
    const pcMap = {};
    if (planIds.length) {
      const pcInFilter = "plan_cycle_id=in.(" + planIds.map(function (s) { return encodeURIComponent(s); }).join(",") + ")";
      const pcRes = supa_select("value_plan_cycles", {
        select: "plan_cycle_id,project_id,period_start_ym,period_end_ym,status",
        filter: pcInFilter,
        limit: 100
      });
      if (pcRes.ok) for (const p of pcRes.rows || []) pcMap[String(p.plan_cycle_id)] = p;
    }
    // role assignments を構築 (アクティブな MS のみ)
    for (const r of respRes.rows) {
      const m = msMap[String(r.milestone_id)];
      if (!m) continue;
      const pc = pcMap[String(m.plan_cycle_id)] || {};
      roleAssignments.push({
        projectId: pc.project_id || "",
        share: Number(r.share || 0),
        role: r.role || "",
        taskDescription: r.task_description || "",
        msTitle: m.title || "",
        msPoints: Number(m.points || 0),
        msGoalLevel: m.goal_level || "",
        msSuccessCriteria: m.success_criteria || "",
        period: (pc.period_start_ym || "") + "-" + (pc.period_end_ym || "")
      });
    }
  }

  // b) source_hash (役割分担も含めて差分検知 → 役割変更で再抽出)
  const inputJson = JSON.stringify({
    cn: codeName,
    mid: memberId,
    pv: "v3_with_aliases", // alias block 追加で全 hash 不一致 → 再抽出
    acts: acts.map(function (a) { return { p: a.project_id, ym: a.ym, ti: String(a.title || ""), cp: String(a.content_preview || "").slice(0, 400) }; }),
    roles: roleAssignments.map(function (r) {
      return { p: r.projectId, sh: r.share, ro: r.role, td: r.taskDescription, mt: r.msTitle, sc: String(r.msSuccessCriteria || "").slice(0, 600) };
    }),
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
  // 3 セクション構成:
  //   C) 公式の役割分担 (milestone_responsibility) ← 本人の業務範囲のグラウンドトゥルース
  //   A) 本人の活動ログ (member_activities) ← 本人主体、自由抽出 OK
  //   B) PJ 全体の会議サマリ (project_meeting_summaries) ← 本人主体とは限らない、慎重抽出
  const inputText = [
    "=== C) " + codeName + " の公式の役割分担 (milestone_responsibility, share>0) ===",
    "[このセクションは本人が公式に担当している業務範囲のグラウンドトゥルース。",
    " skills / work_style 等を抽出するときに最も信頼できる根拠。",
    " ここに書かれていない領域 (例: 経営戦略 / 資金調達 / 技術開発 等) は **本人の業務外** の可能性が高い。]",
    roleAssignments.length === 0 ? "(該当なし — 公式に担当する MS が登録されていない)" :
      roleAssignments.map(function (r) {
        const lines = [
          "[" + r.projectId + " " + r.period + "] [share=" + r.share + "] [role=" + r.role + "] " +
            "MS: " + r.msTitle + " (" + r.msPoints + "pt, " + r.msGoalLevel + ")"
        ];
        if (r.taskDescription) lines.push("  task_description: " + r.taskDescription);
        if (r.msSuccessCriteria) lines.push("  success_criteria: " + String(r.msSuccessCriteria).replace(/\n/g, " / ").slice(0, 600));
        return lines.join("\n");
      }).join("\n"),
    "",
    "=== A) " + codeName + " 本人の活動ログ (member_activities, 直近 90 日, max 200) ===",
    "[このセクションは本人が主体の活動。ここからは自由に抽出して OK]",
    acts.length === 0 ? "(該当なし)" :
      acts.slice(0, 100).map(function (a) {
        return "[" + (a.extracted_at || "").slice(0, 10) + " " + (a.project_id || "") + "/" + (a.ym || "") + "/" + (a.source || "") + "] " +
               (a.title ? a.title + ": " : "") + String(a.content_preview || "").slice(0, 400);
      }).join("\n"),
    "",
    "=== B) " + codeName + " が PJ メンバーである PJ の会議サマリ (project_meeting_summaries, 直近 60 日) ===",
    "[⚠️ このセクションは PJ 全体のサマリ。" + codeName + " 本人が主体とは限らない。",
    " 例えば「神谷氏との CEO 候補面談」と書かれていても、実施したのは PL/PM の可能性が高い。",
    " このセクションからは『" + codeName + " (= 本人) が明示的に主体として書かれている事項』だけ抽出すること。",
    " 本人名が出てこなければ、たとえ PJ にいたとしても抽出しない (skip)。",
    " さらに **セクション C (公式の役割分担) と整合しない事項は無視する** (= 役割外の話を本人スキルにしない)。]",
    summaries.length === 0 ? "(該当なし)" :
      summaries.slice(0, 40).map(function (s) {
        const dec = Array.isArray(s.decided) ? s.decided.join(" / ") : "";
        return "[" + (s.meeting_date || "") + " " + (s.project_id || "") + "] " + (s.title || "") + " :: " + (s.summary_short || "") + (dec ? " | decided: " + dec : "");
      }).join("\n")
  ].join("\n").slice(0, 20000);

  const systemPrompt = [
    "あなたはチームメンバーの人物像を構造化抽出するアシスタント。対象メンバーは入力の code_name で指定される。",
    "",
    "🚨 入力 3 セクションの取扱い:",
    "- セクション C (milestone_responsibility) = **公式の役割分担、グラウンドトゥルース**。ここが本人の業務範囲。",
    "  → skills / work_style は **基本ここから抽出**。MS タイトル + task_description + success_criteria を本人の担当業務として読む。",
    "  → 例: MS タイトル『入札書類作成・契約事務』share=1.0 → skills: 入札書類作成・契約事務 が確実。",
    "- セクション A (member_activities) = 本人が主体の活動ログ。自由抽出 OK。",
    "- セクション B (project_meeting_summaries) = PJ 全体の会議サマリで、**本人が主体とは限らない**。",
    "  → 本人名が明示登場 + セクション C の役割範囲と整合する事項のみ抽出。",
    "  → 役割範囲外の議論 (例: 事務担当なのに経営戦略議論) を本人スキルにしてはいけない。",
    "",
    "出力は JSON のみ:",
    '{ "categories": [ { "category": "skills|personality|communication_style|growth_areas|work_style|interests|episodes", "summary": "100字以内の日本語要約" } ] }',
    "",
    "ルール:",
    "- category は 7 種から複数選択可。**確証のあるものだけ**",
    "- summary は箇条書きでなく自然文 100 字以内",
    "- 入力に書かれてない推測は禁止",
    "- 名前 (code_name) を summary に含めない (テーブル別カラムで管理されるため)",
    "- セクション C も A も空でセクション B だけある場合、抽出 0 件 (= categories: []) を出力する"
  ].join("\n");

  // 過去 feedback + 名前正規化マップ を LLM プロンプトに含める
  const fb = _l2_loadFeedbackBlock_("member_knowledge", codeName, "global");
  const aliasBlock = (typeof nameAlias_buildBlock === "function") ? nameAlias_buildBlock() : "";
  const userPrompt = "code_name: " + codeName + "\n\n" +
    (aliasBlock ? aliasBlock + "\n\n" : "") +
    inputText +
    (fb.block ? "\n\n" + fb.block : "");
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
      // 通知に出す L2 は「はい」で承認されるまで正本反映しない。
      status: "candidate",
      updated_at: new Date().toISOString()
    }, "code_name,category");
    if (up.ok) saved++;
  }

  _l2_upsertState_({
    l2_kind: "member_knowledge", target_id: codeName, scope_key: "global",
    source_hash: newHash, saved_count: saved, total_count: parsed.categories.length,
    llm_model: "gemini-2.5-flash", message: null
  });

  // 過去 feedback を LLM が参照したことを記録 (= applied_count++)
  if (saved > 0 && fb.ids && fb.ids.length) _l2_recordFeedbackApplied_(fb.ids);

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
  if (L2_KNOWLEDGE_CRON_DISABLED_20260522) return nav_l2_disabledCronResponse_("nav_project_knowledge_pollAll");
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
  // ⚠️ status='invalid' は除外 (= 他 PJ 内容で汚染されたレポートが status='invalid' でマークされる運用)
  //   BUGS.md `[GAS] monthly_reports に他 PJ 内容が混入する事故` 参照
  const repRes = supa_select("monthly_reports", {
    select: "project_id,ym,final_content,draft_content,status",
    filter: "project_id=eq." + encodeURIComponent(projectId) + "&ym=eq." + encodeURIComponent(ym) + "&status=neq.invalid",
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
    pv: "v4_meta_strict", // project_meta + 他PJ無視 防御を追加 → 全 hash 不一致で再抽出
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

  const projectName = (typeof _meeting_resolveProjectName_ === "function")
    ? _meeting_resolveProjectName_(projectId) : projectId;

  const inputText = [
    "=== project_meta (これが対象 PJ の唯一の正解。これと無関係な内容は完全に無視) ===",
    "projectId: " + projectId,
    "projectName: " + projectName,
    "ym: " + ym,
    "",
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
    "",
    "🚨 最重要ルール:",
    "- 入力の project_meta (= projectId + projectName) が対象 PJ の唯一の正解。これと無関係な内容は完全に無視する。",
    "- monthly_report 本文や meeting_summaries が他 PJ の内容で汚染されているケース (= 入力データのバグ) がある。",
    "  例: projectName='SE' (= 翔エンジニアリング) なのに monthly_report に 'CryoX' / 'NIMS神谷' / '磁気冷凍' (= CX PJ の内容) が書かれている。",
    "  この場合は **抽出しない** (= items: [] を返す)。汚染データを真面目に抽出して別 PJ の事実として保存してはいけない。",
    "- 入力に projectName と無関係な固有名詞 / 組織 / 技術が書かれていたら、それは汚染データの可能性が高い。",
    "  確証が無ければ抽出 0 件。",
    "",
    "出力は JSON のみ:",
    '{ "items": [ { "category": "people|tech|ip|org|funding|market|competitor|strategy|term", "entity_name": "対象名", "fact_text": "事実の説明 (200字以内)", "confidence": "high|medium|low" } ] }',
    "",
    "ルール:",
    "- category は 9 種から選ぶ",
    "- entity_name は固有名詞・組織名・技術名など",
    "- fact_text は入力に書かれていることだけ。推測禁止",
    "- 同じ entity_name は category 別なら別行 OK",
    "- 対象 PJ と関係性が確証できない事項は無視する"
  ].join("\n");

  const fb = _l2_loadFeedbackBlock_("project_knowledge", projectId, ym);
  const aliasBlock = (typeof nameAlias_buildBlock === "function") ? nameAlias_buildBlock() : "";
  const userPrompt = "project_id: " + projectId + " / ym: " + ym + "\n\n" +
    (aliasBlock ? aliasBlock + "\n\n" : "") +
    inputText +
    (fb.block ? "\n\n" + fb.block : "");
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
        // 通知に出す L2 は「はい」で承認されるまで正本反映しない。
        status: "candidate",
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
        // 通知に出す L2 は「はい」で承認されるまで正本反映しない。
        status: "candidate",
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

  if (saved > 0 && fb.ids && fb.ids.length) _l2_recordFeedbackApplied_(fb.ids);

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
  if (L2_KNOWLEDGE_CRON_DISABLED_20260522) return nav_l2_disabledCronResponse_("nav_protocol_pollAll");
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
    pv: "v4_protocol_result_blank", // result欄は後追い記録に限定、既存抽出を再評価
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

  // ★ AGENTS.common.md ルール: プロンプトはコードに書かない、DB (llm_prompts) で管理。
  //   ハードコード fallback は廃止 (2026-05-11)。DB に body 無し or is_active=false なら
  //   抽出を skip して原因を log + state に残す。
  let systemPrompt = "";
  try {
    const pRes = supa_select("llm_prompts", {
      select: "body,is_active",
      filter: "prompt_key=eq.protocol.extract&is_active=eq.true",
      limit: 1
    });
    if (pRes.ok && pRes.rows && pRes.rows.length > 0 && pRes.rows[0].body) {
      systemPrompt = String(pRes.rows[0].body || "");
    }
  } catch (e) { /* fall through */ }
  if (!systemPrompt) {
    Logger.log("[nav_protocol_extractOneForYm_] llm_prompts.protocol.extract (is_active=TRUE) が空 → skip");
    _l2_upsertState_({
      l2_kind: "protocols", target_id: projectId, scope_key: ym,
      source_hash: newHash, saved_count: 0, total_count: 0,
      llm_model: null, message: "missing llm_prompts.protocol.extract (DB に prompt が無い)"
    });
    return { ok: false, action: "missing_prompt", projectId: projectId, ym: ym };
  }

  const fb = _l2_loadFeedbackBlock_("protocols", projectId, ym);
  const aliasBlock = (typeof nameAlias_buildBlock === "function") ? nameAlias_buildBlock() : "";
  const userPrompt = "project_id: " + projectId + " / ym: " + ym + "\n\n" +
    (aliasBlock ? aliasBlock + "\n\n" : "") +
    inputText +
    (fb.block ? "\n\n" + fb.block : "");
  // protocol 抽出は markdown + examples 配列まで出力するので token 枠が必要。
  // 2048 だと "LLM parse failed" (= 出力途中で truncate された不完全 JSON) が頻発するので 4096 に拡張。
  let parsed = null;
  let llmRawErr = "";
  try { parsed = llm_callJson("default", systemPrompt, userPrompt, { maxTokens: 4096, temperature: 0.3 }); }
  catch (e) { llmRawErr = String(e).slice(0, 200); parsed = null; }
  if (!parsed || !Array.isArray(parsed.protocols)) {
    return { ok: false, action: "error_llm", projectId: projectId, ym: ym, message: llmRawErr || "LLM parse failed" };
  }

  let saved = 0;
  const savedProtocols = [];
  for (let i = 0; i < parsed.protocols.length; i++) {
    const p = parsed.protocols[i] || {};
    const title = String(p.title || "").trim().slice(0, 200);
    const content = _l2_protocolNormalizeContent_(String(p.content || "").trim());
    const imp = Math.max(1, Math.min(3, Math.round(Number(p.importance || 1))));
    const tags = Array.isArray(p.tags) ? p.tags.map(function (s) { return String(s || "").trim(); }).filter(Boolean) : [];
    if (!title || !content) continue;
    // ★ 2026-05-11 まさルール: 普遍プロトコルは project_id を持たない (title だけで一意化、複数事例を抱える)
    //    protocol_id は sha12(title) で「同タイトル = 同プロトコル」、PJ 別 examples で蓄積。
    const protocolId = "p4u-" + _l2_sha256_(title).slice(0, 12);
    const up = supa_upsert("protocols", {
      protocol_id: protocolId,
      project_id: null,                           // ★ 普遍プロトコルは PJ 紐付け null (examples で紐付ける)
      title: title,
      content: content.slice(0, 4000),
      status: "candidate",
      importance: imp,
      source: "l2_hourly_extract",
      tags: tags.slice(0, 8).join(","),
      kind: "pattern",
      is_universal: true,
      updated_at: new Date().toISOString()
    }, "protocol_id");
    if (up.ok) {
      saved++;
      savedProtocols.push({
        protocol_id: protocolId,
        title: title,
        importance: imp
      });
    }

    // ★ examples を protocol_examples に保存 (1 プロトコル : N 事例)
    const examples = Array.isArray(p.examples) ? p.examples : [];
    for (let ei = 0; ei < examples.length; ei++) {
      const ex = examples[ei] || {};
      const exPj = String(ex.project_id || projectId || "").trim();
      const exSum = String(ex.summary || "").trim();
      if (!exPj || !exSum) continue;
      try {
        supa_upsert("protocol_examples", {
          protocol_id: protocolId,
          project_id: exPj,
          occurred_on: ex.occurred_on || null,
          summary: exSum.slice(0, 1000),
          branch_point: String(ex.branch_point || "").slice(0, 2000) || null,
          criteria: String(ex.criteria || "").slice(0, 2000) || null,
          action_taken: String(ex.action_taken || "").slice(0, 2000) || null,
          // result は「アクション後に実際に起きたこと」を後追いで記録する欄。
          // 自動抽出時点では推測・学習要約を入れない。
          result: null,
          source_meeting_id: ex.source_meeting_id || null,
          llm_model: "gemini-2.5-flash",
          updated_at: new Date().toISOString()
        }, "protocol_id,project_id,occurred_on");
      } catch (eEx) { /* skip */ }
    }
  }

  _l2_upsertState_({
    l2_kind: "protocols", target_id: projectId, scope_key: ym,
    source_hash: newHash, saved_count: saved, total_count: parsed.protocols.length,
    llm_model: "gemini-2.5-flash", message: null
  });

  if (saved > 0 && fb.ids && fb.ids.length) _l2_recordFeedbackApplied_(fb.ids);

  if (savedProtocols.length > 0) {
    try {
      const pjName = _l2_resolvePjName_(projectId);
      for (let ni = 0; ni < savedProtocols.length; ni++) {
        const sp = savedProtocols[ni];
        _l2_insertNotification_({
          l2_kind: "protocols",
          target_id: projectId,
          scope_key: ym + ":protocol:" + sp.protocol_id,
          title: "⚖️ " + pjName + " (" + ym + ") AMDプロトコル candidate",
          summary: sp.title,
          saved_count: 1,
          total_count: 1,
          importance: sp.importance
        });
      }
    } catch (e) { Logger.log("[protocols] notify error: " + e); }
  }

  return { ok: true, action: "saved", projectId: projectId, ym: ym, saved: saved, total: parsed.protocols.length };
}

// ============================================================
// trigger setup (1 度実行 / 時間分散)
// ============================================================

function nav_l2_setupAllL2HourlyTriggers_() {
  if (L2_KNOWLEDGE_CRON_DISABLED_20260522) return nav_l2_disableAllL2HourlyTriggers_();
  const out = { ok: true, set: {} };
  out.set.member = _l2_setupHourlyTriggerByName_("nav_member_knowledge_pollAll", 0);
  out.set.project = _l2_setupHourlyTriggerByName_("nav_project_knowledge_pollAll", 15);
  out.set.protocol = _l2_setupHourlyTriggerByName_("nav_protocol_pollAll", 30);
  return out;
}

function nav_l2_disableAllL2HourlyTriggers_() {
  const targetFns = {
    nav_member_knowledge_pollAll: true,
    nav_project_knowledge_pollAll: true,
    nav_protocol_pollAll: true
  };
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  for (const t of triggers) {
    const fn = t.getHandlerFunction && t.getHandlerFunction();
    if (targetFns[fn]) {
      try { ScriptApp.deleteTrigger(t); removed++; } catch (e) {}
    }
  }
  return { ok: true, disabled: true, removed: removed };
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

function _l2_protocolNormalizeContent_(content) {
  let s = String(content || "").trim();
  if (!s) return "";
  s = s
    .replace(/結果[・·]学習/g, "結果")
    .replace(/学習[・·]結果/g, "結果");

  const patterns = [
    /\n{0,2}#{1,6}\s*(?:④\s*)?結果\s*\n[\s\S]*$/m,
    /\n{0,2}\*\*(?:④\s*)?結果\*\*[:：]?\s*[\s\S]*$/m,
    /\n{0,2}(?:④|4[.)．]?)\s*結果[:：]?\s*[\s\S]*$/m
  ];
  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(s)) {
      s = s.replace(patterns[i], "");
      break;
    }
  }
  return s.trim();
}

function _l2_supaUrl_() {
  return String(PropertiesService.getScriptProperties().getProperty("SUPABASE_URL") || "").trim();
}
function _l2_supaKey_() {
  return String(PropertiesService.getScriptProperties().getProperty("SUPABASE_SERVICE_KEY") || "").trim();
}

/** l2_feedbacks から「対象 (l2_kind, target_id, scope_key) + global の active feedback」を取得し
 *  LLM プロンプトに含める文字列に整形する。
 *  scope_key は完全一致または 'global' (= メンバー系の汎用フィードバック) を取る。
 *
 *  使い方:
 *    const feedbackBlock = _l2_loadFeedbackBlock_("project_knowledge", "p21", "202605");
 *    const userPrompt = "...通常の入力..." + (feedbackBlock ? "\n\n" + feedbackBlock : "");
 *    // 抽出後、saved>0 で _l2_recordFeedbackApplied_(...) を呼んで applied_count をインクリメント
 */
function _l2_loadFeedbackBlock_(l2Kind, targetId, scopeKey) {
  const filter = "l2_kind=eq." + encodeURIComponent(l2Kind) +
                 "&target_id=eq." + encodeURIComponent(targetId) +
                 "&status=eq.active";
  const res = supa_select("l2_feedbacks", {
    select: "feedback_id,scope_key,feedback_text,created_at,created_by",
    filter: filter,
    order: "created_at.desc",
    limit: 20
  });
  if (!res.ok) return { block: "", ids: [] };
  const rows = (res.rows || []).filter(function (r) {
    // scope_key 完全一致 or 'global' (= 全 scope に適用するフィードバック)
    // protocols は通知を YYYYMM:protocol:<protocol_id> 粒度に分けるため、月次抽出時は同じ ym 配下の個別 feedback も拾う。
    const protocolScoped = l2Kind === "protocols" && String(r.scope_key || "").indexOf(scopeKey + ":protocol:") === 0;
    return r.scope_key === scopeKey || r.scope_key === "global" || protocolScoped;
  });
  if (!rows.length) return { block: "", ids: [] };
  const lines = rows.slice(0, 10).map(function (r, idx) {
    const date = (r.created_at || "").slice(0, 10);
    const by = r.created_by || "user";
    return "  " + (idx + 1) + ". [" + date + " " + by + "] " + String(r.feedback_text || "").trim();
  });
  const block = "=== 過去のユーザーフィードバック (重要・必ず反映すること) ===\n" + lines.join("\n");
  return { block: block, ids: rows.map(function (r) { return r.feedback_id; }) };
}

/** 抽出が成功した (saved > 0) ときに、参照した feedback_ids について
 *  applied_count++、last_applied_at = now() で UPDATE する。
 */
function _l2_recordFeedbackApplied_(feedbackIds) {
  if (!Array.isArray(feedbackIds) || !feedbackIds.length) return;
  const url = _l2_supaUrl_() + "/rest/v1/rpc/l2f_record_applied";  // RPC 不在ケースは PATCH で対応
  // 簡易: 1 件ずつ PATCH する (件数少ないので OK)
  const key = _l2_supaKey_();
  for (let i = 0; i < feedbackIds.length; i++) {
    try {
      const fid = feedbackIds[i];
      // 取得 → applied_count++ → PATCH (race は許容、cron は同時実行されない)
      const sel = supa_select("l2_feedbacks", {
        select: "applied_count",
        filter: "feedback_id=eq." + encodeURIComponent(fid),
        limit: 1
      });
      const cur = sel.ok && sel.rows && sel.rows[0] ? Number(sel.rows[0].applied_count || 0) : 0;
      const patchUrl = _l2_supaUrl_() + "/rest/v1/l2_feedbacks?feedback_id=eq." + encodeURIComponent(fid);
      UrlFetchApp.fetch(patchUrl, {
        method: "patch",
        contentType: "application/json",
        headers: { "apikey": key, "Authorization": "Bearer " + key, "Prefer": "return=minimal" },
        payload: JSON.stringify({ applied_count: cur + 1, last_applied_at: new Date().toISOString() }),
        muteHttpExceptions: true
      });
    } catch (_e) {}
  }
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
