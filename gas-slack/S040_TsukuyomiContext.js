/** S040_TsukuyomiContext.gs
 * つくよみのsystemPrompt構築。
 * DB_TsukuyomiContextのtags=tsukuyomiをpriority降順で結合。
 * DB_TsukuyomiMemoryのAMD分は常時注入、PJ固有分はprojectId指定時のみ注入。
 * プロンプトの中身はすべてDBで管理する。
 */

function context_getMainSs_() {
  const id = utils_getProp_("MAIN_SPREADSHEET_ID");
  if (!id) throw new Error("MAIN_SPREADSHEET_ID missing");
  return SpreadsheetApp.openById(id);
}

function context_getNavSs_() {
  const id = utils_getProp_("NAVIGATOR_SPREADSHEET_ID");
  if (!id) throw new Error("NAVIGATOR_SPREADSHEET_ID missing");
  return SpreadsheetApp.openById(id);
}

function context_readSheet_(sheetName) {
  const ss = context_getMainSs_();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v || "").trim());
  const rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return rows.map(r => {
    const obj = {};
    header.forEach((h, i) => { if (h) obj[h] = String(r[i] || "").trim(); });
    return obj;
  });
}

function context_readNavSheet_(sheetName) {
  const ss = context_getNavSs_();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v || "").trim());
  const rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return rows.map(r => {
    const obj = {};
    header.forEach((h, i) => { if (h) obj[h] = String(r[i] || "").trim(); });
    return obj;
  });
}

function context_buildMemoryBlock_(projectId) {
  const rows = context_readNavSheet_("DB_TsukuyomiMemory");
  const active = rows.filter(r => r.status === "active" && r.content);

  const amdRows = active.filter(r => r.projectId === "AMD");
  const pjRows = projectId ? active.filter(r => r.projectId === projectId) : [];

  const lines = [];
  if (amdRows.length > 0) {
    lines.push("【AMDナレッジ】");
    amdRows.forEach(r => lines.push("- " + r.content));
  }
  if (pjRows.length > 0) {
    lines.push("【" + projectId + " ナレッジ】");
    pjRows.forEach(r => lines.push("- " + r.content));
  }

  return lines.join("\n").trim();
}

function context_getProjectIdByChannelId_(channelId) {
  channelId = String(channelId || "").trim();
  if (!channelId) return null;
  const ss = context_getMainSs_();
  const sh = ss.getSheetByName("DB_Projects");
  if (!sh) return null;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v || "").trim());
  const rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const iCh = header.indexOf("slackChannelId");
  const iPj = header.indexOf("projectId");
  if (iCh < 0 || iPj < 0) return null;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][iCh] || "").trim() === channelId) {
      return String(rows[i][iPj] || "").trim() || null;
    }
  }
  return null;
}

