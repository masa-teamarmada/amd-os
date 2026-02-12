/** 072_NavigatorApi.gs
 * Navigator（PJ文脈ページ）のサーバ側API。
 * NavigatorPage.html から google.script.run で呼ぶ窓口をここに集約する。
 *
 * 目的：
 * - Monthly Extract（抽出/質問/要約）を扱う
 * - Open Issues を扱う
 * - 履歴ブロック（要約 + lazy detail）を扱う
 *
 * 注意：
 * - まずはUIが動くためのスタブ実装（ダミーデータ返し）でOK
 * - 後でRepo/Domainに分離しても、HTML側の呼び出し関数名は変えない
 */

// ===== Navigator Page: initial load =====
function nav_getNavigatorPageData(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };

  nav_repo_initNavigatorSchema_();

  const ymRaw = String(payload.ym || getCurrentYm_()).trim() || getCurrentYm_();
  const ymKey = normalizeYm(ymRaw);
  if (!ymKey) return { ok:false, message:"ym invalid" };

  const project = nav_repo_getProjectLite_(projectId);

  const monthly = nav_repo_getMonthlyExtract_(projectId, ymKey);
  const issues = nav_repo_listIssues_(projectId);
  const historyBlocks = nav_repo_listHistoryBlocks_(projectId);
  const prevMonth = nav_repo_getPrevMonth_(projectId, ymKey);

  const allTodos = nav_repo_listTodosByProject_(projectId);

  const memRes = nav_listProjectMembers({ projectId: projectId });
  const projectMembers = (memRes && memRes.ok && Array.isArray(memRes.members)) ? memRes.members : [];

  // ★admin判定（既存があればそれを使う）
  let canAccessAdmin = false;
  try{
    if (typeof canAccessAdmin_ === "function") canAccessAdmin = !!canAccessAdmin_();
    else if (typeof canAccessAdmin === "function") canAccessAdmin = !!canAccessAdmin();
  }catch(e){
    canAccessAdmin = false;
  }

  // ★追加：ValuePlan fixed の有無（UX用）
  let valuePlanFixedMeta = { exists:false, planCycleId:"", version:0 };
  try{
    const v = charter_valuePlan_loadLatestFixedByProject(projectId);
    if (v && v.planCycleId){
      valuePlanFixedMeta = {
        exists: true,
        planCycleId: String(v.planCycleId || "").trim(),
        version: Number(v.version || 0)
      };
    }
  } catch(e){
    valuePlanFixedMeta = { exists:false, planCycleId:"", version:0 };
  }

  return {
    ok:true,
    project: project,
    ym: ymKey,

    monthly: monthly,
    issues: issues,
    historyBlocks: historyBlocks,
    prevMonth: prevMonth,

    todos: { all: allTodos },

    projectMembers: projectMembers,

    exitGoal: nav_repo_getTextBlock_(projectId, "exitGoal"),
    exitImage: nav_repo_getTextBlock_(projectId, "exitImage"),

    valuePlanFixedMeta: valuePlanFixedMeta,

    // ★追加：admin UI 用
    canAccessAdmin: canAccessAdmin
  };
}

