/** 112_FreeeInvoiceTemplates.gs
 * 役割：
 * - freee「請求書テンプレ」を一覧取得して、セレクト用の配列に整形して返す
 * - Billing/Admin から呼ばれる “templates for select” の唯一の正
 *
 * 前提：
 * - b_freeeRequestIvJson_ / b_freeeCompanyId_ は B_FreeeCore.gs に存在
 * - freee IV API: GET /invoices/templates を使用
 */

function freee_listInvoiceTemplatesForSelect(){
  const companyId = Number(b_freeeCompanyId_());
  const json = b_freeeRequestIvJson_("get", "/invoices/templates", { company_id: companyId }, null) || {};

  const raw =
    (Array.isArray(json.templates) && json.templates) ||
    (Array.isArray(json.invoice_templates) && json.invoice_templates) ||
    (Array.isArray(json.data) && json.data) ||
    [];

  const list = raw
    .map(t => ({
      id: String(t.id || t.template_id || "").trim(),
      name: String(t.name || t.title || t.display_name || "").trim() || String(t.id || "").trim()
    }))
    .filter(x => x.id);

  // デフォルト候補を上に（請求書PayPay があれば最優先）
  list.sort((a,b) => {
    const ap = a.name.includes("請求書PayPay") ? -1 : 0;
    const bp = b.name.includes("請求書PayPay") ? -1 : 0;
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name, "ja");
  });

  return list;
}
