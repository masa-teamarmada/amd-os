/* 月次会議生成と、その説明欄のAMD OSブロック更新。*/
/**
 * B_CalendarMonthly.gs
 *
 * 目的：
 * 月次報告会のスケジューリングと、Google Calendarイベントの生成/更新を集約する。
 * Calendar description 内の “AMD OSブロック” を安全に差し替え可能にし、人間メモを破壊しない。
 *
 * このファイルが担当するもの：
 * - api_generateMeetingCandidates（Freebusyを使った候補生成）
 * - api_createMonthlyMeetingV2（イベント作成、Meet生成、出席者設定）
 * - description の AMD OSブロック生成・マージ・パッチ更新
 *
 * ルール：
 * - Calendar更新は静かに行う（sendUpdatesの扱いを明示）。
 * - “AMD OSブロック” は start/end マーカーで囲い、差し替え可能にする。
 * - BillingCycleへの反映はDomain側の更新関数/Upsertを用いて一貫性を保つ。
 */

/** ====== calendar stuff ====== */
function b_parseTime_(baseDay, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(baseDay);
  d.setHours(h, m, 0, 0);
  return d;
}
// ====== Calendar description updater (AMD OS block) ======
const __AMD_OS_DESC_BLOCK_START__ = "=== AMD OS ===";
const __AMD_OS_DESC_BLOCK_END__   = "=== /AMD OS ===";
function b_buildMonthlyMeetingAmdOsBlock_(projectId, projectName, ym, monthlyReportUrl) {
  const pid = String(projectId || "").trim();
  const pnm = String(projectName || "").trim() || pid;
  const y = String(ym || "").trim();
  const url = String(monthlyReportUrl || "").trim();

  const lines = [
    __AMD_OS_DESC_BLOCK_START__,
    `PJ：${pnm}（${pid}）`,
    `対象月：${y}`,
    "",
    "月次報告書：",
    url ? url : "未（AMD OS 月次ルーティンからアップロードしてね）",
    "",
    "（この会議は AMD OS から生成）",
    __AMD_OS_DESC_BLOCK_END__
  ];
  return lines.join("\n");
}
function b_mergeDescriptionWithAmdOsBlock_(existingDesc, newBlock) {
  const base = String(existingDesc || "");

  const s = base.indexOf(__AMD_OS_DESC_BLOCK_START__);
  const e = base.indexOf(__AMD_OS_DESC_BLOCK_END__);

  // 既にブロックがあれば、その範囲だけ置換（人間メモは残す）
  if (s >= 0 && e > s) {
    const before = base.slice(0, s).replace(/\s+$/g, "");
    const after  = base.slice(e + __AMD_OS_DESC_BLOCK_END__.length).replace(/^\s+/g, "");
    const mid = String(newBlock || "").trim();

    const parts = [];
    if (before) parts.push(before);
    if (mid) parts.push(mid);
    if (after) parts.push(after);
    return parts.join("\n\n").trim();
  }

  // ブロックが無い古いイベントは末尾に追記
  const tail = String(newBlock || "").trim();
  if (!tail) return base;
  return (base ? (base.trim() + "\n\n" + tail) : tail).trim();
}
function b_patchCalendarEventDescription_(calendarId, eventId, newDesc) {
  const calId = String(calendarId || "").trim();
  const eid = String(eventId || "").trim();
  if (!calId || !eid) return { ok:false, skipped:true, reason:"missing ids" };

  // get → merge → patch
  const cur = Calendar.Events.get(calId, eid);
  const merged = b_mergeDescriptionWithAmdOsBlock_(cur.description || "", newDesc);

  // メール通知は飛ばさない（静かに更新）
  const patched = Calendar.Events.patch(
    { description: merged },
    calId,
    eid,
    { sendUpdates: "none" }
  );

  return { ok:true, eventId: patched.id, htmlLink: patched.htmlLink || "" };
}
function b_isOverlappingBusy_(s, e, busy) { return busy.some(b => s < b.end && e > b.start); }
function b_computeSlots_(start, end, busyRanges, slotMinutes) {
  const slots = [];
  const stepMs = slotMinutes * 60 * 1000;

  const cur = new Date(start);
  while (cur < end) {
    const day = new Date(cur);
    day.setHours(0, 0, 0, 0);

    const ws = b_parseTime_(day, BILLING_CFG.WORK_HOURS.start);
    const we = b_parseTime_(day, BILLING_CFG.WORK_HOURS.end);

    let t = new Date(Math.max(ws.getTime(), cur.getTime()));
    while (t.getTime() + stepMs <= we.getTime() && t < end) {
      const t2 = new Date(t.getTime() + stepMs);
      if (!b_isOverlappingBusy_(t, t2, busyRanges)) {
        slots.push({ startISO: t.toISOString(), endISO: t2.toISOString() });
      }
      t = new Date(t.getTime() + stepMs);
    }
    cur.setDate(cur.getDate() + 1);
    cur.setHours(0, 0, 0, 0);
  }
  return slots;
}
function api_generateMeetingCandidates(projectId, ym, rangeStartISO, rangeEndISO) {
  projectId = String(projectId || "").trim();
  if (!projectId) throw new Error("api_generateMeetingCandidates: projectId empty");

  // ★追加：権限チェック
  b_assertProjectAccess_(projectId);

  const start = new Date(rangeStartISO);
  const end = new Date(rangeEndISO);

  const items = BILLING_CFG.AVAILABILITY_CALENDAR_IDS.map(id => ({ id }));
  const fb = Calendar.Freebusy.query({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    timeZone: BILLING_CFG.TZ,
    items,
  });

  let busyRanges = [];
  for (const calId of BILLING_CFG.AVAILABILITY_CALENDAR_IDS) {
    const entry = fb.calendars?.[calId];
    if (!entry) continue;
    (entry.busy || []).forEach(b => busyRanges.push({ start: new Date(b.start), end: new Date(b.end) }));
  }

  const candidates = b_computeSlots_(start, end, busyRanges, BILLING_CFG.SLOT_MINUTES);
  return { candidates: candidates.slice(0, 25) };
}
function api_createMonthlyMeetingV2(payload) {
  const projectId = String(payload.projectId || "").trim();
  const projectName = String(payload.projectName || "").trim() || b_getProjectName_(projectId) || projectId;
  const ym = b_normYm_(payload.ym);
  const startISO = String(payload.startISO || "").trim();
  const endISO = String(payload.endISO || "").trim();
  const monthlyReportUrl = String(payload.monthlyReportUrl || "").trim();

  if (!projectId) throw new Error("api_createMonthlyMeetingV2: projectId empty");
  if (!ym) throw new Error("api_createMonthlyMeetingV2: ym empty");
  if (!startISO || !endISO) throw new Error("api_createMonthlyMeetingV2: datetime empty");

  b_assertProjectAccess_(projectId);
  b_ensureBillingCycleHeader_();

  const start = new Date(startISO);
  const end = new Date(endISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error("api_createMonthlyMeetingV2: invalid datetime");

  const members = b_indexBy_(b_readTable_("DB_Members"), "memberId");
  const rawPMs = b_readTable_("DB_ProjectMembers")
    .map(x => ({
      projectId: String(x.projectId || "").trim(),
      memberId: String(x.memberId || "").trim(),
      isPM: (x.isPM !== undefined ? x.isPM : ""),
      roleLabel: String(x.roleLabel || "").trim(),
      isActive: (x.isActive !== undefined ? x.isActive : ""),
    }))
    .filter(x => x.projectId === projectId && x.memberId);

  const pmEmails = rawPMs
    .filter(r => b_toBool_(r.isActive, true))
    .filter(r => b_toBool_(r.isPM, false) || String(r.roleLabel||"").toUpperCase().includes("PM"))
    .map(r => String(members[String(r.memberId)]?.email || ""))
    .filter(e => e);

  const attendees = Array.from(new Set([ ...BILLING_CFG.FIXED_ATTENDEES, ...pmEmails ]))
    .map(email => ({ email }));

  const titleName = projectName || projectId;
  const summary = `月次報告会：${titleName}`;

  // ★AMD OS管理ブロック（後で差し替え可能）
  const amdBlock = b_buildMonthlyMeetingAmdOsBlock_(projectId, titleName, ym, monthlyReportUrl);

  // ★監査情報（誰がいつ操作したか）をイベントに埋め込む
  const operatorEmail = String(Session.getActiveUser().getEmail() || "").trim();
  const nowIso = b_nowIso_();

  const auditLines = [];
  auditLines.push("-----");
  auditLines.push("[AMD OS] 監査情報");
  auditLines.push(`操作ユーザー: ${operatorEmail || "(unknown)"}`);
  auditLines.push(`操作時刻: ${nowIso}`);
  auditLines.push(`projectId: ${projectId}`);
  auditLines.push(`ym: ${ym}`);
  if (monthlyReportUrl) auditLines.push(`monthlyReportUrl: ${monthlyReportUrl}`);

  const auditBlock = auditLines.join("\n");

  const event = {
    summary,
    // ★descriptionは人間が読む場所なので末尾に追記
    description: (amdBlock ? (amdBlock + "\n\n" + auditBlock) : auditBlock),

    start: { dateTime: start.toISOString(), timeZone: BILLING_CFG.TZ },
    end: { dateTime: end.toISOString(), timeZone: BILLING_CFG.TZ },
    conferenceData: { createRequest: { requestId: Utilities.getUuid() } },
    attendees,

    // ★機械向けの監査情報（プログラムで追える）
    extendedProperties: {
      private: {
        amdOsOperatorEmail: operatorEmail || "",
        amdOsOperatedAt: String(nowIso || ""),
        amdOsProjectId: String(projectId || ""),
        amdOsYm: String(ym || ""),
        amdOsMonthlyReportUrl: String(monthlyReportUrl || ""),
      }
    }
  };

  const created = Calendar.Events.insert(event, BILLING_CFG.HUB_CALENDAR_ID, {
    conferenceDataVersion: 1,
    sendUpdates: "all",
  });

  const cycleId = `${projectId}_${ym}`;

  const cur = b_getCycleOne_(projectId, ym) || {};
  const createdAt = String(cur.createdAt || "") || nowIso;

  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    cycleId,
    projectId,
    ym,
    projectName: String(cur.projectName || projectName),

    budgetTotal: (cur.budgetTotal !== undefined ? cur.budgetTotal : (cur.budgetYen !== undefined ? cur.budgetYen : "")),
    budgetConfirmedAt: String(cur.budgetConfirmedAt || ""),
    budgetConfirmedBy: String(cur.budgetConfirmedBy || ""),

    memberAllocationsJson: (cur.memberAllocationsJson !== undefined ? String(cur.memberAllocationsJson || "") : ""),
    allocationConfirmedAt: String(cur.allocationConfirmedAt || ""),
    allocationConfirmedBy: String(cur.allocationConfirmedBy || ""),
    status: String(cur.status || "draft"),
    note: String(cur.note || ""),

    monthlyReportFileId: String(cur.monthlyReportFileId || ""),
    monthlyReportUrl: String(cur.monthlyReportUrl || ""),

    meetingEventId: created.id,
    meetingStartAt: created.start.dateTime,
    meetingEndAt: created.end.dateTime,
    meetingHtmlLink: created.htmlLink || "",

    fixedTotalYen: Number(cur.fixedTotalYen || 0),
    invoiceIssuedAt: String(cur.invoiceIssuedAt || ""),
    invoiceIssuedBy: String(cur.invoiceIssuedBy || ""),
    invoicePdfUrl: String(cur.invoicePdfUrl || ""),
    invoiceSentAt: String(cur.invoiceSentAt || ""),
    invoiceSentBy: String(cur.invoiceSentBy || ""),
    paymentConfirmedAt: String(cur.paymentConfirmedAt || ""),
    paymentConfirmedBy: String(cur.paymentConfirmedBy || ""),
    paymentNote: String(cur.paymentNote || ""),

    createdAt,
    updatedAt: nowIso
  });

  b_appendBillingLog_({
    actionType: "MEETING_CREATE",
    target: "meeting",
    projectId,
    ym,
    cycleId,
    beforeValue: JSON.stringify({ meetingEventId: String(cur.meetingEventId || ""), meetingHtmlLink: String(cur.meetingHtmlLink || "") }),
    afterValue: JSON.stringify({ meetingEventId: created.id, meetingHtmlLink: created.htmlLink || "", start: created.start.dateTime }),
    reason: "monthly_meeting_create",
    operatorUserId: operatorEmail,
    operatorName: operatorEmail,
    createdAt: new Date()
  });

  return { ok:true, eventId: created.id, htmlLink: created.htmlLink || "" };
}

