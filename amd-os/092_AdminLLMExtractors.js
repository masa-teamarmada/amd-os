/** 092_AdminLLMExtractors.gs
 * Protocol Store（外部スプレッドシート）の DB_LLMExtractorConfig を扱う。
 *
 * 目的：
 * - navigator_extract を「なければ追加 / あれば更新」する install 関数を提供

 */

function protocolStore_openSpreadsheet_(){
  const props = PropertiesService.getScriptProperties();
  const id = String(props.getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!id) throw new Error("PROTOCOL_STORE_SPREADSHEET_ID missing");
  return SpreadsheetApp.openById(id);
}

function protocolStore_getSheetOrCreate_(ss, sheetName){
  let sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);
  return sh;
}

function protocolStore_nowIsoJst_(){
  const now = new Date();
  return Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function protocolStore_getExtractorConfigSheet_(){
  const ss = protocolStore_openSpreadsheet_();
  const sh = protocolStore_getSheetOrCreate_(ss, "DB_LLMExtractorConfig");

  ensureHeader_(sh, [
    "configId",
    "name",
    "status",
    "version",
    "systemPrompt",
    "note",
    "createdAt",
    "updatedAt",
    "kind",
    "scopeType",
    "scopeKey",
    "tags",
    "priority",
    "maxChars",
    "composeGroup",
    "updatedBy"
  ]);

  return sh;
}

function navigator_extract_basePrompt_(){
  return [
    "あなたはディープテックスタートアップスタジオ（株式会社チームアルマダ）のPMO補助。",
    "入力は、あるPJの議事録「内容」プロパティのテキスト（1か月分、複数回の会議が混在）だけ。",
    "",
    "目的：",
    "月次の進捗として意味のある「事実候補」だけを抽出し、Monthly Extract の items にする。",
    "感想、雑談、抽象論、願望、将来の夢、一般論は捨てる。",
    "同じ内容の重複はまとめる。",
    "",
    "抽出対象（優先度順）：",
    "1) 決定・確定したこと（誰が何を決めた/確定した）",
    "2) 進捗として前に進んだこと（実験/開発/交渉/契約/資金調達/採用などで、状態が変わった事実）",
    "3) 直近の次アクション（担当者 or 期限 or 依存関係が読み取れるもの）",
    "4) リスク・詰まり・未解決（放置すると進捗が止まる具体）",
    "",
    "出力ルール：",
    "- 必ず JSON 配列だけを返す（前後の文章は禁止）",
    "- 各要素は { \"itemType\": \"...\", \"body\": \"...\" } のみ",
    "- itemType は次のどれか： \"decided\" | \"progress\" | \"nextAction\" | \"risk\"",
    "- body は1〜3行で、主語と具体を落とさない。曖昧な言い換え禁止。",
    "- 数は最大20件。重要なものから並べる。",
    "- 入力に根拠がない推測は禁止。書かれていないことを補わない。",
    "",
    "良い例：",
    "- 「XX社にデモ日程を提示し、2/5に実施で合意。資料ドラフトは山田が1/31までに作成」",
    "- 「PoC装置のリーク原因がOリング劣化と判明。規格変更して再試験へ」"
  ].join("\n");
}

function protocolStore_findRowByName_(sh, name){
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { found:false, rowIndex:-1 };

  const vals = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const header = (vals[0] || []).map(x=>String(x||"").trim());
  const iName = header.indexOf("name");
  if (iName < 0) throw new Error("DB_LLMExtractorConfig missing col: name");

  for (let r=1; r<vals.length; r++){
    const nm = String(vals[r][iName]||"").trim();
    if (nm === name) return { found:true, rowIndex:(r+1) };
  }
  return { found:false, rowIndex:-1 };
}

function protocolStore_appendRowObject_(sh, obj){
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x||"").trim());
  const row = header.map(h => (obj[h] !== undefined ? obj[h] : ""));
  sh.appendRow(row);
}

function protocolStore_writeRowObjectByRowIndex_(sh, rowIndex, obj){
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x||"").trim());
  const row = header.map(h => (obj[h] !== undefined ? obj[h] : ""));
  sh.getRange(rowIndex, 1, 1, lastCol).setValues([row]);
}

/**
 * 実行用（末尾_なし）
 * - navigator_extract を Protocol Store の DB_LLMExtractorConfig に追加/更新する
 */
function run_installNavigatorExtractorConfig(){
  const sh = protocolStore_getExtractorConfigSheet_();

  const name = "navigator_extract";
  const composeGroup = "navigator_extract";

  const nowIso = protocolStore_nowIsoJst_();
  const actor = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();

  const desired = {
    name: name,
    status: "active",
    version: "260125_01",
    systemPrompt: navigator_extract_basePrompt_(),
    note: "navigator monthly extract base",
    kind: "base",
    scopeType: "global",
    scopeKey: "",
    tags: "",
    priority: "0",
    maxChars: "16000",
    composeGroup: composeGroup,
    updatedAt: nowIso,
    updatedBy: actor
  };

  const hit = protocolStore_findRowByName_(sh, name);

  if (!hit.found){
    const row = Object.assign({}, desired, {
      configId: Utilities.getUuid().replace(/-/g,""),
      createdAt: nowIso
    });
    protocolStore_appendRowObject_(sh, row);
    return { ok:true, action:"inserted", name:name, composeGroup:composeGroup, updatedAt: nowIso };
  }

  // 既存行は configId / createdAt を残して更新
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x||"").trim());
  const vals = sh.getRange(hit.rowIndex, 1, 1, lastCol).getValues()[0];

  function idx_(col){ return header.indexOf(col); }
  function get_(col){
    const i = idx_(col);
    return (i < 0) ? "" : vals[i];
  }

  const next = {
    configId: String(get_("configId") || "").trim() || Utilities.getUuid().replace(/-/g,""),
    createdAt: String(get_("createdAt") || "").trim() || nowIso
  };
  Object.keys(desired).forEach(k => { next[k] = desired[k]; });

  protocolStore_writeRowObjectByRowIndex_(sh, hit.rowIndex, next);
  return { ok:true, action:"updated", name:name, composeGroup:composeGroup, updatedAt: nowIso };
}
