// 配賦合意（メール送付・トークン・集計）。
/**
 * B_Agreement.gs
 *
 * 目的：
 * 配賦案の合意フロー（メール送付→トークン記録→合意クリック→集計）を集約する。
 * DB_PayoutAgreement を唯一の事実として扱い、履歴と集計を再現可能にする。
 *
 * このファイルが担当するもの：
 * - api_sendPayoutConfirmEmails（合意依頼メール送付＋DB記録）
 * - handleAgreement_（合意クリック処理）
 * - b_getAgreementStatus_ / api_getAgreementStatusOnly（最新versionの集計）
 *
 * ルール：
 * - BillingCycleの更新は原則行わない（必要ならDomain側の関数経由で）。
 * - 合意versionの扱いは“上書きではなく新version”を原則にして監査可能性を維持する。
 */

/** ====== Agreement ====== */
function api_sendPayoutConfirmEmails(payload) {
  const projectId = String(payload.projectId || "").trim();
  const projectName = String(payload.projectName || "").trim() || b_getProjectName_(projectId) || projectId;
  const ym = b_normYm_(payload.ym);
  const budgetYen = Number(payload.budgetYen || 0);
  const payouts = Array.isArray(payload.payouts) ? payload.payouts : [];

  if (!projectId) throw new Error("api_sendPayoutConfirmEmails: projectId empty");
  if (!ym) throw new Error("api_sendPayoutConfirmEmails: ym empty");

  // ★追加：権限チェック
  b_assertProjectAccess_(projectId);

  b_ensureHeader_("DB_PayoutAgreement", [
    "projectId","ym","version","memberId","token",
    "budgetYen","plannedYen","agreedAt","createdAt","updatedAt"
  ]);

  const now = new Date();
  const nowIso = now.toISOString();
  const version = String(Date.now());
  const members = b_indexBy_(b_readTable_("DB_Members"), "memberId");

  const linesAll = payouts.map(p => {
    const codeName = String(p.codeName || p.memberId);
    const yen = Number(p.plannedYen || 0).toLocaleString("ja-JP");
    return `- ${codeName}: ¥${yen}`;
  }).join("\n");

  const targets = payouts
    .map(p => ({
      memberId: String(p.memberId),
      codeName: String(p.codeName || p.memberId),
      email: String(members[String(p.memberId)]?.email || ""),
      plannedYen: Number(p.plannedYen || 0)
    }))
    .filter(t => t.email && Number(t.plannedYen || 0) > 0);

  const baseUrl = ScriptApp.getService().getUrl();

  targets.forEach(t => {
    const token = Utilities.getUuid().replace(/-/g, "");
    b_upsertRow_("DB_PayoutAgreement", ["projectId","ym","version","memberId"], {
      projectId, ym, version,
      memberId: t.memberId,
      token,
      budgetYen,
      plannedYen: t.plannedYen,
      agreedAt: "",
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const agreeUrl =
      `${baseUrl}?mode=agree` +
      `&projectId=${encodeURIComponent(projectId)}` +
      `&ym=${encodeURIComponent(ym)}` +
      `&version=${encodeURIComponent(version)}` +
      `&memberId=${encodeURIComponent(t.memberId)}` +
      `&token=${encodeURIComponent(token)}`;

    const subject = `【AMD】配賦案の確認：${projectName}（${ym}）`;

    const body =
      `${t.codeName} へ

    ${projectName} の「翌月配賦案」について確認お願いするよ。

    【対象月】
    ${ym}

    【翌月予算（税抜）】
    ¥${budgetYen.toLocaleString("ja-JP")}

    【メンバー別（税抜）】
    ${linesAll}

    【あなたの金額（税抜）】
    ¥${t.plannedYen.toLocaleString("ja-JP")}

    ▼合意ボタン（クリックで合意記録）
    ${agreeUrl}

    ※この配賦案が変更されたら、合意はやり直しになるよ
    ※締切：月次報告会の前日まで`;

    GmailApp.sendEmail(t.email, subject, body);

    b_appendBillingLog_({
      actionType: "AGREEMENT_EMAIL_SEND",
      target: "agreement_email",
      projectId,
      ym,
      cycleId: `${projectId}_${ym}`,
      beforeValue: "",
      afterValue: JSON.stringify({ version, to: t.email, memberId: t.memberId, plannedYen: t.plannedYen, budgetYen }),
      reason: "send_confirm_emails",
      operatorUserId: Session.getActiveUser().getEmail(),
      operatorName: Session.getActiveUser().getEmail(),
      createdAt: new Date()
    });
  });

  return { ok: true, version, sentCount: targets.length };
}
function handleAgreement_(projectId, ym, version, memberId, token) {
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  version = String(version || "").trim();
  memberId = String(memberId || "").trim();
  token = String(token || "").trim();

  if (!projectId || !ym || !version || !memberId || !token) return { ok:false, message:"param missing" };

  // ★追加：権限チェック（参画PJのみ）
  // doGet(mode=agree)でも弾くけど二重ガード
  try {
    b_assertProjectAccess_(projectId);
  } catch(e) {
    return { ok:false, message:"access denied" };
  }

  const rows = b_readTable_("DB_PayoutAgreement")
    .map(r => ({ ...r, ym: b_normYm_(r.ym) }))
    .filter(r =>
      String(r.projectId) === projectId &&
      String(r.ym) === ym &&
      String(r.version) === version &&
      String(r.memberId) === memberId
    );
  if (!rows.length) return { ok:false, message:"record not found" };

  const row = rows[0];
  if (String(row.token) !== token) return { ok:false, message:"token mismatch" };

  const nowIso = b_nowIso_();
  b_upsertRow_("DB_PayoutAgreement", ["projectId","ym","version","memberId"], {
    ...row,
    agreedAt: nowIso,
    updatedAt: nowIso,
  });

  b_appendBillingLog_({
    actionType: "AGREEMENT_MEMBER_AGREED",
    target: "agreement",
    projectId,
    ym,
    cycleId: `${projectId}_${ym}`,
    beforeValue: "",
    afterValue: JSON.stringify({ version, memberId, agreedAt: nowIso }),
    reason: "member_agreed",
    operatorUserId: "",
    operatorName: "",
    createdAt: new Date()
  });

  return { ok:true };
}
function b_getAgreementStatus_(projectId, ym, memberIds) {
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);

  const ag = b_readTable_("DB_PayoutAgreement")
    .map(r => ({ ...r, ym: b_normYm_(r.ym) }))
    .filter(r => String(r.projectId) === projectId && String(r.ym) === ym);

  const versions = [...new Set(ag.map(x => String(x.version || "")))].filter(v => v);
  const latest = versions.sort().slice(-1)[0] || "";

  if (!latest) return { latestVersion: "", agreedCount: 0, totalCount: memberIds.length };

  const rows = ag.filter(x => String(x.version) === latest);
  const agreed = new Set(rows.filter(r => r.agreedAt).map(r => String(r.memberId)));

  return {
    latestVersion: latest,
    agreedCount: memberIds.filter(id => agreed.has(String(id))).length,
    totalCount: memberIds.length,
  };
}
function api_getAgreementStatusOnly(projectId, ym){
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  if (!projectId) throw new Error("projectId empty");
  if (!ym) throw new Error("ym empty");

  b_assertProjectAccess_(projectId);

  // 参画メンバー一覧（active only）
  const pms = b_readTable_("DB_ProjectMembers")
    .map(r => ({
      projectId: String(r.projectId || "").trim(),
      memberId: String(r.memberId || "").trim(),
      isActive: (r.isActive !== undefined ? r.isActive : ""),
    }))
    .filter(r => r.projectId === projectId && r.memberId)
    .filter(r => b_toBool_(r.isActive, true));

  const memberIds = pms.map(x => x.memberId);

  // 既存の集計関数を流用
  const a = b_getAgreementStatus_(projectId, ym, memberIds);

  return {
    ok: true,
    latestVersion: String(a.latestVersion || ""),
    agreedCount: Number(a.agreedCount || 0),
    totalCount: Number(a.totalCount || 0),
  };
}