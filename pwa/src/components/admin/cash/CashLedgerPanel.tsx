"use client";

/**
 * 「00 出入りと残高」。きよのスプレッドシート「収支」を置き換える1枚の表。
 *
 * 口座でタブを分けない。すべての口座の取引を日付順に1つの表へ並べ、
 * 右へ各口座の残高と各借入の残高を横に並べる (まさ 2026-09-04「ひとつのシートで
 * すべての口座の残高と取引記録が見れるようにして。横スクロールを許容すればいける」)。
 *
 * 操作もスプレッドシートに合わせる。
 *   - セルを押すとその場で書き換わる。「直す」ボタンは置かない
 *   - 表の一番下に常に空の行があり、そこへ書けば足りる。「行を足す」ボタンは置かない
 *   - 行と行のあいだにマウスを乗せると左端に「＋」が出て、途中へ差し込める
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { CashAccountView, CashAndLoansResult, CashLedgerEntry } from "@/lib/finance/cash-and-loans-types";
import { longDate, shortDate, todayIso, yen } from "./format";

/** 末尾に常に置いておく空行の数。 */
const TRAILING_BLANKS = 5;

/**
 * 見出し行を上に貼り付けておくための指定。
 * `position: sticky` は `<thead>` には効かないブラウザがあるので、各 `<th>` に付ける。
 * 下線も border ではなく box-shadow で引く (sticky なセルの border は一緒に動かない)。
 */
const STICKY_HEAD = "sticky top-0 z-20 bg-muted shadow-[inset_0_-1px_0_hsl(var(--border))]";

type EditableField =
  | "entryDate" | "accountId" | "counterparty" | "withdrawal" | "deposit"
  | "category" | "targetMonth" | "note";

/** 保存前の行。DB にはまだ無い。 */
type DraftRow = {
  draftId: string;
  /** この行の直前に差し込む。null なら末尾の空行。 */
  anchorId: string | null;
  entryDate: string;
  accountId: string;
  counterparty: string;
  withdrawal: string;
  deposit: string;
  category: string;
  targetMonth: string;
  note: string;
};

/** 表に出す1行。取り込んだ行と、保存前の行の両方を同じ形で扱う。 */
type Row = {
  key: string;
  id: string | null;
  draft: DraftRow | null;
  accountId: string;
  entryDate: string;
  counterparty: string | null;
  transferName: string | null;
  withdrawal: number;
  deposit: number;
  sheetBalance: number | null;
  runningBalance: number | null;
  balanceGapStep: number | null;
  category: string | null;
  targetMonth: string | null;
  note: string | null;
  isPlanned: boolean;
  source: string;
  /** その行の時点での、各口座と各借入の残高。 */
  accountBalances: Record<string, number | null>;
  loanBalances: Record<string, number | null>;
};

function newDraftId(): string {
  return `draft-${Math.random().toString(36).slice(2, 10)}`;
}

function blankDraft(anchorId: string | null, entryDate: string, accountId: string): DraftRow {
  return {
    draftId: newDraftId(), anchorId, entryDate, accountId,
    counterparty: "", withdrawal: "", deposit: "",
    category: "", targetMonth: "", note: "",
  };
}

function draftIsEmpty(d: DraftRow): boolean {
  return !d.counterparty && !d.withdrawal && !d.deposit && !d.note && !d.category && !d.targetMonth;
}

function numText(value: number | null | undefined): string {
  if (value == null || value === 0) return "";
  return value.toLocaleString("ja-JP");
}

/**
 * 表の1マス。押すとその場で入力になる。
 *
 * **必ずコンポーネントの外に置く。** 中で定義すると、画面を描き直すたびに別物として
 * 作り直され、入力中の欄が消えて打った内容が失われる。
 */
