"use client";

import type { CSSProperties, ReactNode } from "react";
import type {
  SxManagementBundle,
  SxManagementPartner,
  SxOutcome,
  SxTask,
  SxTrackKey,
} from "@/lib/sx-management";
import styles from "./sx-objective-map.module.css";

const TASK_STATUS_LABEL: Record<SxTask["status"], string> = {
  not_started: "未着手",
  unassessed: "進捗未登録",
  on_track: "進行中",
  attention: "要確認",
  at_risk: "遅れ懸念",
  blocked: "停止",
  completed: "完了",
};

function partnerStateLabel(partner: SxManagementPartner): string {
  if (partner.activityState === "on_hold") return "一旦停止";
  if (partner.activityState === "dropped") return "終了";
  if (partner.currentBallSide === "sx") return "AMD側ボール";
  if (partner.currentBallSide === "partner") return "先方ボール";
  if (partner.currentBallSide === "shared") return "双方で対応";
  if (partner.activityState === "stalled") return "停滞";
  return "現在地を確認";
}

function partnerBelongsToOutcome(
  partner: SxManagementPartner,
  outcome: SxOutcome,
  outcomeMilestoneSlugs: Set<string>,
  outcomesInTrack: number,
): boolean {
  if (
    partner.relatedMilestoneSlugs.some((slug) =>
      outcomeMilestoneSlugs.has(slug),
    )
  )
    return true;
  if (outcomesInTrack !== 1) return false;
  return (
    partner.track === outcome.track ||
    partner.tracks.some((track) => track.track === outcome.track)
  );
}

function sortTasks(left: SxTask, right: SxTask): number {
  return (
    left.sortOrder - right.sortOrder ||
    left.title.localeCompare(right.title, "ja")
  );
}

export function SxObjectiveMap({
  management,
  activeTrack = null,
  onOpenTask,
  onOpenPartners,
}: {
  management: SxManagementBundle;
  activeTrack?: SxTrackKey | null;
  onOpenTask?: (task: SxTask) => void;
  onOpenPartners?: (track: SxTrackKey) => void;
}) {
  const outcomes = management.outcomes.filter(
    (outcome) => !activeTrack || outcome.track === activeTrack,
  );
  const trackLabel = activeTrack
    ? (management.tracks.find((track) => track.key === activeTrack)?.label ??
      activeTrack)
    : null;

  if (!management.objective || outcomes.length === 0) {
    return (
      <div className={styles.empty}>
        <strong>{trackLabel ? `${trackLabel}の目的構造` : "目的構造"}</strong>
        <span>
          目的と成立条件がまだ登録されていないよ。ガントの工程はそのまま見られる。
        </span>
      </div>
    );
  }

  return (
    <div className={styles.map} data-testid="sx-objective-map">
      <section className={styles.objective} aria-label="最上位の目的">
        <span>最上位の目的</span>
        <h3>{management.objective.title}</h3>
        <p>{management.objective.definitionOfDone}</p>
        <div>
          <small>成立条件 {outcomes.length}</small>
          {trackLabel && <small>{trackLabel}</small>}
        </div>
      </section>

      <div
        className={styles.branchGrid}
        style={{ "--branch-count": outcomes.length } as CSSProperties}
        aria-label="目的を成立させる枝"
      >
        {outcomes.map((outcome) => {
          const milestones = management.milestones
            .filter((milestone) => milestone.outcomeId === outcome.id)
            .sort((left, right) => left.title.localeCompare(right.title, "ja"));
          const milestoneIds = new Set(
            milestones.map((milestone) => milestone.id),
          );
          const milestoneSlugs = new Set(
            milestones.map((milestone) => milestone.slug),
          );
          const tasks = management.tasks.filter((task) =>
            task.milestoneId
              ? milestoneIds.has(task.milestoneId)
              : task.track === outcome.track,
          );
          const taskIds = new Set(tasks.map((task) => task.id));
          const roots = tasks
            .filter(
              (task) => !task.parentTaskId || !taskIds.has(task.parentTaskId),
            )
            .sort(sortTasks);
          const childMap = new Map<string, SxTask[]>();
          tasks.forEach((task) => {
            if (!task.parentTaskId || !taskIds.has(task.parentTaskId)) return;
            const current = childMap.get(task.parentTaskId) ?? [];
            current.push(task);
            current.sort(sortTasks);
            childMap.set(task.parentTaskId, current);
          });
          const outcomesInTrack = management.outcomes.filter(
            (candidate) => candidate.track === outcome.track,
          ).length;
          const partners = management.partners.filter((partner) =>
            partnerBelongsToOutcome(
              partner,
              outcome,
              milestoneSlugs,
              outcomesInTrack,
            ),
          );
          const openCount = tasks.filter(
            (task) => task.status !== "completed",
          ).length;
          const completedCount = tasks.filter(
            (task) => task.status === "completed",
          ).length;

          const renderTask = (task: SxTask, depth: number): ReactNode => (
            <li key={task.id}>
              <button
                type="button"
                className={styles.taskRow}
                style={{ "--task-depth": depth } as CSSProperties}
                onClick={() => onOpenTask?.(task)}
              >
                <span className={styles.taskStatus} data-status={task.status}>
                  {TASK_STATUS_LABEL[task.status]}
                </span>
                <span className={styles.taskTitle}>{task.title}</span>
                <small>
                  {task.nextDeliverable || task.blocker || "次の行動 未確認"}
                </small>
              </button>
              {(childMap.get(task.id)?.length ?? 0) > 0 && (
                <ul className={styles.taskList}>
                  {childMap
                    .get(task.id)
                    ?.map((child) => renderTask(child, depth + 1))}
                </ul>
              )}
            </li>
          );

          return (
            <article key={outcome.id} className={styles.branch}>
              <header className={styles.branchHeader}>
                <span>成立条件</span>
                <h4>{outcome.title}</h4>
                <p>{outcome.definitionOfDone}</p>
                <div>
                  <small>進行中 {openCount}</small>
                  <small>完了 {completedCount}</small>
                  <small>関係先 {partners.length}</small>
                </div>
              </header>

              <div className={styles.branchBody}>
                <div className={styles.branchSection}>
                  <h5>やること</h5>
                  {roots.length > 0 ? (
                    <ul className={styles.taskList}>
                      {roots.map((task) => renderTask(task, 0))}
                    </ul>
                  ) : (
                    <p className={styles.missing}>工程未登録</p>
                  )}
                </div>

                {partners.length > 0 && (
                  <div className={styles.branchSection}>
                    <div className={styles.partnerHeading}>
                      <h5>関係先とボール</h5>
                      <button
                        type="button"
                        onClick={() => onOpenPartners?.(outcome.track)}
                      >
                        一覧で見る
                      </button>
                    </div>
                    <ul className={styles.partnerList}>
                      {partners.map((partner) => (
                        <li key={partner.id}>
                          <button
                            type="button"
                            onClick={() => onOpenPartners?.(outcome.track)}
                          >
                            <span>{partner.name}</span>
                            <strong data-state={partner.activityState}>
                              {partnerStateLabel(partner)}
                            </strong>
                            <small>
                              {partner.nextCommitment || "次の行動 未確認"}
                            </small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
