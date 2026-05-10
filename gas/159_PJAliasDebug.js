/** 159_PJAliasDebug.gs — CFG_PJAlias 外部スプシの dump
 *
 * SX (p21) 等の PJ alias が CFG_PJAlias シートに登録されているか確認するための
 * debug 関数。`gas/CalendarToNotionMinutes.js` `_loadPJAliasesForMinutes_` の
 * 戻り値をそのまま JSON として返す。
 *
 * 仕様: pwa/BUGS.md `[GAS] SX (p21) 繰り返し MTG ...` 参照
 *
 * 重要 (まさルール 2026-05-11): PJ alias の管理はコード内では決してやらない。
 * 唯一正本は CFG_PJAlias 外部スプシ。LLM 抽出側 (gas/074) もこれを再利用すべき。
 */

/**
 * CFG_PJAlias シート全行を返す + 特定 pjCode (= projectId) フィルタ可。
 *
 * @param {string} [pjCodeFilter] (optional) "p21" / "SX" などで絞り込み。空なら全件
 * @return {Object} {ok, total, filterApplied, filtered, items: [{alias, pjCode, priority, matchType}]}
 */
function debug_pjAliases_dump(pjCodeFilter) {
  if (typeof _loadPJAliasesForMinutes_ !== "function") {
    return { ok: false, message: "_loadPJAliasesForMinutes_ unavailable (= gas/CalendarToNotionMinutes.js が読み込まれてない)" };
  }
  let all = [];
  try {
    all = _loadPJAliasesForMinutes_() || [];
  } catch (e) {
    Logger.log("[debug_pjAliases_dump] load error: " + (e && e.stack ? e.stack : e));
    return { ok: false, message: "load error: " + e };
  }

  pjCodeFilter = String(pjCodeFilter || "").trim();
  const filtered = pjCodeFilter
    ? all.filter(function (a) { return String(a.pjCode || "").trim().toLowerCase() === pjCodeFilter.toLowerCase(); })
    : all;

  return {
    ok: true,
    total: all.length,
    filterApplied: pjCodeFilter || "",
    filtered: filtered.length,
    items: filtered.map(function (a) {
      return {
        alias: a.alias,
        pjCode: a.pjCode,
        priority: a.priority,
        matchType: a.matchType
      };
    })
  };
}
