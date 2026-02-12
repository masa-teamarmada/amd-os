/** 171_TsukuyomiReply.gs
 *
 * 目的：
 * - つくよみ投稿への「スレッド返信」だけを拾い、スレッドを読んでスレッドへ返信する
 *
 * 方針：
 * - 人格：DB_LLMContext(tags=tsukuyomi, status=active) を既存Opsから取得
 * - 入力：スレッド履歴（conversations.replies 直近N件）
 * - 出力：「次の一手」を短く（1〜5行、確認質問は最大1つ）
 * - 送信：thread_ts へ返信
 */

function tsukuyomiHandleThreadReplyEvent(payload){
  payload = payload || {};
  const channelId = String(payload.channelId || "").trim();
  const threadTs = String(payload.threadTs || "").trim();
  const triggerUserId = String(payload.triggerUserId || "").trim();

  if (!channelId || !threadTs) return { ok:false, message:"missing channelId/threadTs" };

  try{
    // 1) スレッド履歴
    const history = tsukuyomiFetchThreadHistory(channelId, threadTs, 12);

    // 最後の発話（ユーザー側っぽいもの）を拾う
    // ★Slackは順序/発言者がズレやすいので「後ろから見て、bot以外の最新テキスト」を採用する
    const arr = Array.isArray(history) ? history : [];
    let lastUserText = "";
    for (let i = arr.length - 1; i >= 0; i--){
      const m = arr[i] || {};
      const t = String(m.text || "").trim();
      if (!t) continue;

      const subtype = String(m.subtype || "").trim();
      const botId = String(m.bot_id || "").trim();
      const username = String(m.username || "").trim();

      // botっぽいのは除外
      const looksBot = (subtype === "bot_message") || !!botId || !!username;
      if (looksBot) continue;

      lastUserText = t;
      break;
    }

    // ★カナリア検査は「誰が言ったか」ではなく「最新の非bot発言に含まれるか」で判定する
    // これで検査が外れなくなる


    // 2) つくめも保存（失敗しても返信は続行）
    let learned = false;
    try{
      const last = arr.length ? (arr[arr.length - 1] || {}) : {};
      const lastText = String(last.text || "").trim();
      const hasTsukMemo = lastText.indexOf("つくめも") !== -1;

      if (hasTsukMemo && typeof tsukuyomiForceSaveTsukMemo_ === "function"){
        const saved = tsukuyomiForceSaveTsukMemo_(channelId, threadTs, triggerUserId, lastText);
        learned = !!(saved && saved.ok);
      }
    }catch(_e){
      learned = false;
    }

    // 3) systemPrompt（ベース）
    let systemBase = "";
    if (typeof tsukuyomi_buildSystemPromptBaseFromContextDb === "function"){
      systemBase = tsukuyomi_buildSystemPromptBaseFromContextDb({ intent:"thread" });
    } else if (typeof tsukuyomi_buildSystemPromptBase === "function"){
      systemBase = tsukuyomi_buildSystemPromptBase({ });
    } else {
      systemBase = tsukuyomiBuildSystemPromptBaseFallback({});
    }
    systemBase = String(systemBase || "").trim();

    // 3.1) DB_TsukuyomiContext の active ルールを“先頭に”注入（ここが本体）
    // - ここが入れば、社交辞令テンプレよりルールが上に来る
    // - DB側を変えるだけで挙動を変えられる（UI編集の価値が残る）
    let injectedCount = 0;
    let injectedText = "";

    try{
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sh = ss.getSheetByName("DB_TsukuyomiContext");
      if (sh){
        const lastRow = sh.getLastRow();
        const lastCol = sh.getLastColumn();
        if (lastRow >= 2 && lastCol >= 1){
          const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(v => String(v||"").trim());
          const idx = {};
          header.forEach((h,i)=>{ if(h) idx[h] = i; });

          const iTags = (idx.tags !== undefined) ? idx.tags : -1;
          const iStatus = (idx.status !== undefined) ? idx.status : -1;
          const iPrompt = (idx.systemPrompt !== undefined) ? idx.systemPrompt : -1;
          const iPriority = (idx.priority !== undefined) ? idx.priority : -1;

          if (iTags >= 0 && iStatus >= 0 && iPrompt >= 0){
            const vals = sh.getRange(2,1,lastRow-1,lastCol).getValues();
            const rows = [];

            for (let r=0; r<vals.length; r++){
              const tags = String(vals[r][iTags] || "").trim();
              const status = String(vals[r][iStatus] || "").trim();
              const sp = String(vals[r][iPrompt] || "").trim();
              if (!sp) continue;

              // tags は "tsukuyomi" を含めばOK（カンマ区切り想定）
              const tagOk = tags.split(",").map(s=>String(s||"").trim()).includes("tsukuyomi");
              if (!tagOk) continue;
              if (status !== "active") continue;

              const pr = (iPriority >= 0) ? Number(vals[r][iPriority] || 0) : 30;
              rows.push({ pr: isNaN(pr) ? 30 : pr, sp: sp });
            }

            rows.sort((a,b)=>b.pr-a.pr);
            injectedCount = rows.length;

            if (rows.length){
              const lines = [];
              lines.push("【最優先ルール】");
              lines.push("以下は他の指示より優先。社交辞令よりも優先。例に従う。");
              lines.push("");
              rows.slice(0, 40).forEach(x => {
                lines.push("- " + x.sp);
              });
              injectedText = lines.join("\n").trim();
            }
          }
        }
      }
    } catch(_e){
      injectedCount = 0;
      injectedText = "";
    }

    // “先頭に注入”する（ここが重要）
    if (injectedText){
      systemBase = injectedText + "\n\n" + systemBase;
    }

    // 3.2) カナリア：LLMを呼ばずに「いまのsystemBaseの証拠」を返す
    if (lastUserText && lastUserText.indexOf("カナリア") !== -1){
      const sys = String(systemBase || "");
      const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sys, Utilities.Charset.UTF_8);
      const hash = bytes.map(b => ("0" + ((b < 0 ? b + 256 : b).toString(16))).slice(-2)).join("").slice(0, 16);

      const hasNg = (sys.indexOf("つくぼー") !== -1);

      const msg =
        "OK:CONTEXT_FINGERPRINT\n" +
        "sysLen=" + sys.length + "\n" +
        "sysHash16=" + hash + "\n" +
        "injectedCount=" + injectedCount + "\n" +
        "sysHasTsukubo=" + (hasNg ? "1" : "0");

      tsukuyomiPostThreadReply(channelId, threadTs, msg);
      return { ok:true, canary:true, sysLen: sys.length, injectedCount: injectedCount, sysHasTsukubo: hasNg };
    }

    // ★デバッグ：systemBaseの要約を返す（LLMを呼ばない）
    // Slack履歴は順序/発言者の揺れがあるので、lastUserTextに依存しない
    // スレッド内の最新側から「systemBase?」「system?」を含む発言を探して発火する
    let dbgTrigger = false;
    try{
      for (let i = arr.length - 1; i >= 0; i--){
        const m = arr[i] || {};
        const t = String(m.text || "").trim();
        if (!t) continue;
        if (t.indexOf("systemBase?") !== -1 || t.indexOf("system?") !== -1){
          dbgTrigger = true;
          break;
        }
      }
    }catch(_e){
      dbgTrigger = false;
    }

    if (dbgTrigger){
      const sys = String(systemBase || "");
      const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sys, Utilities.Charset.UTF_8);
      const hash16 = bytes.map(b => ("0" + ((b < 0 ? b + 256 : b).toString(16))).slice(-2)).join("").slice(0, 16);

      const hasNg = (sys.indexOf("つくぼー") !== -1);

      const msg =
        "SYS_SUMMARY\n" +
        "len=" + sys.length + "\n" +
        "hash16=" + hash16 + "\n" +
        "hasTsukubo=" + (hasNg ? "1" : "0");

      tsukuyomiPostThreadReply(channelId, threadTs, msg);
      return { ok:true, debug:true, len: sys.length, hash16: hash16, hasTsukubo: hasNg };
    }

    // 4) userPrompt
    const userPrompt = tsukuyomiBuildUserPrompt(history, triggerUserId);

    // 5) LLM
    const replyText = tsukuyomiCallOpenAiResponses(systemBase, userPrompt);
    const finalText = String(replyText || "").trim();
    if (!finalText) throw new Error("empty reply from LLM");

    // 6) 返信
    let out = finalText;
    if (learned){
      out += "\n\n（つくめもに入れといた🌙）";
    }

    tsukuyomiPostThreadReply(channelId, threadTs, out);
    return { ok:true, learned: learned };

  }catch(e){
    const msg = (e && e.message) ? String(e.message) : String(e || "error");
    try{
      tsukuyomiPostThreadReply(
        channelId,
        threadTs,
        "今ちょっとコケたかも…。もう一回言ってみて🌙\n（内部エラー：" + msg.slice(0, 160) + "）"
      );
    }catch(_e2){}
    return { ok:false, message: msg };
  }
}

