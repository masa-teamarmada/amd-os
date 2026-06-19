/** 017_InvoiceSendNudge.gs
 * 請求書送付タスクの Slack nudge cron + interactive button 完了処理
 *
 * 仕様 (まさ依頼 2026-05-08):
 * - 締切前日 17:00 → 20:00 → 締切日 10:00 → 12:00 → 15:00 → 17:00 の 6 回 nudge
 * - 投稿先 = projects.slackChannelId (PJ 専用 Slack チャンネル)
 * - メンション = project_members.is_pm=true のメンバー全員 (Supabase から取得)
 * - 「✅ 送信済み」ボタン → Supabase billing_cycles.invoice_sent_at = NOW()
 * - 完了通知は **新メッセージ** で post (元 nudge は絶対上書き禁止 → gas/CLAUDE.md ルール 4)
 *
 * 必要な ScriptProperties:
 * - SLACK_BOT_TOKEN (既存)
 * - SUPABASE_URL  (新規、自動セットアップで internal_setup mode が入れる)
 * - SUPABASE_SERVICE_ROLE_KEY (新規、自動セットアップで internal_setup mode が入れる)
 *
 * 関連ファイル:
 * - 081_SlackInteractive.js: slackInteractiveWorker から invoice_send_done を分岐
 * - 80_SlackWebhook.js: doPost の internal_setup mode + allow に invoice_send_done 追加
 */

// ============================================================
// 定数
// ============================================================

const INVOICE_NUDGE_LOG_SHEET = "DB_InvoiceSendNudgeLog";
const INVOICE_NUDGE_LOG_HEADER = ["projectId", "ym", "occurrence", "sentAt", "messageTs"];

// 6 occurrence の意味: 順に「締切前日 17:00 / 20:00 / 締切日 10:00 / 12:00 / 15:00 / 17:00」
const NUDGE_OCCURRENCES = [
  { id: "p17", dayOffset: -1, hour: 17 },
  { id: "p20", dayOffset: -1, hour: 20 },
  { id: "d10", dayOffset: 0, hour: 10 },
  { id: "d12", dayOffset: 0, hour: 12 },
  { id: "d15", dayOffset: 0, hour: 15 },
  { id: "d17", dayOffset: 0, hour: 17 },
];

// ============================================================
// 締切日計算 (土日のみ前営業日に補正)
// ============================================================

function invoiceSend_isWeekend_(d) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function invoiceSend_adjustBusinessDay_(d) {
  const out = new Date(d.getTime());
  while (invoiceSend_isWeekend_(out)) {
    out.setDate(out.getDate() - 1);
  }
  return out;
}

/**
 * @param {string} projectId  例 "p20"
 * @param {string} ym         "YYYYMM"
 * @return {Date} JST 日付 (時刻部 00:00)
 */
function invoiceSend_getDeadline_(projectId, ym) {
  const y = Number(String(ym).slice(0, 4));
  const m = Number(String(ym).slice(4, 6));
  const isCtb = String(projectId) === "p06";

  let raw;
  if (isCtb) {
    // CTB: 当月 28 日
    raw = new Date(y, m - 1, 28);
  } else {
    // 標準: 翌月 9 日
    raw = (m === 12) ? new Date(y + 1, 0, 9) : new Date(y, m, 9);
  }
  return invoiceSend_adjustBusinessDay_(raw);
}

// ============================================================
// 送信済みログ
// ============================================================

function invoiceSend_ensureLogSheet_() {
  // 本体スプシ参照ヘルパー (000_Sheets.js)
  const ss = b_ss_();
  let sh = ss.getSheetByName(INVOICE_NUDGE_LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(INVOICE_NUDGE_LOG_SHEET);
    sh.getRange(1, 1, 1, INVOICE_NUDGE_LOG_HEADER.length).setValues([INVOICE_NUDGE_LOG_HEADER]);
  } else {
    const lastCol = Math.max(sh.getLastColumn(), 1);
    const row1 = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x || "").trim());
    const missing = INVOICE_NUDGE_LOG_HEADER.filter(h => row1.indexOf(h) < 0);
    if (missing.length) {
      sh.getRange(1, row1.length + 1, 1, missing.length).setValues([missing]);
    }
  }
  return sh;
}

