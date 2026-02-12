/**
 * 173_TsukuyomiMemoryRepo.gs
 *
 * 役割：
 * - 本体スプシの「つくよみ記憶DB」正本アクセス
 * - シート生成＆ヘッダ保証（手作業禁止）
 * - append / range read / last pointer 読み
 */

function tsukuyomiMemoryEnsureSchema(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  tsukuyomiMemoryEnsureSheet(ss, "DB_TsukuyomiMemory",
    ["id","atJst","channelId","threadTs","messageTs","role","userId","text","textHash","tokensApprox"]
  );

  tsukuyomiMemoryEnsureSheet(ss, "DB_TsukuyomiMemoryDigest",
    ["digestId","atJst","fromMessageTs","toMessageTs","messageCount","windowKey","level","summary","summaryHash","sourceTextHashesJson"]
  );

  tsukuyomiMemoryEnsureSheet(ss, "DB_TsukuyomiMemoryDigest2",
    ["digest2Id","atJst","fromAtJst","toAtJst","digestCount","windowKey","level","summary","summaryHash","sourceDigestHashesJson"]
  );

  return { ok:true };
}

function tsukuyomiMemoryEnsureSheet(ss, name, headers){
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  const row1 = sh.getRange(1,1,1,Math.max(sh.getLastColumn(), headers.length)).getValues()[0];
  const current = row1.map(v => String(v||"").trim());

  // 既存が空っぽならそのまま入れる
  if (sh.getLastRow() === 0 || current.filter(Boolean).length === 0){
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    return;
  }

  // ヘッダ不足分を右に足す（順序は固定せず、存在しないものだけ追加）
  const set = {};
  current.forEach(h => { if(h) set[h]=true; });

  const add = headers.filter(h => !set[h]);
  if (add.length){
    const start = sh.getLastColumn() + 1;
    sh.getRange(1, start, 1, add.length).setValues([add]);
  }
}

function tsukuyomiMemoryAppendMessage(rowObj){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TsukuyomiMemory");
  if (!sh) throw new Error("sheet not found: DB_TsukuyomiMemory");

  const header = tsukuyomiMemoryHeaderMap(sh);
  const lastCol = sh.getLastColumn();
  const row = new Array(lastCol).fill("");

  function set(k, v){
    const c = header[k];
    if (!c) return;
    row[c-1] = v;
  }

  set("id", Utilities.getUuid());
  set("atJst", tsukuyomiMemoryFmtNowJst());
  set("channelId", String(rowObj.channelId||""));
  set("threadTs", String(rowObj.threadTs||""));
  set("messageTs", String(rowObj.messageTs||""));
  set("role", String(rowObj.role||""));
  set("userId", String(rowObj.userId||""));
  set("text", String(rowObj.text||""));

  const th = tsukuyomiMemoryHash(String(rowObj.text||""));
  set("textHash", th);

  const approx = tsukuyomiMemoryTokensApprox(String(rowObj.text||""));
  set("tokensApprox", String(approx));

  sh.appendRow(row);

  return { ok:true, textHash: th };
}

function tsukuyomiMemoryListMessagesAfterTs(afterMessageTs, limit){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TsukuyomiMemory");
  if (!sh) throw new Error("sheet not found: DB_TsukuyomiMemory");

  const header = tsukuyomiMemoryHeaderMap(sh);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const lim = Math.min(Math.max(Number(limit||0)||100, 10), 500);

  const vals = sh.getRange(2,1,lastRow-1,sh.getLastColumn()).getValues();
  const out = [];

  const colTs = header.messageTs;
  const colRole = header.role;
  const colUser = header.userId;
  const colText = header.text;
  const colHash = header.textHash;
  const colChan = header.channelId;
  const colThread = header.threadTs;

  const after = String(afterMessageTs||"").trim();
  for (let i=0; i<vals.length; i++){
    const r = vals[i];
    const ts = colTs ? String(r[colTs-1]||"") : "";
    if (after && ts && ts <= after) continue;

    out.push({
      channelId: colChan ? String(r[colChan-1]||"") : "",
      threadTs: colThread ? String(r[colThread-1]||"") : "",
      messageTs: ts,
      role: colRole ? String(r[colRole-1]||"") : "",
      userId: colUser ? String(r[colUser-1]||"") : "",
      text: colText ? String(r[colText-1]||"") : "",
      textHash: colHash ? String(r[colHash-1]||"") : ""
    });

    if (out.length >= lim) break;
  }

  return out;
}

function tsukuyomiMemoryAppendDigest(d){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TsukuyomiMemoryDigest");
  if (!sh) throw new Error("sheet not found: DB_TsukuyomiMemoryDigest");

  const header = tsukuyomiMemoryHeaderMap(sh);
  const lastCol = sh.getLastColumn();
  const row = new Array(lastCol).fill("");

  function set(k, v){
    const c = header[k];
    if (!c) return;
    row[c-1] = v;
  }

  set("digestId", Utilities.getUuid());
  set("atJst", tsukuyomiMemoryFmtNowJst());
  set("fromMessageTs", String(d.fromMessageTs||""));
  set("toMessageTs", String(d.toMessageTs||""));
  set("messageCount", String(d.messageCount||""));
  set("windowKey", "global");
  set("level", "1");
  set("summary", String(d.summary||""));
  set("summaryHash", tsukuyomiMemoryHash(String(d.summary||"")));
  set("sourceTextHashesJson", JSON.stringify(d.sourceTextHashes||[]));

  sh.appendRow(row);
  return { ok:true };
}