function b_assertAdminAccess_(){
  // まさ/きよだけ
  if (isAdmin_ && isAdmin_()) return;
  if (canAccessAdminPage_ && canAccessAdminPage_()) return;
  throw new Error("admin only");
}

/**
 * admin強制：月次会議を指定日時で確定（既存があれば上書き）
 * payload: { projectId, projectName, ym, startISO, endISO, monthlyReportUrl }
 */
function api_admin_forceSetMonthlyMeeting(payload){
  payload = payload || {};

  b_assertAdminAccess_();

  const projectId = String(payload.projectId || "").trim();
  const projectName = String(payload.projectName || "").trim() || b_getProjectName_(projectId) || projectId;
  const ym = b_normYm_(payload.ym);
  const startISO = String(payload.startISO || "").trim();
  const endISO = String(payload.endISO || "").trim();
  const monthlyReportUrl = String(payload.monthlyReportUrl || "").trim();

  if (!projectId) throw new Error("api_admin_forceSetMonthlyMeeting: projectId empty");
  if (!ym) throw new Error("api_admin_forceSetMonthlyMeeting: ym empty");
  if (!startISO || !endISO) throw new Error("api_admin_forceSetMonthlyMeeting: datetime empty");

  // adminでも projectId は正当か見る（変なIDでDB壊す事故防止）
  b_assertProjectAccess_(projectId);

  b_ensureBillingCycleHeader_();

  const start = new Date(startISO);
  const end = new Date(endISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error("api_admin_forceSetMonthlyMeeting: invalid datetime");

  const operatorEmail = String(Session.getActiveUser().getEmail() || "").trim();
  const nowIso = b_nowIso_();

  const cur = b_getCycleOne_(projectId, ym) || {};
  const eventId = String(cur.meetingEventId || "").trim();

  // AMD OSブロックは「monthlyReportUrl > DB値 > 空」の優先
  const reportUrl =
    monthlyReportUrl ||
    String(cur.monthlyReportUrl || "").trim() ||
    "";

  const titleName = projectName || projectId;
  const summary = `月次報告会：${titleName}`;

  const amdBlock = b_buildMonthlyMeetingAmdOsBlock_(projectId, titleName, ym, reportUrl);

  const auditLines = [];
  auditLines.push("-----");
  auditLines.push("[AMD OS] 監査情報");
  auditLines.push("操作種別: MEETING_FORCE_SET");
  auditLines.push(`操作ユーザー: ${operatorEmail || "(unknown)"}`);
  auditLines.push(`操作時刻: ${nowIso}`);
  auditLines.push(`projectId: ${projectId}`);
  auditLines.push(`ym: ${ym}`);
  if (reportUrl) auditLines.push(`monthlyReportUrl: ${reportUrl}`);
  const auditBlock = auditLines.join("\n");

  // 出席者はV2と同じロジックで再計算（PMが変わってても追従）
  const members = b_indexBy_(b_readTable_("DB_Members"), "memberId");
  const rawPMs = b_readTable_("DB_ProjectMembers")
    .map(x => ({
      projectId: String(x.projectId || "").trim(),
      memberId: String(x.memberId || "").trim(),
      isPM: (x.isPM !== undefined ? x.isPM : ""),
      roleLabel: String(x.roleLabel || "").trim(),
      isActive: (x.isActive !== undefined ? x.isActive : ""),
    }))
    .filter(x => x.projectId === projectId && x.memberId);

  const pmEmails = rawPMs
    .filter(r => b_toBool_(r.isActive, true))
    .filter(r => b_toBool_(r.isPM, false) || String(r.roleLabel||"").toUpperCase().includes("PM"))
    .map(r => String(members[String(r.memberId)]?.email || ""))
    .filter(e => e);

  const attendees = Array.from(new Set([ ...BILLING_CFG.FIXED_ATTENDEES, ...pmEmails ]))
    .map(email => ({ email }));

  let patched = null;
  let htmlLink = "";

  if (eventId){
    // 既存イベントを「patch」で更新（人間メモを壊さない）
    const calId = BILLING_CFG.HUB_CALENDAR_ID;

    const curEv = Calendar.Events.get(calId, eventId);

    // description：AMD OSブロックは差し替え、人間メモは残す。監査は末尾追記。
    const mergedDesc = b_mergeDescriptionWithAmdOsBlock_(curEv.description || "", amdBlock);
    const finalDesc = (mergedDesc ? (mergedDesc + "\n\n" + auditBlock) : auditBlock);

    patched = Calendar.Events.patch(
      {
        summary,
        description: finalDesc,
        start: { dateTime: start.toISOString(), timeZone: BILLING_CFG.TZ },
        end:   { dateTime: end.toISOString(),   timeZone: BILLING_CFG.TZ },
        attendees: attendees,
        extendedProperties: {
          private: {
            amdOsOperatorEmail: operatorEmail || "",
            amdOsOperatedAt: String(nowIso || ""),
            amdOsProjectId: String(projectId || ""),
            amdOsYm: String(ym || ""),
            amdOsMonthlyReportUrl: String(reportUrl || ""),
            amdOsLastAction: "MEETING_FORCE_SET",
          }
        }
      },
      calId,
      eventId,
      { sendUpdates: "all" } // admin強制なので通知は飛ばす（黙って動くと地獄）
    );

    htmlLink = patched.htmlLink || curEv.htmlLink || "";
  } else {
    // 既存が無いなら新規作成（V2と同等に作る）
    const event = {
      summary,
      description: (amdBlock ? (amdBlock + "\n\n" + auditBlock) : auditBlock),
      start: { dateTime: start.toISOString(), timeZone: BILLING_CFG.TZ },
      end:   { dateTime: end.toISOString(),   timeZone: BILLING_CFG.TZ },
      conferenceData: { createRequest: { requestId: Utilities.getUuid() } },
      attendees,
      extendedProperties: {
        private: {
          amdOsOperatorEmail: operatorEmail || "",
          amdOsOperatedAt: String(nowIso || ""),
          amdOsProjectId: String(projectId || ""),
          amdOsYm: String(ym || ""),
          amdOsMonthlyReportUrl: String(reportUrl || ""),
          amdOsLastAction: "MEETING_FORCE_SET",
        }
      }
    };

    patched = Calendar.Events.insert(event, BILLING_CFG.HUB_CALENDAR_ID, {
      conferenceDataVersion: 1,
      sendUpdates: "all",
    });

    htmlLink = patched.htmlLink || "";
  }

  // DB_BillingCycle 更新（meeting系だけは上書き）
  const cycleId = `${projectId}_${ym}`;
  const createdAt = String(cur.createdAt || "") || nowIso;

  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    cycleId,
    projectId,
    ym,
    projectName: String(cur.projectName || projectName),

    // 既存値は壊さない
    budgetTotal: (cur.budgetTotal !== undefined ? cur.budgetTotal : (cur.budgetYen !== undefined ? cur.budgetYen : "")),
    budgetConfirmedAt: String(cur.budgetConfirmedAt || ""),
    budgetConfirmedBy: String(cur.budgetConfirmedBy || ""),
    memberAllocationsJson: (cur.memberAllocationsJson !== undefined ? String(cur.memberAllocationsJson || "") : ""),
    allocationConfirmedAt: String(cur.allocationConfirmedAt || ""),
    allocationConfirmedBy: String(cur.allocationConfirmedBy || ""),
    status: String(cur.status || "draft"),
    note: String(cur.note || ""),

    monthlyReportFileId: String(cur.monthlyReportFileId || ""),
    monthlyReportUrl: String(cur.monthlyReportUrl || ""),

    // ★ここが本題
    meetingEventId: String(patched.id || eventId || ""),
    meetingStartAt: (patched.start && patched.start.dateTime) ? patched.start.dateTime : start.toISOString(),
    meetingEndAt:   (patched.end && patched.end.dateTime) ? patched.end.dateTime : end.toISOString(),
    meetingHtmlLink: htmlLink,

    // 既存値維持
    fixedTotalYen: Number(cur.fixedTotalYen || 0),
    invoiceIssuedAt: String(cur.invoiceIssuedAt || ""),
    invoiceIssuedBy: String(cur.invoiceIssuedBy || ""),
    invoicePdfUrl: String(cur.invoicePdfUrl || ""),
    invoiceSentAt: String(cur.invoiceSentAt || ""),
    invoiceSentBy: String(cur.invoiceSentBy || ""),
    paymentConfirmedAt: String(cur.paymentConfirmedAt || ""),
    paymentConfirmedBy: String(cur.paymentConfirmedBy || ""),
    paymentNote: String(cur.paymentNote || ""),

    createdAt,
    updatedAt: nowIso
  });

  b_appendBillingLog_({
    actionType: "MEETING_FORCE_SET",
    target: "meeting",
    projectId,
    ym,
    cycleId,
    beforeValue: JSON.stringify({
      meetingEventId: String(cur.meetingEventId || ""),
      meetingStartAt: String(cur.meetingStartAt || ""),
      meetingEndAt: String(cur.meetingEndAt || ""),
      meetingHtmlLink: String(cur.meetingHtmlLink || "")
    }),
    afterValue: JSON.stringify({
      meetingEventId: String(patched.id || eventId || ""),
      meetingStartAt: (patched.start && patched.start.dateTime) ? patched.start.dateTime : start.toISOString(),
      meetingEndAt:   (patched.end && patched.end.dateTime) ? patched.end.dateTime : end.toISOString(),
      meetingHtmlLink: htmlLink
    }),
    reason: "admin_force_set_monthly_meeting",
    operatorUserId: operatorEmail,
    operatorName: operatorEmail,
    createdAt: new Date()
  });

  return { ok:true, eventId: String(patched.id || eventId || ""), htmlLink: htmlLink };
}