function nav_listProjectMembers(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty", members:[] };

  // DB_ProjectMembers は “本体スプシ” 側にある想定（Navigator別スプシにしない）
  const sh = getSheet_("DB_ProjectMembers");

  // 最低限この2つがあれば動く
  const header = ensureHeader_(sh, ["projectId","memberId"]);

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const values = (lastRow >= 2 && lastCol >= 1)
    ? sh.getRange(1,1,lastRow,lastCol).getValues()
    : [];

  if (!values.length) return { ok:true, members:[] };

  const head = values[0].map(x=>String(x||"").trim());
  const idx = (name)=>head.indexOf(name);

  const iPid = idx("projectId");
  const iMid = idx("memberId");
  const iCodeName = idx("codeName"); // あれば使う

  // members map（既存のHomeRepoのキャッシュ関数を使う）
  let maps = null;
  try{
    if (typeof _getMembersMapsHome_ === "function") maps = _getMembersMapsHome_();
  } catch(e){ maps = null; }

  const membersById = maps && maps.membersById ? maps.membersById : {};

  const out = [];
  const seen = {};
  for (let r=1; r<values.length; r++){
    const row = values[r];
    const pid = String(row[iPid]||"").trim();
    if (pid !== projectId) continue;

    const mid = String(row[iMid]||"").trim();
    if (!mid) continue;
    if (seen[mid]) continue;
    seen[mid] = true;

    let name = "";
    if (iCodeName >= 0) name = String(row[iCodeName]||"").trim();
    if (!name) name = String(membersById[mid] || "").trim();
    if (!name) name = mid;

    out.push({ memberId: mid, name: name });
  }

  out.sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
  return { ok:true, members: out };
}

// ===== Monthly Extract: run (LLM later) =====
function nav_runMonthlyExtract(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const ym = String(payload.ym || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ym) return { ok:false, message:"ym empty" };

  const res = nav_repo_makeMonthlyExtractDraft_(projectId, ym);

  // ★観測ログ（抽出が走った）
  try{
    if (res && res.ok){
      navObserveAppendSnapshot(projectId, String(ym).trim(), "extract_run");
    }
  }catch(e){}

  return res;
}

function nav_confirmMonthlyExtract(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const ymRaw = String(payload.ym || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ymRaw) return { ok:false, message:"ym empty" };

  const ymKey = normalizeYm(ymRaw);
  if (!ymKey) return { ok:false, message:"ym invalid" };

  const res = nav_repo_confirmMonthly_(projectId, ymKey);

  // ★観測ログ（確定）
  try{
    if (res && res.ok){
      navObserveAppendSnapshot(projectId, ymKey, "confirm");
    }
  }catch(e){}

  return res;
}

function nav_saveMonthlyAnswers(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const ymRaw = String(payload.ym || "").trim();
  const answers = payload.answers || {};
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ymRaw) return { ok:false, message:"ym empty" };

  const ymKey = normalizeYm(ymRaw);
  if (!ymKey) return { ok:false, message:"ym invalid" };

  nav_repo_initNavigatorSchema_();

  const email = (Session.getActiveUser().getEmail() || "").trim();
  const nowIso = new Date().toISOString();

  // confirmed の月は事故防止で保存不可
  const cur = nav_repo_getMonthlyExtract_(projectId, ymKey);
  if (String(cur.status||"").trim() === "confirmed"){
    return { ok:false, message:"monthly already confirmed" };
  }

  // Monthlyをdraftとして upsert（version++）
  nav_repo_upsertMonthlyDraft_({
    projectId: projectId,
    ym: ymKey,
    patch: {
      status: "draft",
      updatedAt: nowIso,
      updatedBy: email
    },
    ensureVersionBump: true
  });

  const q1 = Array.isArray(answers.q1) ? answers.q1 : [];
  const q2 = Array.isArray(answers.q2) ? answers.q2 : [];
  const q3 = String(answers.q3 || "").trim();

  const bodyLines = [];
  bodyLines.push("【Monthly Answers】");
  bodyLines.push("Q1: " + (q1.length ? q1.join(" / ") : ""));
  bodyLines.push("Q2: " + (q2.length ? q2.join(" / ") : ""));
  bodyLines.push("Q3: " + (q3 || ""));
  const body = bodyLines.join("\n");

  nav_repo_appendMonthlyItem_({
    projectId: projectId,
    ym: ymKey,
    itemType: "note",
    body: body,
    sourceType: "manual",
    sourceRef: "",
    createdAt: nowIso,
    createdBy: email
  });

  return { ok:true, projectId:projectId, ym:ymKey };
}