function invoiceSend_hasLogged_(projectId, ym, occurrence) {
  const sh = invoiceSend_ensureLogSheet_();
  const last = sh.getLastRow();
  if (last < 2) return false;
  const vals = sh.getRange(2, 1, last - 1, 3).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (
      String(vals[i][0]).trim() === projectId &&
      String(vals[i][1]).trim() === ym &&
      String(vals[i][2]).trim() === occurrence
    ) return true;
  }
  return false;
}

function invoiceSend_logSent_(projectId, ym, occurrence, messageTs) {
  const sh = invoiceSend_ensureLogSheet_();
  sh.appendRow([projectId, ym, occurrence, new Date().toISOString(), String(messageTs || "")]);
}

// ============================================================
// Supabase REST helpers
// ============================================================

function invoiceSend_supabaseUrl_() {
  const u = String(PropertiesService.getScriptProperties().getProperty("SUPABASE_URL") || "").trim();
  if (!u) throw new Error("SUPABASE_URL is missing in Script Properties");
  return u.replace(/\/+$/, "");
}

function invoiceSend_supabaseKey_() {
  const k = String(PropertiesService.getScriptProperties().getProperty("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing in Script Properties");
  return k;
}

function invoiceSend_supabaseRequest_(method, path, body) {
  const url = invoiceSend_supabaseUrl_() + path;
  const key = invoiceSend_supabaseKey_();
  const opts = {
    method: String(method).toLowerCase(),
    contentType: "application/json",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      Prefer: "return=representation",
    },
    muteHttpExceptions: true,
  };
  if (body !== undefined && body !== null) opts.payload = JSON.stringify(body);
  const res = UrlFetchApp.fetch(url, opts);
  const code = res.getResponseCode();
  const text = res.getContentText() || "";
  if (code >= 200 && code < 300) {
    try { return text ? JSON.parse(text) : null; } catch (_e) { return text; }
  }
  throw new Error("Supabase " + method.toUpperCase() + " " + path + " -> " + code + " " + text);
}

/**
 * billing_cycles のうち status が active 系 + 今期に該当する PJ × ym の組を返す。
 * - 「請求書送付」が必要な月 = invoice_sent_at が空 + freeze 中でない + 締切日が前日 or 当日
 */
function invoiceSend_listCandidatePjYm_() {
  // active な PJ を全部取得
  const pjs = invoiceSend_supabaseRequest_(
    "GET",
    "/rest/v1/projects?select=project_id,project_name,slack_channel_id,status,freeze_from_ym,restart_expected_ym&status=in.(active,sales)"
  );
  const out = [];
  for (const pj of pjs || []) {
    if (!pj.slack_channel_id) continue;
    out.push({
      projectId: pj.project_id,
      projectName: pj.project_name || pj.project_id,
      slackChannelId: pj.slack_channel_id,
      freezeFromYm: pj.freeze_from_ym || null,
      restartExpectedYm: pj.restart_expected_ym || null,
    });
  }
  return out;
}

function invoiceSend_isFrozen_(pj, ym) {
  if (!pj.freezeFromYm) return false;
  const from = String(pj.freezeFromYm);
  const restart = pj.restartExpectedYm ? String(pj.restartExpectedYm) : null;
  if (ym < from) return false;
  if (restart && ym >= restart) return false;
  return true;
}

function invoiceSend_getInvoiceSentAt_(projectId, ym) {
  const enc = encodeURIComponent;
  const rows = invoiceSend_supabaseRequest_(
    "GET",
    `/rest/v1/billing_cycles?select=invoice_sent_at,project_id,ym&project_id=eq.${enc(projectId)}&ym=eq.${enc(ym)}`
  );
  if (!rows || !rows.length) return { exists: false, sent: false };
  const r = rows[0];
  return { exists: true, sent: !!r.invoice_sent_at, sentAt: r.invoice_sent_at };
}

