"use client";

import {
  useMemo,
  useState,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from "react";
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
  tasks: SxTask[];
  roots: SxTask[];
  childMap: Map<string, SxTask[]>;
  partners: SxManagementPartner[];
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
  expandedTaskIds,
  onOpenTask,
  onOpenPartner,
  onToggleTask,
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
  expandedTaskIds: Set<string>;
  onOpenTask?: (task: SxTask) => void;
  onOpenPartner?: (partner: SxManagementPartner) => void;
  onToggleTask: (taskId: string) => void;
  onCreateTask?: (parentTask: SxTask) => void;
  onBeginConnect: (taskId: string | null) => void;
  onMoveTask: (task: SxTask, parentTaskId: string | null) => void;
  onDragStart: (event: DragEvent<HTMLElement>, task: SxTask) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>, task: SxTask) => void;
  onDrop: (event: DragEvent<HTMLElement>, task: SxTask) => void;
}) {
  const children = childMap.get(task.id) ?? [];
  const hasChildren = children.length > 0;
  const expanded = expandedTaskIds.has(task.id);
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
          aria-expanded={hasChildren ? expanded : undefined}
          onClick={() => {
            if (hasChildren) onToggleTask(task.id);
          }}
        >
          <span className={styles.nodeKind}>
            {partner ? "アプローチ" : "やること"}
          </span>
          <strong className={styles.nodeTitle}>{task.title}</strong>
          {hasChildren && (
            <span className={styles.nodeDisclosure}>
              子タスク {children.length}件 {expanded ? "たたむ" : "開く"}
            </span>
          )}
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
      {hasChildren && expanded && (
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
              expandedTaskIds={expandedTaskIds}
              onOpenTask={onOpenTask}
              onOpenPartner={onOpenPartner}
              onToggleTask={onToggleTask}
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

function OutcomeNode({
  tree,
  partnerById,
  allTasks,
  canManage,
  expanded,
  expandedTaskIds,
  draggedTaskId,
  dropTargetTaskId,
  connectingTaskId,
  movingTaskId,
  onToggle,
  onToggleTask,
  onOpenTask,
  onOpenPartner,
  onCreateTask,
  onEdit,
  onBeginConnect,
  onMoveTask,
  onDragStart,
  onDragEnd,
  onDragOverTask,
  onDropTask,
  onDragOverRoot,
  onDropRoot,
}: {
  tree: OutcomeTree;
  partnerById: Map<string, SxManagementPartner>;
  allTasks: SxTask[];
  canManage: boolean;
  expanded: boolean;
  expandedTaskIds: Set<string>;
  draggedTaskId: string | null;
  dropTargetTaskId: string | null;
  connectingTaskId: string | null;
  movingTaskId: string | null;
  onToggle: () => void;
  onToggleTask: (taskId: string) => void;
  onOpenTask?: (task: SxTask) => void;
  onOpenPartner?: (partner: SxManagementPartner) => void;
  onCreateTask?: (outcome: SxOutcome, parentTask?: SxTask) => void;
  onEdit?: (outcome: SxOutcome) => void;
  onBeginConnect: (taskId: string | null) => void;
  onMoveTask: (task: SxTask, parentTaskId: string | null) => void;
  onDragStart: (event: DragEvent<HTMLElement>, task: SxTask) => void;
  onDragEnd: () => void;
  onDragOverTask: (event: DragEvent<HTMLElement>, task: SxTask) => void;
  onDropTask: (event: DragEvent<HTMLElement>, task: SxTask) => void;
  onDragOverRoot: (event: DragEvent<HTMLElement>, tree: OutcomeTree) => void;
  onDropRoot: (event: DragEvent<HTMLElement>, tree: OutcomeTree) => void;
}) {
  const childCount = tree.roots.length;

  return (
    <li className={styles.treeBranch}>
      <article
        className={styles.treeNode}
        data-kind="outcome"
        data-drop-target={
          dropTargetTaskId === `outcome:${tree.outcome.id}` || undefined
        }
        onDragOver={(event) => onDragOverRoot(event, tree)}
        onDrop={(event) => onDropRoot(event, tree)}
      >
        <button
          type="button"
          className={styles.nodeMain}
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <span className={styles.nodeKind}>成立条件</span>
          <strong className={styles.nodeTitle}>{tree.outcome.title}</strong>
          <span className={styles.nodeDisclosure}>
            {childCount > 0
              ? `やること ${childCount}件 ${expanded ? "たたむ" : "開く"}`
              : "やることを追加"}
          </span>
          <p>{tree.outcome.definitionOfDone}</p>
          <span className={styles.outcomeCounts}>
            <small>進行中 {tree.openCount}</small>
            <small>完了 {tree.completedCount}</small>
            <small>関係先 {tree.partners.length}</small>
          </span>
        </button>
        {canManage && (
          <div className={styles.nodeActions}>
            <span aria-hidden="true">└</span>
            <button type="button" onClick={() => onCreateTask?.(tree.outcome)}>
              ＋ タスク
            </button>
            {onEdit && (
              <button type="button" onClick={() => onEdit(tree.outcome)}>
                編集
              </button>
            )}
          </div>
        )}
      </article>
      {expanded && childCount > 0 && (
        <ul className={styles.treeChildren}>
          {tree.roots.map((task) => (
            <TaskNode
              key={task.id}
              task={task}
              childMap={tree.childMap}
              partnerById={partnerById}
              allTasks={allTasks}
              canManage={canManage}
              draggedTaskId={draggedTaskId}
              dropTargetTaskId={dropTargetTaskId}
              connectingTaskId={connectingTaskId}
              movingTaskId={movingTaskId}
              expandedTaskIds={expandedTaskIds}
              onOpenTask={onOpenTask}
              onOpenPartner={onOpenPartner}
              onToggleTask={(taskId) => onToggleTask(taskId)}
              onCreateTask={(parentTask) =>
                onCreateTask?.(tree.outcome, parentTask)
              }
              onBeginConnect={onBeginConnect}
              onMoveTask={onMoveTask}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOverTask}
              onDrop={onDropTask}
            />
          ))}
        </ul>
      )}
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
      return {
        outcome,
        tasks,
        roots,
        childMap,
        partners,
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

  const [objectiveExpanded, setObjectiveExpanded] = useState(true);
  const [expandedOutcomeIds, setExpandedOutcomeIds] = useState<Set<string>>(
    new Set(),
  );
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(
    new Set(),
  );
  const allTasks = useMemo(() => {
    const byId = new Map<string, SxTask>();
    outcomeTrees.forEach((tree) => {
      tree.tasks.forEach((task) => byId.set(task.id, task));
    });
    return [...byId.values()];
  }, [outcomeTrees]);
  const treeForTask = (task: SxTask) =>
    outcomeTrees.find((tree) =>
      tree.tasks.some((candidate) => candidate.id === task.id),
    );
  const toggleSetMember = (
    setValues: Dispatch<SetStateAction<Set<string>>>,
    id: string,
  ) => {
    setValues((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const moveTask = async (task: SxTask, parentTaskId: string | null) => {
    if (task.parentTaskId === parentTaskId) {
      setConnectingTaskId(null);
      return;
    }
    const parent = parentTaskId
      ? allTasks.find((candidate) => candidate.id === parentTaskId)
      : null;
    const taskTree = treeForTask(task);
    if (
      parent &&
      (parent.milestoneId !== task.milestoneId ||
        taskHasDescendant(
          taskTree?.childMap ?? new Map(),
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
    const dragged = allTasks.find((task) => task.id === draggedTaskId);
    const draggedTree = dragged ? treeForTask(dragged) : null;
    if (
      !dragged ||
      dragged.id === target.id ||
      dragged.milestoneId !== target.milestoneId ||
      taskHasDescendant(
        draggedTree?.childMap ?? new Map(),
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
    const dragged = allTasks.find((task) => task.id === taskId);
    if (dragged) void moveTask(dragged, target.id);
  };

  const dragOverRoot = (event: DragEvent<HTMLElement>, tree: OutcomeTree) => {
    const dragged = allTasks.find((task) => task.id === draggedTaskId);
    if (!dragged || !tree.tasks.some((task) => task.id === dragged.id)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDropTargetTaskId(`outcome:${tree.outcome.id}`);
  };

  const dropOnRoot = (event: DragEvent<HTMLElement>, tree: OutcomeTree) => {
    event.preventDefault();
    event.stopPropagation();
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    const dragged = allTasks.find((task) => task.id === taskId);
    if (dragged && tree.tasks.some((task) => task.id === dragged.id)) {
      void moveTask(dragged, null);
    }
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
      {moveMessage && (
        <p className={styles.moveMessage} role="status">
          {moveMessage}
        </p>
      )}
      <div className={styles.treeViewport}>
        <ul className={styles.workTree} aria-label="目的構造">
          <li className={styles.treeRoot}>
            <button
              type="button"
              className={styles.objective}
              aria-expanded={objectiveExpanded}
              onClick={() => setObjectiveExpanded((current) => !current)}
            >
              <span>最上位の目的</span>
              <h3>{management.objective.title}</h3>
              <p>{management.objective.definitionOfDone}</p>
              <div>
                <small>
                  成立条件 {outcomeTrees.length}件 {objectiveExpanded ? "たたむ" : "開く"}
                </small>
                {trackLabel && <small>{trackLabel}</small>}
              </div>
            </button>
            {objectiveExpanded && (
              <ul className={styles.treeChildren} aria-label="目的を成立させる枝">
                {outcomeTrees.map((tree) => (
                  <OutcomeNode
                    key={tree.outcome.id}
                    tree={tree}
                    partnerById={partnerById}
                    allTasks={allTasks}
                    canManage={canManage}
                    expanded={expandedOutcomeIds.has(tree.outcome.id)}
                    expandedTaskIds={expandedTaskIds}
                    draggedTaskId={draggedTaskId}
                    dropTargetTaskId={dropTargetTaskId}
                    connectingTaskId={connectingTaskId}
                    movingTaskId={movingTaskId}
                    onToggle={() =>
                      toggleSetMember(setExpandedOutcomeIds, tree.outcome.id)
                    }
                    onToggleTask={(taskId) =>
                      toggleSetMember(setExpandedTaskIds, taskId)
                    }
                    onOpenTask={onOpenTask}
                    onOpenPartner={() => onOpenPartners?.(tree.outcome.track)}
                    onCreateTask={onCreateTask}
                    onEdit={onEditOutcome}
                    onBeginConnect={setConnectingTaskId}
                    onMoveTask={(task, parentTaskId) =>
                      void moveTask(task, parentTaskId)
                    }
                    onDragStart={beginDrag}
                    onDragEnd={() => {
                      setDraggedTaskId(null);
                      setDropTargetTaskId(null);
                    }}
                    onDragOverTask={dragOverTask}
                    onDropTask={dropOnTask}
                    onDragOverRoot={dragOverRoot}
                    onDropRoot={dropOnRoot}
                  />
                ))}
                {canManage && onCreateOutcome && (
                  <li className={styles.treeBranch}>
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
            )}
          </li>
        </ul>
      </div>
    </div>
  );
}
