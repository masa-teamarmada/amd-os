"use client";

import { FlaskConical } from "lucide-react";
import type { SxJudgment, SxManagementBundle, SxTrackKey } from "@/lib/sx-management";
import {
  SX_TRACK_LABELS,
  SxBadge,
  SxDiamondMark,
  SxStatusIcon,
  SxTickMark,
  sxConfidenceLabel,
  sxDisplayText,
  sxFormatDate,
} from "./sx-visual-shared";
import { WINDOW_LABEL, WINDOW_TONE, type SxRunwayItem } from "./SxDecisionRunway";

const JUDGMENT_TONE: Record<string, string> = {
  on_track: "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]",
  attention: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
  crisis: "border-[#b5533f] bg-[#f9e4e1] text-[#8c3329]",
  unassessed: "border-[#b8b5c8] bg-[#eeedf4] text-[#55506d]",
};

function clampDeltaOffset(deltaDays: number | null) {
  if (deltaDays == null) return 0;
  const clamped = Math.max(-18, Math.min(18, deltaDays));
  return clamped * 1.6;
}

export function SxReactorPanel({
  management,
  judgment,
  selectedTrack,
  onSelectTrack,
  topDecision,
}: {
  management: SxManagementBundle;
  judgment: SxJudgment;
  selectedTrack: SxTrackKey | null;
  onSelectTrack: (track: SxTrackKey | null) => void;
  topDecision?: SxRunwayItem;
}) {
  const objective = management.objective;
  const gateConfirmed = objective?.dateCertainty === "confirmed";

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#cfc7b9] bg-[#fffdf7]/95 p-4 shadow-[0_10px_35px_rgba(61,56,44,0.05)] sm:p-5">
      {/* 制御帯 */}
      <div className="border-b border-[#e4ddd0] pb-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#38745d]">SX事業化リアクター / 経営判定</p>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-bold ${JUDGMENT_TONE[judgment.key] || JUDGMENT_TONE.unassessed}`}>{judgment.label}</span>
        </div>
        <ul className="mt-2 space-y-1 text-[11px] leading-4 text-[#514e47]">
          {judgment.reasons.slice(0, 3).map((reason) => (
            <li key={reason} className="flex gap-1.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#bf7b2c]" />{reason}</li>
          ))}
          {judgment.reasons.length === 0 && <li className="text-[#777166]">判定理由はまだ登録されてないよ。</li>}
        </ul>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
          <div><dt className="text-[9px] font-semibold text-[#777166]">データ充足率</dt><dd className="text-xs font-semibold text-[#24231f]">{judgment.completenessPct}%</dd></div>
          <div><dt className="text-[9px] font-semibold text-[#777166]">重大な未確認</dt><dd className="text-xs font-semibold text-[#24231f]">{judgment.criticalUnknownCount}件</dd></div>
          <div><dt className="text-[9px] font-semibold text-[#777166]">次の期限</dt><dd className="text-xs font-semibold text-[#24231f]">{sxFormatDate(judgment.nextDeadline)}</dd></div>
          <div><dt className="text-[9px] font-semibold text-[#777166]">最終確認</dt><dd className="text-xs font-semibold text-[#24231f]">{sxFormatDate(judgment.lastVerifiedAt)}</dd></div>
        </dl>
      </div>

      {topDecision && (
        <div className="mt-3 rounded-lg border border-[#38745d] bg-[#f1f6f2] p-3 lg:hidden">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-[#38745d]">最優先の判断</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <SxBadge tone={WINDOW_TONE[topDecision.window]}>{WINDOW_LABEL[topDecision.window]}</SxBadge>
            <span className="text-[10px] font-semibold text-[#777166]">{SX_TRACK_LABELS[topDecision.track]} / {topDecision.gateLabel}</span>
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-5 text-[#24231f]">{topDecision.title}</p>
          <p className="mt-1 text-[11px] leading-4 text-[#69665d]">期限 {sxFormatDate(topDecision.dueDate)} / {topDecision.ownerLabel}</p>
        </div>
      )}

      {/* 4流路 → 設立判断ゲート */}
      <figure className="mt-3 flex min-w-0 flex-1 flex-col gap-2">
        <figcaption className="sr-only">
          事業開発、技術開発、資金調達、体制構築の4本の流路が、ゲート弁を通って2027年3月の設立判断ゲートへ収束する図。各流路は現在ゲート・状態・予定日・予測日・担当・次の成果・最大論点を示す。
        </figcaption>
        <div className="flex min-w-0 flex-1 flex-col gap-2 border-l-2 border-dashed border-[#cfc7b9] pl-2">
          {management.tracks.map((track) => {
            const milestone = track.milestoneId ? management.milestones.find((item) => item.id === track.milestoneId) : undefined;
            const isBlocked = milestone?.isBlocked ?? track.status === "blocked";
            const isOverdue = milestone?.isOverdue ?? false;
            const rustEdge = isBlocked || isOverdue;
            const dateCertainty = milestone?.dateCertainty ?? track.dateCertainty;
            const confidenceUnknown = (milestone?.confidence ?? track.confidence) === "unknown";
            const selected = selectedTrack === track.key;
            const deltaDays = track.deltaDays;
            const deltaLabel = deltaDays == null ? "未算定" : deltaDays > 0 ? `予定より+${deltaDays}日` : deltaDays < 0 ? `${Math.abs(deltaDays)}日前倒し` : "予定通り";
            return (
              <div key={track.key} className={`relative rounded-lg border p-2.5 transition sm:p-3 ${rustEdge ? "border-[#b5533f] bg-[#fdf1ee]" : selected ? "border-[#38745d] bg-[#f1f6f2]" : "border-[#d9d2c3] bg-white/70"}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-controls="selected-management-context"
                    onClick={() => onSelectTrack(selected ? null : track.key)}
                    className="flex min-h-11 min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] sm:w-[168px] sm:shrink-0"
                  >
                    <span className="h-6 w-1.5 shrink-0 rounded-full" style={{ background: track.accent }} aria-hidden="true" />
                    <SxStatusIcon status={track.status} blocked={rustEdge} className={`h-4 w-4 shrink-0 ${rustEdge ? "text-[#8c3329]" : "text-[#38745d]"}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-semibold text-[#777166]">{track.label}</span>
                      <span className="block truncate text-xs font-semibold text-[#24231f]">{track.gate}</span>
                    </span>
                  </button>

                  <div className="min-w-0 flex-1 sm:max-w-[200px]">
                    <div className="relative h-6">
                      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[#d9d2c3]" aria-hidden="true" />
                      {track.plannedEnd && <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: "50%" }} title={`予定 ${sxFormatDate(track.plannedEnd)}`}><SxTickMark tone={rustEdge ? "#8c3329" : "#3d382c"} /></span>}
                      {track.forecastEnd && (
                        <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `calc(50% + ${clampDeltaOffset(deltaDays)}px)` }} title={`予測 ${sxFormatDate(track.forecastEnd)}`}>
                          <SxDiamondMark tone={rustEdge ? "#8c3329" : "#3d382c"} dashed={dateCertainty === "provisional"} hollow={confidenceUnknown} className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {!track.plannedEnd && !track.forecastEnd && <span className="absolute inset-0 grid place-items-center text-[9px] text-[#765022]">日程未確認</span>}
                    </div>
                    <p className="mt-0.5 truncate text-center text-[9px] text-[#777166]">{deltaLabel}</p>
                  </div>

                  <div className="min-w-0 text-[11px] leading-4 sm:w-[210px] sm:shrink-0">
                    <p className={`truncate ${track.ownerLabel.includes("未確認") ? "font-semibold text-[#765022]" : "text-[#514e47]"}`}>担当 {track.ownerLabel}</p>
                    <p className="truncate text-[#24231f]">次: {sxDisplayText(track.nextDeliverable)}</p>
                    <p className="truncate text-[#514e47]">論点: {sxDisplayText(track.maxIssue)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-1 flex items-center gap-3 rounded-xl border-2 border-[#3d382c]/60 bg-[#faf7ef] px-3 py-2.5 sm:px-4">
          <FlaskConical className="h-6 w-6 shrink-0 text-[#3d382c]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[9px] font-semibold tracking-[0.14em] text-[#777166]">設立判断ゲート</p>
            <p className="mt-0.5 text-sm font-semibold text-[#24231f]">
              {sxFormatDate(objective?.targetDate)} <SxBadge tone={gateConfirmed ? "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]" : "border-[#c9bfd0] bg-[#f1edf3] text-[#5f4a66]"}>{gateConfirmed ? "確定" : "仮置き"}</SxBadge> <span className="text-[10px] font-normal text-[#777166]">確度 {sxConfidenceLabel(objective?.confidence)}</span>
            </p>
            <p className="mt-1 truncate text-[11px] text-[#69665d]">{objective?.definitionOfDone || "完了条件未確認"}</p>
            <p className="mt-1 text-[10px] font-semibold text-[#5f4a66]">ここで Go／条件付きGo／No-Go を決める</p>
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[#777166]">
          <span className="inline-flex items-center gap-1"><SxTickMark />予定</span>
          <span className="inline-flex items-center gap-1"><SxDiamondMark />予測（確定）</span>
          <span className="inline-flex items-center gap-1"><SxDiamondMark dashed />仮置き日程</span>
          <span className="inline-flex items-center gap-1"><SxDiamondMark hollow />未確認</span>
          <span className="inline-flex items-center gap-1 text-[#8c3329]"><span className="inline-block h-2.5 w-2.5 rounded-sm border border-[#b5533f] bg-[#fdf1ee]" />停止・期限超過のみ縁を強調</span>
        </div>
      </figure>
    </div>
  );
}
