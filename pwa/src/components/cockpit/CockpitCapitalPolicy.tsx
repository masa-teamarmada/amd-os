"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Check, Loader2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  HOLDER_LABELS,
  TRANSACTION_LABELS,
  convertibleScenario,
  type CompanyOverviewData,
} from "@/lib/company-overview";
import { CapitalPolicyTable, CapitalRoundsTable } from "@/components/cockpit/CapitalPolicyTable";
import {
  EmptyState,
  Field,
  NativeSelect,
  Section,
  formatDate,
  formatNumber,
  formatYen,
  numberOrNull,
  statusLabel,
  textOrNull,
} from "@/components/cockpit/company-overview-ui";

/**
 * 資本政策表タブ (`?tab=capital-policy`)。
 * 2026-08-29 まさ「資本政策表は会社概要から独立させて、新タブにしてほしい。会社概要タブの
 * コンテンツが増えすぎて見にくいので」で会社概要タブから切り出した。
 * 会社概要は登記・総会・決算などの会社そのものの記録、こちらは資本構成の記録に分ける。
 */

type DialogKind = "equity" | "round" | "convertible" | null;

const EMPTY_DATA: CompanyOverviewData = {
  profile: null,
  shareholders: [],
  transactions: [],
  convertibles: [],
  financialPeriods: [],
  rounds: [],
  meetings: [],
  actionItems: [],
};

const HOLDER_TYPES = Object.entries(HOLDER_LABELS).map(([value, label]) => ({ value, label }));
const TRANSACTION_TYPES = ["incorporation", "opening_balance", "new_issue", "transfer", "stock_option_grant", "stock_option_exercise", "in_kind_contribution", "cancellation", "correction"]
  .map((value) => ({ value, label: TRANSACTION_LABELS[value] }));

