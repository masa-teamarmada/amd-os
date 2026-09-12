"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
 * 『タスク』タブも新たに作って、そっちはタスクだけをリストアップする。多くはゴールツリーの
 * 中に入ったタスクだろうし、でも一部はゴールツリーにないものも含まれる。
 * OSスイートで実装したものと同じ設計にしてほしい」。
 *
 * 設計の出どころは orchestration-board の「やること」（`Todo/TodoRootView.swift`、
 * 正本 masa/ORCHESTRATION_APP_DESIGN.md）。同じ形にそろえた:
 *   - 上が未完了、下が完了（完了の新しい順）
 *   - チェックを押した瞬間に完了へ移る
 *   - 緊急はオレンジ。未完了の中で先頭に出す
 *   - 行はタイトル＋補足＋分類バッジ（あちらはPJ区分、ここでは所属MS）
 *   - 上の入力欄でその場で足せる
 *
 * データはゴールツリーと同じ束（project_actions 全部）。木にぶら下がっていない
 * やることも同じ列に出るので、「ツリー外」として見える。
 */

type Props = { projectId: string };

/** 木を歩いて、そのやることがどのMSの下にいるかを引けるようにする。 */
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

function fmtDate(value: string | null): string {
  if (!value) return "";
  return value.slice(2).replace(/-/g, "/");
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

  const { open, done } = useMemo(() => {
    const all = bundle?.allActions ?? [];
    // 上が未完了。緊急を先頭、次に期限の近い順、期限なしは後ろ。
    const openItems = all
      .filter((action) => action.status !== "done" && action.status !== "dropped")
      .sort((a, b) => {
        if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
        const ad = a.plannedEnd ?? "9999-99-99";
        const bd = b.plannedEnd ?? "9999-99-99";
        if (ad !== bd) return ad.localeCompare(bd);
        return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "ja");
      });
    // 下が完了。終わった順の新しいものから。
    const doneItems = all
      .filter((action) => action.status === "done")
      .sort((a, b) => (b.actualEnd ?? "").localeCompare(a.actualEnd ?? ""));
    return { open: openItems, done: doneItems };
  }, [bundle]);

  const canManage = bundle?.canManage ?? false;

  const patch = useCallback(
    async (action: ActionNode, fields: Record<string, unknown>) => {
      setBusyId(action.id);
      setError(null);
      try {
        const payload = await mutateQuestionTree(projectId, "PATCH", {
          resource: "action",
          id: action.id,
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

  const toggleDone = (action: ActionNode) =>
    patch(
      action,
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
      const payload = await mutateQuestionTree(projectId, "POST", {
        resource: "action",
        fields: { title, action_kind: "work", urgent: draftUrgent },
      });
      if (payload.bundle) setBundle(payload.bundle);
      setDraft("");
      setDraftUrgent(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "足せなかったよ");
    } finally {
      setBusyId(null);
    }
  };

  const row = (action: ActionNode) => {
    const milestone = milestoneOf.get(action.id);
    const isDone = action.status === "done";
    const owner =
      action.owners.length > 0
        ? action.owners.map((o) => o.displayName).join("・")
        : action.ownerLabel;
    return (
      <div
        key={action.id}
        className={`flex items-start gap-2 border-t border-[#f0f0f2] px-3 py-[6px] ${
          action.urgent && !isDone ? "bg-[#fff7ed]" : ""
        }`}
      >
        <button
          type="button"
          disabled={!canManage || busyId === action.id}
          aria-label={isDone ? `${action.title} を未完了に戻す` : `${action.title} を完了にする`}
          className={`mt-[2px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border text-[11px] ${
            isDone
              ? "border-[#047857] bg-[#047857] text-white"
              : "border-[#c9c9d1] text-transparent hover:border-[#027fdc]"
          }`}
          onClick={() => void toggleDone(action)}
        >
          ✓
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-[2px]">
            {action.urgent && !isDone && (
              <span className="text-[11px] font-bold text-[#d97706]">緊急</span>
            )}
            <span className={`text-[12px] ${isDone ? "text-[#86868b] line-through" : "text-[#1d1d1f]"}`}>
              {action.title}
            </span>
            {milestone ? (
              <span className="rounded bg-[#f0f0f2] px-[5px] py-[1px] text-[10px] text-[#3c3c43]">
                {milestone}
              </span>
            ) : (
              <span className="rounded border border-dashed border-[#d2d2d7] px-[5px] py-[1px] text-[10px] text-[#86868b]">
                ツリー外
              </span>
            )}
          </div>
          {action.detail && (
            <p className="mt-[1px] truncate text-[11px] text-[#86868b]">{action.detail}</p>
          )}
        </div>
        <span className="shrink-0 text-[11px] text-[#86868b]">{owner}</span>
        <span
          className={`w-[52px] shrink-0 text-right text-[11px] tabular-nums ${
            action.isOverdue ? "text-[#dc2626]" : "text-[#86868b]"
          }`}
        >
          {isDone ? fmtDate(action.actualEnd) : action.plannedEnd ? fmtDate(action.plannedEnd) : "—"}
        </span>
        {canManage && (
          <button
            type="button"
            disabled={busyId === action.id}
            aria-label={action.urgent ? "緊急を外す" : "緊急にする"}
            title={action.urgent ? "緊急を外す" : "緊急にする"}
            className={`shrink-0 text-[13px] ${action.urgent ? "text-[#d97706]" : "text-[#d2d2d7] hover:text-[#d97706]"}`}
            onClick={() => void patch(action, { urgent: !action.urgent })}
          >
            ●
          </button>
        )}
      </div>
    );
  };

  if (!bundle) {
    return (
      <section className="rounded-xl border border-[#e5e5e7] bg-white px-4 py-3">
        <p className="text-[12px] text-[#86868b]">
          {error ? `タスクを読み込めなかったよ（${error}）` : "タスクを読み込んでいる…"}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#e5e5e7] bg-white">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[#e5e5e7] px-4 py-3">
        <h2 className="text-[13px] font-bold text-[#1d1d1f]">タスク</h2>
        <p className="text-[11px] text-[#86868b]">
          このPJのやることを一列で。ゴールツリーに入っていないものも並ぶ
        </p>
        <span className="ml-auto flex gap-3 text-[11px] text-[#86868b]">
          <span>
            未完了 <b className="text-[13px] tabular-nums text-[#1d1d1f]">{open.length}</b>
          </span>
          <span>
            緊急{" "}
            <b className="text-[13px] tabular-nums text-[#d97706]">
              {open.filter((a) => a.urgent).length}
            </b>
          </span>
          <span>
            期限超過{" "}
            <b className="text-[13px] tabular-nums text-[#dc2626]">
              {open.filter((a) => a.isOverdue).length}
            </b>
          </span>
        </span>
      </div>

      {canManage && (
        <div className="flex items-center gap-2 border-b border-[#e5e5e7] px-3 py-2">
          <input
            className="min-w-0 flex-1 rounded border border-[#d2d2d7] px-2 py-[5px] text-[12px]"
            placeholder="やることを足す"
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
            className={`shrink-0 rounded border px-2 py-[5px] text-[11px] ${
              draftUrgent
                ? "border-[#d97706] bg-[#fff7ed] text-[#d97706]"
                : "border-[#d2d2d7] text-[#86868b]"
            }`}
            onClick={() => setDraftUrgent((value) => !value)}
          >
            緊急
          </button>
          <button
            type="button"
            className="shrink-0 rounded border border-[#027fdc] bg-[#027fdc] px-3 py-[5px] text-[11px] font-bold text-white disabled:opacity-50"
            disabled={!draft.trim() || busyId === "new"}
            onClick={() => void addTask()}
          >
            足す
          </button>
        </div>
      )}

      {error && (
        <p className="border-b border-[#e5e5e7] px-4 py-2 text-[11px] text-[#991b1b]">{error}</p>
      )}

      {open.length === 0 ? (
        <p className="px-4 py-3 text-[12px] text-[#86868b]">未完了のタスクはありません。</p>
      ) : (
        <div>{open.map(row)}</div>
      )}

      {done.length > 0 && (
        <div className="border-t border-[#e5e5e7]">
          <button
            type="button"
            className="flex w-full items-baseline gap-2 px-4 py-2 text-left hover:bg-[#fafafa]"
            onClick={() => setShowDone((value) => !value)}
          >
            <span
              className={`text-[10px] text-[#86868b] transition-transform ${showDone ? "rotate-90" : ""}`}
            >
              ▶
            </span>
            <span className="text-[12px] font-bold text-[#1d1d1f]">完了</span>
            <span className="text-[11px] tabular-nums text-[#86868b]">{done.length}</span>
          </button>
          {showDone && <div>{done.map(row)}</div>}
        </div>
      )}
    </section>
  );
}
