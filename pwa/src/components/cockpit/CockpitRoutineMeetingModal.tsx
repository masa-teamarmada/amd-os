"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { callEdgeFunctionGET } from "@/lib/supabase/edge-functions";

interface Props {
  projectId: string;
  ym: string;
  isDone: boolean;
  /** done時、action 内に "cpShowMeetingInfo('ISO')" 形式で日時が入る */
  doneAction?: string | null;
  open: boolean;
  onClose: () => void;
}

interface MeetingSlot {
  startISO: string;
  endISO: string;
  label: string;
}

function ymLabel(ym: string) {
  if (ym.length !== 6) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4))}月`;
}

/** "cpShowMeetingInfo('2026-04-10T01:00:00.000Z')" → "2026-04-10T01:00:00.000Z" */
function parseMeetingISO(action: string | null | undefined): string | null {
  if (!action) return null;
  const m = action.match(/\('([^']+)'\)/);
  return m?.[1] || null;
}

function formatMeetingDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const jstOffset = 9 * 60 * 60 * 1000;
  const jst = new Date(d.getTime() + jstOffset);
  const month = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  const wd = weekdays[jst.getUTCDay()];
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${month}月${day}日（${wd}）${hh}:${mm}`;
}

export function CockpitRoutineMeetingModal({ projectId, ym, isDone, doneAction, open, onClose }: Props) {
  const router = useRouter();
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slots, setSlots] = useState<MeetingSlot[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<MeetingSlot | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);
  // 予約直後に props の billingCycles 再 fetch を待たずに「予約完了」表示へ即時切替
  const [localConfirmedISO, setLocalConfirmedISO] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLocalConfirmedISO(null);
      return;
    }
    if (isDone) return;
    let cancelled = false;
    setLoadingSlots(true);
    setLoadError(null);
    setToast(null);

    (async () => {
      try {
        const result = await callEdgeFunctionGET<{ ok: boolean; slots?: MeetingSlot[]; message?: string }>(
          "meeting-slots",
          { projectId, ym }
        );
        if (cancelled) return;
        if (!result.ok) {
          setLoadError(result.message || "空き枠の取得に失敗しました");
          setSlots([]);
        } else {
          setSlots(result.slots || []);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
          setSlots([]);
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, projectId, ym, isDone]);

  async function confirmSchedule(slot: MeetingSlot) {
    setPendingSlot(null);
    setScheduling(true);
    setToast(null);
    try {
      const result = await callEdgeFunctionGET<{ ok: boolean; message?: string; meetingStartAt?: string }>(
        "schedule-meeting",
        {
          projectId,
          ym,
          startISO: slot.startISO,
          endISO: slot.endISO,
        }
      );
      if (result.ok) {
        setToast({ msg: result.message || "登録しました", isError: false });
        // 即時に「予約完了」UI に切り替え
        setLocalConfirmedISO(result.meetingStartAt || slot.startISO);
        // legacy modal: 報告会は廃止済み。誤って使われた場合も親データだけ再取得する。
        router.refresh();
      } else {
        setToast({ msg: result.message || "登録に失敗しました", isError: true });
      }
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setScheduling(false);
    }
  }

  const effectiveIsDone = isDone || !!localConfirmedISO;
  const confirmedISO = localConfirmedISO || (isDone ? parseMeetingISO(doneAction) : null);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>報告会は廃止済み</DialogTitle>
        </DialogHeader>

        {effectiveIsDone && (
          <div className="py-6 space-y-4 text-center">
            <div className="text-5xl">📅</div>
            {confirmedISO ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">この日時で予約完了</p>
                <p className="text-lg font-semibold">{formatMeetingDate(confirmedISO)}</p>
                <p className="text-xs text-muted-foreground">〜（30分）</p>
              </div>
            ) : (
              <p className="text-sm font-medium">報告会が確定済みです</p>
            )}
            <p className="text-xs text-muted-foreground">🌙 お疲れさま！</p>
          </div>
        )}

        {!effectiveIsDone && (
          <div className="space-y-3">
            <div className="text-sm">
              <p className="font-semibold">{ymLabel(ym)}の報告会日程を選択</p>
              <p className="text-xs text-muted-foreground">翌月第1週の空き枠（30分）</p>
            </div>

            {loadingSlots && <p className="text-sm text-muted-foreground py-6 text-center">空き枠を確認中...</p>}

            {loadError && (
              <div className="rounded-md bg-orange-50 border border-orange-200 p-3 space-y-2">
                <p className="text-xs text-orange-700">{loadError}</p>
              </div>
            )}

            {!loadingSlots && !loadError && slots.length === 0 && (
              <div className="py-6 text-center space-y-2">
                <p className="text-sm">翌月第1週に空き枠が見つかりませんでした</p>
                <p className="text-xs text-muted-foreground">直接カレンダーで日程を調整してください</p>
              </div>
            )}

            {!loadingSlots && !loadError && slots.length > 0 && (
              <div className="space-y-1">
                {slots.map((slot) => (
                  <button
                    key={slot.startISO}
                    type="button"
                    onClick={() => setPendingSlot(slot)}
                    disabled={scheduling}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/40 transition-colors text-left disabled:opacity-60"
                  >
                    <span className="text-base">📅</span>
                    <span className="flex-1 text-sm">{slot.label}</span>
                    <span className="text-xs text-muted-foreground">›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {toast && (
          <div
            className={`rounded-md px-3 py-2 text-xs mt-2 ${
              toast.isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {pendingSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-background rounded-xl p-4 w-full max-w-sm space-y-3 shadow-xl">
              <h3 className="font-semibold text-sm">「{pendingSlot.label}〜（30分）」で報告会を登録しますか？</h3>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setPendingSlot(null)} disabled={scheduling}>
                  キャンセル
                </Button>
                <Button size="sm" onClick={() => confirmSchedule(pendingSlot)} disabled={scheduling}>
                  {scheduling ? "登録中..." : "登録する"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