// ===== Tsukuyomi learning from feedback (thread replies) =====

function tsukuyomiMaybeLearnFromThread(channelId, threadTs, triggerUserId, history){
  const arr = Array.isArray(history) ? history : [];
  if (!arr.length) return { ok:true, learned:false };

  const last = arr[arr.length - 1] || {};
  const lastText = String(last.text || "").trim();
  if (!lastText) return { ok:true, learned:false };

  // ★最優先：つくめも明示なら問答無用で保存する（LLM/他関数に依存しない）
  const isTsukMemo = (lastText.indexOf("つくめも") !== -1);

  if (isTsukMemo){
    const saved = tsukuyomiForceSaveTsukMemo_(channelId, threadTs, triggerUserId, lastText);
    if (saved && saved.ok){
      return { ok:true, learned:true, mode:saved.mode, rowIndex:saved.rowIndex, contextId:saved.contextId };
    }
    return { ok:false, learned:false, message: saved && saved.message ? saved.message : "tsukmemo save failed" };
  }

  // ★つくめも無しなら、いまはMVPとして学習しない（まず確実トリガーだけで回す）
  // ここを後で「暗黙フィードバックも拾う」に拡張すればOK
  return { ok:true, learned:false };
}

/**
 * つくめも強制保存
 * - tags は固定 tsukuyomi
 * - scopeKey は使わない
 * - 既存統合は一旦やらず、まず insert で確実に残す（MVP）
 */
