"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadQuestionTree,
  mutateQuestionTree,
  peekQuestionTree,
} from "@/lib/question-tree-client";
import type { ActionNode, QuestionNode, QuestionTreeBundle } from "@/lib/question-tree-types";

/**
 * タスクタブ。PJのやることだけを一列に並べる。
 *
 * まさ 2026-09-12「ゴールツリーにすべてのタスクを書き込もうとするから違和感がある。
 * 『タスク』タブも新たに作って、そっちはタスクだけをリストアップする。
 * OSスイートで実装したものと同じ設計にしてほしい」。
 *
 * 設計の出どころは orchestration-board の「やること」
 * （Sources/OrchestrationBoard/Todo/TodoRootView.swift + TodoStore.swift）。
 * 中身をそのまま持ってきている:
 *
 *   - カード（角丸・枠線）を縦に並べる。上が未完了、下が完了
 *   - 右端の三本線を掴むと、長押しなしでその場で動く。掴んだカードは指に追従して
 *     少し浮き、入る場所は青い横線で示す。**ドラッグ中はリストの並びを凍結する**
 *     （動かすと、掴んでいる指の下のビューが動いて移動量を測り直し、毎フレーム
 *     往復して振動する。まさ報告 2026-09-09 と同じ罠なので同じ対策を採る）
 *   - 並べ替えの保存は、動かした1行の sort_order を「前後の中点」にするだけ。
 *     中点が潰れたときだけ全体を振り直す
 *   - チェックは丸。押した瞬間に完了へ移る
 *   - 緊急は炎マーク。カードの地色と枠がオレンジになる
 *   - 「…」に 編集 / 緊急 / 完了 / 削除
 *
 * データはゴールツリーと同じ束（project_actions 全部）。木にぶら下がっていない
 * やることも同じ列に出る。
 */

type Props = { projectId: string };

const ROW_GAP = 8;

function buildMilestoneIndex(roots: QuestionNode[]): Map<string, string> {
  const index = new Map<string, string>();
  const walk = (node: QuestionNode, milestone: string | null) => {
    const next = node.questionKind === "milestone" ? node.title : milestone;
    for (const action of node.actions) {
      if (next && !index.has(action.id)) index.set(action.id, next);
    }
    for (const child of node.children) walk(child, next);
  };
  for (const root of roots) walk(root, null);
  return index;
}

/** MSごとに色を振る。どのMSの仕事かを、読まずに色で拾えるようにする。 */
const BAND_COLORS = ["#027fdc", "#6d28d9", "#047857", "#d97706", "#be185d", "#0369a1"];
function bandColor(milestone: string | null, order: string[]): string {
  if (!milestone) return "transparent";
  const index = order.indexOf(milestone);
  return BAND_COLORS[(index < 0 ? 0 : index) % BAND_COLORS.length];
}

function fmtDate(value: string | null): string {
  if (!value) return "";
  return value.slice(2).replace(/-/g, "/");
}

/** 並べ替えの位置。まだ位置を持たない行は作成が新しいほど上（OSスイートと同じ）。 */
function orderKey(action: ActionNode): number {
  return action.sortOrder;
}

