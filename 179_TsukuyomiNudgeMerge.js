/**
 * 179_TsukuyomiNudgeMerge.gs
 *
 * 役割：
 * - posted な nudge のスレッド返信と直近7日のSlackログを回収
 * - LLMで「月次進捗候補」を雑に抽出
 * - Navigatorに追記できる関数があれば呼ぶ
 * - 無ければ DB_TsukuyomiNudgeArtifacts に保存して merged 扱いにする（データは残る）
 */

function tsukuyomi_mergePostedNudges(){
  const now = new Date();
  const nowJst = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss");

  const qSheet = getSheet_("DB_TsukuyomiNudgeQueue");
  ensureHeader_(qSheet, [
    "nudgeId",
    "projectId",
    "projectName",
    "slackChannelId",
    "ym",
    "plannedAtJst",
    "plannedHourBucket",
    "needMention",
    "mentionMemberIdsJson",
    "status",
    "reason",
    "postedTs",
    "createdAtJst",
    "updatedAtJst"
  ]);

  const vals = qSheet.getDataRange().getValues();
  if (vals.length < 2) return { ok:true, merged:0 };

  const h = vals[0].map(x=>String(x||"").trim());
  const idx = {};
  h.forEach((k,i)=>{ if(k) idx[k]=i; });

  // artifacts sheet
  const aSheet = getSheetOrCreate_("DB_TsukuyomiNudgeArtifacts");
  ensureHeader_(aSheet, [
    "artifactId",
    "nudgeId",
    "projectId",
    "ym",
    "channelId",
    "postedTs",
    "threadRepliesJson",
    "channelDigestText",
    "extractedItemsJson",
    "createdAtJst"
  ]);

  let merged = 0;

  for (let r=1; r<vals.length; r++){
    const status = String(vals[r][idx.status]||"").trim();
    if (status !== "posted") continue;

    const nudgeId = String(vals[r][idx.nudgeId]||"").trim();
    const projectId = String(vals[r][idx.projectId]||"").trim();
    const projectName = String(vals[r][idx.projectName]||"").trim();
    const channelId = String(vals[r][idx.slackChannelId]||"").trim();
    const ym = String(vals[r][idx.ym]||"").trim();
    const postedTs = String(vals[r][idx.postedTs]||"").trim();

    if (!projectId || !channelId || !postedTs) continue;

    // スレッド返信回収
    const replies = _tsukuyomi_fetchThreadReplies_(channelId, postedTs);

    // チャンネル直近7日ダイジェスト
    const digest = _tsukuyomi_fetchSlackDigestForQuestion_(channelId, 7);

    // LLM抽出：月次に入れる進捗候補
    const items = _tsukuyomi_llmExtractMonthlyProgressItems_(projectName, ym, replies, digest);

    // artifacts保存（まず正本を残す）
    aSheet.appendRow([
      Utilities.getUuid().replace(/-/g,""),
      nudgeId,
      projectId,
      ym,
      channelId,
      postedTs,
      JSON.stringify(replies || []),
      String(digest || ""),
      JSON.stringify(items || []),
      nowJst
    ]);

    // Navigatorへ即時反映（Repo直叩き：確実にDB_NavigatorNudgeItemsへ入れる）
    let pushed = false;
    try{
      const resNav = navNudgeRepo_appendItems_(projectId, ym, items, {
        sourceType: "tsukuyomi",
        sourceRef: postedTs
      });
      pushed = !!(resNav && resNav.ok);
    }catch(e){
      pushed = false;
    }

    // Queue更新：merged（Navigatorに入らなくても artifacts に残ってるのでOK）
    qSheet.getRange(r+1, idx.status+1).setValue("merged");
    qSheet.getRange(r+1, idx.updatedAtJst+1).setValue(nowJst);

    _tsukuyomi_appendNudgeLog_("merged", {
      projectId, nudgeId, channelId, postedTs, ym, pushed, itemsCount: (items||[]).length
    });

    merged++;
  }

  return { ok:true, merged };
}