function context_extractAndSaveMemory_(threadHistory, channelId) {
  const rows = context_readSheet_("DB_TsukuyomiContext");
  const promptRow = rows.find(r => {
    const tags = r.tags ? r.tags.split(",").map(s => s.trim()) : [];
    return tags.includes("memory_extract") && r.status === "active" && r.systemPrompt;
  });
  if (!promptRow) return;

  const projectId = context_getProjectIdByChannelId_(channelId) || "AMD";

  // スレッド内のユーザーslackIdを収集（メンバー解決用）
  const userIds = [];
  const historyText = (Array.isArray(threadHistory) ? threadHistory : [])
    .map(m => {
      const isBotMsg = !!m.bot_id;
      const who = isBotMsg ? "つくよみ" : "ユーザー";
      if (!isBotMsg && m.user) userIds.push(String(m.user));
      return "[" + who + "] " + String(m.text || "").replace(/\s+/g, " ").trim();
    })
    .filter(l => l.length > 10)
    .join("\n");

  if (!historyText) return;

  // メンバー名の解決
  var memberNames = [];
  var uniqueUserIds = userIds.filter(function(v, i, a) { return a.indexOf(v) === i; });
  uniqueUserIds.forEach(function(uid) {
    var info = context_getMemberBySlackId_(uid);
    if (info.current) memberNames.push(info.current.codeName);
  });

  const ss = context_getNavSs_();
  const jstLabel = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日");
  const tsStr = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMddHHmmss");

  // ===== Step 1: PJ記憶抽出（既存フロー、DB_TsukuyomiContextのプロンプト使用）=====
  const userPrompt = "以下のSlack会話から記憶を抽出してください。\n\nPJ文脈: " + projectId + "\n\n会話:\n" + historyText;
  const raw = llm_call_(promptRow.systemPrompt, userPrompt, { maxTokens: 800, temperature: 0.2 });
  if (raw) {
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      const entries = JSON.parse(clean);
      if (Array.isArray(entries) && entries.length > 0) {
        const memSh = ss.getSheetByName("DB_TsukuyomiMemory");
        if (memSh) {
          entries.forEach((e, idx) => {
            const pjId = String(e.projectId || projectId).trim();
            const content = String(e.content || "").trim();
            if (!content) return;
            const memId = "mem_" + pjId + "_sl_" + tsStr + "_" + idx;
            memSh.appendRow([memId, pjId, content, "slack_conversation", "active", jstLabel, jstLabel]);
          });
        }
      }
    } catch(e) {}
  }

  // ===== Step 2: メンバー観察抽出（専用プロンプト、コード内定義）=====
  console.log("[MemberObs] memberNames=" + JSON.stringify(memberNames) + " uniqueUserIds=" + JSON.stringify(uniqueUserIds));
  if (memberNames.length > 0) {
    try {
      context_extractMemberObservations_(historyText, memberNames, ss, jstLabel, tsStr);
    } catch(_me) {
      console.log("[MemberObs] extract error: " + (_me && _me.message ? _me.message : String(_me)));
    }
  } else {
    console.log("[MemberObs] skipped: no memberNames resolved");
  }
}

/**
 * メンバー観察を専用LLM呼び出しで抽出し、DB_MemberEntitiesに保存。
 * memory_extractとは独立したプロンプト・フォーマットを使用。
 */
function context_extractMemberObservations_(historyText, memberNames, navSs, jstLabel, tsStr) {
  var systemPrompt =
    "あなたはSlackの会話からメンバー個人に関する観察を抽出するアシスタントです。\n\n" +
    "以下を抽出してください：\n" +
    "- 性格や人柄が分かる発言・行動\n" +
    "- スキルや専門性に関する情報\n" +
    "- コミュニケーションスタイルの特徴\n" +
    "- 趣味・興味・関心事\n" +
    "- 仕事の進め方やこだわり\n" +
    "- 成長課題や悩み\n" +
    "- 印象的なエピソードや出来事\n\n" +
    "以下は抽出しない：\n" +
    "- プロジェクトの事実情報（それは別途抽出される）\n" +
    "- 曖昧・推測にすぎない情報\n" +
    "- つくよみ自身の返答内容\n\n" +
    "出力はJSON配列のみ。該当なければ空配列[]を返す。\n" +
    "形式:\n" +
    "[\n" +
    "  {\n" +
    '    "codeName": "メンバーのcodeName",\n' +
    '    "category": "personality|skills|communication_style|growth_areas|work_style|interests|episodes",\n' +
    '    "observation": "観察内容（1〜2文で簡潔に）"\n' +
    "  }\n" +
    "]";

  var userPrompt = "参加メンバー: " + memberNames.join(", ") + "\n\n会話:\n" + historyText;

  console.log("[MemberObs] calling LLM for observation extraction...");
  var raw = llm_call_(systemPrompt, userPrompt, { maxTokens: 600, temperature: 0.2 });
  console.log("[MemberObs] LLM raw length=" + (raw ? raw.length : 0));
  if (!raw) return;

  var entries;
  try {
    var clean = raw.replace(/```json|```/g, "").trim();
    entries = JSON.parse(clean);
  } catch(e) {
    console.log("[MemberObs] JSON parse error: " + e.message + " raw=" + raw.substring(0, 200));
    return;
  }

  console.log("[MemberObs] entries=" + entries.length + " items");
  if (!Array.isArray(entries) || entries.length === 0) return;

  context_saveMemberObservations_(navSs, entries, "", jstLabel, tsStr);
  console.log("[MemberObs] saved " + entries.length + " observations");
}

/**
 * メンバー観察をDB_MemberEntitiesに保存する。
 * シートがなければ作成する。
 */
