/** Archiving and disclosure are independent opt-ins. Missing provenance is private. */
export type SlackArchiveTarget = { workspace_key: string; channel_id: string; archive_enabled: boolean; workspace_shared: boolean };
export function matchesSlackArchiveTarget(row: {item_id: string; metadata_json: Record<string, unknown> | null}, targets: SlackArchiveTarget[], sharedOnly: boolean): boolean {
  const meta = row.metadata_json ?? {};
  const channel = String(meta.channel_id || row.item_id.split(":")[0] || "");
  let host = "";
  try { const url = new URL(String(meta.permalink || meta.source_url || "")); if (url.protocol !== "https:") return false; host = url.hostname; } catch { return false; }
  return targets.some(t => t.archive_enabled && (!sharedOnly || t.workspace_shared) && !["armada", "teamarmadahq"].includes(t.workspace_key) && t.channel_id === channel && host === `${t.workspace_key}.slack.com`);
}
