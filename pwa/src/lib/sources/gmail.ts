/**
 * Gmail 生データ抽出。
 * env: 共通 google.ts (OAuth refresh token 推奨。Service Account は domain-wide delegation 必須)
 *
 * Gmail API:
 *   - users.messages.list で query 検索 (Gmail 検索構文)
 *   - users.messages.get で本文取得 (Subject + Snippet + 一部本文)
 */

import { google } from "googleapis";
import { getGoogleAuthAsync } from "./google";

export interface GmailHit {
  id: string;
  threadId: string;
  from: string | null;
  subject: string | null;
  date: string | null;
  snippet: string;
  body: string;          // 簡易テキスト化した本文 (最初の数千文字)
}

const MAX_BODY = 2000;

export async function fetchGmailContext(query: string, limit = 15): Promise<GmailHit[]> {
  const auth = await getGoogleAuthAsync();
  if (!auth) {
    console.warn("[gmail] no Google auth — skipping");
    return [];
  }
  const gmail = google.gmail({ version: "v1", auth });
  try {
    const list = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: Math.min(limit, 100),
    });
    const out: GmailHit[] = [];
    for (const m of list.data.messages ?? []) {
      try {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: m.id ?? "",
          format: "full",
        });
        const headers = msg.data.payload?.headers ?? [];
        const getH = (n: string) => headers.find((h) => (h.name ?? "").toLowerCase() === n.toLowerCase())?.value ?? null;
        const body = extractBody(msg.data.payload);
        out.push({
          id: msg.data.id ?? "",
          threadId: msg.data.threadId ?? "",
          from: getH("From"),
          subject: getH("Subject"),
          date: getH("Date"),
          snippet: msg.data.snippet ?? "",
          body: body.slice(0, MAX_BODY),
        });
      } catch (e) {
        console.warn(`[gmail] message ${m.id} get failed:`, e);
      }
    }
    return out;
  } catch (e) {
    console.error("[gmail] list failed:", e);
    return [];
  }
}

function extractBody(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as { body?: { data?: string }; mimeType?: string; parts?: unknown[] };
  if (p.body?.data && (p.mimeType ?? "").startsWith("text/")) {
    try {
      return Buffer.from(p.body.data, "base64").toString("utf-8");
    } catch {
      return "";
    }
  }
  for (const part of p.parts ?? []) {
    const t = extractBody(part);
    if (t) return t;
  }
  return "";
}