function invoiceSend_setInvoiceSentAt_(projectId, ym, sentAtIso) {
  const enc = encodeURIComponent;
  return invoiceSend_supabaseRequest_(
    "PATCH",
    `/rest/v1/billing_cycles?project_id=eq.${enc(projectId)}&ym=eq.${enc(ym)}`,
    { invoice_sent_at: sentAtIso }
  );
}

/**
 * @return {Array<{memberId: string, slackId: string, codeName: string}>}
 */
function invoiceSend_getPmSlackIds_(projectId) {
  const enc = encodeURIComponent;
  const pms = invoiceSend_supabaseRequest_(
    "GET",
    `/rest/v1/project_members?select=member_id&project_id=eq.${enc(projectId)}&is_pm=eq.true&is_active=eq.true`
  );
  const memberIds = (pms || []).map(r => r.member_id).filter(Boolean);
  if (!memberIds.length) return [];
  const filterIds = memberIds.map(id => `"${id}"`).join(",");
  const members = invoiceSend_supabaseRequest_(
    "GET",
    `/rest/v1/members?select=member_id,slack_id,code_name&member_id=in.(${filterIds})`
  );
  return (members || [])
    .filter(m => m.slack_id)
    .map(m => ({ memberId: m.member_id, slackId: m.slack_id, codeName: m.code_name || m.member_id }));
}

// ============================================================
// Slack 投稿
// ============================================================

function invoiceSend_slackBotToken_() {
  const t = String(PropertiesService.getScriptProperties().getProperty("SLACK_BOT_TOKEN") || "").trim();
  if (!t) throw new Error("SLACK_BOT_TOKEN missing");
  return t;
}

function invoiceSend_slackPost_(payload) {
  const res = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + invoiceSend_slackBotToken_() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const obj = JSON.parse(res.getContentText() || "{}");
  if (!obj.ok) throw new Error("Slack chat.postMessage failed: " + (obj.error || res.getContentText()));
  return obj;
}

function invoiceSend_buildBlocks_(projectName, ym, occurrenceLabel, mentions, projectId) {
  const ymLabel = `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
  const mentionStr = mentions.length ? mentions.join(" ") + " " : "";
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${mentionStr}*【${projectName}】 ${ymLabel} の請求書送付した?*\n_${occurrenceLabel}_`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "✅ 送信済み" },
          style: "primary",
          action_id: "invoice_send_done",
          value: JSON.stringify({ projectId, ym }),
        },
      ],
    },
  ];
}

// ============================================================
// メインの cron
// ============================================================

/**
 * 5 つの時間トリガー (10:00 / 12:00 / 15:00 / 17:00 / 20:00 JST) から呼ばれる。
 * 各 PJ × 締切日 (前日 or 当日) で、該当 occurrence の nudge を送る。
 */
