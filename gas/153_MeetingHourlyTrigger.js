/** 153_MeetingHourlyTrigger.gs — Phase 3 (毎時 polling 方式)
 *
 * 「会議が終わって 60 分後ぐらいに、その会議の議事録だけをピンポイントで抽出」する仕組み。
 *
 * 仕様正本: pwa/design/meeting_summaries.md (Phase 3 セクション)
 *
 * ─────────────────────────────────────────────
 * なぜ ad-hoc trigger 方式 → 毎時 polling 方式に変えたか
 * ─────────────────────────────────────────────
 * 当初 ScriptApp.newTrigger.at(date) で各 event の終了 +60 分に個別 trigger をセットしていたが、
 * GAS の time-trigger 上限 (1 script あたり 20-100 個) に引っかかった。
 *
 * 代わりに「毎時 0 分の cron 1 個だけ」を立てて、その中で
 * 「過去 60-120 分に終わった PJ 関連 events」を毎回スキャンする方式にした。
 * 終了 +60 分ピッタリには発火しないが、+60 〜 +120 分のどこかで処理されるので実用上 OK。
 *
 * ─────────────────────────────────────────────
 * 動き方
 * ─────────────────────────────────────────────
 * 1. setup: 一度だけ `nav_meeting_setupHourlyPollTrigger_` を実行
 *           → 毎時 0 分発火の time-trigger 1 個が作られる
 * 2. 毎時 0 分: `nav_meeting_pollRecentlyEndedEvents` が呼ばれる
 *    a) 過去 3 時間ぶんの calendar events を listEventsByApi_ で取得
 *    b) 終了時刻が「現在の 60 〜 180 分前」の events だけ filter
 *       (= 終了 +60 分 〜 +180 分の窓 ≒ 「ちょうど終了 +60 分すぎたあたり」を毎時拾う)
 *       ※窓を 120 分でなく 180 分にしたのは、cron の遅延や跨ぎを許容するため
 *       重複は Supabase の source_hash 差分検知で防ぐので広めでも問題ない
 *    c) PJ 判定 (CFG_ColorPJHistory + CFG_PJAlias)
 *    d) 各 event について `nav_meeting_processOneEvent_(eventId, projectId)` (074)
 *    e) sourceKinds != 'none' なら meeting_notifications に upsert (Swift APNs 通知用)
 * 3. 03:00 daily cron (152 nav_cronMonthlyExtractAt3) は **拾い漏れ救済 fallback** として
 *    Phase 2 月単位抽出 (`nav_meeting_extractForProjectYm_`) を引き続き実行
 *
 * ─────────────────────────────────────────────
 * 直前追加 MTG への対応
 * ─────────────────────────────────────────────
 * 毎時 polling なので、03:00 以降に追加された MTG も最大 1 時間以内に検知される
 * (= 開催前に scheduling する必要がない、終了後の polling だけで済む)。
 *
 * ─────────────────────────────────────────────
 * 依存
 * ─────────────────────────────────────────────
 * - 074_MeetingSummaryRepo.js: nav_meeting_processOneEvent_
 * - CalendarToNotionMinutes.js: readColorPJHistory_, pickPJByColorHistory_,
 *                                _loadPJAliasesForMinutes_, _matchAlias_, listEventsByApi_,
 *                                readKeyValueConfig_
 * - NotionProtocolSync.js: _resolveAmdProjectIdByProjectNameOrCode_
 * - 180_SupabaseClient.js: supa_upsert
 *
 * ScriptProperties:
 * - MAIN_CALENDAR_ID  (任意) curl/手動テスト用 calendar id override。本番 cron では Session.getEffectiveUser で取れる
 */

var MEETING_HOURLY_CRON_DISABLED_20260522 = true;

// ============================================================
// 公開関数
// ============================================================

/**
 * 毎時 polling callback (毎時 0 分発火)。
 * 過去 60 〜 180 分に終わった PJ 関連 events を取得して 1 event 抽出 + 通知。
 *
 * @param {Object} [opts] {windowStartMinutesAgo?: number=180, windowEndMinutesAgo?: number=60}
 *   テストで窓を変えたい時用。本番では default 60〜180 分前。
 */
