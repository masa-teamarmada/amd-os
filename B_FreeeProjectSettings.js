/**
 * B_FreeeProjectSettings.gs
 *
 * 目的：
 * freeeの取引先/テンプレ設定を、DB_Projects と同期する“設定レイヤー”を集約する。
 * 「UIが渡すprojectIdが揺れる」「partnerIdが空」など運用上の揺れを吸収し、設定を安定化する。
 *
 * このファイルが担当するもの：
 * - DB_Projects からの freee設定取得（partnerId/partnerName/templateId）
 * - projectId解決（id/name/clientName の揺れ吸収）
 * - freee取引先の“名前確定”（完全一致→無ければ作成）
 * - DB_Projects への反映（freeePartnerId/freeePartnerName/freeeInvoiceTemplateId）
 * - api_getFreeeProjectSettings（UI向け）
 *
 * ルール：
 * - freeeコア呼び口（OAuth/API caller）は B_FreeeCore.gs を唯一正として使う。
 * - 請求書発行ロジックはここに置かない（B_FreeeInvoiceFlow.gs 側）。
 */

/**
 * DB_Projects から freee設定を取得
 */
function b_getFreeeProjectSettings_(projectId) {
  projectId = String(projectId || "").trim();
  if (!projectId) return { partnerId: "", partnerName: "", templateId: "" };

  // ★clientNameは廃止方針：列を保証しない。freee系だけ保証する
  b_ensureHeader_("DB_Projects", ["projectId", "freeePartnerId", "freeePartnerName", "freeeInvoiceTemplateId"]);

  const sh = b_getSheet_("DB_Projects");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { partnerId: "", partnerName: "", templateId: "" };

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => String(h || "").trim());

  const idx = (name) => headers.indexOf(name);

  const iProjectId = idx("projectId");
  const iPartnerId = idx("freeePartnerId");
  const iPartnerName = idx("freeePartnerName");
  const iTemplateId = idx("freeeInvoiceTemplateId");

  if (iProjectId < 0) throw new Error("DB_Projects: projectId header not found");

  for (let r = 1; r < values.length; r++) {
    const pid = String(values[r][iProjectId] || "").trim();
    if (pid !== projectId) continue;

    const partnerId = (iPartnerId >= 0) ? String(values[r][iPartnerId] || "").trim() : "";
    const partnerName = (iPartnerName >= 0) ? String(values[r][iPartnerName] || "").trim() : "";
    const templateId = (iTemplateId >= 0) ? String(values[r][iTemplateId] || "").trim() : "";

    // ★partnerName は freeePartnerName が空なら空のまま返す（clientNameフォールバック禁止）
    return { partnerId, partnerName, templateId };
  }

  return { partnerId: "", partnerName: "", templateId: "" };
}

function b_resolveProjectId_(idOrName) {
  const key = String(idOrName || "").trim();
  if (!key) return "";

  try {
    const rows = b_readTable_("DB_Projects");

    // 1) projectId 直一致
    const direct = rows.find(r => String(r.projectId || "").trim() === key);
    if (direct) return String(direct.projectId || "").trim();

    // 2) projectName 一致（UIがprojectName渡すケース）
    const byName = rows.find(r => String(r.projectName || "").trim() === key);
    if (byName) return String(byName.projectId || "").trim();

    // ★clientName一致は廃止（事故源）
  } catch (e) {
    return "";
  }

  return "";
}

/**
 * freee取引先を「名前」で確定する
 * - 完全一致があればそれを使う
 * - なければ作成する
 * 戻り値: { partnerId, partnerName, created }
 *
 * 注意：GET /partners は全件取得なので、取引先が爆増したら重くなる
 * （AMD規模なら当面OK）
 */
function b_freeeEnsurePartnerByName_(partnerName) {
  const name = String(partnerName || "").trim();
  if (!name) return { partnerId: "", partnerName: "", created: false };

  const companyId = String(PropertiesService.getScriptProperties().getProperty("FREEE_COMPANY_ID") || "").trim();
  if (!companyId) throw new Error("FREEE_COMPANY_ID is not set");

  // 1) 一覧から完全一致を探す
  const list = b_freeeRequestAccounting_("get", "/partners", { company_id: companyId }, null);
  const partners = (list.partners || []).map(p => ({
    id: String(p.id || "").trim(),
    name: String(p.name || p.display_name || p.contact_name || "").trim(),
  })).filter(p => p.id && p.name);

  const hit = partners.find(p => p.name === name);
  if (hit) return { partnerId: hit.id, partnerName: hit.name, created: false };

  // 2) 無ければ作成
  const created = b_freeeRequestAccounting_("post", "/partners", null, {
    company_id: Number(companyId),
    name: name,
  });

  const id = String(created.id || (created.partner && created.partner.id) || "").trim();
  const nm = String(created.name || (created.partner && created.partner.name) || name).trim();

  if (!id) throw new Error("freee partner created but id missing: " + JSON.stringify(created));
  return { partnerId: id, partnerName: nm, created: true };
}
/**
 * DB_Projects の freeePartnerId/freeePartnerName を更新
 * - DB_Projects に列が無ければ自動で追加
 */