function context_saveMemberObservations_(navSs, observations, channelId, jstLabel, tsStr) {
  var sheetName = "DB_MemberEntities";
  var sh = navSs.getSheetByName(sheetName);
  if (!sh) {
    sh = navSs.insertSheet(sheetName);
    sh.getRange(1, 1, 1, 8).setValues([[
      "entityId", "codeName", "category", "observation", "source", "confidence", "status", "createdAtJst"
    ]]);
  }

  var rows = [];
  observations.forEach(function(o, idx) {
    var codeName = String(o.codeName || "").trim();
    var category = String(o.category || "personality").trim();
    var observation = String(o.observation || "").trim();
    if (!codeName || !observation) return;

    rows.push([
      "mobs_" + tsStr + "_" + idx,
      codeName,
      category,
      observation,
      "slack_conversation",
      "medium",
      "active",
      jstLabel
    ]);
  });

  if (rows.length > 0) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
}

/**
 * DB_Members（Mainスプシ）からslackId→codeName/memberId解決。
 * 全activeメンバーの一覧も返す。
 */
function context_getMemberBySlackId_(slackUserId) {
  slackUserId = String(slackUserId || "").trim();
  var members = context_readSheet_("DB_Members");
  var result = { current: null, all: [] };

  members.forEach(function(m) {
    var status = String(m.status || "").trim().toLowerCase();
    if (status === "inactive" || status === "disabled" || status === "off") return;
    var codeName = String(m.codeName || "").trim();
    if (!codeName) return;

    var entry = {
      memberId: String(m.memberId || "").trim(),
      codeName: codeName,
      slackId: String(m.slackId || m.slackUserId || "").trim()
    };
    result.all.push(entry);

    if (slackUserId && entry.slackId === slackUserId) {
      result.current = entry;
    }
  });

  return result;
}

/**
 * DB_MemberKnowledge（Navigatorスプシ）からメンバー知識を取得。
 * 指定codeNameのプロファイルと、全メンバー一覧を注入用テキストで返す。
 */
function context_buildMemberBlock_(slackUserId) {
  var memberInfo = context_getMemberBySlackId_(slackUserId);
  var lines = [];

  // 全メンバー一覧（codeNameで呼ぶためのマッピング）
  if (memberInfo.all.length > 0) {
    lines.push("【AMDメンバー一覧】");
    memberInfo.all.forEach(function(m) {
      lines.push("- " + m.codeName + " (slackId:" + m.slackId + ")");
    });
  }

  // 会話相手の情報
  if (memberInfo.current) {
    lines.push("");
    lines.push("【現在の会話相手】" + memberInfo.current.codeName);
  }

  // DB_MemberKnowledge から詳細プロファイル
  var knowledgeRows = context_readNavSheet_("DB_MemberKnowledge");
  if (knowledgeRows.length > 0) {
    var categoryLabels = {
      skills: "スキル・専門性", personality: "性格・特徴",
      communication_style: "コミュニケーションスタイル",
      growth_areas: "成長テーマ", work_style: "働き方",
      interests: "興味・関心", episodes: "過去のエピソード・出来事"
    };

    // 会話相手のナレッジ
    if (memberInfo.current) {
      var currentKnowledge = knowledgeRows.filter(function(r) {
        return r.codeName === memberInfo.current.codeName && r.summaryText;
      });
      if (currentKnowledge.length > 0) {
        lines.push("");
        lines.push("【" + memberInfo.current.codeName + " のプロファイル】");
        currentKnowledge.forEach(function(r) {
          var label = categoryLabels[r.category] || r.category;
          lines.push(label + ": " + r.summaryText);
        });
      }
    }

    // 他メンバーのナレッジ（簡潔版）
    var otherMembers = {};
    knowledgeRows.forEach(function(r) {
      if (memberInfo.current && r.codeName === memberInfo.current.codeName) return;
      if (!r.summaryText) return;
      if (!otherMembers[r.codeName]) otherMembers[r.codeName] = [];
      var label = categoryLabels[r.category] || r.category;
      otherMembers[r.codeName].push(label + ": " + r.summaryText);
    });
    var otherNames = Object.keys(otherMembers).sort();
    if (otherNames.length > 0) {
      lines.push("");
      lines.push("【他メンバーのプロファイル】");
      otherNames.forEach(function(name) {
        lines.push(name + ": " + otherMembers[name].join(" / "));
      });
    }
  }

  return lines.join("\n").trim();
}