// ===== Issues =====
function nav_listIssues(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };

  const issues = nav_repo_listIssues_(projectId);
  return { ok:true, issues: issues };
}

function nav_upsertIssue(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const issue = payload.issue || {};
  if (!projectId) return { ok:false, message:"projectId empty" };

  return nav_repo_upsertIssue_(projectId, issue);
}

function nav_updateIssueStatus(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const issueId = String(payload.issueId || "").trim();
  const status = String(payload.status || "").trim().toLowerCase();
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!issueId) return { ok:false, message:"issueId empty" };
  if (!status) return { ok:false, message:"status empty" };

  return nav_repo_updateIssueStatus_(projectId, issueId, status);
}

// ===== History =====
function nav_listHistoryBlocks(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };

  const blocks = nav_repo_listHistoryBlocks_(projectId);
  return { ok:true, blocks: blocks };
}

function nav_getHistoryBlockDetail(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const blockId = String(payload.blockId || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!blockId) return { ok:false, message:"blockId empty" };

  const d = nav_repo_getHistoryDetail_(projectId, blockId);
  return { ok:true, blockId:blockId, detail:d.detail, links:d.links };
}

// ===== Text blocks =====
function nav_saveTextBlock(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const blockKey = String(payload.blockKey || "").trim();
  const text = String(payload.text || "");
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!blockKey) return { ok:false, message:"blockKey empty" };

  const res = nav_repo_saveTextBlock_(projectId, blockKey, text);
  return res && res.ok ? { ok:true } : (res || { ok:false, message:"save failed" });
}

// ===== utils =====
function getCurrentYm_(){
  const d = new Date();
  const y = d.getFullYear();
  const m = ("0" + (d.getMonth()+1)).slice(-2);
  return String(y) + String(m); // yyyymm
}

function nav_createIssueFromMonthlyItem(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const ymRaw = String(payload.ym || "").trim();
  const itemId = String(payload.itemId || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ymRaw) return { ok:false, message:"ym empty" };
  if (!itemId) return { ok:false, message:"itemId empty" };

  const ymKey = normalizeYm(ymRaw);
  if (!ymKey) return { ok:false, message:"ym invalid" };

  return nav_repo_createIssueFromMonthlyItem_(projectId, ymKey, itemId);
}

function nav_debugMonthlyItems(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const ymRaw = String(payload.ym || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ymRaw) return { ok:false, message:"ym empty" };

  const ymKey = normalizeYm(ymRaw);
  if (!ymKey) return { ok:false, message:"ym invalid" };

  const dbg = nav_repo_debugMonthlyItems_(projectId, ymKey);
  return { ok:true, debug: dbg };
}

function run_debugNavigatorPageData(){
  const payload = { projectId:"p21", ym:"2026-01" };
  const res = nav_getNavigatorPageData(payload);

  // 観測ポイントだけ抜く（ログが爆発しないように）
  const out = {
    ok: !!(res && res.ok),
    message: res && res.message ? String(res.message) : "",
    ymReturned: res && res.ym ? String(res.ym) : "",
    monthlyStatus: res && res.monthly ? String(res.monthly.status||"") : "",
    monthlyUpdatedAt: res && res.monthly ? String(res.monthly.updatedAt||"") : "",
    monthlyItemsCount: (res && res.monthly && Array.isArray(res.monthly.items)) ? res.monthly.items.length : 0,
    monthlyItemsHead: (res && res.monthly && Array.isArray(res.monthly.items)) ? res.monthly.items.slice(0, 3) : []
  };

  Logger.log("[NavigatorPageData debug]\n" + JSON.stringify(out, null, 2));
  return out;
}