function tsukuyomiForceSaveTsukMemo_(channelId, threadTs, triggerUserId, rawText){
  const ss = tsukuyomiGetDbSs();
  const sh = ss.getSheetByName("DB_TsukuyomiContext");
  if (!sh) return { ok:false, message:"sheet not found: DB_TsukuyomiContext" };

  // 以下、元のまま
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(v => String(v||"").trim());
  const col = {};
  header.forEach((h,i)=>{ if(h) col[h] = i + 1; });

  // 必須カラム最低限チェック（不足してたら即分かるように返す）
  const need = ["tags","status","systemPrompt","contextId","contextType","priority","scope","scopeKey","createdAtJst","updatedAtJst"];
  const missing = need.filter(k => !col[k]);
  if (missing.length){
    return { ok:false, message:"missing columns: " + missing.join(",") };
  }

  const now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");

  // 「つくめもに入れといて」系はノイズなので軽く剥がす
  const cleaned = tsukuyomiStripTsukMemoPrefix_(rawText);
  const prompt = cleaned || ("つくめも：" + String(rawText || "").trim());

  // 1行ぶんの配列を作る（列数ぶん）
  const lastCol = sh.getLastColumn();
  const row = new Array(lastCol).fill("");

  // 値をセット（UI方針に合わせて tags固定・scopeKey空）
  row[col.tags - 1] = "tsukuyomi";
  row[col.status - 1] = "active";
  row[col.systemPrompt - 1] = prompt;

  row[col.contextId - 1] = Utilities.getUuid();
  row[col.contextType - 1] = "tone_feedback"; // 口調・挨拶・テンションはここに寄せる
  row[col.priority - 1] = "30";
  row[col.scope - 1] = "project";
  row[col.scopeKey - 1] = "";

  if (col.rationale) row[col.rationale - 1] = "tsukmemo_thread";
  if (col.evidenceSnippet) row[col.evidenceSnippet - 1] = "";
  if (col.sourceEventIdsJson) row[col.sourceEventIdsJson - 1] = JSON.stringify({
    channelId: String(channelId || ""),
    threadTs: String(threadTs || ""),
    triggerUserId: String(triggerUserId || "")
  });

  row[col.createdAtJst - 1] = now;
  row[col.updatedAtJst - 1] = now;

  try{
    sh.appendRow(row);

    // 追加した行番号を返す（append後に lastRow 取り直し）
    const rowIndex = sh.getLastRow();
    return { ok:true, mode:"insert", rowIndex: rowIndex, contextId: row[col.contextId - 1] };
  }catch(e){
    const msg = (e && e.stack) ? String(e.stack) : String(e || "append failed");
    return { ok:false, message: msg };
  }
}

