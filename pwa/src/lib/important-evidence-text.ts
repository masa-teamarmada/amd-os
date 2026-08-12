const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>「」『』]+/gi;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?<!\d)(?:\+?81[- ]?)?0\d{1,4}[-ー]\d{1,4}[-ー]\d{3,4}(?!\d)/g;
const SECRET_RE = /(?:password|passcode|secret|token|api[_ -]?key|client[_ -]?secret|パスワード|パスコード|暗証番号|秘密鍵|APIキー)\s*[:=：]?\s*[^\s,、。;；]{2,}/gi;
const TOKEN_VALUE_RE = /\b(?:xox[baprs]-[A-Za-z0-9-]+|sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{8,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{8,})\b/g;

/**
 * 重要情報の候補・正本・通知へ残す短文専用の非LLM sanitizer。
 * 原文hashは別fieldで保持し、表示用短文にはURL・連絡先・認証情報を残さない。
 */
export function sanitizeImportantEvidenceText(value: unknown, max = 500): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(URL_RE, "[URL省略]")
    .replace(EMAIL_RE, "[メール省略]")
    .replace(PHONE_RE, "[電話番号省略]")
    .replace(SECRET_RE, "[認証情報省略]")
    .replace(TOKEN_VALUE_RE, "[認証情報省略]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Math.max(0, max));
}