function cron_invoiceSendNudge_() {
  return { ok: true, disabled: true, reason: "monthly routine invoice-send nudge abolished 2026-06-19" };

  const now = new Date();
  const hour = now.getHours(); // JST (TZ Asia/Tokyo)

  // 現在時刻が NUDGE_OCCURRENCES のどれかにマッチ?
  // 「dayOffset = -1 (締切前日) で hour = 17 or 20」
  // 「dayOffset = 0 (締切日) で hour = 10 / 12 / 15 / 17」
  // → 17:00 トリガーは「前日 17 (= 締切が明日)」と「当日 17 (= 締切が今日)」の両方を判定する
  const candidates = NUDGE_OCCURRENCES.filter(o => o.hour === hour);
  if (!candidates.length) {
    Logger.log(`cron_invoiceSendNudge_: hour=${hour} 該当 occurrence なし`);
    return { ok: true, sent: 0, skipped: 0 };
  }

  // 当月 ym (= 業務月)。請求書送付は通常「翌月初頭」に発生するので、
  // 締切が今日 or 明日 → 業務月は今月 (12月で翌年1月締切なら例外)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const pjs = invoiceSend_listCandidatePjYm_();
  let sent = 0;
  let skipped = 0;
  const errors = [];

  for (const pj of pjs) {
    // 過去 3 ヶ月 + 当月 + 来月 の ym を candidate にして、各 ym で締切日を計算 → 該当のみ処理
    for (let monthOffset = -2; monthOffset <= 1; monthOffset++) {
      const ymDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const ym = Utilities.formatDate(ymDate, "Asia/Tokyo", "yyyyMM");

      if (invoiceSend_isFrozen_(pj, ym)) continue;

      const deadline = invoiceSend_getDeadline_(pj.projectId, ym);
      const dayDiff = Math.round((deadline.getTime() - today.getTime()) / (24 * 3600 * 1000));

      // 該当 occurrence (現在 hour で、dayDiff が -1 or 0 のもの) を探す
      const occ = candidates.find(c => c.dayOffset === -dayDiff || (c.dayOffset === 0 && dayDiff === 0) || (c.dayOffset === -1 && dayDiff === 1));
      if (!occ) continue;
      // dayOffset = -1 は「締切前日」= dayDiff = 1 (締切まであと1日)
      // dayOffset =  0 は「締切日」    = dayDiff = 0
      const isMatch = (occ.dayOffset === -1 && dayDiff === 1) || (occ.dayOffset === 0 && dayDiff === 0);
      if (!isMatch) continue;

      // 既送 → skip
      if (invoiceSend_hasLogged_(pj.projectId, ym, occ.id)) {
        skipped++;
        continue;
      }

      // 既に送付済 → skip
      let sentInfo;
      try {
        sentInfo = invoiceSend_getInvoiceSentAt_(pj.projectId, ym);
      } catch (e) {
        errors.push(`${pj.projectId}/${ym}: getInvoiceSentAt failed - ${e.message}`);
        continue;
      }
      if (!sentInfo.exists) {
        // billing_cycles 行が無い PJ × ym → そもそも nudge 不要
        skipped++;
        continue;
      }
      if (sentInfo.sent) {
        skipped++;
        continue;
      }

      // PM の Slack ID
      let pms;
      try {
        pms = invoiceSend_getPmSlackIds_(pj.projectId);
      } catch (e) {
        errors.push(`${pj.projectId}/${ym}: getPmSlackIds failed - ${e.message}`);
        continue;
      }
      const mentions = pms.map(p => `<@${p.slackId}>`);

      // occurrence ラベル
      const labelMap = {
        p17: "締切前日 17:00",
        p20: "締切前日 20:00",
        d10: "締切日 10:00",
        d12: "締切日 12:00",
        d15: "締切日 15:00",
        d17: "締切日 17:00 (最終)",
      };
      const occLabel = labelMap[occ.id] || occ.id;

      // 投稿
      try {
        const res = invoiceSend_slackPost_({
          channel: pj.slackChannelId,
          text: `【${pj.projectName}】${ym.slice(0,4)}年${Number(ym.slice(4,6))}月 の請求書送付したか確認`,
          blocks: invoiceSend_buildBlocks_(pj.projectName, ym, occLabel, mentions, pj.projectId),
        });
        invoiceSend_logSent_(pj.projectId, ym, occ.id, res.ts);
        sent++;
      } catch (e) {
        errors.push(`${pj.projectId}/${ym}: post failed - ${e.message}`);
      }
    }
  }

  Logger.log(`cron_invoiceSendNudge_: sent=${sent} skipped=${skipped} errors=${errors.length}`);
  if (errors.length) Logger.log(errors.join("\n"));
  return { ok: errors.length === 0, sent, skipped, errors };
}

// ============================================================
// worker から呼ばれる「送信済み」ボタン処理
// ============================================================

/**
 * 081_SlackInteractive.js / slackInteractiveWorker から呼ばれる。
 * @param {object} job  キューに積まれた {actionId, actionValue, userId, channelId, messageTs}
 */