function tsukuyomiStripTsukMemoPrefix_(text){
  let s = String(text || "").trim();
  if (!s) return "";

  // よくある言い回しを雑に除去（MVP）
  s = s.replaceAll("つくめもに入れといて", "");
  s = s.replaceAll("つくめもに入れといてね", "");
  s = s.replaceAll("つくめも入れといて", "");
  s = s.replaceAll("つくめも入れといてね", "");
  s = s.replaceAll("つくめもに入れといてー", "");
  s = s.replaceAll("つくめもに入れといてー。", "");
  s = s.replaceAll("つくめもに入れといて。", "");
  s = s.replaceAll("つくめもに入れといてね。", "");
  s = s.replaceAll("つくめも", ""); // 文頭に残った単語だけ落とす意図

  // 余計な区切り記号だけ整える
  s = s.replace(/^[\s:：\-—\(\)（）wｗ]+/g, "").trim();
  return s;
}

function tsukuyomiLooksLikeFeedbackTrigger(text){
  const t = String(text || "");
  const keys = [
    "メモリ", "覚え", "次から", "ルール", "修正",
    "ズレ", "違う", "つくめも"
  ];
  return keys.some(k => t.indexOf(k) !== -1);
}


/**
 * LLMで「学習する？」を判定して、保存用の payload を作る
 * 返却: { learned, contextType, scope, scopeKey?, priority, systemPrompt, rationale }
 */