function nav_meeting_pollRecentlyEndedEvents(opts) {
  opts = opts || {};
  // dryRun=true (= Claude routine `amd-os-meeting-extract` から呼ばれる) のときは kill switch を通す
  // (= GAS 内 LLM call はせず、各 event の context だけを返す形なので、廃止判断 (= LLM 課金抑制) と整合)
  if (MEETING_HOURLY_CRON_DISABLED_20260522 && opts.dryRun !== true) {
    return { ok: true, disabled: true, message: "Meeting summary hourly cron disabled. Use Codex automation/review batches." };
  }
  const winStartMinAgo = Number(opts.windowStartMinutesAgo || 180);
  const winEndMinAgo = Number(opts.windowEndMinutesAgo || 60);

  const calRes = _meeting_resolveCalendarId_(opts.calendarIdOverride);
  if (!calRes.ok) return calRes;
  const calendarId = calRes.calendarId;

  if (typeof readColorPJHistory_ !== "function") return { ok: false, message: "readColorPJHistory_ not found" };
  if (typeof pickPJByColorHistory_ !== "function") return { ok: false, message: "pickPJByColorHistory_ not found" };
  if (typeof listEventsByApi_ !== "function") return { ok: false, message: "listEventsByApi_ not found" };
  if (typeof _loadPJAliasesForMinutes_ !== "function") return { ok: false, message: "_loadPJAliasesForMinutes_ not found" };
  if (typeof _resolveAmdProjectIdByProjectNameOrCode_ !== "function") return { ok: false, message: "_resolveAmdProjectIdByProjectNameOrCode_ not found" };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const colorHistory = readColorPJHistory_(ss);
  const pjAliases = _loadPJAliasesForMinutes_();
  const now = Date.now();
  const winStartMs = now - winStartMinAgo * 60 * 1000;  // 例: 180分前
  const winEndMs = now - winEndMinAgo * 60 * 1000;      // 例: 60分前
  // listEventsByApi の取得範囲は (winStart - 余裕, now)
  const queryStart = new Date(winStartMs - 60 * 60 * 1000); // 余裕 60 分前まで広げる
  const queryEnd = new Date(now);

  const events = listEventsByApi_(calendarId, queryStart, queryEnd);

  let scanned = 0, in_window = 0, processed = 0, skipped_excluded = 0;
  let skipped_no_pj = 0, errors = 0;
  const items = [];

  for (const ev of events) {
    scanned++;
    const eventId = String(ev.id || "").trim();
    if (!eventId) continue;

    const title = String(ev.summary || "").trim();
    if (!title) continue;

    if (title.startsWith("+") || title.startsWith("＋")) { skipped_excluded++; continue; }
    const startObj = ev.start || {};
    const isAllDay = !!(startObj.date && !startObj.dateTime);
    if (isAllDay) { skipped_excluded++; continue; }

    const desc = String(ev.description || "").trim();
    const loc = String(ev.location || "").trim();
    const text = (title + "\n" + desc + "\n" + loc);
    const aliasHit = _matchAlias_(text, pjAliases);
    if (aliasHit && String(aliasHit.pjCode || "").trim().toUpperCase() === "EXCLUDE") {
      skipped_excluded++;
      continue;
    }

    const startStr = startObj.dateTime || startObj.date;
    if (!startStr) continue;
    const startAt = new Date(startStr);
    if (isNaN(startAt.getTime())) continue;

    const endObj = ev.end || {};
    const endStr = endObj.dateTime || endObj.date;
    if (!endStr) continue;
    const endAt = new Date(endStr);
    if (isNaN(endAt.getTime())) continue;

    // 終了時刻が窓内かチェック
    const endMs = endAt.getTime();
    if (endMs < winStartMs || endMs >= winEndMs) {
      // 窓外 = skip (loop 全体の filter)
      continue;
    }
    in_window++;

    // PJ 判定
    const explicitColorId = String(ev.colorId || "").trim();
    let pjCode = explicitColorId ? (pickPJByColorHistory_(explicitColorId, startAt, colorHistory) || "") : "";
    const safeAlias = _meeting_highConfidencePjAliasForLive_(title, aliasHit);
    if (!pjCode && safeAlias.ok) {
      pjCode = String(aliasHit.pjCode || "").trim();
    }
    if (!pjCode || pjCode.toUpperCase() === "AMD") {
      skipped_no_pj++;
      items.push({ eventId: eventId, title: title, action: "skipped_no_pj", reason: pjCode ? "AMD overall" : "no pjCode" });
      continue;
    }
    const projectId = _resolveAmdProjectIdByProjectNameOrCode_(pjCode);
    if (!projectId) {
      skipped_no_pj++;
      items.push({ eventId: eventId, title: title, action: "skipped_no_pj", pjCode: pjCode });
      continue;
    }

    // 1 event 抽出 (event title / startAt を渡して self-healing + AI ページ fallback 起動)
    let r = null;
    try {
      r = nav_meeting_processOneEvent_(eventId, projectId, {
        eventTitle: title,
        eventStartAt: startAt instanceof Date ? startAt.toISOString() : "",
        dryRun: opts.dryRun === true
      });
    } catch (e) {
      r = { ok: false, message: String(e && e.message ? e.message : e) };
    }

    if (r && r.ok) {
      processed++;
      if (opts.dryRun === true) {
        // dryRun: 各 event の context (= notion + gmail combined text、alias、feedback 等) をそのまま items に積む
        // Claude routine `amd-os-meeting-extract` が LLM 抽出 + Supabase upsert + 通知 upsert を担当
        items.push(r);
      } else {
        items.push({
          eventId: eventId,
          title: title,
          action: r.action,
          sourceKinds: r.sourceKinds || null,
          gmailThreads: r.gmailThreads || 0
        });
        // 通知 insert (拾えた + 内容ありのときだけ)
        try {
          if ((r.action === "inserted" || r.action === "updated") &&
              r.sourceKinds && r.sourceKinds !== "none") {
            _meeting_insertNotification_({
              meetingId: r.meetingId,
              projectId: r.projectId,
              title: r.title || title,
              sourceKinds: r.sourceKinds,
              summaryShort: r.summaryShort || ""
            });
          }
        } catch (eN) {
          Logger.log("[nav_meeting_pollRecentlyEndedEvents] notification insert error: " + eN);
        }
      }
    } else {
      errors++;
      items.push({ eventId: eventId, title: title, action: (r && r.action) || "error", message: (r && r.message) || "" });
    }
  }

  Logger.log("[nav_meeting_pollRecentlyEndedEvents] " + JSON.stringify({
    scanned: scanned, in_window: in_window, processed: processed,
    skipped_excluded: skipped_excluded, skipped_no_pj: skipped_no_pj, errors: errors
  }));

  return {
    ok: true,
    scanned: scanned,
    in_window: in_window,
    processed: processed,
    skipped_excluded: skipped_excluded,
    skipped_no_pj: skipped_no_pj,
    errors: errors,
    items: items
  };
}

