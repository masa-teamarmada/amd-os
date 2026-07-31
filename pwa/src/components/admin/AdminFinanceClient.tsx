"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, RefreshCw, Save } from "lucide-react";
import type { FinanceOfficerReserve } from "@/lib/finance/officer-compensation";

export type { FinanceOfficerReserve };

export interface FinanceRecurringItem {
  id: string;
  status: string;
  item_kind: string;
  display_name: string;
  vendor_name: string | null;
  category: string;
  amount_yen: number;
  currency: string;
  frequency: string;
  start_ym: string;
  end_ym: string | null;
  budget_forward_fill: boolean;
  auto_debit: boolean | null;
  withdrawal_account: string | null;
  payment_method: string | null;
  source_kind: string;
  source_ref: string | null;
  last_receipt_at: string | null;
  last_budget_synced_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface FinanceReceiptEvent {
  id: string;
  recurring_item_id: string | null;
  ym: string | null;
  receipt_date: string | null;
  vendor_name: string | null;
  amount_yen: number | null;
  payment_method: string | null;
  withdrawal_account: string | null;
  subject: string | null;
  source_kind: string;
  source_ref: string | null;
  status: string;
  actual_synced_at?: string | null;
  created_at: string;
}

interface Props {
  recurringItems: FinanceRecurringItem[];
  receiptEvents: FinanceReceiptEvent[];
  officerReserve: FinanceOfficerReserve;
}

type DraftItem = {
  display_name: string;
  vendor_name: string;
  amount_yen: number;
  frequency: string;
  start_ym: string;
  category: string;
  auto_debit: boolean | null;
  withdrawal_account: string;
  payment_method: string;
  budget_forward_fill: boolean;
  notes: string;
};

const BLANK_DRAFT: DraftItem = {
  display_name: "",
  vendor_name: "",
  amount_yen: 0,
  frequency: "monthly",
  start_ym: currentYm(),
  category: "fixed_cost",
  auto_debit: null,
  withdrawal_account: "",
  payment_method: "",
  budget_forward_fill: false,
  notes: "",
};

function currentYm() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function yen(value: number | null | undefined) {
  if (!value) return "-";
  return `¥${Number(value).toLocaleString("ja-JP")}`;
}

function ymLabel(ym: string | null | undefined) {
  if (!ym) return "-";
  return `${ym.slice(0, 4)}/${ym.slice(4)}`;
}

function boolSelectValue(value: boolean | null) {
  if (value === null) return "unknown";
  return value ? "true" : "false";
}

function parseBoolSelect(value: string): boolean | null {
  if (value === "unknown") return null;
  return value === "true";
}

function statusTone(status: string) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "paused") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-500";
}