function nav_saveMonthlyOverride(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const ymRaw = String(payload.ym || "").trim();
  const fieldKey = String(payload.fieldKey || "").trim();
  const text = String(payload.text || "");
  const note = String(payload.note || "");

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ymRaw) return { ok:false, message:"ym empty" };
  if (!fieldKey) return { ok:false, message:"fieldKey empty" };

  const ymKey = normalizeYm(ymRaw);
  if (!ymKey) return { ok:false, message:"ym invalid" };

  const res = nav_repo_saveMonthlyOverride_({
    projectId: projectId,
    ym: ymKey,
    fieldKey: fieldKey,
    text: text,
    note: note
  });

  // ★観測ログ（人が本文を修正）
  try{
    if (res && res.ok){
      navObserveAppendSnapshot(projectId, ymKey, "override_save");
    }
  }catch(e){}

  return res && res.ok ? { ok:true } : (res || { ok:false, message:"save failed" });
}

// ===== Monthly Field Fix by Feedback (LLM) =====
function nav_fixMonthlyByFeedback(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const ymRaw = String(payload.ym || "").trim();
  const fieldKey = String(payload.fieldKey || "").trim();
  const currentText = String(payload.currentText || "");
  const feedback = String(payload.feedback || "").trim();

  if (!projectId) return { ok:false, message:"projectId empty" };
  const ymKey = normalizeYm(ymRaw);
  if (!ymKey) return { ok:false, message:"ym invalid" };
  if (!fieldKey) return { ok:false, message:"fieldKey empty" };
  if (!feedback) return { ok:false, message:"feedback empty" };

  // confirmedは事故防止で弾く
  const cur = nav_repo_getMonthlyExtract_(projectId, ymKey);
  if (String(cur.status||"").trim() === "confirmed"){
    return { ok:false, message:"monthly already confirmed" };
  }

  // 根拠ログ（items）
  const items = Array.isArray(cur.items) ? cur.items : [];
  const itemsText = items.slice(0, 80).map(x=>{
    const t = String(x.itemType || "item");
    const b = String(x.body || "");
    return `- [${t}] ${b}`;
  }).join("\n");

  // LLM修正（090に入れた関数を呼ぶ）
  let fixed = null;
  try{
    fixed = _openai_fixNavigatorMonthlyFieldByFeedback_({
      projectId: projectId,
      ym: ymKey,
      fieldKey: fieldKey,
      currentText: currentText,
      feedback: feedback,
      itemsText: itemsText
    });
  }catch(e){
    return { ok:false, message:String(e && (e.message || e) || "LLM fix error") };
  }

  const fixedText = String((fixed && fixed.text) ? fixed.text : "").trim();
  if (!fixedText) return { ok:false, message:"LLM returned empty text" };

  // override保存（既存Repo）
  const res = nav_repo_saveMonthlyOverride_({
    projectId: projectId,
    ym: ymKey,
    fieldKey: fieldKey,
    text: fixedText,
    note: "llm_fix: " + feedback
  });
  if (!res || !res.ok) return res || { ok:false, message:"save failed" };

  // ★運用学習ログ（Human Fixes に注入されるやつ）
  try{
    if (typeof nav_repo_appendMonthlyEditLogForFeedback_ === "function"){
      nav_repo_appendMonthlyEditLogForFeedback_({
        projectId: projectId,
        ym: ymKey,
        fieldKey: fieldKey,
        beforeText: currentText,
        afterText: fixedText,
        note: "llm_fix: " + feedback
      });
    }
  }catch(e){
    // ここは失敗しても月次修正は成立させる
  }

  // 観測ログ（入れてるなら）
  try{
    if (typeof navObserveAppendSnapshot === "function"){
      navObserveAppendSnapshot(projectId, ymKey, "llm_fix");
    }
  }catch(e){}

  return { ok:true, projectId:projectId, ym:ymKey, fieldKey:fieldKey, text: fixedText };
}

