"use client";

/**
 * AMD スコア breakdown モーダル: chip クリックで開く。
 * 計算式・各パラメータの値・寄与を表示。
 *
 * 現状はダミー (Before Zero Theory v3.x 確定待ち)。式と値の対応を一目で見せる。
 */

import { computeAmdScoreBreakdown, type VentureStatusBundle } from "@/lib/venture-status-data";

interface Props {
  bundle: VentureStatusBundle;
  onClose: () => void;
}

const KIND_LABEL_JP: Record<string, string> = {
  hire: "採用",
  funding: "資金調達",
  deal: "事業契約",
  governance: "ガバナンス",
  note: "メモ",
  xrl_obs: "XRL 観測",
  amd_score_override: "スコア手動補正",
};

export function CockpitAmdScoreBreakdownModal({ bundle, onClose }: Props) {
  const b = computeAmdScoreBreakdown(bundle);
  if (!b) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[640px] max-w-[92vw] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <h3 className="text-sm font-semibold">AMD スコアの内訳</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            ✕
          </button>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4">
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            ⚠️ 計算式は <strong>ダミー</strong> です。Before Zero Theory v3.x で正本確定予定。確定したら
            <code className="font-mono text-[10px] mx-1">computeAmdScoreBreakdown()</code>を差し替え。
          </div>

          <div className="text-[12px] leading-relaxed">
            <div className="text-muted-foreground mb-1">計算時点</div>
            <div className="font-mono text-[13px]">{b.asOf}</div>
          </div>

          <div className="text-[12px] leading-relaxed">
            <div className="text-muted-foreground mb-1">設立日</div>
            <div className="font-mono text-[13px]">
              {b.founded_at || "未設立"}
              {b.isBeforeZero && <span className="ml-2 text-blue-600">(Before 0)</span>}
              {!b.isBeforeZero && b.founded_at && <span className="ml-2 text-emerald-600">(After 0)</span>}
            </div>
          </div>

          {b.isBeforeZero && (
            <>
              <div className="border border-[#e5e5e7] rounded-md p-3 bg-[#fafbff]">
                <div className="text-[12px] font-semibold mb-1">Before 0 線形補間</div>
                <pre className="text-[11px] font-mono whitespace-pre-wrap text-slate-700">
{`score(t) = -100 × (founded - t) / (founded - anchor)
       + 0  × (t - anchor) / (founded - anchor)

ここで:
  anchor = founded_at - 5 年 = ${b.beforeZeroAnchor?.date}      (score = -100)
  founded = ${b.founded_at}      (score = 0)
  t       = ${b.asOf}      (今日)
`}
                </pre>
                <div className="mt-2 text-[12px]">
                  → 今日のスコア: <strong className="font-mono">{b.beforeZeroToday?.score.toFixed(1)}</strong>
                </div>
              </div>
            </>
          )}

          {!b.isBeforeZero && (
            <>
              <div className="border border-[#e5e5e7] rounded-md p-3 bg-[#fafbff]">
                <div className="text-[12px] font-semibold mb-1">After 0 計算式</div>
                <pre className="text-[11px] font-mono whitespace-pre-wrap text-slate-700">
{`score = min(100,
  ((TRL + BRL + HRL) / 27) × 60   ← XRL 部分 (最大 60)
  + Σ event_bonus(kind)            ← イベント加点
)

event_bonus:
  hire=+3 / funding=+8 / deal=+5 / governance=+2
  (note / xrl_obs / amd_score_override は 0)
`}
                </pre>
              </div>

              <div className="border border-[#e5e5e7] rounded-md p-3">
                <div className="text-[12px] font-semibold mb-1">XRL 部分</div>
                {b.latestXrl ? (
                  <div className="text-[12px] leading-relaxed">
                    最新観測: <span className="font-mono">{b.latestXrl.observed_at}</span> /
                    TRL <span className="font-mono">{b.latestXrl.trl ?? "—"}</span> ·
                    BRL <span className="font-mono">{b.latestXrl.brl ?? "—"}</span> ·
                    HRL <span className="font-mono">{b.latestXrl.hrl ?? "—"}</span>
                    <div className="mt-1">
                      合計 <span className="font-mono">{b.xrlSum}</span> / 27 →
                      score 寄与 <strong className="font-mono">{b.xrlScore.toFixed(1)}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="text-[12px] text-muted-foreground">XRL 観測なし → 0</div>
                )}
              </div>

              <div className="border border-[#e5e5e7] rounded-md p-3">
                <div className="text-[12px] font-semibold mb-1">イベント加点 ({b.eventBonuses.length} 件)</div>
                {b.eventBonuses.length === 0 ? (
                  <div className="text-[12px] text-muted-foreground">加点対象イベントなし → 0</div>
                ) : (
                  <ul className="text-[11.5px] divide-y divide-[#f1f5f9]">
                    {b.eventBonuses.map((e, i) => (
                      <li key={i} className="py-1 flex items-start gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground w-[80px] shrink-0">
                          {e.occurred_on}
                        </span>
                        <span className="text-[10px] text-muted-foreground w-[64px] shrink-0">
                          {KIND_LABEL_JP[e.kind] ?? e.kind}
                        </span>
                        <span className="flex-1">{e.label}</span>
                        <span className="font-mono text-emerald-700">+{e.bonus}</span>
                      </li>
                    ))}
                    <li className="py-1 flex items-center gap-2 mt-1 border-t-2 border-slate-300 pt-2 font-semibold">
                      <span className="flex-1 text-right">小計</span>
                      <span className="font-mono text-emerald-700">+{b.eventBonusTotal}</span>
                    </li>
                  </ul>
                )}
              </div>
            </>
          )}

          <div className="border-t-2 border-slate-300 pt-3 flex items-baseline justify-between">
            <span className="text-[12px] text-muted-foreground">最終スコア (cap 100):</span>
            <span
              className="text-2xl font-mono font-bold"
              style={{ color: b.finalScore >= 0 ? "#16a34a" : "#ef4444" }}
            >
              {b.finalScore.toFixed(1)}
            </span>
          </div>
          {!b.isBeforeZero && b.rawScore > 100 && (
            <div className="text-[10px] text-muted-foreground -mt-2 text-right">
              (raw {b.rawScore.toFixed(1)} → 100 で cap)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