// ===== Slack fetch =====
function _tsukuyomi_fetchThreadReplies_(channelId, threadTs){
  const ch = String(channelId||"").trim();
  const ts = String(threadTs||"").trim();
  if (!ch || !ts) return [];

  function isSystemLine_(text){
    const t = String(text||"").trim();
    if (!t) return true;

    // JP/ENの典型
    if (t.includes("新メンバーがチャンネルに参加しました")) return true;
    if (t.toLowerCase().includes("has joined the channel")) return true;
    if (t.toLowerCase().includes("joined the channel")) return true;
    if (t.toLowerCase().includes("left the channel")) return true;

    // Slackのよくあるjoin/leave/rename系の匂い
    if (/(参加しました|退出しました|招待しました|チャンネル名を変更しました|トピックを変更しました)/.test(t)) return true;

    return false;
  }

  try{
    const obj = slack_callApi("conversations.replies", {
      channel: ch,
      ts: ts,
      limit: 50,
      inclusive: true
    });

    const msgs = obj && Array.isArray(obj.messages) ? obj.messages : [];
    if (msgs.length <= 1) return [];

    // 先頭は親なのでスキップ、返信だけ
    const replies = msgs.slice(1);

    return replies
      .map(m => ({
        user: String(m.user||"").trim(),
        ts: String(m.ts||"").trim(),
        text: String(m.text||"").trim(),
        subtype: String(m.subtype||"").trim()
      }))
      .filter(x => {
        // userが空のやつはシステム寄り（bot_idだけの可能性もあるけど、今回は安全側で落とす）
        if (!x.user) return false;

        // subtypeがあるやつも基本はシステム系が多い（bot_message以外）
        if (x.subtype) return false;

        // 明示的なシステム文除外
        if (isSystemLine_(x.text)) return false;

        return !!x.text;
      })
      .map(x => ({ user:x.user, ts:x.ts, text:x.text })); // 後段互換
  }catch(e){
    return [];
  }
}

