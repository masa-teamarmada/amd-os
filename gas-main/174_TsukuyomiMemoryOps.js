/**
 * 174_TsukuyomiMemoryOps.gs
 *
 * 役割：
 * - Slack message event を記憶DBへ保存（全スレッド横断）
 * - 100件ごとに一次要約を生成して保存
 * - 一次要約が10個たまったら二次要約を生成して保存
 * - つくよみ systemPrompt に注入する「最近の記憶テキスト」を返す
 */

function tsukuyomiMemoryAppendFromSlackEvent(event){
  // event: Slack event_callback message を想定
  if (!event) return { ok:false, message:"event empty" };

  // botも含めて保存する（人間ぽさのため）
  const channelId = String(event.channel || "").trim();
  const messageTs = String(event.ts || "").trim();
  const threadTs = String(event.thread_ts || "").trim();
  const userId = String(event.user || "").trim();
  const botId = String(event.bot_id || "").trim();
  const subtype = String(event.subtype || "").trim();

  // message_changed とかはスキップ（あとで必要なら対応）
  if (subtype && subtype !== "bot_message") {
    // files_share 等も混ざるので、まずはテキストがあるものだけ許す
  }

  const textRaw = String(event.text || "");
  const text = tsukuyomiMemoryTrimSlackText(textRaw);
  if (!channelId || !messageTs || !text) return { ok:true, skipped:true };

  const role = botId ? "bot" : "user";

  // schema確保
  tsukuyomiMemoryEnsureSchema();

  return tsukuyomiMemoryAppendMessage({
    channelId, threadTs, messageTs, role,
    userId: botId ? botId : userId,
    text
  });
}

function admin_tsukuyomi_memoryBuildDigest(){
  tsukuyomiMemoryEnsureSchema();

  const ptr = tsukuyomiMemoryGetLatestDigestPointers();
  const after = ptr.lastToMessageTs || "";

  // 直近100件を取りにいく（after以降）
  const msgs = tsukuyomiMemoryListMessagesAfterTs(after, 100);
  if (!msgs.length) return { ok:true, message:"no new messages" };

  // 100件たまってないなら作らない（人間ぽい“すぐ忘れる”を避ける）
  if (msgs.length < 100) return { ok:true, message:"not enough messages yet", count: msgs.length };

  const fromTs = msgs[0].messageTs;
  const toTs = msgs[msgs.length - 1].messageTs;

  const lines = msgs.map(m => {
    const who = m.role === "bot" ? "bot" : "user";
    const head = String(m.text||"").replace(/\s+/g," ").slice(0, 260);
    return "[" + who + "] " + head;
  }).join("\n");

  const sys =
    "あなたはSlackの会話を要約して『最近の空気感』として残す係。\n" +
    "雑談も残してOK。ただし個人情報っぽいものは具体名をぼかす。\n" +
    "出力は日本語。箇条書き多用しない。短い段落で。\n";

  const summary = tsukuyomiCallOpenAiResponses(sys, lines);
  const sum = String(summary||"").trim();
  if (!sum) return { ok:false, message:"summary empty" };

  const hashes = msgs.map(m => m.textHash).filter(Boolean);

  tsukuyomiMemoryAppendDigest({
    fromMessageTs: fromTs,
    toMessageTs: toTs,
    messageCount: msgs.length,
    summary: sum,
    sourceTextHashes: hashes
  });

  // 二次要約の条件チェック（一次要約が10個増えたら）
  tsukuyomiMemoryMaybeBuildDigest2();

  return { ok:true, fromMessageTs: fromTs, toMessageTs: toTs, messageCount: msgs.length };
}

function tsukuyomiMemoryMaybeBuildDigest2(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh1 = ss.getSheetByName("DB_TsukuyomiMemoryDigest");
  const sh2 = ss.getSheetByName("DB_TsukuyomiMemoryDigest2");
  if (!sh1 || sh1.getLastRow() < 2) return { ok:true, skipped:true };

  const header1 = tsukuyomiMemoryHeaderMap(sh1);
  const colAt = header1.atJst;
  const colSummary = header1.summary;
  const colHash = header1.summaryHash;

  if (!colAt || !colSummary || !colHash) return { ok:true, skipped:true };

  const lastRow1 = sh1.getLastRow();
  const digestsCount = lastRow1 - 1;

  // 二次要約がまだないなら、まず10個で作る
  let already = 0;
  if (sh2 && sh2.getLastRow() >= 2) already = sh2.getLastRow() - 1;

  // ここは単純に「一次要約10個単位で1個作る」
  const want = Math.floor(digestsCount / 10);
  if (want <= already) return { ok:true, skipped:true };

  // 対象：直近の“まだ二次に取り込んでない” 10個
  const startIndex = already * 10 + 1; // 1-based (digest#)
  const startRow = 1 + startIndex;
  const endRow = startRow + 10 - 1;

  const vals = sh1.getRange(startRow, 1, 10, sh1.getLastColumn()).getValues();

  const parts = [];
  const hashes = [];
  let fromAt = "";
  let toAt = "";
  for (let i=0; i<vals.length; i++){
    const r = vals[i];
    const at = String(r[colAt-1]||"");
    const sum = String(r[colSummary-1]||"");
    const h = String(r[colHash-1]||"");
    if (!fromAt) fromAt = at;
    toAt = at;
    hashes.push(h);
    parts.push("[" + at + "] " + sum);
  }

  const sys =
    "あなたは『一次要約をさらにまとめて』二次要約にする係。\n" +
    "遠い記憶ほど薄くしてOK。雑談も少しだけ残してOK。\n" +
    "出力は日本語。短い段落で。\n";

  const summary2 = tsukuyomiCallOpenAiResponses(sys, parts.join("\n\n"));
  const sum2 = String(summary2||"").trim();
  if (!sum2) return { ok:false, message:"summary2 empty" };

  tsukuyomiMemoryAppendDigest2({
    fromAtJst: fromAt,
    toAtJst: toAt,
    digestCount: 10,
    summary: sum2,
    sourceDigestHashes: hashes
  });

  return { ok:true };
}

function tsukuyomiMemoryBuildPromptAddon(){
  // 最新一次2つ＋最新二次1つを混ぜる
  const d1 = tsukuyomiMemoryListLatestDigests(2);
  const d2 = tsukuyomiMemoryListLatestDigest2();

  const parts = [];
  if (d2 && d2.summary){
    parts.push("【少し昔の会話メモ】\n" + String(d2.summary||"").trim());
  }
  if (d1 && d1.length){
    parts.push("【直近の会話メモ】\n" + d1.map(x => String(x.summary||"").trim()).join("\n\n"));
  }

  const out = parts.filter(Boolean).join("\n\n");
  return String(out||"").trim();
}
