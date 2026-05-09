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

// ============================================================
// meeting_extract: 1 回の MTG 議事録 → summary_short + decided/progress/nextActions/risks
// 仕様: pwa/design/meeting_summaries.md
// ============================================================

function meeting_extract_basePrompt_(){
  return [
    "あなたはディープテックスタートアップスタジオ (株式会社チームアルマダ) の PMO 補助。",
    "入力は、ある PJ の 1 回の MTG (1 calendar event) に関する **複数ソースの結合テキスト**。",
    "",
    "入力構造 (固定):",
    "  === meeting_meta ===   この会議の対象 PJ・タイトル・日付。これが**唯一の正解**。",
    "  === combined sources (notion + gmail) ===",
    "    === notion ===  Notion 議事録ページ本文 (人手 or 自動議事録ツールによる本文)",
    "    === gmail ===   会議日 ±1日に reportEmails 宛に届いたメール群",
    "                    (CircleBack 要約 / GMeet recording 通知 / 関係者やりとり 等)",
    "",
    "目的:",
    "meeting_meta で指定された **その 1 回の MTG** で何が起きたかを 4 軸 + 短いまとめで構造化する。",
    "",
    "🚨 最重要ルール: 対象 PJ と無関係な内容は完全に無視する",
    "- gmail セクションは「reportEmails の from/to 一致」だけで集めたものなので、",
    "  **対象 PJ と無関係な別 PJ のメール** が混入することがある (実例: BWE 株主総会の議事録枠に",
    "  CX/神谷PJ の Kiutra/CryoX 関連メールが混入した事故が 2026-05 にあった)。",
    "- 特に NIMS / 大学 / 大企業など **複数 PJ にまたがる組織の人** は、別 PJ の打ち合わせメールに",
    "  CC されることが多く、それが reportEmails のフィルタを通過してしまう。",
    "- 各 thread / メールについて、内容が meeting_meta.projectName / meeting_meta.meetingTitle と",
    "  **明らかに無関係** (= 別 PJ の固有名詞・別 PJ 特有の話題・別組織の意思決定だけが語られる) と",
    "  判定したら、その thread の中身は decided/progress/next_actions/risks に**一切含めない**。",
    "- 判断に迷うときは、対象 PJ 名・対象会議タイトル・対象日付に **直接結びつく内容のみ** を採用する。",
    "- 結果として該当する内容が無ければ、各配列は **空配列 []** を返す。summary_short も空 or 簡潔に",
    '  "対象 PJ に関連する議事録が確認できず" としてよい。**対象 PJ と無関係な内容で枠を埋めるな**。',
    "",
    "その他のルール:",
    "- 同一事項が notion と gmail の両方にあれば、より具体的な記述を優先して 1 つにまとめる。",
    "- メール本文中の自動通知文・署名・URL などは捨て、本文の意味の部分だけ拾う。",
    "- 入力に書かれていない推測は禁止。書かれていないことを補わない。",
    "- 感想・雑談・抽象論・願望・将来の夢・一般論は捨てる。",
    "- 同じ内容の重複はまとめる。",
    "",
    "出力ルール:",
    "- 必ず厳密な JSON オブジェクトだけを返す。前後の文章・コードフェンス禁止。",
    "- スキーマ:",
    '  {',
    '    "summary_short": "2 行以内・80 字以内・体言止め可。会議の要点を一言で。",',
    '    "decided":      ["string", ...],',
    '    "progress":     ["string", ...],',
    '    "next_actions": ["string", ...],',
    '    "risks":        ["string", ...]',
    '  }',
    "- 各配列の各要素は 1〜3 行。主語と具体を落とさない。",
    "- 各配列は最大 5 件。重要なものから並べる。該当が無ければ空配列 [] を返す。",
    "",
    "各軸の意味:",
    "- decided      : 決定・確定したこと (誰が何を決めた)",
    "- progress     : 進捗として前に進んだこと (実験/開発/交渉/契約/資金調達/採用などで状態が変わった事実)",
    "- next_actions : 直近の次アクション (担当者 or 期限 or 依存関係が読み取れるもの優先)",
    "- risks        : リスク・詰まり・未解決事項 (放置すると進捗が止まる具体)",
    "",
    "良い例:",
    '  decided:    "XX社にデモ日程を提示し、2/5 に実施で合意"',
    '  progress:   "PoC 装置のリーク原因が O リング劣化と判明、規格変更して再試験へ"',
    '  next_actions: "山田が 1/31 までに資料ドラフト作成"',
    '  risks:      "ライセンス契約条件が未合意。8/末までに固まらないと量産スケジュール遅延"'
  ].join("\n");
}

/**
 * meeting_extract を Protocol Store に追加/更新する。
 * 同時に DB_LlmModelConfig にも meeting_extract = gemini-2.0-flash のレコードを upsert する。
 *
 * 使い方: GAS エディタ or `clasp run run_installMeetingExtractorConfig`
 */
function run_installMeetingExtractorConfig(){
  const sh = protocolStore_getExtractorConfigSheet_();

  const name = "meeting_extract";
  const composeGroup = "meeting_extract";

  const nowIso = protocolStore_nowIsoJst_();
  const actor = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();

  const desired = {
    name: name,
    status: "active",
    version: "260509_03",
    systemPrompt: meeting_extract_basePrompt_(),
    note: "v3: meeting_meta セクション (projectName/meetingTitle/meetingDate) を冒頭に明示 + 対象 PJ と無関係な別 PJ thread の混入排除ルール強化 (BWE株主総会枠に CX/Kiutra メールが混入した事故対策、2026-05-09)",
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
  let promptResult;

  if (!hit.found){
    const row = Object.assign({}, desired, {
      configId: Utilities.getUuid().replace(/-/g,""),
      createdAt: nowIso
    });
    protocolStore_appendRowObject_(sh, row);
    promptResult = { ok:true, action:"inserted", name:name, composeGroup:composeGroup, updatedAt: nowIso };
  } else {
    const lastCol = sh.getLastColumn();
    const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x||"").trim());
    const vals = sh.getRange(hit.rowIndex, 1, 1, lastCol).getValues()[0];
    function get_(col){
      const i = header.indexOf(col);
      return (i < 0) ? "" : vals[i];
    }
    const next = {
      configId: String(get_("configId") || "").trim() || Utilities.getUuid().replace(/-/g,""),
      createdAt: String(get_("createdAt") || "").trim() || nowIso
    };
    Object.keys(desired).forEach(k => { next[k] = desired[k]; });
    protocolStore_writeRowObjectByRowIndex_(sh, hit.rowIndex, next);
    promptResult = { ok:true, action:"updated", name:name, composeGroup:composeGroup, updatedAt: nowIso };
  }

  // DB_LlmModelConfig に meeting_extract = gemini-2.0-flash を登録
  let modelResult = null;
  try {
    if (typeof admin_upsertLlmModelConfig === "function") {
      modelResult = admin_upsertLlmModelConfig({
        usageKey: "meeting_extract",
        provider: "gemini",
        model: "gemini-2.5-flash",
        maxTokens: 2048,
        temperature: 0.2,
        notes: "1 MTG 議事録 → 構造化サマリ (pwa/design/meeting_summaries.md)"
      });
    }
  } catch(e) {
    modelResult = { ok:false, error: String(e && e.message ? e.message : e) };
  }

  return { ok:true, prompt: promptResult, model: modelResult };
}