function _meeting_highConfidencePjAliasForLive_(title, aliasHit) {
  if (!aliasHit || !aliasHit.alias || !aliasHit.pjCode) return { ok: false, reason: "no_alias_hit" };
  const pjCode = String(aliasHit.pjCode || "").trim().toUpperCase();
  if (!pjCode || pjCode === "EXCLUDE" || pjCode === "AMD") return { ok: false, reason: "alias_skip_code" };

  const rawTitle = String(title || "").trim();
  const rawAlias = String(aliasHit.alias || "").trim();
  if (!rawTitle || !rawAlias) return { ok: false, reason: "empty_title_or_alias" };

  const matchType = String(aliasHit.matchType || "contains").trim().toLowerCase() || "contains";
  const titleLower = rawTitle.toLowerCase();
  const aliasLower = rawAlias.toLowerCase();

  if (matchType === "exact") {
    return { ok: titleLower === aliasLower, reason: titleLower === aliasLower ? "cfg_exact_title" : "exact_not_title" };
  }
  if (matchType === "regex") {
    let re = aliasHit.re || null;
    if (!re) {
      try { re = new RegExp(rawAlias, "i"); } catch (_e) { re = null; }
    }
    const ok = !!(re && re.test(rawTitle));
    return { ok: ok, reason: ok ? "cfg_regex_title" : "regex_not_title" };
  }

  const bracketed = ["[" + rawAlias + "]", "【" + rawAlias + "】", "(" + rawAlias + ")", "（" + rawAlias + "）"];
  for (let i = 0; i < bracketed.length; i++) {
    if (titleLower.indexOf(bracketed[i].toLowerCase()) >= 0) {
      return { ok: true, reason: "cfg_bracketed_title_alias" };
    }
  }

  if (/^[A-Za-z0-9_-]{2,}$/.test(rawAlias)) {
    const escaped = rawAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wholeToken = new RegExp("(^|[^A-Za-z0-9])" + escaped + "([^A-Za-z0-9]|$)", "i");
    if (wholeToken.test(rawTitle)) {
      return { ok: true, reason: "cfg_whole_token_title_alias" };
    }
  }

  return { ok: false, reason: "contains_review_only" };
}