function tsukuyomiJudgeLearningAndMergeWithLlm(channelId, threadTs, triggerUserId, history, lastText, isTsukMemo){
  if (typeof tsukuyomiCallOpenAiResponses !== "function"){
    // ★つくめも明示なら、LLM無しでも最低限書く
    if (isTsukMemo) {
      return {
        learned:true,
        action:"insert",
        targetRowIndex:0,
        contextType:"behavior_rule",
        scope:"project",
        priority:"30",
        systemPrompt: "つくめも：" + String(lastText || "").trim(),
        rationale:"llm_missing_fallback"
      };
    }
    return { learned:false };
  }
  if (typeof tsukuyomi_listContextRows !== "function"){
    if (isTsukMemo) {
      return {
        learned:true,
        action:"insert",
        targetRowIndex:0,
        contextType:"behavior_rule",
        scope:"project",
        priority:"30",
        systemPrompt: "つくめも：" + String(lastText || "").trim(),
        rationale:"list_missing_fallback"
      };
    }
    return { learned:false };
  }

  // 既存候補（active / tags=tsukuyomi）を拾う：LLMに「update先」を選ばせる
  const existing = (tsukuyomi_listContextRows({ tag:"tsukuyomi", status:"active", scope:"", scopeKey:"" }) || {}).rows || [];
  const candidates = existing.map(r => ({
    rowIndex: Number(r.rowIndex || 0),
    contextType: String(r.contextType || ""),
    scope: String(r.scope || ""),
    priority: String(r.priority || ""),
    head: String(r.systemPrompt || "").replace(/\s+/g," ").slice(0, 140)
  }))
  .filter(x => x.rowIndex >= 2);

  const sys =
    "あなたはSlack bot「つくよみ」の『つくめも（ルール手帳）』編集補助。\n" +
    "目的：ユーザーのフィードバックを、今後のルールとしてDBへ統合する。\n" +
    "重要：ルールが増殖しないように、可能なら既存行をupdateして統合する。\n" +
    "出力はJSONのみ。余計な文章は禁止。\n" +
    "学習するのは『今後も繰り返し有効な一般ルール』だけ。\n" +
    "一回限りの状況説明、個人情報、機密情報、具体PJ内部の秘匿は学習しない。\n" +
    "contextType は tone_feedback / fact_feedback / behavior_rule のどれか。\n" +
    "scope は project または global。\n" +
    "action は insert または update。updateのとき targetRowIndex を必須。\n" +
    "systemPrompt は、つくよみへの『今後の指針』として書く（命令口調を避ける）。\n" +
    "priority は数値文字列。推奨は 30。\n" +
    "つくめもが明示されている場合は、原則 learned=true（ただし機密・個人情報なら learned=false）。\n";

  // 履歴要約
  const lines = [];
  lines.push("【今回の最新発言】");
  lines.push(String(lastText || ""));

  lines.push("");
  lines.push("【つくめも明示】 " + (isTsukMemo ? "true" : "false"));

  lines.push("");
  lines.push("【既存ルール候補（要約）】");
  candidates.slice(0, 60).forEach(c => {
    lines.push(
      "row=" + c.rowIndex +
      " type=" + c.contextType +
      " scope=" + c.scope +
      " pr=" + c.priority +
      " head=" + c.head
    );
  });

  lines.push("");
  lines.push("JSONスキーマ：");
  lines.push('{"learned":true|false,"action":"insert|update","targetRowIndex":0,"contextType":"tone_feedback|fact_feedback|behavior_rule","scope":"project|global","priority":"30","systemPrompt":"...","rationale":"..."}');

  const out = tsukuyomiCallOpenAiResponses(sys, lines.join("\n"));
  const obj = tsukuyomiParseJsonSafe_(out);

  // ★ここが今回の肝：JSONが壊れてても「つくめも明示なら必ず学習」に倒す
  if (!obj){
    if (!isTsukMemo) return { learned:false };

    // フォールバック：最後の発言を「ルール文」に整形して保存
    const sys2 =
      "次の文を『今後のつくよみのルール』として自然な1〜2文に整形して返して。JSON不要、文章だけ。\n" +
      "命令口調を避けて、方針として書く。";
    const ruleText = String(tsukuyomiCallOpenAiResponses(sys2, String(lastText||"")) || "").trim();

    const sp = ruleText || ("つくめも：" + String(lastText||"").trim());

    return {
      learned:true,
      action:"insert",
      targetRowIndex:0,
      contextType:"tone_feedback",  // 「言い方」系が多いのでデフォはこれ
      scope:"project",
      priority:"30",
      systemPrompt: sp,
      rationale:"tsukmemo_fallback_json_parse_failed"
    };
  }

  // つくめも明示なら learned=true を強制（ただしsystemPromptが空はダメ）
  const sp0 = String(obj.systemPrompt || "").trim();
  const learned = (obj.learned === true) || (isTsukMemo === true);
  if (!learned || !sp0) return { learned:false };

  const ctRaw = String(obj.contextType || "").trim();
  const scRaw = String(obj.scope || "").trim();

  const ct = (ctRaw === "tone_feedback" || ctRaw === "fact_feedback" || ctRaw === "behavior_rule")
    ? ctRaw
    : "behavior_rule";

  const sc = (scRaw === "project" || scRaw === "global") ? scRaw : "project";

  const actionRaw = String(obj.action || "").trim();
  const action = (actionRaw === "update" || actionRaw === "insert") ? actionRaw : "insert";

  const targetRowIndex = Number(obj.targetRowIndex || 0);

  return {
    learned:true,
    action: (action === "update" && targetRowIndex >= 2) ? "update" : "insert",
    targetRowIndex: (action === "update" && targetRowIndex >= 2) ? targetRowIndex : 0,
    contextType: ct,
    scope: sc,
    priority: String(obj.priority || "30").trim() || "30",
    systemPrompt: sp0,
    rationale: String(obj.rationale || "").trim()
  };
}