export function CockpitProjectTasks({ projectId }: Props) {
  const [bundle, setBundle] = useState<QuestionTreeBundle | null>(
    () => peekQuestionTree(projectId) ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftUrgent, setDraftUrgent] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ActionNode | null>(null);

  // ---- 並べ替え（掴んだ瞬間から指に付いてくる自前ドラッグ） -------------------
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  /** 掴んだ瞬間の並び。ドラッグ中はこれで描き続ける（動かすと振動する） */
  const frozenRef = useRef<ActionNode[]>([]);
  const startIndexRef = useRef<number | null>(null);
  const startYRef = useRef(0);
  const heightsRef = useRef(new Map<string, number>());

  const reload = useCallback(
    async (force = false) => {
      try {
        setBundle(await loadQuestionTree(projectId, { force }));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "読み込めなかったよ");
      }
    },
    [projectId],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const milestoneOf = useMemo(
    () => (bundle ? buildMilestoneIndex(bundle.roots) : new Map<string, string>()),
    [bundle],
  );
  const milestoneOrder = useMemo(
    () => [...new Set([...milestoneOf.values()])],
    [milestoneOf],
  );

  const liveOpen = useMemo(() => {
    const all = bundle?.allActions ?? [];
    return all
      .filter((action) => action.status !== "done" && action.status !== "dropped")
      .sort((a, b) => orderKey(a) - orderKey(b) || a.id.localeCompare(b.id));
  }, [bundle]);

  const done = useMemo(() => {
    const all = bundle?.allActions ?? [];
    return all
      .filter((action) => action.status === "done")
      .sort((a, b) => (b.actualEnd ?? "").localeCompare(a.actualEnd ?? ""));
  }, [bundle]);

  // ドラッグ中は掴んだ瞬間の並びのまま描く。
  const open = dragId ? frozenRef.current : liveOpen;
  const canManage = bundle?.canManage ?? false;

  const patch = useCallback(
    async (id: string, fields: Record<string, unknown>) => {
      setBusyId(id);
      setError(null);
      try {
        const payload = await mutateQuestionTree(projectId, "PATCH", {
          resource: "action",
          id,
          fields,
        });
        if (payload.bundle) setBundle(payload.bundle);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "保存できなかったよ");
      } finally {
        setBusyId(null);
      }
    },
    [projectId],
  );

  const heightOf = (action: ActionNode) => heightsRef.current.get(action.id) ?? 64;
  const slotY = (index: number, order: ActionNode[]) => {
    let y = 0;
    for (let i = 0; i < Math.max(0, Math.min(index, order.length)); i += 1) {
      y += heightOf(order[i]) + ROW_GAP;
    }
    return y;
  };

  // ドラッグ中の pointer は window で受ける。カード自身が動くので、
  // カードの上でイベントを取ると基準がずれる。
  useEffect(() => {
    if (!dragId) return;
    const onMove = (event: PointerEvent) => {
      const order = frozenRef.current;
      const start = startIndexRef.current;
      if (start === null || order.length === 0) return;
      const translation = event.clientY - startYRef.current;
      setDragY(translation);
      const moved = order[start];
      const center = slotY(start, order) + translation + heightOf(moved) / 2;
      let slot = order.length;
      let y = 0;
      for (let i = 0; i < order.length; i += 1) {
        const bottom = y + heightOf(order[i]) + ROW_GAP;
        if (center < bottom) {
          slot = i;
          break;
        }
        y = bottom;
      }
      setDragSlot(slot);
    };
    const onUp = () => {
      const order = frozenRef.current;
      const start = startIndexRef.current;
      const slot = dragSlot;
      const movedId = dragId;
      setDragId(null);
      setDragY(0);
      setDragSlot(null);
      startIndexRef.current = null;
      if (start === null || slot === null || !movedId) return;
      const target = slot > start ? slot - 1 : slot;
      if (target === start) return;
      // 動かした1行だけ、前後の中点へ書く（OSスイートと同じ）。
      const rest = order.filter((action) => action.id !== movedId);
      const above = target > 0 ? orderKey(rest[target - 1]) : null;
      const below = target < rest.length ? orderKey(rest[target]) : null;
      let next: number;
      if (above === null && below === null) next = 0;
      else if (above === null) next = (below as number) - 1;
      else if (below === null) next = above + 1;
      else {
        const mid = (above + below) / 2;
        // 中点が潰れたときだけ全体を振り直す。1件ずつ投げると並びが途中で見えるので、
        // まとめて1回で確定する。
        if (!(mid > above && mid < below)) {
          const renumbered = [...rest];
          renumbered.splice(target, 0, order[start]);
          void (async () => {
            setBusyId(movedId);
            try {
              const payload = await mutateQuestionTree(projectId, "PATCH", {
                resource: "action_reorder",
                ordered_ids: renumbered.map((action) => action.id),
              });
              if (payload.bundle) setBundle(payload.bundle);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "並べ替えを保存できなかったよ");
            } finally {
              setBusyId(null);
            }
          })();
          return;
        }
        next = mid;
      }
      void patch(movedId, { sort_order: next });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragId, dragSlot, patch]);

  const toggleDone = (action: ActionNode) =>
    patch(
      action.id,
      action.status === "done"
        ? { status: "not_started", actual_end: null }
        : { status: "done", actual_end: new Date().toISOString().slice(0, 10) },
    );

  const addTask = async () => {
    const title = draft.trim();
    if (!title) return;
    setBusyId("new");
    setError(null);
    try {
      // 新しいものは先頭へ（OSスイートと同じく、いま書いたものが上に来る）。
      const top = liveOpen.length > 0 ? orderKey(liveOpen[0]) : 0;
      const payload = await mutateQuestionTree(projectId, "POST", {
        resource: "action",
        fields: { title, action_kind: "work", urgent: draftUrgent, sort_order: top - 1 },
      });
      if (payload.bundle) setBundle(payload.bundle);
      setDraft("");
      setDraftUrgent(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "追加できなかったよ");
    } finally {
      setBusyId(null);
    }
  };

  const card = (action: ActionNode, index: number, draggable: boolean) => {
    const milestone = milestoneOf.get(action.id) ?? null;
    const isDone = action.status === "done";
    const isDragging = dragId === action.id;
    const urgent = action.urgent && !isDone;
    const owner =
      action.owners.length > 0
        ? action.owners.map((o) => o.displayName).join("・")
        : action.ownerLabel;
    return (
      <div
        key={action.id}
        ref={(element) => {
          if (element) heightsRef.current.set(action.id, element.offsetHeight);
        }}
        className={`relative flex items-start gap-3 rounded-xl border px-[14px] py-3 ${
          urgent ? "border-[#fdba74] bg-[#fff7ed]" : "border-[#e5e5e7] bg-white"
        } ${isDone ? "opacity-60" : ""} ${isDragging ? "z-10 border-[#027fdc] shadow-lg" : ""}`}
        style={
          isDragging
            ? { transform: `translateY(${dragY}px) scale(1.02)`, transition: "none" }
            : undefined
        }
      >
        <button
          type="button"
          disabled={!canManage || busyId === action.id}
          aria-label={isDone ? `${action.title} を未完了に戻す` : `${action.title} を完了にする`}
          className={`mt-[1px] grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full border-[1.5px] text-[12px] ${
            isDone
              ? "border-[#027fdc] bg-[#027fdc] text-white"
              : "border-[#c9c9d1] text-transparent hover:border-[#027fdc]"
          }`}
          onClick={() => void toggleDone(action)}
        >
          ✓
        </button>

        {/* MSごとの色帯。どの枝の仕事かを読まずに拾えるようにする */}
        <span
          className="mt-[2px] w-[3px] shrink-0 self-stretch rounded-full"
          style={{ background: bandColor(milestone, milestoneOrder) }}
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-[6px] gap-y-1">
            {urgent && <span className="text-[13px] leading-none text-[#ea580c]">🔥</span>}
            <span
              className={`text-[13px] ${isDone ? "text-[#86868b] line-through" : "text-[#1d1d1f]"}`}
            >
              {action.title}
            </span>
          </div>
          {action.detail && (
            <p className="mt-[3px] line-clamp-2 text-[11px] text-[#86868b]">{action.detail}</p>
          )}
          <div className="mt-[5px] flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#86868b]">
            {milestone ? (
              <span className="rounded bg-[#f0f0f2] px-[6px] py-[1px] text-[10px] text-[#3c3c43]">
                {milestone}
              </span>
            ) : (
              <span className="rounded border border-dashed border-[#d2d2d7] px-[6px] py-[1px] text-[10px]">
                ツリー外
              </span>
            )}
            {owner && <span>{owner}</span>}
            {isDone
              ? action.actualEnd && <span>完了 {fmtDate(action.actualEnd)}</span>
              : action.plannedEnd && (
                  <span className={action.isOverdue ? "font-bold text-[#dc2626]" : ""}>
                    {fmtDate(action.plannedEnd)}
                  </span>
                )}
          </div>
        </div>

        {canManage && (
          <div className="relative shrink-0">
            <button
              type="button"
              aria-label={`${action.title} の操作`}
              className="h-[26px] w-[30px] text-[15px] font-bold text-[#86868b] hover:text-[#1d1d1f]"
              onClick={() => setMenuId(menuId === action.id ? null : action.id)}
            >
              …
            </button>
            {menuId === action.id && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuId(null)} />
                <div className="absolute right-0 top-[26px] z-30 w-[150px] overflow-hidden rounded-lg border border-[#e5e5e7] bg-white py-1 shadow-lg">
                  {[
                    { label: "編集", run: () => setEditing(action) },
                    {
                      label: action.urgent ? "緊急を外す" : "緊急にする",
                      run: () => void patch(action.id, { urgent: !action.urgent }),
                    },
                    {
                      label: isDone ? "未完了に戻す" : "完了にする",
                      run: () => void toggleDone(action),
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="block w-full px-3 py-[6px] text-left text-[12px] hover:bg-[#f5f5f7]"
                      onClick={() => {
                        setMenuId(null);
                        item.run();
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                  <div className="my-1 border-t border-[#f0f0f2]" />
                  <button
                    type="button"
                    className="block w-full px-3 py-[6px] text-left text-[12px] text-[#991b1b] hover:bg-[#fee2e2]"
                    onClick={() => {
                      setMenuId(null);
                      void (async () => {
                        setBusyId(action.id);
                        try {
                          const payload = await mutateQuestionTree(projectId, "DELETE", {
                            resource: "action",
                            id: action.id,
                          });
                          if (payload.bundle) setBundle(payload.bundle);
                        } catch (caught) {
                          setError(caught instanceof Error ? caught.message : "消せなかったよ");
                        } finally {
                          setBusyId(null);
                        }
                      })();
                    }}
                  >
                    削除
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 掴みしろ。長押しなしでその場から動く。 */}
        {draggable && canManage && (
          <span
            role="button"
            tabIndex={0}
            aria-label={`${action.title} を並べ替える`}
            className={`-my-3 flex w-[30px] shrink-0 cursor-grab touch-none select-none items-center justify-center self-stretch text-[13px] ${
              isDragging ? "cursor-grabbing text-[#027fdc]" : "text-[#c9c9d1] hover:text-[#86868b]"
            }`}
            onPointerDown={(event) => {
              event.preventDefault();
              frozenRef.current = liveOpen;
              startIndexRef.current = index;
              startYRef.current = event.clientY;
              setDragId(action.id);
              setDragY(0);
              setDragSlot(index);
            }}
          >
            ☰
          </span>
        )}
      </div>
    );
  };

  if (!bundle) {
    return (
      <section className="rounded-xl border border-[#e5e5e7] bg-white px-4 py-3">
        <p className="text-[12px] text-[#86868b]">
          {error ? `タスクを読み込めなかったよ（${error}）` : "読み込み中…"}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-[860px] flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[19px] font-bold text-[#1d1d1f]">タスク</h2>
        <span className="text-[12px] font-medium text-[#86868b]">未完了 {liveOpen.length}</span>
      </div>

      {canManage && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded-xl border border-[#e5e5e7] bg-white px-[14px] py-[10px] text-[13px] outline-none focus:border-[#7cbceb]"
              placeholder="新しいタスク"
              value={draft}
              disabled={busyId === "new"}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addTask();
                }
              }}
            />
            <button
              type="button"
              className="shrink-0 rounded-lg bg-[#027fdc] px-4 py-[9px] text-[13px] font-bold text-white disabled:opacity-40"
              disabled={!draft.trim() || busyId === "new"}
              onClick={() => void addTask()}
            >
              追加
            </button>
          </div>
          <button
            type="button"
            className={`self-start rounded-full px-[10px] py-[4px] text-[11px] font-bold ${
              draftUrgent ? "bg-[#ffedd5] text-[#ea580c]" : "bg-[#f0f0f2] text-[#86868b]"
            }`}
            onClick={() => setDraftUrgent((value) => !value)}
          >
            🔥 緊急
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-[#fee2e2] px-3 py-2 text-[11px] text-[#991b1b]">{error}</p>
      )}

      <div className="relative flex flex-col" style={{ gap: ROW_GAP }}>
        {open.length === 0 ? (
          <p className="py-3 text-[12px] text-[#86868b]">未完了はありません</p>
        ) : (
          open.map((action, index) => card(action, index, true))
        )}
        {/* 入る場所。レイアウトに影響させないよう重ねて描く */}
        {dragId && dragSlot !== null && (
          <span
            className="pointer-events-none absolute left-0 right-0 z-20 h-[3px] rounded-full bg-[#027fdc]"
            style={{
              top:
                dragSlot >= open.length
                  ? slotY(open.length, open) - ROW_GAP
                  : slotY(dragSlot, open) - ROW_GAP / 2,
            }}
          />
        )}
      </div>

      {open.length > 0 && canManage && (
        <p className="text-[10px] text-[#86868b]">右端の三本線を掴むと、その場で動かせる</p>
      )}

      {done.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="flex items-baseline gap-2 self-start"
            onClick={() => setShowDone((value) => !value)}
          >
            <span
              className={`text-[10px] text-[#86868b] transition-transform ${showDone ? "rotate-90" : ""}`}
            >
              ▶
            </span>
            <span className="text-[14px] font-bold text-[#1d1d1f]">完了</span>
            <span className="text-[12px] text-[#86868b]">{done.length}</span>
          </button>
          {showDone && (
            <div className="flex flex-col" style={{ gap: ROW_GAP }}>
              {done.map((action, index) => card(action, index, false))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <TaskEditDialog
          action={editing}
          busy={busyId === editing.id}
          onClose={() => setEditing(null)}
          onSave={async (fields) => {
            await patch(editing.id, fields);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

/** 編集。タイトル・メモ・期限・緊急だけ。細かい欄はゴールツリー側の詳細で触る。 */
function TaskEditDialog({
  action,
  busy,
  onClose,
  onSave,
}: {
  action: ActionNode;
  busy: boolean;
  onClose: () => void;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState(action.title);
  const [detail, setDetail] = useState(action.detail ?? "");
  const [plannedEnd, setPlannedEnd] = useState(action.plannedEnd ?? "");
  const [urgent, setUrgent] = useState(action.urgent);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="mb-3 text-[14px] font-bold text-[#1d1d1f]">タスクを編集</h3>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[11px] font-bold text-[#86868b]">
            タスク
            <input
              className="rounded-lg border border-[#d2d2d7] px-3 py-2 text-[13px] font-normal text-[#1d1d1f]"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-[#86868b]">
            メモ
            <textarea
              className="min-h-[64px] rounded-lg border border-[#d2d2d7] px-3 py-2 text-[13px] font-normal text-[#1d1d1f]"
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-[#86868b]">
            期限
            <input
              type="date"
              className="rounded-lg border border-[#d2d2d7] px-3 py-2 text-[13px] font-normal text-[#1d1d1f]"
              value={plannedEnd}
              onChange={(event) => setPlannedEnd(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={`self-start rounded-full px-[10px] py-[4px] text-[11px] font-bold ${
              urgent ? "bg-[#ffedd5] text-[#ea580c]" : "bg-[#f0f0f2] text-[#86868b]"
            }`}
            onClick={() => setUrgent((value) => !value)}
          >
            🔥 緊急
          </button>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-[#d2d2d7] px-3 py-2 text-[12px] text-[#3c3c43]"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="rounded-lg bg-[#027fdc] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-40"
            disabled={!title.trim() || busy}
            onClick={() =>
              void onSave({
                title: title.trim(),
                detail: detail.trim() || null,
                planned_end: plannedEnd || null,
                urgent,
              })
            }
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