/**
 * 毎時 0 分の polling trigger を 1 個だけセット (1 度実行)。
 * 既存の同名 trigger があれば消してから作成。
 */
function nav_meeting_setupHourlyPollTrigger_() {
  if (MEETING_HOURLY_CRON_DISABLED_20260522) return nav_meeting_disableHourlyPollTrigger_();
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  for (const t of triggers) {
    if (t.getHandlerFunction && t.getHandlerFunction() === "nav_meeting_pollRecentlyEndedEvents") {
      try { ScriptApp.deleteTrigger(t); removed++; } catch (e) {}
    }
  }
  ScriptApp.newTrigger("nav_meeting_pollRecentlyEndedEvents")
    .timeBased()
    .everyHours(1)
    .create();
  return { ok: true, removed: removed, message: "hourly poll trigger set (every 1 hour)" };
}

function nav_meeting_disableHourlyPollTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  for (const t of triggers) {
    if (t.getHandlerFunction && t.getHandlerFunction() === "nav_meeting_pollRecentlyEndedEvents") {
      try { ScriptApp.deleteTrigger(t); removed++; } catch (e) {}
    }
  }
  return { ok: true, disabled: true, removed: removed };
}

/** デバッグ: 現在のすべてのプロジェクト trigger 一覧 */
function nav_meeting_listAllProjectTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  return {
    ok: true,
    count: triggers.length,
    triggers: triggers.map(function (t) {
      return {
        handler: t.getHandlerFunction ? t.getHandlerFunction() : "",
        eventType: String(t.getEventType ? t.getEventType() : ""),
        triggerSource: String(t.getTriggerSource ? t.getTriggerSource() : ""),
        uniqueId: t.getUniqueId ? t.getUniqueId() : ""
      };
    })
  };
}

// ============================================================
// 内部 helper
// ============================================================

function _meeting_resolveCalendarId_(calendarIdOverride) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = (typeof readKeyValueConfig_ === "function") ? readKeyValueConfig_(ss, "CFG_CalendarImport") : {};
  const propsCal = String(PropertiesService.getScriptProperties().getProperty("MAIN_CALENDAR_ID") || "").trim();
  let sessionEmail = "";
  try {
    if (Session.getEffectiveUser) sessionEmail = String(Session.getEffectiveUser().getEmail() || "").trim();
    if (!sessionEmail && Session.getActiveUser) sessionEmail = String(Session.getActiveUser().getEmail() || "").trim();
  } catch (e) { sessionEmail = ""; }
  const calendarId = String(
    calendarIdOverride ||
    cfg.calendarId ||
    propsCal ||
    sessionEmail
  ).trim();
  if (!calendarId) {
    return { ok: false, calendarId: "", message: "calendarId empty (set MAIN_CALENDAR_ID in ScriptProperties or pass calendarIdOverride)" };
  }
  return { ok: true, calendarId: calendarId };
}

/**
 * meeting_notifications テーブルに upsert (Swift APNs 通知用)。
 * 同 meeting_id で複数通知しないよう PK = meeting_id。
 * iOS 側は notified_at IS NULL の行を polling して APNs 送信、送信後 notified_at = now() に更新。
 */
function _meeting_insertNotification_(payload) {
  const row = {
    meeting_id: String(payload.meetingId || ""),
    project_id: String(payload.projectId || ""),
    title: String(payload.title || ""),
    source_kinds: String(payload.sourceKinds || ""),
    summary_short: String(payload.summaryShort || "")
    // notified_at / created_at は DB default
  };
  if (!row.meeting_id) return { ok: false, message: "meeting_id empty" };
  return supa_upsert("meeting_notifications", row, "meeting_id");
}
