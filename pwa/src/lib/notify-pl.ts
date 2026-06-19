/** 予算例外 / 月次報告確認の依頼を PL に Slack DM で送る。
 *  失敗してもユーザーアクションは止めない (silent log)。 */
export async function notifyPlReview(args: {
  projectId: string;
  ym: string;
  taskKind: "budget" | "reportFix";
  taskLabel: string;
}): Promise<{ ok: boolean; sent: number; message?: string }> {
  try {
    const res = await fetch("/api/notify/pl-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, sent: 0, message: err };
    }
    const json = await res.json();
    return { ok: true, sent: json.sent || 0, message: json.message };
  } catch (e) {
    return { ok: false, sent: 0, message: e instanceof Error ? e.message : String(e) };
  }
}
