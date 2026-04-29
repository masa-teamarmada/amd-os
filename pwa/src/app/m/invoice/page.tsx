"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getInvoicePrefill, type InvoiceLine } from "@/lib/supabase/billing-queries";
import { invokeFreeeInvoice, invokeReimburse } from "@/lib/edge-functions";

const CATEGORY_LABELS: Record<string, string> = {
  transport: "交通費",
  lodging: "宿泊",
  supplies: "消耗品",
  meal: "会議費",
  other: "その他",
};

interface ReimbItem {
  id: string;
  date: string;
  category: string;
  category_label: string;
  amount: number;
  tax_rate: number;
  description: string;
  transport_from?: string;
  transport_to?: string;
}

export default function InvoiceWizardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const projectCode = searchParams.get("project") || "";
  const ym = searchParams.get("ym") || "";
  const projectIdParam = searchParams.get("project_id") || "";

  const [projectId, setProjectId] = useState(projectIdParam);
  const [clientName, setClientName] = useState("");

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // Step 1: 明細 + 件名 + 備考
  const [baseLines, setBaseLines] = useState<InvoiceLine[]>([]);
  const [subject, setSubject] = useState("");
  const [remark, setRemark] = useState("");

  // 立替
  const [reimbItems, setReimbItems] = useState<ReimbItem[]>([]);
  const [reimbTotal, setReimbTotal] = useState(0);

  // Step 2: 日付
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 2, 0);
    return d.toISOString().slice(0, 10);
  });

  // 結果
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  // ─── 初期データ読み込み ───
  useEffect(() => {
    if (!ym || (!projectId && !projectCode)) return;
    const load = async () => {
      // project_idが無い場合はproject_codeから取得
      let pid = projectId;
      if (!pid && projectCode) {
        const { data: pj } = await supabase
          .from("projects")
          .select("id, client_name")
          .eq("project_code", projectCode)
          .single();
        if (pj) {
          pid = pj.id;
          setProjectId(pid);
          setClientName(pj.client_name || "");
        } else {
          setLoading(false);
          return;
        }
      } else if (pid) {
        const { data: pj } = await supabase
          .from("projects")
          .select("client_name")
          .eq("id", pid)
          .single();
        if (pj) setClientName(pj.client_name || "");
      }

      const [prefill, reimbRes] = await Promise.all([
        getInvoicePrefill(supabase, pid, ym),
        invokeReimburse({
          action: "list_for_billing",
          project_id: pid,
          ym,
        }),
      ]);

      setBaseLines(prefill.base_lines);
      setRemark(prefill.remark);

      // 件名: 前月のがあればインクリメント済みで来る。なければ自動生成
      if (prefill.subject) {
        setSubject(prefill.subject);
      }
      // subject は useEffect 後に clientName が確定してから生成（下の別 useEffect）

      if (reimbRes.ok && reimbRes.data) {
        const d = reimbRes.data as { items: ReimbItem[]; total_yen: number };
        setReimbItems(d.items || []);
        setReimbTotal(d.total_yen || 0);
      }

      setLoading(false);
    };
    load();
  }, [projectId, ym]);

  // 件名の自動生成（clientName確定後）
  useEffect(() => {
    if (subject || !clientName || !ym) return;
    const [y, m] = ym.split("-").map(Number);
    setSubject(`${clientName} ${y}年${m}月分 業務委託費`);
  }, [clientName, ym, subject]);

  // ─── 明細操作 ───
  const updateLine = (
    idx: number,
    field: keyof InvoiceLine,
    value: string
  ) => {
    const updated = [...baseLines];
    if (field === "description") {
      updated[idx] = { ...updated[idx], description: value };
    } else {
      // 空文字を許容（プレースホルダーとして0を表示しない）
      updated[idx] = {
        ...updated[idx],
        [field]: value === "" ? 0 : Number(value),
      };
    }
    setBaseLines(updated);
  };

  const addLine = () => {
    setBaseLines([
      ...baseLines,
      { description: "", quantity: 1, unit_price: 0 },
    ]);
  };

  const removeLine = (idx: number) => {
    if (baseLines.length <= 1) return;
    setBaseLines(baseLines.filter((_, i) => i !== idx));
  };

  // ─── 計算 ───
  const baseTotal = baseLines.reduce(
    (s, l) => s + l.unit_price * l.quantity,
    0
  );
  const reimbExclTax = reimbItems.reduce(
    (s, r) => s + Math.floor(r.amount / (1 + (r.tax_rate || 0.1))),
    0
  );
  const grandTotal = baseTotal + reimbExclTax;
  const grandTotalWithTax = Math.floor(grandTotal * 1.1);

  // ─── 送信（下書き作成のみ） ───
  const handleCreate = async () => {
    setSubmitting(true);
    const res = await invokeFreeeInvoice({
      action: "create",
      project_id: projectId,
      ym,
      issue_date: issueDate,
      due_date: dueDate,
      base_lines: baseLines.filter((l) => l.description && l.unit_price > 0),
      subject: subject || undefined,
      remark: remark || undefined,
    });

    if (res.ok) {
      // 立替を請求済みマーク
      if (reimbItems.length > 0) {
        await invokeReimburse({
          action: "mark_billed",
          ids: reimbItems.map((r) => r.id),
          ym,
        });
      }

      // 明細テンプレートを保存（次月用）
      await supabase
        .from("billing_cycles")
        .update({
          invoice_base_lines_json: baseLines,
          invoice_subject: subject,
          invoice_remark: remark,
          invoice_reimb_total: reimbTotal,
        })
        .eq("project_id", projectId)
        .eq("ym", ym);

      setResult({ ok: true, message: "請求書を作成しました" });
      setTimeout(() => router.push(`/m/${projectCode}?ym=${ym}`), 2000);
    } else {
      setResult({ ok: false, message: res.error || "作成に失敗しました" });
    }
    setSubmitting(false);
  };

  // ─── 数値入力ヘルパー（0の時は空表示） ───
  const numDisplay = (v: number) => (v === 0 ? "" : String(v));

  // ─── レンダリング ───

  if (!ym && !projectCode) {
    return (
      <div className="px-4 py-6 text-center text-gray-400 text-sm">
        パラメータが不足しています
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-12 text-center text-gray-400 text-sm">
        明細データを読み込み中...
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      {/* Header */}
      <div className="mb-4">
        <button
          onClick={() => (step > 1 ? setStep(step - 1) : router.back())}
          className="text-blue-600 text-xs mb-2"
        >
          ← {step > 1 ? "前のステップ" : "戻る"}
        </button>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">請求書作成</h2>
          <span className="text-xs text-gray-400">
            {projectCode} · {ym}
          </span>
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-1 mt-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${
                s <= step ? "bg-blue-500" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span className={step === 1 ? "text-blue-600 font-medium" : ""}>
            明細・備考
          </span>
          <span className={step === 2 ? "text-blue-600 font-medium" : ""}>
            日付設定
          </span>
          <span className={step === 3 ? "text-blue-600 font-medium" : ""}>
            確認・作成
          </span>
        </div>
      </div>

      {/* ═══ Step 1: 明細 + 件名 + 備考 ═══ */}
      {step === 1 && (
        <div className="space-y-4">
          {/* 件名 */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">件名</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* 基本明細 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500">
                基本明細
              </label>
              <button onClick={addLine} className="text-xs text-blue-600">
                + 行追加
              </button>
            </div>
            {baseLines.map((line, idx) => {
              const lineTotal = line.unit_price * line.quantity;
              return (
                <div
                  key={idx}
                  className="bg-white border border-gray-200 rounded-lg p-3 mb-2"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-gray-400">
                      行 {idx + 1}
                    </span>
                    {baseLines.length > 1 && (
                      <button
                        onClick={() => removeLine(idx)}
                        className="text-[10px] text-red-400"
                      >
                        削除
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) =>
                      updateLine(idx, "description", e.target.value)
                    }
                    className="w-full border-b border-gray-100 pb-1 mb-2 text-sm outline-none"
                    placeholder="説明"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-gray-400">数量</span>
                      <input
                        type="number"
                        value={numDisplay(line.quantity)}
                        onChange={(e) =>
                          updateLine(idx, "quantity", e.target.value)
                        }
                        placeholder="1"
                        min={1}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400">
                        単価（税抜）
                      </span>
                      <input
                        type="number"
                        value={numDisplay(line.unit_price)}
                        onChange={(e) =>
                          updateLine(idx, "unit_price", e.target.value)
                        }
                        placeholder="0"
                        min={0}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400">金額</span>
                      <div className="border border-gray-100 bg-gray-50 rounded px-2 py-1 text-sm font-mono text-gray-700">
                        {lineTotal > 0
                          ? `¥${lineTotal.toLocaleString()}`
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 立替（自動組込） */}
          {reimbItems.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">
                立替精算（承認済み・{reimbItems.length}件）
              </label>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                {reimbItems.map((r) => {
                  const label =
                    r.category === "transport" && r.transport_from
                      ? `${r.transport_from}→${r.transport_to}`
                      : CATEGORY_LABELS[r.category] || r.category;
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between py-1 text-xs"
                    >
                      <span className="text-gray-600 truncate flex-1">
                        {new Date(r.date).toLocaleDateString("ja-JP", {
                          month: "numeric",
                          day: "numeric",
                        })}{" "}
                        {label} {r.description}
                      </span>
                      <span className="font-mono text-gray-700 ml-2">
                        ¥{r.amount.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
                <div className="border-t border-emerald-300 mt-2 pt-2 flex justify-between text-xs font-medium">
                  <span className="text-emerald-700">立替合計（税込）</span>
                  <span className="font-mono text-emerald-800">
                    ¥{reimbTotal.toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] text-emerald-600 mt-1">
                  請求書に自動組込されます
                </p>
              </div>
            </div>
          )}

          {/* 備考 */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              備考（任意）
            </label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
              placeholder="前月の備考がここに入ります"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* 小計 */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">基本明細小計</span>
              <span className="font-mono">
                ¥{baseTotal.toLocaleString()}
              </span>
            </div>
            {reimbItems.length > 0 && (
              <div className="flex justify-between mt-1">
                <span className="text-gray-500">立替（税抜換算）</span>
                <span className="font-mono">
                  ¥{reimbExclTax.toLocaleString()}
                </span>
              </div>
            )}
            <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold">
              <span>税込合計</span>
              <span className="font-mono text-blue-700">
                ¥{grandTotalWithTax.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={baseTotal <= 0}
            className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-medium active:bg-blue-700 disabled:opacity-50"
          >
            次へ →
          </button>
        </div>
      )}

      {/* ═══ Step 2: 日付設定 ═══ */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">請求日</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              支払期日
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>

          <button
            onClick={() => setStep(3)}
            className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-medium active:bg-blue-700"
          >
            次へ →
          </button>
        </div>
      )}

      {/* ═══ Step 3: 確認・作成 ═══ */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              請求書プレビュー
            </h3>

            {subject && (
              <div className="text-xs text-gray-500 mb-3">
                件名: {subject}
              </div>
            )}

            {/* 基本明細 */}
            <div className="space-y-1">
              {baseLines
                .filter((l) => l.description)
                .map((l, i) => (
                  <div key={i} className="flex justify-between text-sm py-1">
                    <span className="text-gray-700 flex-1">
                      {l.description}
                      {l.quantity > 1 && (
                        <span className="text-gray-400 text-xs ml-1">
                          ×{l.quantity}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-gray-900 ml-2">
                      ¥{(l.unit_price * l.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>

            {/* 立替 */}
            {reimbItems.length > 0 && (
              <>
                <div className="border-t border-gray-100 my-2" />
                <div className="text-[10px] text-gray-400 mb-1">
                  立替精算（{reimbItems.length}件）
                </div>
                {reimbItems.map((r) => (
                  <div
                    key={r.id}
                    className="flex justify-between text-xs py-0.5"
                  >
                    <span className="text-gray-500 truncate flex-1">
                      [立替]{" "}
                      {new Date(r.date).toLocaleDateString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                      })}{" "}
                      {r.category_label || CATEGORY_LABELS[r.category]}{" "}
                      {r.description}
                    </span>
                    <span className="font-mono text-gray-600 ml-2">
                      ¥
                      {Math.floor(
                        r.amount / (1 + (r.tax_rate || 0.1))
                      ).toLocaleString()}
                    </span>
                  </div>
                ))}
              </>
            )}

            {/* 合計 */}
            <div className="border-t border-gray-200 mt-3 pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">税抜合計</span>
                <span className="font-mono">
                  ¥{grandTotal.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold mt-1">
                <span>税込合計</span>
                <span className="font-mono text-blue-700">
                  ¥{grandTotalWithTax.toLocaleString()}
                </span>
              </div>
            </div>

            {/* メタ情報 */}
            <div className="border-t border-gray-100 mt-3 pt-2 text-xs text-gray-400 space-y-0.5">
              <div>請求日: {issueDate}</div>
              <div>支払期日: {dueDate}</div>
              {remark && <div>備考: {remark}</div>}
            </div>
          </div>

          {/* 結果メッセージ */}
          {result && (
            <div
              className={`rounded-lg p-3 text-sm ${
                result.ok
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {result.message}
            </div>
          )}

          {/* CTA: 作成のみ（送付はadminチェック後に手動） */}
          <button
            onClick={handleCreate}
            disabled={submitting || grandTotal <= 0}
            className="w-full bg-blue-600 text-white rounded-xl py-3.5 text-sm font-medium active:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "作成中..." : "請求書を作成する"}
          </button>
          <p className="text-[10px] text-gray-400 text-center">
            作成後、adminが確認してから手動で送付します
          </p>
        </div>
      )}
    </div>
  );
}