function tsukuyomiParseJsonSafe_(s){
  const raw = String(s || "").trim();
  if (!raw) return null;

  // ```json ``` を剥がす
  const stripped = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try{
    return JSON.parse(stripped);
  }catch(e){
    return null;
  }
}

/**
 * DB_TsukuyomiContext に行追加（既存Repoを利用）
 * tags は固定で tsukuyomi、scopeKey は使わない
 */
function tsukuyomiUpsertLearningContext(judge){
  if (typeof admin_upsertTsukuyomiContextRow !== "function"){
    return { ok:false, message:"admin_upsertTsukuyomiContextRow missing" };
  }
  if (typeof tsukuyomi_listContextRows !== "function"){
    return { ok:false, message:"tsukuyomi_listContextRows missing" };
  }

  const now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");

  // update時は、既存行の contextId / createdAtJst を保持する
  let keep = null;
  if (judge.action === "update" && judge.targetRowIndex >= 2){
    const rows = (tsukuyomi_listContextRows({ tag:"tsukuyomi", status:"", scope:"", scopeKey:"" }) || {}).rows || [];
    keep = rows.find(r => Number(r.rowIndex || 0) === Number(judge.targetRowIndex));
  }

  const payload = {
    rowIndex: (keep && keep.rowIndex) ? Number(keep.rowIndex) : 0,

    tags: "tsukuyomi",
    status: "active",

    systemPrompt: String(judge.systemPrompt || "").trim(),
    contextType: String(judge.contextType || "").trim(),
    priority: String(judge.priority || "30").trim(),

    scope: String(judge.scope || "project").trim(),
    scopeKey: "",

    rationale: String(judge.rationale || "").trim(),
    evidenceSnippet: "",
    sourceEventIdsJson: "",

    // ★updateなら保持、insertなら新規
    contextId: (keep && keep.contextId) ? String(keep.contextId || "") : "",
    createdAtJst: (keep && keep.createdAtJst) ? String(keep.createdAtJst || "") : now
  };

  const res = admin_upsertTsukuyomiContextRow(payload) || {};
  if (!res.ok) return { ok:false, message: res.message || "upsert failed" };

  return {
    ok:true,
    mode: payload.rowIndex ? "update" : "insert",
    rowIndex: payload.rowIndex ? payload.rowIndex : (res.rowIndex || 0),
    contextId: res.contextId || payload.contextId || ""
  };
}

function tsukuyomiFetchThreadHistory(channelId, threadTs, limit){
  const ch = String(channelId || "").trim();
  const ts = String(threadTs || "").trim();
  const lim = Math.min(Math.max(Number(limit || 0) || 12, 3), 30);
  if (!ch || !ts) return [];

  const obj = slack_callApi("conversations.replies", {
    channel: ch,
    ts: ts,
    limit: lim,
    inclusive: true
  });

  const msgs = obj && Array.isArray(obj.messages) ? obj.messages : [];
  return msgs.map(m => ({
    ts: String(m.ts || ""),
    user: String(m.user || ""),
    username: String(m.username || ""),
    bot_id: String(m.bot_id || ""),
    subtype: String(m.subtype || ""),
    text: String(m.text || "")
  }));
}

