"use client";

import { useEffect, useMemo, useState } from "react";

type ConfirmMeta =
  | {
      ok: true;
      projectName: string;
      invoiceYm: string;
      sourceYms: string[];
      expectedAmountYen: number;
      expectedNetAmountYen: number;
    }
  | { ok: false; error: string };

function fmtYen(value: number): string {
  return `¥${Math.round(value).toLocaleString()}`;
}

function ymLabel(ym: string): string {
  if (!/^\d{6}$/.test(ym)) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

export function PaymentConfirmClient({ token }: { token: string }) {
  const [meta, setMeta] = useState<ConfirmMeta | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/payment-confirm?token=${encodeURIComponent(token)}`);
        const data = (await res.json()) as ConfirmMeta;
        if (cancelled) return;
        setMeta(data);
        if (data.ok) setAmount(String(data.expectedAmountYen));
      } catch (e) {
        if (!cancelled) setMeta({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const amountNumber = useMemo(() => Number(amount.replace(/[^\d]/g, "")), [amount]);

  async function submit() {
    setSaving(true);
    setError(null);
    setDone(null);
    try {
      if (!Number.isFinite(amountNumber) || amountNumber <= 0) throw new Error("入金額を入れてね");
      const res = await fetch("/api/admin/payment-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, amountYen: amountNumber, note: note.trim() || null }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; updated?: number };
      if (!data.ok) throw new Error(data.error || "更新に失敗した");
      setDone(`${data.updated ?? 0} cycleを入金確認済みにしたよ`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return <Message title="リンクが足りない" body="Slackのボタンからもう一度開いてね。" tone="error" />;
  }
  if (!meta) {
    return <Message title="確認中" body="入金確認リンクを確認してる..." tone="muted" />;
  }
  if (!meta.ok) {
    return <Message title="リンクを確認できなかった" body={meta.error} tone="error" />;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f5f7] px-4 py-10 text-[#1d1d1f]">
      <section className="w-full max-w-lg rounded-xl border border-[#d2d2d7] bg-white p-6 shadow-[0_16px_50px_rgba(0,0,0,0.08)]">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-emerald-700">AMD OS 入金確認</p>
          <h1 className="text-xl font-semibold">{meta.projectName}</h1>
          <p className="text-sm text-[#6e6e73]">
            支払月 {ymLabel(meta.invoiceYm)} / 対象 {meta.sourceYms.map(ymLabel).join(", ")}
          </p>
        </div>

        <div className="mt-5 rounded-lg border border-[#e5e5e7] bg-[#fafafa] p-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-[#6e6e73]">予定入金額</span>
            <span className="font-semibold">{fmtYen(meta.expectedAmountYen)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-4 text-xs text-[#86868b]">
            <span>税抜ベース</span>
            <span>{fmtYen(meta.expectedNetAmountYen)}</span>
          </div>
        </div>

        <label className="mt-5 block space-y-1 text-sm">
          <span className="font-medium">実際の入金額</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="numeric"
            className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-right text-lg font-semibold outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </label>

        <label className="mt-4 block space-y-1 text-sm">
          <span className="font-medium">メモ</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/30"
            placeholder="差額理由など"
          />
        </label>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {done && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{done}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={saving || !!done}
          className="mt-5 w-full rounded-lg bg-[#1d1d1f] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "反映中..." : "この金額で入金確認する"}
        </button>
      </section>
    </main>
  );
}

function Message({ title, body, tone }: { title: string; body: string; tone: "muted" | "error" }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f5f7] px-4 text-[#1d1d1f]">
      <section className="w-full max-w-md rounded-xl border border-[#d2d2d7] bg-white p-6 shadow-[0_16px_50px_rgba(0,0,0,0.08)]">
        <h1 className={`text-xl font-semibold ${tone === "error" ? "text-red-700" : ""}`}>{title}</h1>
        <p className="mt-2 text-sm text-[#6e6e73]">{body}</p>
      </section>
    </main>
  );
}