// ===== Todos =====
function nav_upsertTodo(payload){
  payload = payload || {};
  const todo = payload.todo || {};
  const projectId = String(todo.projectId || payload.projectId || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };

  todo.projectId = projectId;

  // bucketYmは必須（yyyymm）
  todo.bucketYm = normalizeYm(todo.bucketYm);
  if (!todo.bucketYm) return { ok:false, message:"bucketYm invalid" };

  return nav_repo_upsertTodo_(todo);
}

function nav_patchTodo(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const todoId = String(payload.todoId || "").trim();
  const patch = payload.patch || {};
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!todoId) return { ok:false, message:"todoId empty" };

  if (patch.bucketYm !== undefined) patch.bucketYm = normalizeYm(patch.bucketYm);

  return nav_repo_patchTodo_(projectId, todoId, patch);
}

function nav_deleteTodo(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const todoId = String(payload.todoId || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!todoId) return { ok:false, message:"todoId empty" };

  return nav_repo_deleteTodo_(projectId, todoId);
}

function nav_applyTodoEdits(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const edits = Array.isArray(payload.edits) ? payload.edits : [];
  if (!projectId) return { ok:false, message:"projectId empty" };

  for (let i=0; i<edits.length; i++){
    const e = edits[i] || {};
    const todoId = String(e.todoId || "").trim();
    if (!todoId) continue;

    nav_repo_upsertTodo_({
      todoId: todoId,
      projectId: projectId,
      body: String(e.body || "").trim(),   // ★必須
      owner: String(e.owner || ""),
      dueDate: String(e.dueDate || ""),
      isDone: !!e.isDone,
      sortNo: (e.sortNo !== undefined) ? e.sortNo : 0,
      isProposed: false
    });
  }

  return { ok:true };
}

// ===== ValuePlan debug (from Navigator) =====
function nav_debugValuePlanFixed(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };

  try{
    const diag = charter_valuePlan_debugLoadLatestFixed(projectId);
    return { ok:true, diag: diag };
  } catch(e){
    return { ok:false, message: String(e && (e.message || e)) };
  }
}

/**
 * Tsukuyomi Nudge 由来の進捗を「今月の進捗候補」として即時に蓄積する
 * payload: { projectId, ym, items:[{itemType, body}], sourceRef? }
 */
function nav_appendMonthlyProgressItemsFromTsukuyomiNudge(payload){
  payload = payload || {};
  const projectId = String(payload.projectId||"").trim();
  const ym = String(payload.ym||"").trim();
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!/^\d{6}$/.test(ym)) return { ok:false, message:"ym invalid (yyyymm)" };

  try{
    const res = navNudgeRepo_appendItems_(projectId, ym, items, {
      sourceType: "tsukuyomi",
      sourceRef: String(payload.sourceRef||"").trim()
    });

    // ★観測ログ（材料が増えた）
    try{
      navObserveAppendSnapshot(projectId, ym, "nudge_append");
    }catch(e){}

    return { ok:true, appended: res.appended, createdAtJst: res.createdAtJst };
  }catch(e){
    return { ok:false, message:String(e && (e.message||e.stack||e) ? (e.message||e.stack||e) : e) };
  }
}

/**
 * Navigatorページ用：今月のnudge進捗を取得
 * payload: { projectId, ym, limit? }
 */
function nav_listMonthlyNudgeProgressItems(payload){
  payload = payload || {};
  const projectId = String(payload.projectId||"").trim();
  const ym = String(payload.ym||"").trim();
  const limit = (payload.limit !== undefined && payload.limit !== null) ? Number(payload.limit||0) : 200;

  if (!projectId) return { ok:false, message:"projectId empty", items:[] };
  if (!/^\d{6}$/.test(ym)) return { ok:false, message:"ym invalid (yyyymm)", items:[] };

  try{
    const items = navNudgeRepo_listItemsByProjectYm_(projectId, ym, limit);
    return { ok:true, items: items };
  }catch(e){
    return { ok:false, message:String(e && (e.message||e.stack||e) ? (e.message||e.stack||e) : e), items:[] };
  }
}