function invoiceSend_handleDoneFromQueue_(job) {
  let v = {};
  try { v = job.actionValue ? JSON.parse(String(job.actionValue)) : {}; } catch (_e) { v = {}; }
  const projectId = String(v.projectId || "").trim();
  const ym = String(v.ym || "").trim();
  if (!projectId || !ym) {
    return { ok: false, message: "projectId/ym missing in action value" };
  }

  // dedup (連打 / Slack 再送対策)
  const cache = CacheService.getScriptCache();
  const dedupeKey = "invoice_send_done_" + projectId + "_" + ym + "_" + (job.userId || "u");
  if (cache.get(dedupeKey)) return { ok: true, message: "dedup hit" };
  cache.put(dedupeKey, "1", 300);

  // Supabase 更新
  const sentAtIso = new Date().toISOString();
  try {
    invoiceSend_setInvoiceSentAt_(projectId, ym, sentAtIso);
  } catch (e) {
    // 失敗時は新メッセージで通知 (元 nudge は触らない)
    try {
      invoiceSend_slackPost_({
        channel: job.channelId,
        text: `⚠️ 「送信済み」ボタンの DB 反映に失敗 (${projectId} / ${ym}): ${e.message}`,
      });
    } catch (_e) {}
    return { ok: false, message: e.message };
  }

  // 完了通知 (新メッセージ、元 nudge は絶対上書きしない)
  try {
    const ymLabel = `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
    const hhmm = Utilities.formatDate(new Date(), "Asia/Tokyo", "HH:mm");
    invoiceSend_slackPost_({
      channel: job.channelId,
      text: `✅ <@${job.userId}> が ${ymLabel} の請求書送付を「送信済み」として記録しました (${hhmm})`,
    });
  } catch (e) {
    Logger.log("invoiceSend_handleDoneFromQueue_: post complete msg failed " + e.message);
  }

  return { ok: true, projectId, ym, sentAt: sentAtIso };
}

// ============================================================
// 自動セットアップ (doPost mode=internal_setup から呼ばれる)
// ============================================================

/**
 * 1 回限りの自動セットアップ:
 * - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY を ScriptProperties にセット
 * - cron_invoiceSendNudge_ の時間トリガー 5 つを作成
 * - 既存の slackInteractiveWorker トリガーが無ければ作成
 *
 * 既に SUPABASE_SERVICE_ROLE_KEY が設定されている場合は再実行を拒否する。
 *
 * @param {object} body  {supabaseUrl, supabaseKey}
 * @return {object}
 */
function invoiceSend_runInternalSetup_(body) {
  const props = PropertiesService.getScriptProperties();
  const fn = "cron_invoiceSendNudge_";
  const existingTriggers = ScriptApp.getProjectTriggers().filter(t => {
    try { return t.getHandlerFunction() === fn; } catch (_e) { return false; }
  });
  existingTriggers.forEach(t => { try { ScriptApp.deleteTrigger(t); } catch (_e) {} });

  if (String(props.getProperty("SUPABASE_SERVICE_ROLE_KEY") || "").trim()) {
    return { ok: true, disabled: true, removedTriggers: existingTriggers.length, message: "invoice-send nudge disabled; existing config kept" };
  }

  const supabaseUrl = String((body && body.supabaseUrl) || "").trim();
  const supabaseKey = String((body && body.supabaseKey) || "").trim();
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, message: "supabaseUrl / supabaseKey required" };
  }

  props.setProperty("SUPABASE_URL", supabaseUrl);
  props.setProperty("SUPABASE_SERVICE_ROLE_KEY", supabaseKey);

  // slackInteractiveWorker も確実に作成 (既にあれば不要)
  try {
    if (typeof admin_ensureSlackInteractiveWorkerTrigger === "function") {
      admin_ensureSlackInteractiveWorkerTrigger();
    }
  } catch (_e) {}

  return {
    ok: true,
    disabled: true,
    removedTriggers: existingTriggers.length,
    message: "invoice-send nudge disabled; no trigger created",
  };
}