function Cell({
  row, field, value, align = "left", className, width,
  editing, accounts, onStartEdit, onCancelEdit, onCommit,
}: {
  row: Row; field: EditableField; value: string; align?: "left" | "right";
  className?: string; width?: string;
  editing: { key: string; field: EditableField } | null;
  accounts: CashAccountView[];
  onStartEdit: (key: string, field: EditableField) => void;
  onCancelEdit: () => void;
  onCommit: (row: Row, field: EditableField, raw: string) => void;
}) {
  const isEditing = editing?.key === row.key && editing.field === field;
  if (isEditing) {
    if (field === "accountId") {
      return (
        <td className={cn("p-0", width)}>
          <select
            autoFocus
            defaultValue={row.accountId}
            onBlur={(e) => onCommit(row, field, e.target.value)}
            onChange={(e) => onCommit(row, field, e.target.value)}
            className="h-6 w-full rounded-none border border-foreground bg-background px-1 text-xs text-foreground focus:outline-none"
          >
            {accounts.map((a) => <option key={a.accountId} value={a.accountId}>{a.shortName}</option>)}
          </select>
        </td>
      );
    }
    return (
      <td className={cn("p-0", width)}>
        <input
          autoFocus
          type={field === "entryDate" ? "date" : "text"}
          defaultValue={field === "entryDate" ? row.entryDate : value}
          inputMode={field === "withdrawal" || field === "deposit" ? "numeric" : undefined}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => onCommit(row, field, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") onCancelEdit();
          }}
          className={cn(
            "h-6 w-full rounded-none border border-foreground bg-background px-1 text-xs text-foreground focus:outline-none",
            align === "right" && "text-right font-mono tabular-nums",
          )}
        />
      </td>
    );
  }
  return (
    <td
      onClick={() => onStartEdit(row.key, field)}
      title={value || undefined}
      className={cn(
        "max-w-0 cursor-text truncate whitespace-nowrap px-1.5 py-1 text-xs",
        align === "right" ? "text-right font-mono tabular-nums" : "text-left",
        className,
      )}
    >
      {value || <span className="text-transparent">-</span>}
    </td>
  );
}

