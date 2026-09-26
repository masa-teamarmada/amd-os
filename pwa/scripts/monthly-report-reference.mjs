/** Use a supplied actual submitted Drive document only with explicit provenance. */
export function resolveMonthlyReportReference({ projectId, referenceYm, databaseBody, item }) {
  const supplied = item.reference_body_md ?? item.referenceBodyMd ?? "";
  if (!String(supplied).trim()) return databaseBody || "";
  if ((item.reference_project_id ?? item.referenceProjectId) !== projectId || (item.reference_ym ?? item.referenceYm) !== referenceYm) {
    throw new Error(`monthlyReportsExternal reference must be the same project's previous month: expected ${projectId}/${referenceYm}`);
  }
  if (item.reference_source === "submitted_drive") {
    let url;
    try { url = new URL(item.reference_source_url); } catch { throw new Error("submitted_drive reference requires its Drive source URL"); }
    if (url.protocol !== "https:" || !["drive.google.com", "docs.google.com"].includes(url.hostname)) throw new Error("submitted_drive reference requires its Drive source URL");
    return supplied;
  }
  return String(databaseBody || "").trim() ? databaseBody : supplied;
}