// ===== LLM extract =====
function _tsukuyomi_llmExtractMonthlyProgressItems_(projectName, ym, replies, digestText){
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty("OPENAI_API_KEY")||"").trim();
  const model = String(props.getProperty("OPENAI_MODEL")||"gpt-4o-mini").trim();

  const repArr = Array.isArray(replies) ? replies : [];
  const repTextsRaw = repArr.map(x => String(x && x.text ? x.text : "").trim()).filter(t => t);

  // ===== system/join系を判定する（入力も出力も同じ基準で検疫）
  function isSystemLine_(text){
    const t = String(text||"").trim();
    if (!t) return true;

    // 日本語 join/leave
    if (/参加しました|退出しました|招待しました|チャンネル名を変更しました|トピックを変更しました/.test(t)) return true;

    // 「新メンバー」「新しいメンバー」系（言い換え含む）
    if (/新(しい)?メンバー/.test(t) && /(参加|加入|参加しました|加入しました)/.test(t)) return true;
    if (/プロジェクトに新(しい)?メンバーが(参加|加入)しました/.test(t)) return true;

    // <@Uxxxx>さんが〜参加/退出
    if (/<@U[0-9A-Z]+>.*(参加しました|退出しました|加入しました)/i.test(t)) return true;

    // 英語
    const low = t.toLowerCase();
    if (low.includes("has joined the channel")) return true;
    if (low.includes("joined the channel")) return true;
    if (low.includes("left the channel")) return true;

    return false;
  }

  function sanitizeText_(s){
    // 複数行テキストから system/join を落とす
    const lines = String(s||"")
      .split("\n")
      .map(x=>String(x||"").trim())
      .filter(x=>x && !isSystemLine_(x));
    return lines.join("\n").trim();
  }

  const repTexts = repTextsRaw.filter(t => !isSystemLine_(t));
  const digestClean = sanitizeText_(digestText);

  // フォールバック（LLM無しでも“返信があればそれを進捗として残す”）
  if (!apiKey){
    return _tsukuyomi_fallbackItemsFromReplies_(repTexts, digestClean, "no api key");
  }

  const system = [
    "あなたはAMD OSの月次進捗抽出器。",
    "入力はSlackのスレッド返信と、直近ログ抜粋。",
    "",
    "重要：このPJはNotionが空でもあり得る。Slack返信が進捗の一次情報。",
    "返信に少しでも進捗が書いてあるなら、必ず月次に残る形で要約して items にする。",
    "",
    "禁止：",
    "- 参加しました/新メンバー参加/加入 などのシステム通知を進捗として出さない",
    "",
    "制約：",
    "- 最大10件",
    "- 出力はJSONのみ（items配列）",
    "- 各要素は { itemType:'progress|risk|nextAction|decided', body:'短文' }",
    "- 推測で盛らない",
    "- 返信があるのに0件はNG。最低1件は作る"
  ].join("\n");

  const user = [
    `PJ: ${String(projectName||"")}`,
    `ym: ${String(ym||"")}`,
    "",
    "=== thread replies (primary) ===",
    JSON.stringify(repArr.map(x=>({ user:x.user, ts:x.ts, text: x.text })).filter(x=>x.text && !isSystemLine_(x.text)), null, 2),
    "",
    "=== channel digest (secondary) ===",
    digestClean || "(empty)"
  ].join("\n");

  // strict json_schema
  const schema = {
    type:"object",
    additionalProperties:false,
    properties:{
      items:{
        type:"array",
        items:{
          type:"object",
          additionalProperties:false,
          properties:{
            itemType:{ type:"string" },
            body:{ type:"string" }
          },
          required:["itemType","body"]
        }
      }
    },
    required:["items"]
  };

  const payload = {
    model,
    input: [
      { role:"system", content: system },
      { role:"user", content: user }
    ],
    text: {
      format: {
        type:"json_schema",
        name:"nudge_merge_extract",
        strict:true,
        schema: schema
      }
    },
    store: false
  };

  try{
    const resp = UrlFetchApp.fetch("https://api.openai.com/v1/responses", {
      method:"post",
      headers:{
        "Authorization":"Bearer "+apiKey,
        "Content-Type":"application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions:true
    });

    const code = resp.getResponseCode();
    const raw = resp.getContentText() || "";

    if (code < 200 || code >= 300){
      _tsukuyomi_appendNudgeLog_("llm_http_error", {
        code: code,
        head: raw.slice(0, 1200),
        projectName: projectName,
        ym: ym
      });
      return _tsukuyomi_fallbackItemsFromReplies_(repTexts, digestClean, "LLM HTTP error");
    }

    let json = null;
    try{ json = JSON.parse(raw); } catch(e){
      _tsukuyomi_appendNudgeLog_("llm_json_parse_error", { head: raw.slice(0,1200) });
      return _tsukuyomi_fallbackItemsFromReplies_(repTexts, digestClean, "LLM parse error");
    }

    let outText = "";
    try{
      outText = (json.output_text) ? String(json.output_text) : String(_openai_extractOutputText_(json));
    } catch(e){
      _tsukuyomi_appendNudgeLog_("llm_no_output_text", { head: raw.slice(0,1200) });
      return _tsukuyomi_fallbackItemsFromReplies_(repTexts, digestClean, "LLM no output");
    }

    let parsed = null;
    try{ parsed = JSON.parse(outText); } catch(e){
      _tsukuyomi_appendNudgeLog_("llm_output_not_json", { outHead: outText.slice(0,1200) });
      return _tsukuyomi_fallbackItemsFromReplies_(repTexts, digestClean, "LLM output not JSON");
    }

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const cleaned = items
      .map(x=>({ itemType:String(x.itemType||"progress").trim(), body:String(x.body||"").trim() }))
      .filter(x=>x.body)
      // ★出力側でも join/system文を捨てる（LLMの言い換え対策）
      .filter(x=>!isSystemLine_(x.body))
      .slice(0,10);

    // ★LLMが全部join文しか出さなかったらfallbackへ
    if (!cleaned.length){
      return _tsukuyomi_fallbackItemsFromReplies_(repTexts, digestClean, "LLM produced only system/join lines");
    }

    return cleaned;

  }catch(e){
    _tsukuyomi_appendNudgeLog_("llm_exception", {
      message: String(e && (e.message||e.stack||e) ? (e.message||e.stack||e) : e)
    });
    return _tsukuyomi_fallbackItemsFromReplies_(repTexts, digestClean, "LLM exception");
  }
}