/**
 * DB_ProjectKnowledge（Navigatorスプシ）からPJ固有ナレッジを取得し注入用テキストを返す。
 * R094_ProjectKnowledge_Repo.pk_buildContextText_ と同等ロジック。
 * （AMD-Slack GASからAMD-Report GASの関数は呼べないためローカルに実装）
 */
function context_buildProjectKnowledgeBlock_(projectId) {
  if (!projectId) return "";
  var rows = context_readNavSheet_("DB_ProjectKnowledge");
  if (!rows.length) return "";

  var categoryLabels = {
    people: "人物", tech: "技術", ip: "知財", org: "組織",
    funding: "資金", market: "市場", competitor: "競合",
    strategy: "戦略", term: "用語"
  };

  var lines = [];
  var cats = [];
  rows.forEach(function(r) {
    if (r.projectId === projectId && r.summaryText) {
      cats.push(r);
    }
  });
  cats.sort(function(a, b) { return (a.category || "").localeCompare(b.category || ""); });

  cats.forEach(function(r) {
    var label = categoryLabels[r.category] || r.category;
    lines.push("【" + label + "】" + r.summaryText);
  });

  return lines.join("\n").trim();
}

function context_buildSystemPrompt_(projectId, slackUserId, persona) {
  const rows = context_readSheet_("DB_TsukuyomiContext");
  const personaTag = String(persona || "").trim() === "eimi" ? "eimi" : "tsukuyomi";

  const tsukuRows = rows
    .filter(r => {
      const tags = r.tags ? r.tags.split(",").map(s => s.trim()) : [];
      return tags.includes(personaTag) && r.status === "active" && r.systemPrompt;
    })
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));

  const parts = tsukuRows.map(r => r.systemPrompt);

  const kb = rows.find(r => r.contextId === "tsukuyomi_knowledge_base" && r.status === "active");
  if (kb && kb.systemPrompt) {
    parts.push("【背景知識】\n" + kb.systemPrompt);
  }

  // PJナレッジ（DB_ProjectKnowledge）を注入
  if (projectId) {
    const pkBlock = context_buildProjectKnowledgeBlock_(projectId);
    if (pkBlock) {
      parts.push(
        "【重要：プロジェクトコンテキスト " + projectId + "】\n" +
        "このチャンネルは " + projectId + " 専用。以下はあなたが既に知っている事実。\n" +
        "回答ルール:\n" +
        "- 以下に登場する人名・技術・組織・戦略は「知っている前提」で話すこと\n" +
        "- 「どのプロジェクト？」「篠原先生って誰？」等の確認質問は絶対にしない\n" +
        "- ユーザーの質問に関連する知識があれば、最初にその知識を提示してから自分の見解を述べる\n" +
        "- 例：「篠原先生は京大のマイクロ波の権威でWiPoTリーダーだから、〜」のように具体的に言及する\n\n" +
        pkBlock
      );
    }
  }

  // メンバー情報（codeName解決 + プロファイル）
  var memberBlock = context_buildMemberBlock_(slackUserId || null);
  if (memberBlock) {
    parts.push(
      "【メンバー情報】\n" +
      "メンバーは必ずcodeNameで呼ぶこと。「あなた」は使わない。\n" +
      "メンバーの過去のエピソードや特徴を知っていれば、会話の中で自然に触れること。\n\n" +
      memberBlock
    );
  }

  // 会話スタイル指示
  parts.push(
    "【会話スタイル】\n" +
    "- 返答の構造を毎回変えること。「賛同→でもね→別角度」のパターンを繰り返さない\n" +
    "- 短いメッセージには短く返す。全てに長文で答えない\n" +
    "- 毎回指摘や問題提起をしなくていい。共感だけ、質問だけ、雑談だけの返答もあり\n" +
    "- 「ただ聞いてほしい」雰囲気のときは、アドバイスせずに受け止める\n" +
    "- たまには軽い冗談や、相手の過去の話題に触れて親しみを出す\n" +
    "- 指摘するときも「気になるのは」「ひとつだけ」程度に留め、毎回やらない"
  );

  const memBlock = context_buildMemoryBlock_(projectId || null);
  if (memBlock) {
    parts.push("【記憶・ナレッジ】\n" + memBlock);
  }

  return parts.join("\n\n").trim();
}
