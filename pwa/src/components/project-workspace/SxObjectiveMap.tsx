"use client";

import { useMemo, useState, type DragEvent } from "react";
import type {
  SxManagementBundle,
  SxManagementPartner,
  SxOutcome,
  SxPartnerInteraction,
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

function sortInteractions(
  left: SxPartnerInteraction,
  right: SxPartnerInteraction,
): number {
  const leftDate = left.occurredOn || "0000-00-00";
  const rightDate = right.occurredOn || "0000-00-00";
  return (
    leftDate.localeCompare(rightDate) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.summary.localeCompare(right.summary, "ja")
  );
}

function taskHasDescendant(
  childMap: Map<string, SxTask[]>,
  taskId: string,
  candidateId: string,
): boolean {
  const stack = [...(childMap.get(taskId) ?? [])];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current.id)) continue;
    if (current.id === candidateId) return true;
    visited.add(current.id);
    stack.push(...(childMap.get(current.id) ?? []));
  }
  return false;
}

function interactionDate(interaction: SxPartnerInteraction): string {
  if (!interaction.occurredOn) return "日付未確認";
  const [year, month, day] = interaction.occurredOn.split("-");
  if (interaction.occurredOnPrecision === "month")
    return `${Number(year)}年${Number(month)}月`;
  return `${Number(month)}/${Number(day)}`;
}

type OutcomeTree = {
  outcome: SxOutcome;
  roots: SxTask[];
  childMap: Map<string, SxTask[]>;
  partners: SxManagementPartner[];
  unlinkedPartners: SxManagementPartner[];
  openCount: number;
  completedCount: number;
};