// ★返信から“雑に”月次進捗を作る（LLM空振り対策）
function _tsukuyomi_fallbackItemsFromReplies_(replyTexts, digestText, note){
  const repRaw = Array.isArray(replyTexts) ? replyTexts : [];

  function isSystemLine_(text){
    const t = String(text||"").trim();
    if (!t) return true;

    // 参加/退出 系（日本語）
    if (/参加しました|退出しました|招待しました|チャンネル名を変更しました|トピックを変更しました/.test(t)) return true;

    // <@Uxxxx>さんがチャンネルに参加しました
    if (/<@U[0-9A-Z]+>.*(参加しました|退出しました)/i.test(t)) return true;

    // 英語
    const low = t.toLowerCase();
    if (low.includes("has joined the channel")) return true;
    if (low.includes("joined the channel")) return true;
    if (low.includes("left the channel")) return true;

    return false;
  }

  // 返信テキストからシステム文を除外
  const rep = repRaw
    .map(t => String(t||"").replace(/\s+/g," ").trim())
    .filter(t => t && !isSystemLine_(t));

  const out = [];

  // 返信があるなら、先頭2件を進捗として残す
  rep.slice(0, 2).forEach(t=>{
    out.push({ itemType:"progress", body: t.slice(0, 220) });
  });

  // 返信が無いが、digestがあるなら保険（digest側も除外してから使う）
  if (!out.length){
    const d0 = String(digestText||"").trim();
    const d = d0
      .split("\n")
      .map(x=>String(x||"").trim())
      .filter(x=>x && !isSystemLine_(x))
      .slice(0, 6)
      .join(" / ");

    if (d){
      out.push({ itemType:"progress", body:"Slackで動きあり（要約）：" + d.slice(0, 200) });
    }
  }

  if (!out.length){
    out.push({ itemType:"progress", body:"（進捗ログを取得できなかった）" });
  }

  try{
    if (note){
      _tsukuyomi_appendNudgeLog_("fallback_used", { note: String(note), head: out[0]?.body || "" });
    }
  }catch(e){}

  return out;
}

/**
 * backfill: 既に作られた DB_TsukuyomiNudgeArtifacts から
 * DB_NavigatorNudgeItems へ流し込む（即時反映の取りこぼし救済）
 *
 * payload:
 *  { projectId: "p31", ym: "202602", limit?: 20 }
 */