function tsukuyomiBuildUserPrompt(history, triggerUserId){
  // ★コード側で「行数」「質問数」「長文禁止」などの縛りを入れない
  // ここはスレッド履歴を渡すだけ。口調・性格・振る舞いは Context（system prompt）に任せる
  const lines = [];
  lines.push("以下はSlackスレッドの履歴。文脈を読んで返信を作って。");
  lines.push("");

  const arr = Array.isArray(history) ? history : [];
  for (let i=0; i<arr.length; i++){
    const h = arr[i] || {};
    const who = h.bot_id ? ("bot:" + (h.username || h.bot_id)) : ("user:" + (h.user || "unknown"));
    const txt = String(h.text || "").replace(/\s+/g, " ").trim();
    if (!txt) continue;
    lines.push("[" + who + "] " + txt);
  }

  if (triggerUserId){
    lines.push("");
    lines.push("返信トリガーのユーザー: " + triggerUserId);
  }

  return lines.join("\n");
}

function tsukuyomiCallOpenAiResponses(systemPrompt, userPrompt){
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty("OPENAI_API_KEY") || "").trim();
  const model = String(props.getProperty("OPENAI_MODEL") || "").trim();

  if (!apiKey) throw new Error("missing OPENAI_API_KEY");
  if (!model) throw new Error("missing OPENAI_MODEL");

  const url = "https://api.openai.com/v1/responses";

  const payload = {
    model: model,
    input: [
      { role: "system", content: String(systemPrompt || "").trim() },
      { role: "user", content: String(userPrompt || "").trim() }
    ],
    max_output_tokens: 220
  };

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    headers: { Authorization: "Bearer " + apiKey },
    muteHttpExceptions: true
  });

  const txt = res.getContentText() || "";
  let obj = null;
  try{ obj = JSON.parse(txt); } catch(_e){ obj = null; }

  if (!obj) throw new Error("OpenAI invalid json: " + txt.slice(0, 200));
  if (obj.error) throw new Error("OpenAI error: " + JSON.stringify(obj.error));

  const out = String(obj.output_text || "").trim();
  if (out) return out;

  // フォールバック（モデル差分吸収）
  try{
    const output = Array.isArray(obj.output) ? obj.output : [];
    for (let i=0; i<output.length; i++){
      const item = output[i] || {};
      const content = Array.isArray(item.content) ? item.content : [];
      for (let j=0; j<content.length; j++){
        const c = content[j] || {};
        if (c.type === "output_text" && c.text) return String(c.text).trim();
      }
    }
  } catch(_e){}

  return "";
}

function tsukuyomiPostThreadReply(channelId, threadTs, text){
  const ch = String(channelId || "").trim();
  const ts = String(threadTs || "").trim();
  const t = String(text || "").trim();
  if (!ch) throw new Error("tsukuyomiPostThreadReply: channelId empty");
  if (!ts) throw new Error("tsukuyomiPostThreadReply: threadTs empty");
  if (!t) throw new Error("tsukuyomiPostThreadReply: text empty");

  // 185_SlackNotify.gs の基盤に寄せて thread_ts 付きで送る
  return slack_callApi("chat.postMessage", {
    channel: ch,
    text: t,
    thread_ts: ts
  });
}

function tsukuyomiBuildSystemPromptBaseFallback(persona){
  // ★コード側で性格・文体・長さ・質問数などを縛らない
  // ここは「運用上の事故防止」だけに限定
  const p = persona || {};
  const name = String(p.name || "tsukuyomi").trim();
  const style = String(p.style || "").trim();

  const lines = [];
  lines.push("あなたはSlack内のアシスタント「" + name + "」。");
  lines.push("与えられたスレッド履歴だけを根拠に返信する。");
  lines.push("スレッド外の会話に割り込まない。");
  lines.push("不明な点は推測せず、不明と書く。");
  if (style) lines.push(style); // styleが入っていても「口調・性格：」みたいな指定ラベルは付けない

  return lines.join("\n");
}

function tsukuyomiHasTsukMemoTrigger(text){
  const t = String(text || "");
  // 「つくめも」って単語が入ってたら確実に学習フローへ
  return t.indexOf("つくめも") !== -1;
}
