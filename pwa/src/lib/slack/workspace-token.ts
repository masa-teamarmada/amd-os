/**
 * Slackワークスペースごとのボットトークン解決。
 *
 * AMD OS は長らく team ARMADA の1ワークスペースだけを読んでいたので
 * `SLACK_BOT_TOKEN` 1本で足りていた。SXのように別ワークスペース
 * (SolvioraX) からも会話を吸い上げるPJが出たため、workspace_key で
 * 環境変数を切り替える。
 *
 * 既定 (armada) は従来の `SLACK_BOT_TOKEN` をそのまま使うので、
 * 既存PJの挙動は変わらない。
 */

export const DEFAULT_SLACK_WORKSPACE_KEY = "armada";

export function normalizeWorkspaceKey(key?: string | null): string {
  const value = String(key || "").trim().toLowerCase();
  return value || DEFAULT_SLACK_WORKSPACE_KEY;
}

/** workspace_key に対応する環境変数名。armada だけ従来名を使う。 */
export function slackEnvNameForWorkspace(key?: string | null): string {
  const normalized = normalizeWorkspaceKey(key);
  if (normalized === DEFAULT_SLACK_WORKSPACE_KEY) return "SLACK_BOT_TOKEN";
  const suffix = normalized.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return `SLACK_BOT_TOKEN_${suffix}`;
}

/** 未設定なら空文字。呼び出し側でそのチャンネルだけskipする。 */
export function slackTokenForWorkspace(key?: string | null): string {
  return process.env[slackEnvNameForWorkspace(key)] || "";
}