/**
 * 月次会議をキャンセル（Googleカレンダーから削除 + DB_BillingCycleのmeeting情報をクリア）
 * payload: { projectId, ym }  // ym は "YYYY-MM" 形式でもOK（b_normYm_で吸収）
 */
function api_cancelMonthlyMeetingV2(payload){
  payload = payload || {};

  const projectId = String(payload.projectId || "").trim();
  const ym = b_normYm_(payload.ym);

  if (!projectId) throw new Error("api_cancelMonthlyMeetingV2: projectId empty");
  if (!ym) throw new Error("api_cancelMonthlyMeetingV2: ym empty");

  // 権限チェック
  b_assertProjectAccess_(projectId);
  b_ensureBillingCycleHeader_();

  const nowIso = b_nowIso_();
  const operatorEmail = String(Session.getActiveUser().getEmail() || "").trim();

  const cur = b_getCycleOne_(projectId, ym) || {};
  const eventId = String(cur.meetingEventId || "").trim();
  if (!eventId){
    return { ok:true, skipped:true, message:"meetingEventId empty (already canceled?)" };
  }

  // 1) Calendarから削除（通知は飛ばす。黙って消すと現場が混乱する）
  try{
    Calendar.Events.remove(
      String(BILLING_CFG.HUB_CALENDAR_ID || "").trim(),
      eventId,
      { sendUpdates: "all" }
    );
  } catch(e){
    // 既に消えてるケースもあるので「not found」は許容
    const msg = String(e && (e.message || e) || "");
    if (!msg.toLowerCase().includes("notfound") && !msg.toLowerCase().includes("not found")){
      throw e;
    }
  }

  // 2) DB_BillingCycleの meeting系を空にする（他の確定情報は保持）
  const cycleId = String(cur.cycleId || `${projectId}_${ym}`);
  const createdAt = String(cur.createdAt || "") || nowIso;

  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    cycleId,
    projectId,
    ym,
    projectName: String(cur.projectName || ""),

    // 既存値は壊さない
    budgetTotal: (cur.budgetTotal !== undefined ? cur.budgetTotal : (cur.budgetYen !== undefined ? cur.budgetYen : "")),
    budgetConfirmedAt: String(cur.budgetConfirmedAt || ""),
    budgetConfirmedBy: String(cur.budgetConfirmedBy || ""),

    memberAllocationsJson: (cur.memberAllocationsJson !== undefined ? String(cur.memberAllocationsJson || "") : ""),
    allocationConfirmedAt: String(cur.allocationConfirmedAt || ""),
    allocationConfirmedBy: String(cur.allocationConfirmedBy || ""),
    status: String(cur.status || "draft"),
    note: String(cur.note || ""),

    monthlyReportFileId: String(cur.monthlyReportFileId || ""),
    monthlyReportUrl: String(cur.monthlyReportUrl || ""),

    // ★ここが本題：meetingをリセット
    meetingEventId: "",
    meetingStartAt: "",
    meetingEndAt: "",
    meetingHtmlLink: "",

    // 既存値維持
    fixedTotalYen: Number(cur.fixedTotalYen || 0),
    invoiceIssuedAt: String(cur.invoiceIssuedAt || ""),
    invoiceIssuedBy: String(cur.invoiceIssuedBy || ""),
    invoicePdfUrl: String(cur.invoicePdfUrl || ""),
    invoiceSentAt: String(cur.invoiceSentAt || ""),
    invoiceSentBy: String(cur.invoiceSentBy || ""),
    paymentConfirmedAt: String(cur.paymentConfirmedAt || ""),
    paymentConfirmedBy: String(cur.paymentConfirmedBy || ""),
    paymentNote: String(cur.paymentNote || ""),

    createdAt,
    updatedAt: nowIso
  });

  // 3) ログ
  try{
    b_appendBillingLog_({
      actionType: "MEETING_CANCEL",
      target: "meeting",
      projectId,
      ym,
      cycleId,
      beforeValue: JSON.stringify({
        meetingEventId: String(cur.meetingEventId || ""),
        meetingStartAt: String(cur.meetingStartAt || ""),
        meetingEndAt: String(cur.meetingEndAt || ""),
        meetingHtmlLink: String(cur.meetingHtmlLink || "")
      }),
      afterValue: JSON.stringify({
        meetingEventId: "",
        meetingStartAt: "",
        meetingEndAt: "",
        meetingHtmlLink: ""
      }),
      reason: "monthly_meeting_cancel",
      operatorUserId: operatorEmail,
      operatorName: operatorEmail,
      createdAt: new Date()
    });
  } catch(_e){}

  return { ok:true, eventId: eventId };
}
