/** 079_NameAliasMap.gs — メンバー名の表記揺れマップ (LLM プロンプト用)
 *
 * まさからの問題提起 (2026-05-09):
 *   - 「山田氏」=「りょー」(山田 凌波 / inactive)
 *   - 「chiko」=「ちこ」(遠藤 千穂)
 *   - 「山地」=「まさ」(山地 正洋)
 *   が別人としてカウントされる事故 → 名前の表記揺れを LLM に教える正規化マップが必要
 *
 * 設計:
 *   - 専用テーブル/列を切らず、既存 members.member_name + members.email + members.code_name から
 *     動的に alias を生成 (= 上流の members メンテのみで OK、別 UI 不要)
 *   - 抽出される alias:
 *       1. code_name (例: 'まさ')
 *       2. member_name 全体 (例: '山地 正洋')
 *       3. member_name の姓 (例: '山地', スペース手前)
 *       4. member_name の名 (例: '正洋')
 *       5. email local part (例: 'masa')
 *   - 1 ~ 5 を「同一人物の別表記」として LLM プロンプトに 1 ブロックで渡す
 *
 * 使い方:
 *   const block = nameAlias_buildBlock();
 *   userPrompt = "...\n" + block;
 *
 *   // active メンバーだけに絞る場合:
 *   nameAlias_buildBlock({ activeOnly: true });
 *
 * ブロックの形 (LLM 向け):
 *   === 名前の正規化マップ (同一人物の別表記) ===
 *   - まさ = 山地 正洋, 山地, 正洋, masa  (= 同一人物、code_name は 'まさ')
 *   - ちこ = 遠藤 千穂, 遠藤, 千穂, chiko  (= 同一人物、code_name は 'ちこ')
 *   - りょー = 山田 凌波, 山田, 凌波, ryoha  (= 同一人物、code_name は 'りょー') [非アクティブ]
 *   ...
 */

/**
 * @param {Object} [opts] {activeOnly?: boolean (default false), includeInactive?: boolean (default true)}
 * @return {string} LLM プロンプトに含める正規化ブロック (空文字なら省略可)
 */
function nameAlias_buildBlock(opts) {
  opts = opts || {};
  const activeOnly = !!opts.activeOnly;

  const filter = activeOnly ? "status=eq.active" : "";
  const res = supa_select("members", {
    select: "member_id,code_name,member_name,email,status",
    filter: filter || undefined,
    order: "member_id",
    limit: 200
  });
  if (!res.ok) return "";
  const rows = res.rows || [];
  if (!rows.length) return "";

  const lines = [];
  for (const m of rows) {
    const codeName = String(m.code_name || "").trim();
    if (!codeName) continue;
    const memberName = String(m.member_name || "").trim();
    const email = String(m.email || "").trim();
    const status = String(m.status || "").trim();

    // alias を組み立てる (重複排除)
    const aliasSet = {};
    aliasSet[codeName] = true;

    if (memberName) {
      aliasSet[memberName] = true;
      // 姓・名 (空白区切り)
      const parts = memberName.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        aliasSet[parts[0]] = true;
        aliasSet[parts[parts.length - 1]] = true;
      }
    }
    if (email) {
      // email local part (= '@' 手前)
      const at = email.indexOf("@");
      if (at > 0) {
        const local = email.slice(0, at).trim();
        if (local && !/^id\d+$/i.test(local)) aliasSet[local] = true;
      }
    }

    // code_name 自体は line の先頭に出すので alias 部から除外
    delete aliasSet[codeName];
    const aliases = Object.keys(aliasSet);
    if (!aliases.length && !memberName) continue;

    const inactiveSuffix = status === "inactive" ? " [非アクティブ・歴史的記録に登場可]" : "";
    lines.push("- " + codeName + " = " + aliases.join(", ") + " (= 同一人物、code_name は '" + codeName + "')" + inactiveSuffix);
  }

  if (!lines.length) return "";
  return [
    "=== 名前の正規化マップ (同一人物の別表記) ===",
    "[以下は AMD のメンバー一覧。同一人物が異なる表記 (姓 / 名 / 本名 / ローマ字) で",
    " 入力に出てくることがある。LLM は以下のマップに従って **必ず code_name に正規化** して",
    " 抽出すること。例: '山田氏' と書かれていたら 'りょー' と読み替える。'山地' は 'まさ'、",
    " 'chiko' は 'ちこ'。誤って別人として扱わないこと。]",
    ""
  ].concat(lines).join("\n");
}