function tsukuyomi_backfillNudgeArtifactsToNavigator(payload){
  payload = payload || {};
  const projectId = String(payload.projectId||"").trim();
  const ym = String(payload.ym||"").trim();
  const limit = (payload.limit !== undefined && payload.limit !== null) ? Number(payload.limit||0) : 20;

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!/^\d{6}$/.test(ym)) return { ok:false, message:"ym invalid (yyyymm)" };

  // ★重要：マッチ0件でも “まずDB_NavigatorNudgeItemsを必ず生成” して存在確認できるようにする
  try{
    if (typeof navNudgeRepo_ensure_ === "function"){
      navNudgeRepo_ensure_();
    }
  } catch(e){}

  const aSheet = getSheetOrCreate_("DB_TsukuyomiNudgeArtifacts");
  ensureHeader_(aSheet, [
    "artifactId",
    "nudgeId",
    "projectId",
    "ym",
    "channelId",
    "postedTs",
    "threadRepliesJson",
    "channelDigestText",
    "extractedItemsJson",
    "createdAtJst"
  ]);

  const vals = aSheet.getDataRange().getValues();
  if (!vals || vals.length < 2){
    return { ok:true, pushed:0, matchedArtifacts:0, note:"no artifacts rows" };
  }

  const h = vals[0].map(x=>String(x||"").trim());
  const iPid = h.indexOf("projectId");
  const iYm = h.indexOf("ym");
  const iItems = h.indexOf("extractedItemsJson");
  const iTs = h.indexOf("postedTs");
  const iAt = h.indexOf("createdAtJst");

  if (iPid < 0 || iYm < 0 || iItems < 0){
    return {
      ok:false,
      message:"artifacts cols missing",
      header: h
    };
  }

  const rows = [];
  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iPid]||"").trim() !== projectId) continue;
    if (String(vals[r][iYm]||"").trim() !== ym) continue;

    rows.push({
      rowNo: r+1,
      createdAt: (iAt>=0) ? String(vals[r][iAt]||"").trim() : "",
      postedTs: (iTs>=0) ? String(vals[r][iTs]||"").trim() : "",
      itemsJson: String(vals[r][iItems]||"").trim()
    });
  }

  if (!rows.length){
    return {
      ok:true,
      pushed:0,
      matchedArtifacts:0,
      note:"no matching artifacts (projectId/ym)",
      debug: { projectId, ym }
    };
  }

  rows.sort((a,b)=> String(b.createdAt).localeCompare(String(a.createdAt)));
  const take = (limit > 0) ? rows.slice(0, limit) : rows;

  let pushed = 0;
  let parsedArtifacts = 0;
  let emptyItemsArtifacts = 0;

  for (const row of take){
    let items = [];
    try{
      items = row.itemsJson ? JSON.parse(row.itemsJson) : [];
    }catch(e){
      items = [];
    }

    parsedArtifacts++;

    if (!Array.isArray(items) || !items.length){
      emptyItemsArtifacts++;
      continue;
    }

    // ★Repo直叩き：ここで確実に DB_NavigatorNudgeItems に入る
    const resNav = navNudgeRepo_appendItems_(projectId, ym, items, {
      sourceType: "tsukuyomi",
      sourceRef: row.postedTs || ""
    });

    if (resNav && resNav.ok){
      pushed += Number(resNav.appended || 0);
    }
  }

  return {
    ok:true,
    pushed,
    matchedArtifacts: rows.length,
    parsedArtifacts,
    emptyItemsArtifacts,
    note: "backfill done"
  };
}

/**
 * 手動実行用（引数なし）：
 * p31 / 202602 を backfill して DB_NavigatorNudgeItems を生成・追記する
 */
function run_tsukuyomi_backfill_p31_202602(){
  const res = tsukuyomi_backfillNudgeArtifactsToNavigator({
    projectId: "p31",
    ym: "202602",
    limit: 10
  });
  try{ Logger.log(JSON.stringify(res, null, 2)); } catch(e){}
  return res;
}

/**
 * Artifactsの threadRepliesJson / channelDigestText から再抽出して、
 * extractedItemsJson を更新し、DB_NavigatorNudgeItems に反映する。
 *
 * payload: { projectId, ym, limit? }
 */
