/**
 * Anthropic クライアント共通ファクトリ — 従量課金の一元管理ゲート
 *
 * まさ確定 2026-07-01: 「定額トークンが余ってるのに Anthropic API 従量課金を使う意味がない。
 * 背景抽出は Codex automation (定額枠) に一本化し、PWA/Vercel からの API 直叩きは封鎖する」。
 *
 * 正本ルール (pwa/design/L2_DATA.md):
 * - PWA/Vercel LLM cron = 従量課金 LLM を背景実行する cron。L2 抽出用途では禁止/停止。
 * - 背景抽出の唯一経路は Codex automation (~/.codex/automations)。
 *
 * ここに全 `new Anthropic()` を寄せることで、1 つの env で全 API 直叩きを封鎖できる。
 * バラバラに書かれた `new Anthropic({apiKey})` を各所に残すと、うっかり課金経路が復活する。
 *
 * ── 2 種類のクライアント ──
 * - getBackgroundAnthropic(): cron / routine / 背景 lib 用。
 *     ALLOW_PWA_LLM_CRONS !== "1" のとき throw する (= デフォルト封鎖)。
 *     背景抽出は Codex automation に移植済み/移植すべきなので、ここで API を叩かせない。
 * - getInteractiveAnthropic(): まさが能動操作する対話 UI 用 (tsukuyomi chat / 月報 narrate /
 *     PL hearing / report 生成 等)。まさのアクション起点なので許可する。
 *     こちらは業務に必要なので封鎖しない。
 *
 * どちらも ANTHROPIC_API_KEY 未設定なら throw する。
 */

import Anthropic from "@anthropic-ai/sdk";

/** 背景 LLM (cron/routine/背景 lib) が Anthropic API 直叩きを許可されているか。 */
export function isBackgroundAnthropicAllowed(): boolean {
  return process.env.ALLOW_PWA_LLM_CRONS === "1";
}

/** 封鎖時に投げるエラー。呼び出し側は catch して「skip / disabled」応答に落とす。 */
export class BackgroundAnthropicDisabledError extends Error {
  readonly disabled = true;
  constructor(caller?: string) {
    super(
      `[anthropic-client] 背景 Anthropic API 直叩きは封鎖されています` +
        (caller ? ` (caller: ${caller})` : "") +
        `。背景抽出は Codex automation (定額枠) に一本化する方針です。` +
        `どうしても PWA 側で従量課金を使う場合のみ ALLOW_PWA_LLM_CRONS=1 を明示してください。`
    );
    this.name = "BackgroundAnthropicDisabledError";
  }
}

/**
 * 背景抽出 (cron / routine / 背景 lib) 用の Anthropic クライアント。
 * ALLOW_PWA_LLM_CRONS=1 が明示されていなければ throw する (= デフォルト封鎖)。
 *
 * @param caller ログ/エラー用の呼び出し元識別子 (例: "cron/vc-discover")
 */
export function getBackgroundAnthropic(caller?: string): Anthropic {
  if (!isBackgroundAnthropicAllowed()) {
    throw new BackgroundAnthropicDisabledError(caller);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(`[anthropic-client] ANTHROPIC_API_KEY 未設定 (caller: ${caller ?? "?"})`);
  }
  return new Anthropic({ apiKey });
}

/**
 * まさが能動操作する対話 UI 用の Anthropic クライアント。封鎖しない。
 * ANTHROPIC_API_KEY が無ければ throw する。
 */
export function getInteractiveAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("[anthropic-client] ANTHROPIC_API_KEY 未設定 (interactive)");
  }
  return new Anthropic({ apiKey });
}
