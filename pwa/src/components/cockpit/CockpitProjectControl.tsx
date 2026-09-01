"use client";

/**
 * PJコックピットの管制タブ（週次差分 / ガント / 関係先 / 論点・仮説）。
 *
 * 2026-08-28 まさ「コックピットとワークスペースを統合できそうじゃない？」→
 * 「コックピット側を12タブにしよう」。PJワークスペースの4タブを、同じ
 * `SxWeeklyControlDashboard` を埋め込みモードで使って取り込む。表示・編集の中身は
 * ワークスペースと完全に同じで、タブ列だけコックピット側が持つ。
 *
 * 外向けの `/project/[projectId]/workspace` は別ルートのまま残す。
 * あちらは大学・SU の workspace_account も入る面なので、
 * 「AMD内部前提で組み立てた面」をそこへ寄せない（`workspace-bundle` route の注記が正本）。
 *
 * 束は可変系（週次の差分・関係先の状況・論点の判断）なのでキャッシュしない。
 * 4タブが1つのマウントを共有するので、タブを行き来しても読み直さない。
 */

import { useEffect, useState } from "react";
import {
  SxWeeklyControlDashboard,
  type SxWeeklyControlView,
} from "@/components/project-workspace/SxWeeklyControlDashboard";
import type { CurrentMemberAccess, ProjectWorkspaceBundle } from "@/lib/project-workspace";

// PJを切り替えた瞬間に前のPJの束を出さないよう、state 自身が projectId を持つ。
// (effect の先頭で loading へ戻すと、描画中の setState になる)
type LoadState =
  | { status: "loading"; projectId: string }
  | { status: "ready"; projectId: string; bundle: ProjectWorkspaceBundle; viewer: CurrentMemberAccess }
  | { status: "error"; projectId: string; message: string };

export function CockpitProjectControl({
  projectId,
  view,
  ganttDisplayMode,
  onViewChange,
}: {
  projectId: string;
  view: SxWeeklyControlView;
  /** コックピットの独立タブからガント内の表示モードを固定する。 */
  ganttDisplayMode?: "timeline" | "objective";
  onViewChange?: (view: SxWeeklyControlView) => void;
}) {
  const [loadState, setState] = useState<LoadState>(() => ({ status: "loading", projectId }));

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/project/${encodeURIComponent(projectId)}/workspace-bundle`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; bundle: ProjectWorkspaceBundle; viewer: CurrentMemberAccess }
          | { ok: false; error?: string }
          | null;
        if (cancelled) return;
        if (!response.ok || !payload || !payload.ok) {
          setState({
            status: "error",
            projectId,
            message: payload && "error" in payload && payload.error ? payload.error : "PJ管制データの取得に失敗",
          });
          return;
        }
        setState({ status: "ready", projectId, bundle: payload.bundle, viewer: payload.viewer });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", projectId, message: "PJ管制データの取得に失敗" });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const state: LoadState = loadState.projectId === projectId ? loadState : { status: "loading", projectId };

  if (state.status === "loading") {
    return (
      <div className="grid min-h-24 place-items-center rounded-xl border border-[#e5e5e7] bg-white text-[11px] text-muted-foreground">
        PJ管制を読み込み中…
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-[11px] text-red-800">{state.message}</div>
    );
  }

  return (
    <SxWeeklyControlDashboard
      bundle={state.bundle}
      access={state.viewer}
      view={view}
      ganttDisplayMode={ganttDisplayMode}
      embedded
      onViewChange={onViewChange}
    />
  );
}