function tsukuyomi_reextractArtifactsToNavigator(payload){
  payload = payload || {};
  const projectId = String(payload.projectId||"").trim();
  const ym = String(payload.ym||"").trim();
  const limit = (payload.limit !== undefined && payload.limit !== null) ? Number(payload.limit||0) : 20;

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!/^\d{6}$/.test(ym)) return { ok:false, message:"ym invalid (yyyymm)" };

  // NudgeItemsを必ず生成
  try{ if (typeof navNudgeRepo_ensure_ === "function") navNudgeRepo_ensure_(); }catch(e){}

  const aSheet = getSheetOrCreate_("DB_TsukuyomiNudgeArtifacts");
  ensureHeader_(aSheet, [
    "artifactId",
    "nudgeId",
    "projectId",
    "ym",
    "channelId",
    "postedTs",
    "threadRepliesJson",
    "channelDigestText",
    "extractedItemsJson",
    "createdAtJst"
  ]);

  const vals = aSheet.getDataRange().getValues();
  if (!vals || vals.length < 2){
    return { ok:true, reextracted:0, pushed:0, note:"no artifacts" };
  }

  const h = vals[0].map(x=>String(x||"").trim());
  const iPid = h.indexOf("projectId");
  const iYm = h.indexOf("ym");
  const iCh = h.indexOf("channelId");
  const iTs = h.indexOf("postedTs");
  const iRep = h.indexOf("threadRepliesJson");
  const iDig = h.indexOf("channelDigestText");
  const iOut = h.indexOf("extractedItemsJson");
  const iAt = h.indexOf("createdAtJst");

  if (iPid<0 || iYm<0 || iCh<0 || iTs<0 || iRep<0 || iDig<0 || iOut<0){
    return { ok:false, message:"artifacts cols missing" };
  }

  const list = [];
  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iPid]||"").trim() !== projectId) continue;
    if (String(vals[r][iYm]||"").trim() !== ym) continue;

    list.push({
      rowNo: r+1,
      createdAt: (iAt>=0) ? String(vals[r][iAt]||"").trim() : "",
      channelId: String(vals[r][iCh]||"").trim(),
      postedTs: String(vals[r][iTs]||"").trim(),
      repliesJson: String(vals[r][iRep]||"").trim(),
      digestText: String(vals[r][iDig]||"").trim()
    });
  }

  if (!list.length){
    return { ok:true, reextracted:0, pushed:0, note:"no matching artifacts" };
  }

  list.sort((a,b)=> String(b.createdAt).localeCompare(String(a.createdAt)));
  const take = (limit > 0) ? list.slice(0, limit) : list;

  let reextracted = 0;
  let pushed = 0;
  let updatedArtifactRows = 0;

  for (const it of take){
    // replies復元（スレッド返信）
    let replies = [];
    try{ replies = it.repliesJson ? JSON.parse(it.repliesJson) : []; }catch(e){ replies = []; }
    if (!Array.isArray(replies)) replies = [];

    // ★追加：postedTs以降のチャンネル投稿も拾う（スレッドを強制しない）
    const chPosts = _tsukuyomi_fetchChannelMessagesAfter_(it.channelId, it.postedTs, 40);

    // LLMへの入力を増やす：返信＋チャンネル投稿をまとめる
    const combinedReplies = []
      .concat(replies.map(x => ({ user:x.user, ts:x.ts, text:x.text })))
      .concat(chPosts.map(x => ({ user:x.user, ts:x.ts, text:x.text })));

    // ダイジェストも、Artifacts保存値より“今取ったやつ”を優先
    const freshDigest = chPosts.map(x => "- " + String(x.text||"").trim()).filter(x=>x && x.length>2).slice(0, 20).join("\n");
    const digestForLlm = freshDigest || String(it.digestText||"").trim();

    const projectName = projectId; // テスト段階は雑でOK
    const items = _tsukuyomi_llmExtractMonthlyProgressItems_(projectName, ym, combinedReplies, digestForLlm);

    reextracted++;

    // artifactsの extractedItemsJson を更新（監査用）
    try{
      aSheet.getRange(it.rowNo, iOut+1).setValue(JSON.stringify(items || []));
      updatedArtifactRows++;
    }catch(e){}

    // 重複防止：同じsourceRefで既存を削除
    try{
      _navNudge_deleteExistingBySourceRef_(projectId, ym, it.postedTs);
    }catch(e){}

    // NavigatorNudgeItemsへ反映（Repo直叩き）
    try{
      const resNav = navNudgeRepo_appendItems_(projectId, ym, items, {
        sourceType: "tsukuyomi",
        sourceRef: it.postedTs || ""
      });
      if (resNav && resNav.ok) pushed += Number(resNav.appended || 0);
    }catch(e){}
  }

  return {
    ok:true,
    reextracted,
    updatedArtifactRows,
    pushed
  };
}