export function CockpitCapitalPolicy({ projectId }: { projectId: string }) {
  const [data, setData] = useState<CompanyOverviewData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/governance?projectId=${encodeURIComponent(projectId)}`);
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "資本政策を読み込めなかったよ");
      setData(json);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "資本政策を読み込めなかったよ");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const hasEquityLedger = data.transactions.some((transaction) => transaction.status === "confirmed");
  const conversion = convertibleScenario(data);

  async function post(entity: string, row: Record<string, unknown>) {
    const response = await fetch("/api/governance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, row }) });
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json.error || "保存できなかったよ");
  }

  async function save(label: string, action: () => Promise<void>) {
    setSaving(true);
    setError("");
    try {
      await action();
      setDialog(null);
      await load();
      setNotice(`${label}を保存したよ`);
      window.setTimeout(() => setNotice(""), 3200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できなかったよ");
    } finally {
      setSaving(false);
    }
  }

  async function saveEquity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const transactionType = String(form.get("transaction_type"));
    const shares = Number(numberOrNull(form.get("shares")) || 0);
    const paidIn = Number(numberOrNull(form.get("paid_in_yen")) || 0);
    const holderType = String(form.get("holder_type") || "other");
    const toHolder = String(form.get("to_holder") || "").trim();
    const fromHolder = String(form.get("from_holder") || "").trim();
    const securityClass = String(form.get("security_class") || "普通株式").trim();
    if (!shares || shares < 0) { setError("株式数は0より大きい数で入力してね"); return; }
    if (transactionType === "transfer" && (!fromHolder || !toHolder)) { setError("譲渡元と譲渡先を入力してね"); return; }
    if (transactionType !== "transfer" && !toHolder) { setError("株主・付与先を入力してね"); return; }

    const entry = (holderName: string, outstanding: number, diluted: number, paidInYen = 0, klass = securityClass) => ({ holder_type: holderType, holder_name: holderName, security_class: klass, outstanding_delta: outstanding, diluted_delta: diluted, paid_in_yen_delta: paidInYen });
    let entries;
    if (transactionType === "transfer") entries = [entry(fromHolder, -shares, -shares), entry(toHolder, shares, shares)];
    else if (transactionType === "stock_option_grant") entries = [entry(toHolder, 0, shares, 0, securityClass || "新株予約権")];
    else if (transactionType === "stock_option_exercise") entries = [entry(toHolder, 0, -shares, 0, securityClass || "新株予約権"), entry(toHolder, shares, shares, paidIn, "普通株式")];
    else if (transactionType === "cancellation") entries = [entry(toHolder, -shares, -shares)];
    else entries = [entry(toHolder, shares, shares, paidIn)];

    const roundId = String(form.get("round_id") || "none");

    await save("株式イベント", () => post("equity_transaction", {
      project_id: projectId, round_id: roundId === "none" ? null : roundId, effective_on: form.get("effective_on"), transaction_type: transactionType,
      description: textOrNull(form.get("description")), status: form.get("status"), source_ref: textOrNull(form.get("source_ref")),
      notes: textOrNull(form.get("notes")), entries,
    }));
  }

  async function saveRound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await save("調達ラウンド", () => post("round", {
      project_id: projectId, round_name: textOrNull(form.get("round_name")), round_date: textOrNull(form.get("round_date")),
      pre_money_yen: numberOrNull(form.get("pre_money_yen")), post_money_yen: numberOrNull(form.get("post_money_yen")),
      raised_yen: numberOrNull(form.get("raised_yen")), price_per_share_yen: numberOrNull(form.get("price_per_share_yen")),
      lead_investor: textOrNull(form.get("lead_investor")), source_ref: textOrNull(form.get("source_ref")), notes: textOrNull(form.get("notes")),
    }));
  }

  async function saveConvertible(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const discount = numberOrNull(form.get("discount_rate_pct"));
    await save("転換前証券", () => post("convertible", {
      project_id: projectId, holder_name: textOrNull(form.get("holder_name")), instrument_type: form.get("instrument_type"),
      issued_on: textOrNull(form.get("issued_on")), principal_yen: numberOrNull(form.get("principal_yen")),
      valuation_cap_yen: numberOrNull(form.get("valuation_cap_yen")), discount_rate: discount == null ? null : Number(discount) / 100,
      conversion_trigger: textOrNull(form.get("conversion_trigger")), maturity_on: textOrNull(form.get("maturity_on")),
      estimated_conversion_price: numberOrNull(form.get("estimated_conversion_price")), estimated_conversion_shares: numberOrNull(form.get("estimated_conversion_shares")),
      status: form.get("status"), source_ref: textOrNull(form.get("source_ref")), notes: textOrNull(form.get("notes")),
    }));
  }

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><Check className="size-4" />{notice}</div>}

      <Section
        title="資本政策表"
        description="ラウンドを列・株主を行に置いた正式な資本政策表。株数、持株比率、発行価額、時価総額の推移をそのまま追える。表になるのは確定済みの株式イベントで、計画ラウンドはラウンド一覧に並ぶ"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11" onClick={() => void load()} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}更新</Button>
            <Button variant="outline" className="h-11" onClick={() => setDialog("equity")}><Plus />株式イベント</Button>
            <Button variant="outline" className="h-11" onClick={() => setDialog("round")}><Plus />ラウンド</Button>
            <Button variant="outline" className="h-11" onClick={() => setDialog("convertible")}><Plus />転換前証券</Button>
          </div>
        }
      >
        {!hasEquityLedger && data.rounds.length === 0 && data.convertibles.length === 0
          ? <EmptyState>{loading ? "読み込み中…" : "株式イベントや調達ラウンドを追加すると、ラウンド別の資本政策表になるよ。"}</EmptyState>
          : <div className="divide-y divide-slate-100">
              <CapitalPolicyTable data={data} />
              {data.rounds.length > 0 && (
                <div>
                  <div className="px-4 pb-1 pt-4 text-[11px] font-semibold text-slate-500 sm:px-5">
                    ラウンド一覧{hasEquityLedger ? "（計画中・株式イベント未登録のラウンドを含む全件）" : ""}
                  </div>
                  <CapitalRoundsTable data={data} showLedgerHint={!hasEquityLedger} />
                </div>
              )}
              {data.convertibles.length > 0 && (
                <div className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>転換前証券</span>
                    <span>転換見込 {formatNumber(conversion.estimatedShares, 2)}株</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-xs">
                      <thead className="bg-slate-50 text-[11px] text-slate-500">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">保有者</th>
                          <th className="px-3 py-3 text-left font-medium">種別 / 状態</th>
                          <th className="px-3 py-3 text-left font-medium">発行日 / 期限</th>
                          <th className="px-3 py-3 text-right font-medium">元本</th>
                          <th className="px-3 py-3 text-right font-medium">評価上限</th>
                          <th className="px-3 py-3 text-right font-medium">ディスカウント</th>
                          <th className="px-4 py-3 text-right font-medium">転換見込株式</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.convertibles.map((instrument) => (
                          <tr key={instrument.id}>
                            <td className="px-4 py-3 font-medium text-slate-900">{instrument.holder_name}</td>
                            <td className="px-3 py-3 text-slate-600">{instrument.instrument_type} / {statusLabel(instrument.status)}</td>
                            <td className="px-3 py-3 tabular-nums text-slate-600">{[instrument.issued_on, instrument.maturity_on].filter(Boolean).map((value) => formatDate(value)).join(" 〜 ") || "－"}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{formatYen(instrument.principal_yen)}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{formatYen(instrument.valuation_cap_yen)}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{instrument.discount_rate == null ? "－" : `${(Number(instrument.discount_rate) * 100).toFixed(1)}%`}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatNumber(instrument.estimated_conversion_shares, 2)}株</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-slate-500">転換前証券は現在の持株比率には混ぜず、転換見込シナリオとして別に持つ。</p>
                </div>
              )}
            </div>}
      </Section>

      <Dialog open={dialog === "equity"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-2xl"><form onSubmit={(event) => void saveEquity(event)}><DialogHeader><DialogTitle>株式イベントを追加</DialogTitle><DialogDescription>確定イベントだけが資本政策表の列になるよ。譲渡は譲渡元と譲渡先を同時に記録する。</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2">
        <Field label="イベント"><NativeSelect name="transaction_type" defaultValue="new_issue" options={TRANSACTION_TYPES} /></Field>
        <Field label="状態"><NativeSelect name="status" defaultValue="confirmed" options={[{ value: "planned", label: "計画" }, { value: "confirmed", label: "確定" }]} /></Field>
        <Field label="効力日" name="effective_on" hint="YYYY-MM-DD"><Input id="effective_on" name="effective_on" required defaultValue={new Date().toISOString().slice(0, 10)} className="h-11" /></Field>
        <Field label="株主区分"><NativeSelect name="holder_type" defaultValue="founder" options={HOLDER_TYPES} /></Field>
        <Field label="関連ラウンド" hint="任意。発行価額・pre/postはここで紐付けたラウンドの登録値を使う"><NativeSelect name="round_id" defaultValue="none" options={[{ value: "none", label: "なし" }, ...data.rounds.map((round) => ({ value: round.id, label: round.round_name || formatDate(round.round_date || round.round_ym) }))]} /></Field>
        <Field label="譲渡元（譲渡のとき）" name="from_holder"><Input id="from_holder" name="from_holder" className="h-11" /></Field>
        <Field label="株主・譲渡先・付与先" name="to_holder"><Input id="to_holder" name="to_holder" className="h-11" /></Field>
        <Field label="証券種別" name="security_class"><Input id="security_class" name="security_class" defaultValue="普通株式" className="h-11" /></Field>
        <Field label="株式数 / 個数" name="shares"><Input id="shares" name="shares" inputMode="decimal" required className="h-11" /></Field>
        <Field label="払込総額（円）" name="paid_in_yen" hint="譲渡なら会社への払込ではないので0"><Input id="paid_in_yen" name="paid_in_yen" inputMode="numeric" className="h-11" /></Field>
        <Field label="説明" name="description"><Input id="description" name="description" placeholder="Seed増資、創業時発行など" className="h-11" /></Field>
        <Field label="確認元" name="source_ref"><Input id="source_ref" name="source_ref" placeholder="株主名簿 / 払込証明 / 契約" className="h-11" /></Field>
        <div className="sm:col-span-2"><Field label="メモ" name="notes"><Textarea id="notes" name="notes" /></Field></div>
      </div><DialogFooter><Button type="button" variant="outline" className="h-11" onClick={() => setDialog(null)}>閉じる</Button><Button type="submit" className="h-11" disabled={saving}>{saving && <Loader2 className="animate-spin" />}追加</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={dialog === "round"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-2xl"><form onSubmit={(event) => void saveRound(event)}><DialogHeader><DialogTitle>調達ラウンドを追加</DialogTitle><DialogDescription>株式イベントとラウンド情報を分けることで、持株計算とバリュエーションを混同しない。</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2">
        <Field label="ラウンド名" name="round_name"><Input id="round_name" name="round_name" placeholder="Seed" required className="h-11" /></Field><Field label="実施日" name="round_date"><Input id="round_date" name="round_date" placeholder="2026-07-16" className="h-11" /></Field>
        <Field label="pre-money（円）" name="pre_money_yen"><Input id="pre_money_yen" name="pre_money_yen" inputMode="numeric" className="h-11" /></Field><Field label="post-money（円）" name="post_money_yen"><Input id="post_money_yen" name="post_money_yen" inputMode="numeric" className="h-11" /></Field>
        <Field label="調達額（円）" name="raised_yen"><Input id="raised_yen" name="raised_yen" inputMode="numeric" className="h-11" /></Field><Field label="1株単価（円）" name="price_per_share_yen"><Input id="price_per_share_yen" name="price_per_share_yen" inputMode="decimal" className="h-11" /></Field>
        <Field label="リード投資家" name="lead_investor"><Input id="lead_investor" name="lead_investor" className="h-11" /></Field><Field label="確認元" name="source_ref"><Input id="source_ref" name="source_ref" className="h-11" /></Field>
        <div className="sm:col-span-2"><Field label="メモ" name="notes"><Textarea id="notes" name="notes" /></Field></div>
      </div><DialogFooter><Button type="button" variant="outline" className="h-11" onClick={() => setDialog(null)}>閉じる</Button><Button type="submit" className="h-11" disabled={saving}>{saving && <Loader2 className="animate-spin" />}追加</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={dialog === "convertible"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-2xl"><form onSubmit={(event) => void saveConvertible(event)}><DialogHeader><DialogTitle>転換前証券を追加</DialogTitle><DialogDescription>現在の持株比率には入れず、転換見込シナリオとして別表示するよ。</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2">
        <Field label="保有者" name="holder_name"><Input id="holder_name" name="holder_name" required className="h-11" /></Field><Field label="証券"><NativeSelect name="instrument_type" defaultValue="J-KISS" options={[{ value: "J-KISS", label: "J-KISS" }, { value: "SAFE", label: "SAFE" }, { value: "CB", label: "転換社債" }, { value: "other", label: "その他" }]} /></Field>
        <Field label="発行日" name="issued_on"><Input id="issued_on" name="issued_on" placeholder="2026-07-16" className="h-11" /></Field><Field label="状態"><NativeSelect name="status" defaultValue="outstanding" options={[{ value: "outstanding", label: "転換前" }, { value: "converted", label: "転換済み" }, { value: "repaid", label: "償還済み" }, { value: "cancelled", label: "取消" }]} /></Field>
        <Field label="元本（円）" name="principal_yen"><Input id="principal_yen" name="principal_yen" inputMode="numeric" className="h-11" /></Field><Field label="評価上限（円）" name="valuation_cap_yen"><Input id="valuation_cap_yen" name="valuation_cap_yen" inputMode="numeric" className="h-11" /></Field>
        <Field label="割引率（%）" name="discount_rate_pct"><Input id="discount_rate_pct" name="discount_rate_pct" inputMode="decimal" placeholder="20" className="h-11" /></Field><Field label="満期日" name="maturity_on"><Input id="maturity_on" name="maturity_on" className="h-11" /></Field>
        <Field label="転換見込単価（円）" name="estimated_conversion_price"><Input id="estimated_conversion_price" name="estimated_conversion_price" inputMode="decimal" className="h-11" /></Field><Field label="転換見込株式数" name="estimated_conversion_shares"><Input id="estimated_conversion_shares" name="estimated_conversion_shares" inputMode="decimal" className="h-11" /></Field>
        <div className="sm:col-span-2"><Field label="転換条件" name="conversion_trigger"><Input id="conversion_trigger" name="conversion_trigger" placeholder="適格資金調達 1.2億円以上" className="h-11" /></Field></div>
        <div className="sm:col-span-2"><Field label="確認元" name="source_ref"><Input id="source_ref" name="source_ref" className="h-11" /></Field></div>
        <div className="sm:col-span-2"><Field label="メモ" name="notes"><Textarea id="notes" name="notes" /></Field></div>
      </div><DialogFooter><Button type="button" variant="outline" className="h-11" onClick={() => setDialog(null)}>閉じる</Button><Button type="submit" className="h-11" disabled={saving}>{saving && <Loader2 className="animate-spin" />}追加</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
}