export function CashLedgerPanel({
  data,
  loading,
  onChanged,
}: {
  data: CashAndLoansResult | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const loans = useMemo(() => data?.loans ?? [], [data]);
  const today = data?.today ?? todayIso();

  const [year, setYear] = useState<string>("");
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [editing, setEditing] = useState<{ key: string; field: EditableField } | null>(null);
  /** 保存が届くまでのあいだ、画面に先に反映しておく値。 */
  const [overrides, setOverrides] = useState<Record<string, Partial<CashLedgerEntry>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const savingRef = useRef(false);

  // ── 全口座の行を1本にまとめ、その時点の残高を横に持たせる ──
  const allRows = useMemo(() => {
    const merged: (CashLedgerEntry & { accountId: string })[] = [];
    for (const account of accounts) {
      for (const entry of account.entries) {
        const patch = overrides[entry.id];
        merged.push({ ...entry, ...(patch ?? {}), accountId: patch?.accountId ?? account.accountId });
      }
    }
    const orderOf = new Map(accounts.map((a, i) => [a.accountId, i]));
    merged.sort((a, b) => {
      if (a.entryDate !== b.entryDate) return a.entryDate < b.entryDate ? -1 : 1;
      const ao = orderOf.get(a.accountId) ?? 99;
      const bo = orderOf.get(b.accountId) ?? 99;
      return ao === bo ? a.seq - b.seq : ao - bo;
    });

    // 借入の残高は、日付順に借入と返済をたどって持ち越す。
    const loanEvents = loans
      .flatMap((l) => l.events.map((e) => ({ loanId: l.loanId, date: e.eventDate, balance: e.balanceAfter })))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let loanCursor = 0;
    const loanNow: Record<string, number | null> = Object.fromEntries(loans.map((l) => [l.loanId, null]));
    const accountNow: Record<string, number | null> = Object.fromEntries(accounts.map((a) => [a.accountId, null]));

    const out: Row[] = [];
    for (const e of merged) {
      while (loanCursor < loanEvents.length && loanEvents[loanCursor].date <= e.entryDate) {
        loanNow[loanEvents[loanCursor].loanId] = loanEvents[loanCursor].balance;
        loanCursor += 1;
      }
      // 残高はサーバが期首から積み上げ直した値 (runningBalance) を使う。
      // 取り込んだときの値 (sheetBalance) を出すと、金額を直しても残高が変わらない。
      accountNow[e.accountId] = e.runningBalance;
      out.push({
        key: e.id, id: e.id, draft: null,
        accountId: e.accountId, entryDate: e.entryDate,
        counterparty: e.counterparty, transferName: e.transferName,
        withdrawal: e.withdrawal, deposit: e.deposit,
        sheetBalance: e.sheetBalance, runningBalance: e.runningBalance, balanceGapStep: e.balanceGapStep,
        category: e.category, targetMonth: e.targetMonth, note: e.note, isPlanned: e.isPlanned,
        source: e.source,
        accountBalances: { ...accountNow }, loanBalances: { ...loanNow },
      });
    }
    return out;
  }, [accounts, loans, overrides]);

  const years = useMemo(() => {
    const set = new Set(allRows.map((r) => r.entryDate.slice(0, 4)));
    return [...set].sort();
  }, [allRows]);

  // 既定は今年。今年の行が無ければいちばん新しい年。
  const activeYear = useMemo(() => {
    if (year) return year;
    const current = today.slice(0, 4);
    return years.includes(current) ? current : years[years.length - 1] ?? "";
  }, [year, years, today]);

  const visibleRows = useMemo(
    () => (activeYear === "all" ? allRows : allRows.filter((r) => r.entryDate.slice(0, 4) === activeYear)),
    [allRows, activeYear],
  );

  // ── 末尾の空行を切らさない ──
  useEffect(() => {
    const trailing = drafts.filter((d) => d.anchorId === null);
    const empty = trailing.filter(draftIsEmpty).length;
    if (empty < TRAILING_BLANKS) {
      // 新しく書くのはたいてい今日以降のこと。保存すると日付の位置へ動く。
      const accountId = accounts[0]?.accountId ?? "";
      if (!accountId) return;
      setDrafts((prev) => [
        ...prev,
        ...Array.from({ length: TRAILING_BLANKS - empty }, () => blankDraft(null, today, accountId)),
      ]);
    }
  }, [drafts, today, accounts]);

  // ── 表示する行の並び (差し込みの空行を混ぜる) ──
  const displayRows = useMemo(() => {
    const inserted = new Map<string, DraftRow[]>();
    const trailing: DraftRow[] = [];
    for (const d of drafts) {
      if (d.anchorId === null) trailing.push(d);
      else inserted.set(d.anchorId, [...(inserted.get(d.anchorId) ?? []), d]);
    }
    const out: Row[] = [];
    const toRow = (d: DraftRow): Row => ({
      key: d.draftId, id: null, draft: d,
      accountId: d.accountId, entryDate: d.entryDate,
      counterparty: d.counterparty || null, transferName: null,
      withdrawal: Number(d.withdrawal.replace(/[^\d]/g, "")) || 0,
      deposit: Number(d.deposit.replace(/[^\d]/g, "")) || 0,
      sheetBalance: null,
      runningBalance: null, balanceGapStep: null,
      category: d.category || null, targetMonth: d.targetMonth || null, note: d.note || null,
      isPlanned: d.entryDate > today,
      source: "manual",
      accountBalances: {}, loanBalances: {},
    });
    for (const r of visibleRows) {
      for (const d of inserted.get(r.key) ?? []) out.push(toRow(d));
      out.push(r);
    }
    for (const d of trailing) out.push(toRow(d));
    return out;
  }, [visibleRows, drafts, today]);

  // ── 保存 ──
  const saveEntry = useCallback(
    async (payload: Record<string, unknown>, rowId: string | null) => {
      if (savingRef.current) return false;
      savingRef.current = true;
      setMessage(null);
      try {
        const res = await fetch("/api/admin/cash-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, id: rowId ?? undefined }),
        });
        const body = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !body.ok) throw new Error(body.error ?? "保存に失敗した");
        return true;
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : "保存に失敗した");
        return false;
      } finally {
        savingRef.current = false;
      }
    },
    [],
  );

  const commitCell = useCallback(
    async (row: Row, field: EditableField, raw: string) => {
      setEditing(null);
      // 日付を空や読めない形で確定させない。ここを通すと、行そのものが保存できなくなる。
      if (field === "entryDate" && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return;
      if (row.draft) {
        // 保存前の行。まず手元で書き換え、中身が入ったら保存する。
        const next: DraftRow = { ...row.draft, [field]: raw };
        const filled = !draftIsEmpty(next);
        setDrafts((prev) => prev.map((d) => (d.draftId === next.draftId ? next : d)));
        if (!filled) return;
        const ok = await saveEntry(
          {
            accountId: next.accountId, entryDate: next.entryDate, counterparty: next.counterparty,
            withdrawal: next.withdrawal, deposit: next.deposit,
            balance: null,
            category: next.category, targetMonth: next.targetMonth, note: next.note,
          },
          null,
        );
        if (ok) {
          setDrafts((prev) => prev.filter((d) => d.draftId !== next.draftId));
          onChanged();
        }
        return;
      }

      if (!row.id) return;
      const patch: Partial<CashLedgerEntry> = {};
      const payload: Record<string, unknown> = {
        accountId: row.accountId, entryDate: row.entryDate,
        counterparty: row.counterparty ?? "", withdrawal: row.withdrawal, deposit: row.deposit,
        balance: row.sheetBalance, category: row.category ?? "",
        targetMonth: row.targetMonth ?? "", note: row.note ?? "",
      };
      if (field === "withdrawal" || field === "deposit") {
        const n = Number(raw.replace(/[^\d]/g, "")) || 0;
        payload[field] = n;
        patch[field] = n;
      } else if (field === "accountId") {
        payload.accountId = raw;
        patch.accountId = raw;
      } else if (field === "entryDate") {
        payload.entryDate = raw;
        patch.entryDate = raw;
      } else {
        payload[field] = raw;
        patch[field] = raw as never;
      }
      setOverrides((prev) => ({ ...prev, [row.id as string]: { ...(prev[row.id as string] ?? {}), ...patch } }));
      const ok = await saveEntry(payload, row.id);
      if (ok) onChanged();
    },
    [saveEntry, onChanged],
  );

  const removeRow = useCallback(
    async (row: Row) => {
      if (row.draft) {
        setDrafts((prev) => prev.filter((d) => d.draftId !== row.draft?.draftId));
        return;
      }
      if (!row.id) return;
      const res = await fetch(`/api/admin/cash-entries?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setMessage(body.error ?? "削除に失敗した");
        return;
      }
      onChanged();
    },
    [onChanged],
  );

  // ── セル ──

  const loanColumns = loans;

  // Cell へ毎回渡すもの。Cell 自体はコンポーネントの外にあるので、状態はここから渡す。
  const cellProps = {
    editing,
    accounts,
    onStartEdit: (key: string, field: EditableField) => setEditing({ key, field }),
    onCancelEdit: () => setEditing(null),
    onCommit: (row: Row, field: EditableField, raw: string) => void commitCell(row, field, raw),
  };

  return (
    <div className="space-y-2">
      {/* ── 上段: 口座と借入のいま ── */}
      <section className="overflow-x-auto border border-border">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] text-muted-foreground">
              <th scope="col" className="px-2 py-1 text-left font-medium">口座・借入</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">いまの残高</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">いつ時点</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">先の見通し</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">気をつける日</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">記録</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && loading ? (
              <tr><td colSpan={6} className="px-2 py-6 text-center text-xs text-muted-foreground">読み込み中…</td></tr>
            ) : null}
            {accounts.map((a) => (
              <tr key={a.accountId} className="border-b border-border">
                <th scope="row" className="px-2 py-1.5 text-left">
                  <span className="text-xs font-semibold text-foreground">{a.shortName}</span>
                  <span className="ml-1 text-[11px] text-muted-foreground">{a.institution}</span>
                </th>
                <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-foreground">
                  {a.actualBalance == null ? "—" : yen(a.actualBalance)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {a.actualAsOf ? longDate(a.actualAsOf) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {a.plannedBalance == null ? "—" : yen(a.plannedBalance)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                  {a.lowestPlanned ? (
                    <span className={a.lowestPlanned.balance < 0 ? "font-semibold text-destructive" : "text-foreground"}>
                      {yen(a.lowestPlanned.balance)}
                      <span className="ml-1 text-[11px] text-muted-foreground">{shortDate(a.lowestPlanned.date)}</span>
                    </span>
                  ) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {a.entryCount}件
                  {a.gapCount > 0 ? <span className="ml-1 text-amber-600 dark:text-amber-500">要確認{a.gapCount}</span> : null}
                </td>
              </tr>
            ))}
            {loans.map((l) => (
              <tr key={l.loanId} className="border-b border-border last:border-b-0 bg-muted/20">
                <th scope="row" className="px-2 py-1.5 text-left">
                  <span className="text-xs font-semibold text-foreground">借入 {l.shortName}</span>
                  <span className="ml-1 text-[11px] text-muted-foreground">{l.lender}・年利{(l.annualRate * 100).toFixed(1)}%</span>
                </th>
                <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-foreground">
                  {l.outstanding > 0 ? yen(l.outstanding) : "0円"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{longDate(today)}</td>
                <td className="px-2 py-1.5 text-right text-xs text-muted-foreground">
                  {l.finalDueOn ? `${longDate(l.finalDueOn)}に返し終わる` : "返す予定はまだ無い"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-foreground">
                  {l.nextDue ? (
                    <>
                      {shortDate(l.nextDue.date)}
                      <span className="ml-1">{yen(l.nextDue.amount)}</span>
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">の返済</span>
                    </>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {l.events.length}件
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        セルを押すとその場で書き換わる。一番下の空いている行に書けば新しい記録が増える。
        途中に足したいときは、行と行のあいだの左端にマウスを乗せると出る「＋」を押す。
      </p>

      {message ? <p className="border border-destructive/40 bg-destructive/5 p-1.5 text-[11px] text-destructive">{message}</p> : null}

      {/* ── 年の切り替え ── */}
      <div className="flex flex-wrap items-center gap-1">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setYear(y)}
            className={cn(
              "h-7 rounded-none border border-border px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              activeYear === y ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {y}年
          </button>
        ))}
        <button
          type="button"
          onClick={() => setYear("all")}
          className={cn(
            "h-7 rounded-none border border-border px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            activeYear === "all" ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-accent",
          )}
        >
          ぜんぶ
        </button>
        <span className="ml-2 text-[11px] text-muted-foreground">{displayRows.length}行</span>
      </div>

      {/* ── 本体の1枚表 ── */}
      <div className="max-h-[720px] overflow-auto border border-border">
        <table className="w-full min-w-[1620px] border-collapse">
          <thead>
            <tr className="text-[11px] text-muted-foreground">
              <th scope="col" className={cn(STICKY_HEAD, "w-6 px-0 py-1")}> </th>
              <th scope="col" className={cn(STICKY_HEAD, "w-[96px] px-1.5 py-1 text-left font-medium")}>日付</th>
              <th scope="col" className={cn(STICKY_HEAD, "w-[52px] px-1 py-1 text-left font-medium")}>出どころ</th>
              <th scope="col" className={cn(STICKY_HEAD, "w-[92px] px-1.5 py-1 text-left font-medium")}>口座</th>
              <th scope="col" className={cn(STICKY_HEAD, "w-[150px] px-1.5 py-1 text-left font-medium")}>相手先</th>
              <th scope="col" className={cn(STICKY_HEAD, "w-[96px] px-1.5 py-1 text-right font-medium")}>出ていった</th>
              <th scope="col" className={cn(STICKY_HEAD, "w-[96px] px-1.5 py-1 text-right font-medium")}>入ってきた</th>
              {accounts.map((a) => (
                <th key={a.accountId} scope="col" className={cn(STICKY_HEAD, "w-[110px] border-l border-border px-1.5 py-1 text-right font-medium")}>
                  {a.shortName}
                </th>
              ))}
              {loanColumns.map((l) => (
                <th key={l.loanId} scope="col" className={cn(STICKY_HEAD, "w-[110px] border-l border-border px-1.5 py-1 text-right font-medium")}>
                  借入 {l.shortName}
                </th>
              ))}
              <th scope="col" className={cn(STICKY_HEAD, "w-[90px] border-l border-border px-1.5 py-1 text-left font-medium")}>対象</th>
              <th scope="col" className={cn(STICKY_HEAD, "w-[96px] px-1.5 py-1 text-left font-medium")}>対象月</th>
              <th scope="col" className={cn(STICKY_HEAD, "min-w-[220px] px-1.5 py-1 text-left font-medium")}>備考</th>
              <th scope="col" className={cn(STICKY_HEAD, "w-8 px-1 py-1")}> </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 && loading ? (
              <tr><td colSpan={13 + accounts.length + loanColumns.length} className="px-2 py-8 text-center text-xs text-muted-foreground">読み込み中…</td></tr>
            ) : null}
            {displayRows.map((row) => (
              <tr
                key={row.key}
                className={cn(
                  "group border-b border-border hover:bg-accent/30",
                  row.isPlanned && "bg-muted/20",
                  row.draft && "bg-background",
                )}
              >
                {/* 行と行のあいだに差し込む「＋」 */}
                <td className="relative w-6 p-0 align-middle">
                  {row.id ? (
                    <button
                      type="button"
                      aria-label="この行の上に足す"
                      onClick={() => setDrafts((prev) => [...prev, blankDraft(row.key, row.entryDate, row.accountId)])}
                      className="absolute -top-[9px] left-0 z-10 flex h-[18px] w-6 items-center justify-center border border-border bg-background text-[11px] leading-none text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      ＋
                    </button>
                  ) : (
                    <span className="block px-1 text-center text-[10px] text-muted-foreground">新</span>
                  )}
                </td>

                <Cell row={row} {...cellProps} field="entryDate" value={shortDate(row.entryDate)} width="w-[96px]"
                  className={cn(row.isPlanned && "text-muted-foreground")} />
                <td className="w-[52px] px-1 py-1 text-[10px] text-muted-foreground">
                  {row.isPlanned ? "予定" : row.source === "freee" ? "freee" : row.source === "manual" ? "手入力" : ""}
                </td>
                <Cell row={row} {...cellProps} field="accountId"
                  value={accounts.find((a) => a.accountId === row.accountId)?.shortName ?? row.accountId}
                  width="w-[92px]" className="text-muted-foreground" />
                <Cell row={row} {...cellProps} field="counterparty" value={row.counterparty ?? ""} width="w-[150px]" />
                <Cell row={row} {...cellProps} field="withdrawal" value={numText(row.withdrawal)} align="right" width="w-[96px]" />
                <Cell row={row} {...cellProps} field="deposit" value={numText(row.deposit)} align="right" width="w-[96px]" />

                {accounts.map((a) => {
                  const isOwn = a.accountId === row.accountId;
                  const carried = row.accountBalances[a.accountId];
                  // 残高は計算した結果なので直接は書き換えない。金額を直すと、その先の残高がぜんぶ変わる。
                  return (
                    <td
                      key={a.accountId}
                      title={
                        isOwn && row.balanceGapStep
                          ? `スプレッドシートにはここが ${row.sheetBalance?.toLocaleString("ja-JP") ?? "空"} と書いてあった（差 ${row.balanceGapStep.toLocaleString("ja-JP")}）`
                          : undefined
                      }
                      className={cn(
                        "border-l border-border px-1.5 py-1 text-right font-mono text-xs tabular-nums",
                        isOwn
                          ? row.balanceGapStep
                            ? "bg-amber-100 font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                            : "font-semibold text-foreground"
                          : "text-muted-foreground/50",
                      )}
                    >
                      {carried == null ? "" : carried.toLocaleString("ja-JP")}
                    </td>
                  );
                })}

                {loanColumns.map((l) => {
                  const bal = row.loanBalances[l.loanId];
                  return (
                    <td key={l.loanId} className="border-l border-border bg-muted/20 px-1.5 py-1 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {bal == null ? "" : bal.toLocaleString("ja-JP")}
                    </td>
                  );
                })}

                <Cell row={row} {...cellProps} field="category" value={row.category ?? ""} width="w-[90px]"
                  className="border-l border-border text-muted-foreground" />
                <Cell row={row} {...cellProps} field="targetMonth" value={row.targetMonth ?? ""} width="w-[96px]"
                  className="text-muted-foreground" />
                <Cell row={row} {...cellProps} field="note" value={row.note ?? ""} className="text-muted-foreground" />

                <td className="w-8 px-1 py-1 text-right">
                  <button
                    type="button"
                    aria-label="この行を消す"
                    onClick={() => void removeRow(row)}
                    className="text-[11px] text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        残高の列は、その行の口座のところが濃い字で、ほかの口座はその時点の持ち越し。
        <span className="font-medium text-foreground">残高はこの画面が毎回その場で足し引きして出している</span>ので、
        途中の行の金額を直すと、その先の残高がぜんぶ変わる。だから残高のセルは直接は書き換えられない。
        黄色いセルは、きよのスプレッドシートに書いてあった残高と食い違うところ（カーソルを乗せると元の値が出る）。
        freee から取り込んだ行では、そこに書かれている銀行の実残高で計算を合わせ直している。
      </p>
    </div>
  );
}