/**
 * 重複防止：DB_NavigatorNudgeItems から
 * projectId+ym+sourceRef が一致する行を削除する
 */
function _navNudge_deleteExistingBySourceRef_(projectId, ym, sourceRef){
  const pid = String(projectId||"").trim();
  const y = String(ym||"").trim();
  const ref = String(sourceRef||"").trim();
  if (!pid || !y || !ref) return;

  const sh = getSheetOrCreate_("DB_NavigatorNudgeItems");
  const vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2) return;

  const h = vals[0].map(x=>String(x||"").trim());
  const iPid = h.indexOf("projectId");
  const iYm = h.indexOf("ym");
  const iRef = h.indexOf("sourceRef");
  if (iPid<0 || iYm<0 || iRef<0) return;

  // 下から消す
  for (let r=vals.length-1; r>=1; r--){
    if (String(vals[r][iPid]||"").trim() !== pid) continue;
    if (String(vals[r][iYm]||"").trim() !== y) continue;
    if (String(vals[r][iRef]||"").trim() !== ref) continue;
    sh.deleteRow(r+1);
  }
}

/**
 * 手動実行用（引数なし）
 */
function run_tsukuyomi_reextract_p31_202602(){
  const res = tsukuyomi_reextractArtifactsToNavigator({
    projectId: "p31",
    ym: "202602",
    limit: 10
  });
  try{ Logger.log(JSON.stringify(res, null, 2)); }catch(e){}
  return res;
}

/**
 * デバッグ用：OpenAI Responses API に最小リクエストを投げて
 * HTTPコードとレスポンス先頭をログに出す（引数なし実行用）
 */
function run_debug_openai_responses_min(){
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty("OPENAI_API_KEY")||"").trim();
  const model = String(props.getProperty("OPENAI_MODEL")||"gpt-4o-mini").trim();

  if (!apiKey){
    Logger.log("OPENAI_API_KEY missing");
    return { ok:false, message:"OPENAI_API_KEY missing" };
  }

  const payload = {
    model,
    input: [
      { role:"system", content:"You output JSON only." },
      { role:"user", content:"Return {\"ok\":true} as JSON." }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ping",
        strict: true,
        schema: {
          type:"object",
          properties:{ ok:{ type:"boolean" } },
          required:["ok"]
        }
      }
    },
    store: false
  };

  const resp = UrlFetchApp.fetch("https://api.openai.com/v1/responses", {
    method: "post",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  const raw = resp.getContentText() || "";
  const head = raw.slice(0, 2000);

  Logger.log("OpenAI responses ping code=" + code);
  Logger.log(head);

  return { ok: (code>=200 && code<300), code, head };
}

/**
 * デバッグ用：
 * DB_TsukuyomiNudgeArtifacts から p31/202602 の最新1件を取り、
 * threadRepliesJson の中身（先頭）をLoggerに出す
 */
function run_debug_tsukuyomi_replies_p31_202602(){
  const projectId = "p31";
  const ym = "202602";

  const sh = getSheetOrCreate_("DB_TsukuyomiNudgeArtifacts");
  const vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2){
    Logger.log("no artifacts");
    return { ok:false, message:"no artifacts" };
  }

  const h = vals[0].map(x=>String(x||"").trim());
  const iPid = h.indexOf("projectId");
  const iYm = h.indexOf("ym");
  const iAt = h.indexOf("createdAtJst");
  const iRep = h.indexOf("threadRepliesJson");
  const iTs = h.indexOf("postedTs");

  const rows = [];
  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iPid]||"").trim() !== projectId) continue;
    if (String(vals[r][iYm]||"").trim() !== ym) continue;
    rows.push({
      rowNo: r+1,
      createdAt: (iAt>=0) ? String(vals[r][iAt]||"").trim() : "",
      postedTs: (iTs>=0) ? String(vals[r][iTs]||"").trim() : "",
      repJson: (iRep>=0) ? String(vals[r][iRep]||"").trim() : ""
    });
  }

  if (!rows.length){
    Logger.log("no matching artifacts for p31/202602");
    return { ok:false, message:"no matching artifacts" };
  }

  rows.sort((a,b)=> String(b.createdAt).localeCompare(String(a.createdAt)));
  const top = rows[0];

  let arr = [];
  try{ arr = top.repJson ? JSON.parse(top.repJson) : []; } catch(e){ arr = []; }

  const preview = Array.isArray(arr) ? arr.slice(0, 10) : [];
  Logger.log(JSON.stringify({ postedTs: top.postedTs, createdAt: top.createdAt, repliesCount: (arr||[]).length, preview }, null, 2));

  return { ok:true, postedTs: top.postedTs, createdAt: top.createdAt, repliesCount: (arr||[]).length, preview };
}