function PartnerHistory({
  partner,
  onOpen,
}: {
  partner: SxManagementPartner;
  onOpen?: () => void;
}) {
  const interactions = partner.interactions.slice().sort(sortInteractions);
  return (
    <div className={styles.partnerHistory}>
      <div className={styles.partnerHistoryHeader}>
        <span>接点の経緯</span>
        <strong data-state={partner.activityState}>
          {partnerStateLabel(partner)}
        </strong>
      </div>
      {interactions.length > 0 ? (
        <ol className={styles.eventSpine}>
          {interactions.map((interaction, index) => (
            <li
              key={interaction.id}
              data-current={index === interactions.length - 1 || undefined}
            >
              <time>{interactionDate(interaction)}</time>
              <strong>{interaction.summary}</strong>
              {interaction.outcomeSummary && (
                <p>{interaction.outcomeSummary}</p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.historyMissing}>接点の記録はまだ無い</p>
      )}
      <div className={styles.currentBall}>
        <span>現在</span>
        <strong>{partnerStateLabel(partner)}</strong>
        <p>{partner.nextCommitment || "次の行動 未確認"}</p>
        <button type="button" onClick={onOpen}>
          関係先で開く
        </button>
      </div>
    </div>
  );
}

function TaskNode({
  task,
  childMap,
  partnerById,
  allTasks,
  canManage,
  draggedTaskId,
  dropTargetTaskId,
  connectingTaskId,
  movingTaskId,
  onOpenTask,
  onOpenPartner,
  onCreateTask,
  onBeginConnect,
  onMoveTask,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  task: SxTask;
  childMap: Map<string, SxTask[]>;
  partnerById: Map<string, SxManagementPartner>;
  allTasks: SxTask[];
  canManage: boolean;
  draggedTaskId: string | null;
  dropTargetTaskId: string | null;
  connectingTaskId: string | null;
  movingTaskId: string | null;
  onOpenTask?: (task: SxTask) => void;
  onOpenPartner?: (partner: SxManagementPartner) => void;
  onCreateTask?: (parentTask: SxTask) => void;
  onBeginConnect: (taskId: string | null) => void;
  onMoveTask: (task: SxTask, parentTaskId: string | null) => void;
  onDragStart: (event: DragEvent<HTMLElement>, task: SxTask) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>, task: SxTask) => void;
  onDrop: (event: DragEvent<HTMLElement>, task: SxTask) => void;
}) {
  const children = childMap.get(task.id) ?? [];
  const partner = task.partnerId ? partnerById.get(task.partnerId) : null;
  const stateLabel = partner
    ? partnerStateLabel(partner)
    : TASK_STATUS_LABEL[task.status];
  const detail = task.description || task.goal || task.nextDeliverable;

  return (
    <li className={styles.treeBranch}>
      <article
        className={styles.treeNode}
        data-kind={partner ? "approach" : "task"}
        data-state={partner?.activityState || task.status}
        data-dragging={draggedTaskId === task.id || undefined}
        data-drop-target={dropTargetTaskId === task.id || undefined}
        draggable={canManage && movingTaskId !== task.id}
        onDragStart={(event) => onDragStart(event, task)}
        onDragEnd={onDragEnd}
        onDragOver={(event) => onDragOver(event, task)}
        onDrop={(event) => onDrop(event, task)}
      >
        <button
          type="button"
          className={styles.nodeMain}
          onClick={() => onOpenTask?.(task)}
        >
          <span className={styles.nodeKind}>
            {partner ? "アプローチ" : "やること"}
          </span>
          <strong className={styles.nodeTitle}>{task.title}</strong>
          {detail && <p>{detail}</p>}
          <span
            className={styles.nodeState}
            data-state={partner?.activityState || task.status}
          >
            {stateLabel}
          </span>
        </button>
        {canManage && (
          <div className={styles.nodeActions}>
            <span aria-hidden="true" title="ドラッグして接続先を変更">
              ⠿
            </span>
            <button type="button" onClick={() => onCreateTask?.(task)}>
              ＋ 子タスク
            </button>
            <button
              type="button"
              aria-expanded={connectingTaskId === task.id}
              onClick={() =>
                onBeginConnect(connectingTaskId === task.id ? null : task.id)
              }
            >
              接続変更
            </button>
          </div>
        )}
        {canManage && connectingTaskId === task.id && (
          <label className={styles.connectionEditor}>
            <span>このタスクの接続先</span>
            <select
              value={task.parentTaskId || ""}
              disabled={movingTaskId === task.id}
              onChange={(event) => onMoveTask(task, event.target.value || null)}
            >
              <option value="">成立条件の直下</option>
              {allTasks
                .filter(
                  (candidate) =>
                    candidate.id !== task.id &&
                    candidate.milestoneId === task.milestoneId &&
                    !taskHasDescendant(childMap, task.id, candidate.id),
                )
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </option>
                ))}
            </select>
          </label>
        )}
        {partner && (
          <PartnerHistory
            partner={partner}
            onOpen={() => onOpenPartner?.(partner)}
          />
        )}
      </article>
      {children.length > 0 && (
        <ul className={styles.treeChildren}>
          {children.map((child) => (
            <TaskNode
              key={child.id}
              task={child}
              childMap={childMap}
              partnerById={partnerById}
              allTasks={allTasks}
              canManage={canManage}
              draggedTaskId={draggedTaskId}
              dropTargetTaskId={dropTargetTaskId}
              connectingTaskId={connectingTaskId}
              movingTaskId={movingTaskId}
              onOpenTask={onOpenTask}
              onOpenPartner={onOpenPartner}
              onCreateTask={onCreateTask}
              onBeginConnect={onBeginConnect}
              onMoveTask={onMoveTask}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function PartnerNode({
  partner,
  onOpen,
}: {
  partner: SxManagementPartner;
  onOpen?: (partner: SxManagementPartner) => void;
}) {
  return (
    <li className={styles.treeBranch}>
      <article
        className={styles.treeNode}
        data-kind="approach"
        data-state={partner.activityState}
      >
        <div className={styles.nodeMain}>
          <span className={styles.nodeKind}>関係先</span>
          <strong className={styles.nodeTitle}>{partner.name}</strong>
          {partner.connectionContext && <p>{partner.connectionContext}</p>}
        </div>
        <PartnerHistory partner={partner} onOpen={() => onOpen?.(partner)} />
      </article>
    </li>
  );
}

export function SxObjectiveMap({
  management,
  activeTrack = null,
  canManage = false,
  onOpenTask,
  onOpenPartners,
  onCreateTask,
  onCreateOutcome,
  onEditOutcome,
  onMoveTask,
}: {
  management: SxManagementBundle;
  activeTrack?: SxTrackKey | null;
  canManage?: boolean;
  onOpenTask?: (task: SxTask) => void;
  onOpenPartners?: (track: SxTrackKey) => void;
  onCreateTask?: (outcome: SxOutcome, parentTask?: SxTask) => void;
  /** 業務ライン (= 成立条件) の追加・編集。目的の下に横並びで増える単位なので、
   * DBへ直接入れなくても画面から立てられるようにする。 */
  onCreateOutcome?: () => void;
  onEditOutcome?: (outcome: SxOutcome) => void;
  onMoveTask?: (
    task: SxTask,
    parentTaskId: string | null,
  ) => Promise<void> | void;
}) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetTaskId, setDropTargetTaskId] = useState<string | null>(null);
  const [connectingTaskId, setConnectingTaskId] = useState<string | null>(null);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [moveMessage, setMoveMessage] = useState<string | null>(null);
  const outcomes = useMemo(
    () =>
      management.outcomes.filter(
        (outcome) => !activeTrack || outcome.track === activeTrack,
      ),
    [activeTrack, management.outcomes],
  );
  const trackLabel = activeTrack
    ? (management.tracks.find((track) => track.key === activeTrack)?.label ??
      activeTrack)
    : null;

  const outcomeTrees = useMemo<OutcomeTree[]>(() => {
    return outcomes.map((outcome) => {
      const milestones = management.milestones
        .filter((milestone) => milestone.outcomeId === outcome.id)
        .sort((left, right) => left.title.localeCompare(right.title, "ja"));
      const milestoneIds = new Set(milestones.map((milestone) => milestone.id));
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
        .filter((task) => !task.parentTaskId || !taskIds.has(task.parentTaskId))
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
      const linkedPartnerIds = new Set(
        tasks.map((task) => task.partnerId).filter(Boolean),
      );
      return {
        outcome,
        roots,
        childMap,
        partners,
        unlinkedPartners: partners.filter(
          (partner) => !linkedPartnerIds.has(partner.id),
        ),
        openCount: tasks.filter((task) => task.status !== "completed").length,
        completedCount: tasks.filter((task) => task.status === "completed")
          .length,
      };
    });
  }, [
    management.milestones,
    management.outcomes,
    management.partners,
    management.tasks,
    outcomes,
  ]);

  const preferredOutcome =
    outcomeTrees.find((tree) =>
      tree.roots.some(
        (root) =>
          root.partnerId ||
          (tree.childMap.get(root.id) ?? []).some((task) => task.partnerId),
      ),
    ) ||
    outcomeTrees.find((tree) => tree.outcome.title.includes("供給")) ||
    outcomeTrees[0];
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(
    preferredOutcome?.outcome.id ?? "",
  );
  const selectedTree =
    outcomeTrees.find((tree) => tree.outcome.id === selectedOutcomeId) ||
    preferredOutcome;

  const selectedTasks = useMemo(() => {
    if (!selectedTree) return [];
    const tasks: SxTask[] = [];
    const visit = (task: SxTask) => {
      tasks.push(task);
      (selectedTree.childMap.get(task.id) ?? []).forEach(visit);
    };
    selectedTree.roots.forEach(visit);
    return tasks;
  }, [selectedTree]);

  const moveTask = async (task: SxTask, parentTaskId: string | null) => {
    if (task.parentTaskId === parentTaskId) {
      setConnectingTaskId(null);
      return;
    }
    const parent = parentTaskId
      ? selectedTasks.find((candidate) => candidate.id === parentTaskId)
      : null;
    if (
      parent &&
      (parent.milestoneId !== task.milestoneId ||
        taskHasDescendant(
          selectedTree?.childMap ?? new Map(),
          task.id,
          parent.id,
        ))
    ) {
      setMoveMessage("同じタスク群の、自分の子孫ではないタスクへ接続してね");
      return;
    }
    setMovingTaskId(task.id);
    setMoveMessage(null);
    try {
      await onMoveTask?.(task, parentTaskId);
      setConnectingTaskId(null);
    } catch (error) {
      setMoveMessage(
        error instanceof Error ? error.message : "接続を変更できなかったよ",
      );
    } finally {
      setMovingTaskId(null);
      setDraggedTaskId(null);
      setDropTargetTaskId(null);
    }
  };

  const beginDrag = (event: DragEvent<HTMLElement>, task: SxTask) => {
    if (!canManage) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    setDraggedTaskId(task.id);
    setMoveMessage(null);
  };

  const dragOverTask = (event: DragEvent<HTMLElement>, target: SxTask) => {
    const dragged = selectedTasks.find((task) => task.id === draggedTaskId);
    if (
      !dragged ||
      dragged.id === target.id ||
      dragged.milestoneId !== target.milestoneId ||
      taskHasDescendant(
        selectedTree?.childMap ?? new Map(),
        dragged.id,
        target.id,
      )
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDropTargetTaskId(target.id);
  };

  const dropOnTask = (event: DragEvent<HTMLElement>, target: SxTask) => {
    event.preventDefault();
    event.stopPropagation();
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    const dragged = selectedTasks.find((task) => task.id === taskId);
    if (dragged) void moveTask(dragged, target.id);
  };

  if (!management.objective || outcomeTrees.length === 0) {
    return (
      <div className={styles.empty}>
        <strong>{trackLabel ? `${trackLabel}の目的構造` : "目的構造"}</strong>
        <span>
          {management.objective
            ? "最上位の目的はあるけど、その下の業務ラインがまだ無いよ。"
            : "目的と成立条件がまだ登録されていないよ。ガントの工程はそのまま見られる。"}
        </span>
        {canManage && management.objective && onCreateOutcome && (
          <button type="button" onClick={onCreateOutcome}>
            ＋ 業務ラインを追加
          </button>
        )}
      </div>
    );
  }

  const partnerById = new Map(
    management.partners.map((partner) => [partner.id, partner]),
  );

  return (
    <div className={styles.map} data-testid="sx-objective-map">
      <div className={styles.overviewViewport}>
        <ul className={styles.overviewTree}>
          <li>
            <section className={styles.objective} aria-label="最上位の目的">
              <span>最上位の目的</span>
              <h3>{management.objective.title}</h3>
              <p>{management.objective.definitionOfDone}</p>
              <div>
                <small>成立条件 {outcomeTrees.length}</small>
                {trackLabel && <small>{trackLabel}</small>}
              </div>
            </section>
            <ul
              className={styles.overviewChildren}
              aria-label="目的を成立させる枝"
            >
              {outcomeTrees.map((tree) => {
                const selected = tree.outcome.id === selectedTree?.outcome.id;
                return (
                  <li key={tree.outcome.id}>
                    <button
                      type="button"
                      className={styles.outcomeNode}
                      aria-pressed={selected}
                      onClick={() => setSelectedOutcomeId(tree.outcome.id)}
                    >
                      <span>成立条件</span>
                      <strong>{tree.outcome.title}</strong>
                      <p>{tree.outcome.definitionOfDone}</p>
                      <div>
                        <small>進行中 {tree.openCount}</small>
                        <small>完了 {tree.completedCount}</small>
                        <small>関係先 {tree.partners.length}</small>
                      </div>
                    </button>
                  </li>
                );
              })}
              {canManage && onCreateOutcome && (
                <li>
                  <button
                    type="button"
                    className={styles.outcomeAddNode}
                    onClick={onCreateOutcome}
                  >
                    <span>成立条件</span>
                    <strong>＋ 業務ラインを追加</strong>
                    <p>新しく立ち上がった業務を、この目的の下に1本足す</p>
                  </button>
                </li>
              )}
            </ul>
          </li>
        </ul>
      </div>

      {selectedTree && (
        <section
          className={styles.expandedBranch}
          aria-label={`${selectedTree.outcome.title}の分岐`}
        >
          <header className={styles.expandedHeader}>
            <div>
              <span>選択中の成立条件</span>
              <h4>{selectedTree.outcome.title}</h4>
            </div>
            <div className={styles.branchTools}>
              <p>
                上から下へ流れをたどる
                {canManage && " · カードを別カードへドラッグして接続変更"}
              </p>
              {canManage && onEditOutcome && (
                <button
                  type="button"
                  onClick={() => onEditOutcome(selectedTree.outcome)}
                >
                  このラインを編集
                </button>
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={() => onCreateTask?.(selectedTree.outcome)}
                >
                  ＋ タスク追加
                </button>
              )}
            </div>
          </header>
          {moveMessage && (
            <p className={styles.moveMessage} role="status">
              {moveMessage}
            </p>
          )}
          <div className={styles.treeViewport}>
            <ul className={styles.workTree}>
              <li className={styles.treeRoot}>
                <article
                  className={styles.outcomeRootNode}
                  data-drop-target={dropTargetTaskId === "root" || undefined}
                  onDragOver={(event) => {
                    if (!draggedTaskId) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropTargetTaskId("root");
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const taskId =
                      event.dataTransfer.getData("text/plain") || draggedTaskId;
                    const dragged = selectedTasks.find(
                      (task) => task.id === taskId,
                    );
                    if (dragged) void moveTask(dragged, null);
                  }}
                >
                  <span>成立条件</span>
                  <strong>{selectedTree.outcome.title}</strong>
                  <p>{selectedTree.outcome.definitionOfDone}</p>
                </article>
                {(selectedTree.roots.length > 0 ||
                  selectedTree.unlinkedPartners.length > 0) && (
                  <ul className={styles.treeChildren}>
                    {selectedTree.roots.map((task) => (
                      <TaskNode
                        key={task.id}
                        task={task}
                        childMap={selectedTree.childMap}
                        partnerById={partnerById}
                        allTasks={selectedTasks}
                        canManage={canManage}
                        draggedTaskId={draggedTaskId}
                        dropTargetTaskId={dropTargetTaskId}
                        connectingTaskId={connectingTaskId}
                        movingTaskId={movingTaskId}
                        onOpenTask={onOpenTask}
                        onOpenPartner={() =>
                          onOpenPartners?.(selectedTree.outcome.track)
                        }
                        onCreateTask={(parentTask) =>
                          onCreateTask?.(selectedTree.outcome, parentTask)
                        }
                        onBeginConnect={setConnectingTaskId}
                        onMoveTask={(task, parentTaskId) =>
                          void moveTask(task, parentTaskId)
                        }
                        onDragStart={beginDrag}
                        onDragEnd={() => {
                          setDraggedTaskId(null);
                          setDropTargetTaskId(null);
                        }}
                        onDragOver={dragOverTask}
                        onDrop={dropOnTask}
                      />
                    ))}
                    {selectedTree.unlinkedPartners.map((partner) => (
                      <PartnerNode
                        key={partner.id}
                        partner={partner}
                        onOpen={() =>
                          onOpenPartners?.(selectedTree.outcome.track)
                        }
                      />
                    ))}
                  </ul>
                )}
              </li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