function tsukuyomiMemoryAppendDigest2(d){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TsukuyomiMemoryDigest2");
  if (!sh) throw new Error("sheet not found: DB_TsukuyomiMemoryDigest2");

  const header = tsukuyomiMemoryHeaderMap(sh);
  const lastCol = sh.getLastColumn();
  const row = new Array(lastCol).fill("");

  function set(k, v){
    const c = header[k];
    if (!c) return;
    row[c-1] = v;
  }

  set("digest2Id", Utilities.getUuid());
  set("atJst", tsukuyomiMemoryFmtNowJst());
  set("fromAtJst", String(d.fromAtJst||""));
  set("toAtJst", String(d.toAtJst||""));
  set("digestCount", String(d.digestCount||""));
  set("windowKey", "global");
  set("level", "2");
  set("summary", String(d.summary||""));
  set("summaryHash", tsukuyomiMemoryHash(String(d.summary||"")));
  set("sourceDigestHashesJson", JSON.stringify(d.sourceDigestHashes||[]));

  sh.appendRow(row);
  return { ok:true };
}

function tsukuyomiMemoryGetLatestDigestPointers(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh1 = ss.getSheetByName("DB_TsukuyomiMemoryDigest");
  const sh2 = ss.getSheetByName("DB_TsukuyomiMemoryDigest2");

  let lastToTs = "";
  if (sh1 && sh1.getLastRow() >= 2){
    const header = tsukuyomiMemoryHeaderMap(sh1);
    const colTo = header.toMessageTs;
    if (colTo){
      lastToTs = String(sh1.getRange(sh1.getLastRow(), colTo).getValue() || "");
    }
  }

  let lastToAt = "";
  if (sh2 && sh2.getLastRow() >= 2){
    const header2 = tsukuyomiMemoryHeaderMap(sh2);
    const colToAt = header2.toAtJst;
    if (colToAt){
      lastToAt = String(sh2.getRange(sh2.getLastRow(), colToAt).getValue() || "");
    }
  }

  return { ok:true, lastToMessageTs: lastToTs, lastToAtJst: lastToAt };
}

function tsukuyomiMemoryListLatestDigests(limit){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TsukuyomiMemoryDigest");
  if (!sh || sh.getLastRow() < 2) return [];

  const header = tsukuyomiMemoryHeaderMap(sh);
  const colSummary = header.summary;
  const colAt = header.atJst;
  if (!colSummary) return [];

  const lim = Math.min(Math.max(Number(limit||0)||2, 1), 10);
  const lastRow = sh.getLastRow();
  const start = Math.max(2, lastRow - lim + 1);
  const vals = sh.getRange(start, 1, lastRow - start + 1, sh.getLastColumn()).getValues();

  const out = [];
  for (let i=0; i<vals.length; i++){
    const r = vals[i];
    out.push({
      atJst: colAt ? String(r[colAt-1]||"") : "",
      summary: String(r[colSummary-1]||"")
    });
  }
  return out;
}

function tsukuyomiMemoryListLatestDigest2(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TsukuyomiMemoryDigest2");
  if (!sh || sh.getLastRow() < 2) return null;

  const header = tsukuyomiMemoryHeaderMap(sh);
  const colSummary = header.summary;
  const colAt = header.atJst;
  if (!colSummary) return null;

  const r = sh.getRange(sh.getLastRow(), 1, 1, sh.getLastColumn()).getValues()[0];
  return {
    atJst: colAt ? String(r[colAt-1]||"") : "",
    summary: String(r[colSummary-1]||"")
  };
}

function tsukuyomiMemoryHeaderMap(sh){
  const row1 = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const map = {};
  for (let i=0; i<row1.length; i++){
    const k = String(row1[i]||"").trim();
    if (k) map[k] = i + 1;
  }
  return map;
}

function tsukuyomiMemoryFmtNowJst(){
  return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
}

function tsukuyomiMemoryHash(s){
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s||""), Utilities.Charset.UTF_8);
  return bytes.map(b => (b<0?b+256:b).toString(16).padStart(2,"0")).join("").slice(0, 24);
}

function tsukuyomiMemoryTokensApprox(text){
  const t = String(text||"");
  return Math.max(1, Math.ceil(t.length / 4));
}

function tsukuyomiMemoryTrimSlackText(text){
  // 雑談込みでOK。でも爆長は切る（Notionみたいに上限で落ちるの防止）
  const s = String(text||"").trim();
  if (s.length <= 2000) return s;
  return s.slice(0, 2000);
}