/**
 * postedTs 以降のチャンネル投稿を拾う（最大limit件）
 * - bot/システム(join/leave等)は除外
 */
function _tsukuyomi_fetchChannelMessagesAfter_(channelId, postedTs, limit){
  const ch = String(channelId||"").trim();
  const ts = String(postedTs||"").trim();
  const lim = (limit !== undefined && limit !== null) ? Number(limit||0) : 40;
  if (!ch || !ts) return [];

  function isSystemSubType_(subtype){
    const st = String(subtype||"").trim().toLowerCase();
    if (!st) return false;
    const deny = new Set([
      "channel_join",
      "channel_leave",
      "channel_name",
      "channel_topic",
      "channel_purpose",
      "group_join",
      "group_leave"
    ]);
    return deny.has(st);
  }

  function isSystemLine_(text){
    const t = String(text||"").trim();
    if (!t) return true;
    if (/参加しました|退出しました|招待しました|チャンネル名を変更しました|トピックを変更しました/.test(t)) return true;
    if (/新(しい)?メンバー/.test(t) && /(参加|加入|参加しました|加入しました)/.test(t)) return true;
    if (/<@U[0-9A-Z]+>.*(参加しました|退出しました|加入しました)/i.test(t)) return true;
    const low = t.toLowerCase();
    if (low.includes("joined the channel") || low.includes("left the channel")) return true;
    return false;
  }

  try{
    // Slackのtsは秒.小数。oldestは“その直後”にしたいので少し足す
    let oldest = Number(ts);
    if (!isFinite(oldest)) oldest = ts;
    if (typeof oldest === "number") oldest = oldest + 0.000001;

    const obj = slack_callApi("conversations.history", {
      channel: ch,
      oldest: oldest,
      inclusive: false,
      limit: Math.max(lim, 40)
    });

    const msgs = obj && Array.isArray(obj.messages) ? obj.messages : [];
    const out = [];

    for (let i=0; i<msgs.length; i++){
      const m = msgs[i] || {};
      const text = String(m.text||"").trim();
      if (!text) continue;

      if (m.subtype === "bot_message" || m.bot_id) continue;
      if (isSystemSubType_(m.subtype)) continue;
      if (isSystemLine_(text)) continue;

      const user = String(m.user||"").trim();
      if (!user) continue;

      out.push({ user, ts: String(m.ts||"").trim(), text: text });
      if (lim > 0 && out.length >= lim) break;
    }

    return out;
  }catch(e){
    return [];
  }
}
