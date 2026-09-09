/**
 * コックピット「Slack」タブのクライアント側アクセス層。
 *
 * 取り込みは毎朝1回なので、開くたびに読み直す必要がない参照系。
 * 画面は必ずこのファイル経由で読む
 * (guard: scripts/check_reference_data_cache_contract.mjs)。
 */
"use client";

import {
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
} from "@/lib/reference-data-cache";
import type { SlackMessagesResult } from "@/lib/slack/slack-messages-types";

const ENDPOINT = "/api/slack/messages";

function keyOf(projectId: string, ym?: string) {
  return `slack-messages:${projectId}:${ym || "latest"}`;
}

async function request(projectId: string, ym?: string): Promise<SlackMessagesResult> {
  const params = new URLSearchParams({ projectId });
  if (ym) params.set("ym", ym);
  const response = await fetch(`${ENDPOINT}?${params.toString()}`);
  const payload = (await response.json()) as { ok: boolean; data?: SlackMessagesResult; error?: string };
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error ?? "Slackの会話の読み込みに失敗した");
  }
  return payload.data;
}

export function loadSlackMessages(
  projectId: string,
  ym?: string,
  options?: { force?: boolean },
): Promise<SlackMessagesResult> {
  return loadReferenceData(keyOf(projectId, ym), () => request(projectId, ym), options);
}

/** キャッシュ済みなら同期で返す。タブを開き直したときに骨組みから描き直さないため。 */
export function peekSlackMessages(projectId: string, ym?: string): SlackMessagesResult | undefined {
  return peekReferenceData<SlackMessagesResult>(keyOf(projectId, ym));
}

/** タブのhoverから先読みする。 */
export function prefetchSlackMessages(projectId: string, ym?: string): void {
  prefetchReferenceData(keyOf(projectId, ym), () => request(projectId, ym));
}