export function AdminFinanceClient({ recurringItems, receiptEvents, officerReserve }: Props) {
  const [rows, setRows] = useState<FinanceRecurringItem[]>(recurringItems);
  const [draft, setDraft] = useState<DraftItem>(BLANK_DRAFT);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [syncingReceiptId, setSyncingReceiptId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [hint, setHint] = useState("");

  const totals = useMemo(() => {
    const active = rows.filter((row) => row.status === "active");
    const monthly = active
      .filter((row) => row.frequency === "monthly")
      .reduce((sum, row) => sum + (row.amount_yen || 0), 0);
    const autoDebit = active.filter((row) => row.auto_debit === true).length;
    const unknownDebit = active.filter((row) => row.auto_debit === null).length;
    const forwardFill = active.filter((row) => row.budget_forward_fill).length;
    return { active: active.length, monthly, autoDebit, unknownDebit, forwardFill };
  }, [rows]);

  const patchRow = (id: string, patch: Partial<FinanceRecurringItem>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const saveRow = async (row: FinanceRecurringItem, syncBudget = false) => {
    setSavingId(row.id);
    setHint("");
    const res = await fetch("/api/admin/finance/recurring", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...row, syncBudget }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setHint(`保存エラー: ${json.error ?? res.statusText}`);
    } else {
      patchRow(row.id, json.item);
      setHint(syncBudget ? `予算を${json.budgetSync?.inserted ?? 0}か月分同期した` : `${row.display_name} を保存した`);
    }
    setSavingId(null);
  };

  const syncBudget = async (row: FinanceRecurringItem) => {
    setSavingId(row.id);
    setHint("");
    const res = await fetch("/api/admin/finance/recurring", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "syncBudget", id: row.id }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setHint(`同期エラー: ${json.error ?? res.statusText}`);
    } else {
      patchRow(row.id, { last_budget_synced_at: new Date().toISOString() });
      setHint(`${row.display_name}: 予算を${json.inserted ?? 0}か月分同期した`);
    }
    setSavingId(null);
  };

  const createItem = async () => {
    if (!draft.display_name.trim() && !draft.vendor_name.trim()) {
      setHint("名前か支払先を入れてね");
      return;
    }
    setCreating(true);
    setHint("");
    const res = await fetch("/api/admin/finance/recurring", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...draft,
        source_kind: "manual",
        item_kind: "subscription",
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setHint(`追加エラー: ${json.error ?? res.statusText}`);
    } else {
      setRows((prev) => [json.item, ...prev]);
      setDraft(BLANK_DRAFT);
      setHint(`${json.item.display_name} を追加した`);
    }
    setCreating(false);
  };

  const syncReceiptActual = async (event: FinanceReceiptEvent) => {
    setSyncingReceiptId(event.id);
    setHint("");
    const res = await fetch("/api/admin/finance/receipts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "syncActual", id: event.id }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setHint(`実績同期エラー: ${json.error ?? res.statusText}`);
    } else {
      setHint(`${event.vendor_name ?? event.subject ?? "receipt"} を ${json.actual?.ym ?? ""} 実績へ同期した`);
    }
    setSyncingReceiptId(null);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11px] text-muted-foreground">Active items</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{totals.active}</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11px] text-muted-foreground">Monthly run-rate</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{yen(totals.monthly)}</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11px] text-muted-foreground">Auto debit</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{totals.autoDebit}</div>
          <div className="text-[11px] text-muted-foreground">unknown {totals.unknownDebit}</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11px] text-muted-foreground">Budget forward-fill</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{totals.forwardFill}</div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <h2 className="text-[13px] font-semibold text-amber-900">AMD運営費へ残る役員除外分</h2>
            <p className="mt-0.5 text-[11px] text-amber-900/75">
              支払月 {ymLabel(officerReserve.ym)} のadmin.payoutsで、役員ONのメンバーを支払対象から外した金額。
            </p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xl font-semibold tabular-nums text-amber-900">{yen(officerReserve.totalYen)}</div>
            <div className="text-[11px] text-amber-900/70">{officerReserve.entries.length} 明細</div>
          </div>
        </div>
        {officerReserve.entries.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-md border border-amber-200 bg-background/80">
            <table className="w-full text-[12px]">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">PJ</th>
                  <th className="px-3 py-2 text-left font-medium">稼働月</th>
                  <th className="px-3 py-2 text-left font-medium">役員</th>
                  <th className="px-3 py-2 text-right font-medium">運営費へ残る額</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {officerReserve.entries.map((entry) => (
                  <tr key={`${entry.projectId}:${entry.sourceYm}:${entry.memberId}`}>
                    <td className="px-3 py-2 font-medium">{entry.projectName}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{ymLabel(entry.sourceYm)}</td>
                    <td className="px-3 py-2">{entry.memberName}</td>
                    <td className="px-3 py-2 text-right font-semibold">{yen(entry.amountYen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold">新しい継続支払い</h2>
          {hint && <div className="text-[12px] text-muted-foreground">{hint}</div>}
        </div>
        <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_120px_100px_90px_1fr]">
          <input
            value={draft.display_name}
            onChange={(e) => setDraft((prev) => ({ ...prev, display_name: e.target.value }))}
            placeholder="表示名"
            className="rounded border border-border bg-background px-2 py-1.5 text-[12px]"
          />
          <input
            value={draft.vendor_name}
            onChange={(e) => setDraft((prev) => ({ ...prev, vendor_name: e.target.value }))}
            placeholder="支払先"
            className="rounded border border-border bg-background px-2 py-1.5 text-[12px]"
          />
          <input
            type="number"
            value={draft.amount_yen || ""}
            onChange={(e) => setDraft((prev) => ({ ...prev, amount_yen: Number(e.target.value || 0) }))}
            placeholder="月額"
            className="rounded border border-border bg-background px-2 py-1.5 text-[12px]"
          />
          <input
            value={draft.start_ym}
            onChange={(e) => setDraft((prev) => ({ ...prev, start_ym: e.target.value }))}
            placeholder="YYYYMM"
            className="rounded border border-border bg-background px-2 py-1.5 text-[12px] font-mono"
          />
          <select
            value={boolSelectValue(draft.auto_debit)}
            onChange={(e) => setDraft((prev) => ({ ...prev, auto_debit: parseBoolSelect(e.target.value) }))}
            className="rounded border border-border bg-background px-2 py-1.5 text-[12px]"
          >
            <option value="unknown">自動?</option>
            <option value="true">自動</option>
            <option value="false">手動</option>
          </select>
          <div className="flex gap-2">
            <input
              value={draft.withdrawal_account}
              onChange={(e) => setDraft((prev) => ({ ...prev, withdrawal_account: e.target.value }))}
              placeholder="引落口座"
              className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 text-[12px]"
            />
            <button
              onClick={createItem}
              disabled={creating}
              className="inline-flex items-center gap-1 rounded bg-foreground px-3 py-1.5 text-[12px] text-background disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              追加
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-left font-medium">Amount</th>
              <th className="px-3 py-2 text-left font-medium">Period</th>
              <th className="px-3 py-2 text-left font-medium">Auto debit</th>
              <th className="px-3 py-2 text-left font-medium">Budget</th>
              <th className="px-3 py-2 text-left font-medium">Source</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="align-top hover:bg-muted/20">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] ${statusTone(row.status)}`}>
                      {row.status}
                    </span>
                    <input
                      value={row.display_name}
                      onChange={(e) => patchRow(row.id, { display_name: e.target.value })}
                      className="min-w-40 rounded border border-transparent bg-transparent px-1 py-0.5 font-medium hover:border-border focus:border-border"
                    />
                  </div>
                  <input
                    value={row.vendor_name ?? ""}
                    onChange={(e) => patchRow(row.id, { vendor_name: e.target.value })}
                    placeholder="支払先未設定"
                    className="mt-1 w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-muted-foreground hover:border-border focus:border-border"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={row.amount_yen || ""}
                    onChange={(e) => patchRow(row.id, { amount_yen: Number(e.target.value || 0) })}
                    className="w-28 rounded border border-border bg-background px-2 py-1 text-right font-mono"
                  />
                  <select
                    value={row.category}
                    onChange={(e) => patchRow(row.id, { category: e.target.value })}
                    className="mt-1 w-28 rounded border border-border bg-background px-2 py-1 text-[11px]"
                  >
                    <option value="fixed_cost">fixed_cost</option>
                    <option value="subscription">subscription</option>
                    <option value="tax_payment">tax_payment</option>
                    <option value="loan_payment">loan_payment</option>
                    <option value="other">other</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <input
                      value={row.start_ym}
                      onChange={(e) => patchRow(row.id, { start_ym: e.target.value })}
                      className="w-20 rounded border border-border bg-background px-2 py-1 font-mono"
                    />
                    <span className="text-muted-foreground">to</span>
                    <input
                      value={row.end_ym ?? ""}
                      onChange={(e) => patchRow(row.id, { end_ym: e.target.value || null })}
                      placeholder="-"
                      className="w-20 rounded border border-border bg-background px-2 py-1 font-mono"
                    />
                  </div>
                  <select
                    value={row.frequency}
                    onChange={(e) => patchRow(row.id, { frequency: e.target.value })}
                    className="mt-1 w-24 rounded border border-border bg-background px-2 py-1 text-[11px]"
                  >
                    <option value="monthly">monthly</option>
                    <option value="annual">annual</option>
                    <option value="one_time">one_time</option>
                    <option value="unknown">unknown</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={boolSelectValue(row.auto_debit)}
                    onChange={(e) => patchRow(row.id, { auto_debit: parseBoolSelect(e.target.value) })}
                    className="w-24 rounded border border-border bg-background px-2 py-1"
                  >
                    <option value="unknown">未確認</option>
                    <option value="true">自動</option>
                    <option value="false">手動</option>
                  </select>
                  <input
                    value={row.withdrawal_account ?? ""}
                    onChange={(e) => patchRow(row.id, { withdrawal_account: e.target.value })}
                    placeholder="引落口座"
                    className="mt-1 w-36 rounded border border-border bg-background px-2 py-1"
                  />
                </td>
                <td className="px-3 py-2">
                  <label className="flex items-center gap-2 text-[11px]">
                    <input
                      type="checkbox"
                      checked={row.budget_forward_fill}
                      onChange={(e) => patchRow(row.id, { budget_forward_fill: e.target.checked })}
                    />
                    forward fill
                  </label>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    synced {row.last_budget_synced_at ? row.last_budget_synced_at.slice(0, 10) : "-"}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="font-mono text-[11px]">{row.source_kind}</div>
                  <div className="mt-1 max-w-44 truncate text-[11px] text-muted-foreground">{row.source_ref ?? "-"}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => saveRow(row)}
                      disabled={savingId === row.id}
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted/40 disabled:opacity-60"
                    >
                      {savingId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      保存
                    </button>
                    <button
                      onClick={() => syncBudget(row)}
                      disabled={savingId === row.id}
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted/40 disabled:opacity-60"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      同期
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="mb-2 flex items-baseline gap-3">
          <h2 className="text-[13px] font-semibold">Receipt events</h2>
          <span className="text-[12px] text-muted-foreground">latest {receiptEvents.length}</span>
        </div>
        {receiptEvents.length === 0 ? (
          <div className="py-5 text-center text-[12px] text-muted-foreground">
            Gmail/freee/manualの領収書イベントはまだない
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium">YM</th>
                  <th className="px-3 py-2 text-left font-medium">Vendor</th>
                  <th className="px-3 py-2 text-left font-medium">Amount</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {receiptEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="px-3 py-2 font-mono">{ymLabel(event.ym)}</td>
                    <td className="px-3 py-2">
                      <div>{event.vendor_name ?? "-"}</div>
                      <div className="max-w-xl truncate text-[11px] text-muted-foreground">{event.subject ?? "-"}</div>
                    </td>
                    <td className="px-3 py-2 font-mono">{yen(event.amount_yen)}</td>
                    <td className="px-3 py-2">{event.status}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{event.source_kind}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => syncReceiptActual(event)}
                        disabled={syncingReceiptId === event.id}
                        className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted/40 disabled:opacity-60"
                      >
                        {syncingReceiptId === event.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        実績同期
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