function b_updateDbProjectsFreee_(projectId, patch) {
  projectId = String(projectId || "").trim();
  patch = patch || {};
  if (!projectId) throw new Error("b_updateDbProjectsFreee_: projectId empty");

  // 必要列を保証
  b_ensureHeader_("DB_Projects", ["freeePartnerId", "freeePartnerName", "freeeInvoiceTemplateId"]);

  const sh = b_getSheet_("DB_Projects");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const values = (lastRow >= 1 && lastCol >= 1) ? sh.getRange(1, 1, lastRow, lastCol).getValues() : [[]];
  const headers = (values[0] || []).map(h => String(h || "").trim());

  const idxProjectId = headers.indexOf("projectId");
  if (idxProjectId < 0) throw new Error("DB_Projects に projectId 列がない");

  // どの列を更新するか
  const targets = Object.keys(patch).filter(k => headers.indexOf(k) >= 0);
  if (!targets.length) return { ok: true, updated: false, reason: "no target columns" };

  // 行を特定して更新
  for (let r = 1; r < values.length; r++) {
    const pid = String(values[r][idxProjectId] || "").trim();
    if (pid !== projectId) continue;

    targets.forEach(k => {
      const c = headers.indexOf(k);
      values[r][c] = patch[k];
    });

    sh.getRange(r + 1, 1, 1, headers.length).setValues([values[r].slice(0, headers.length)]);
    return { ok: true, updated: true };
  }

  // 見つからなければ何もしない（ここは運用によっては throw にしてもいい）
  return { ok: true, updated: false, reason: "project not found" };
}
function api_getFreeeProjectSettings(projectIdOrName) {
  projectIdOrName = String(projectIdOrName || "").trim();
  if (!projectIdOrName) throw new Error("api_getFreeeProjectSettings: projectId empty");

  // ✅ projectId が来る前提を捨てて、「名前でも解決」する
  const resolvedProjectId = b_resolveProjectId_(projectIdOrName);
  if (!resolvedProjectId) {
    return {
      ok: true,
      partnerId: "",
      partnerName: "",
      templateId: "",
      resolvedProjectId: "",
      note: "project not found by id/name"
    };
  }

  b_assertProjectAccess_(resolvedProjectId);

  // ★堅牢派：ここでは「自動作成/自動紐づけ」は絶対にしない（読むだけ）
  const s = b_getFreeeProjectSettings_(resolvedProjectId);

  return {
    ok: true,
    partnerId: String(s.partnerId || "").trim(),
    partnerName: String(s.partnerName || "").trim(),
    templateId: String(s.templateId || "").trim(),
    resolvedProjectId: resolvedProjectId,
  };
}
// ====== Charter Freee Partner Link APIs (admin only) ======

function api_searchFreeePartnersForCharter(payload){
  payload = payload || {};
  const q = String(payload.q || "").trim();
  if (!q) return { ok:false, message:"q empty", partners:[] };

  // admin only（安全のため）
  if (typeof isAdmin_ === "function" && !isAdmin_()) return { ok:false, message:"admin only", partners:[] };

  const companyId = String(PropertiesService.getScriptProperties().getProperty("FREEE_COMPANY_ID") || "").trim();
  if (!companyId) throw new Error("FREEE_COMPANY_ID is not set");

  // freee partners はページングされる可能性が高いので、limit/offsetで全部なめる
  const all = [];
  const limit = 500;
  for (let offset = 0; offset < 20000; offset += limit) {
    const json = b_freeeRequestAccounting_("get", "/partners", { company_id: companyId, limit: limit, offset: offset }, null);
    const part = (json.partners || []).map(p => ({
      id: String(p.id || "").trim(),
      name: String(p.name || p.display_name || p.contact_name || "").trim(),
      shortcut1: String(p.shortcut1 || "").trim(),
      shortcut2: String(p.shortcut2 || "").trim(),
    })).filter(x => x.id && x.name);

    all.push(...part);

    // 取得件数がlimit未満なら最後
    if (part.length < limit) break;
  }

  const qq = q.toLowerCase();
  const filtered = all
    .filter(p => p.name.toLowerCase().includes(qq) || p.shortcut1.toLowerCase().includes(qq) || p.shortcut2.toLowerCase().includes(qq))
    // name昇順で安定表示
    .sort((a,b) => a.name.localeCompare(b.name, "ja"));

  return { ok:true, partners: filtered };
}

function api_linkFreeePartnerToProjectForCharter(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const partnerId = String(payload.partnerId || "").trim();
  const partnerName = String(payload.partnerName || "").trim();

  if (!projectId) throw new Error("projectId empty");
  if (!partnerId) throw new Error("partnerId empty");
  if (!partnerName) throw new Error("partnerName empty");

  if (typeof isAdmin_ === "function" && !isAdmin_()) return { ok:false, message:"admin only" };

  // project access（adminでも参画PJ以外はダメ）
  b_assertProjectAccess_(projectId);

  b_updateDbProjectsFreee_(projectId, {
    freeePartnerId: partnerId,
    freeePartnerName: partnerName,
  });

  const s = b_getFreeeProjectSettings_(projectId);
  return {
    ok: true,
    partnerId: String(s.partnerId || "").trim(),
    partnerName: String(s.partnerName || "").trim(),
    templateId: String(s.templateId || "").trim(),
  };
}
