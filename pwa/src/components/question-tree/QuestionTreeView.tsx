"use client";

import { GripVertical } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useModalContainment } from "@/components/project-workspace/useModalContainment";
import { loadQuestionTree, mutateQuestionTree, peekQuestionTree } from "@/lib/question-tree-client";
import { buildFinishToStartRoute } from "@/lib/sx-gantt-dependency-route";
import {
  addDays,
  computeBarMove,
  computeBarResizeEnd,
  computeBarResizeStart,
  diffDays,
  isWithinClickThreshold,
  pxToDayDelta,
} from "@/lib/sx-gantt-drag";
import {
  ACTION_STATUS_LABEL,
  FINDING_KIND_LABEL,
  CHILDREN_LOGIC_LABEL,
  QUESTION_KIND_LABEL,
  QUESTION_STATE_LABEL,
  type ActionNode,
  type QuestionNode,
  type QuestionTreeBundle,
} from "@/lib/question-tree-types";

import styles from "./question-tree.module.css";

/**
 * ゴールツリー。正本は pwa/spec/3-21-question-tree-current-spec.md と
 * pwa/spec/3-22-goal-tree-plan.md（到達点・MS・ptの型）。
 *
 * 状態は導出値なので編集させない。人が書くのは、答え・追わない理由・
 * 子の問い・TODO・分かったことだけ。
 */

type FormKind = "answer" | "drop" | "child" | "finding" | null;

/** TODOの担当。新しい担当欄が空のときだけ、旧・自由記述の担当を出す。 */
function ownerText(action: ActionNode): string {
  if (action.owners.length > 0) return action.owners.map((owner) => owner.displayName).join("・");
  return action.ownerLabel;
}

function ptText(value: number | null): string {
  if (value === null) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}pt`;
}

/** ガントの横軸。バーを引けるTODOの日程と基準日から決める。 */
type GanttDomain = { start: string; end: string; totalDays: number };

/**
 * TODOの引ける期間。開始が無ければ期限の一点として扱う。
 * 期限が無いものはバーを持たない（「日程未設定」へ集める）。
 */
function barRangeOf(action: ActionNode): { start: string; end: string } | null {
  if (!action.plannedEnd) return null;
  return { start: action.plannedStart ?? action.plannedEnd, end: action.plannedEnd };
}

function buildGanttDomain(actions: ActionNode[], asOf: string): GanttDomain | null {
  let min: string | null = null;
  let max: string | null = null;
  for (const action of actions) {
    const range = barRangeOf(action);
    if (!range) continue;
    if (!min || range.start < min) min = range.start;
    if (!max || range.end > max) max = range.end;
  }
  if (!min || !max) return null;
  // 基準日が範囲の外でも「今日」の線が見えるようにする。
  if (asOf < min) min = asOf;
  if (asOf > max) max = asOf;
  const start = addDays(min, -7);
  const end = addDays(max, 7);
  return { start, end, totalDays: diffDays(start, end) + 1 };
}

/** 横軸の月の区切り。何月を見ているか分からないガントにしない。 */
function buildMonthTicks(domain: GanttDomain): { key: string; label: string; leftPct: number; widthPct: number }[] {
  const ticks: { key: string; label: string; leftPct: number; widthPct: number }[] = [];
  let cursor = `${domain.start.slice(0, 7)}-01`;
  while (cursor <= domain.end) {
    const [year, month] = cursor.split("-").map(Number);
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const from = cursor < domain.start ? domain.start : cursor;
    const to = nextMonth > domain.end ? domain.end : addDays(nextMonth, -1);
    const days = diffDays(from, to) + 1;
    if (days > 0) {
      ticks.push({
        key: cursor,
        label: month === 1 ? `${year}年1月` : `${month}月`,
        leftPct: (diffDays(domain.start, from) / domain.totalDays) * 100,
        widthPct: (days / domain.totalDays) * 100,
      });
    }
    cursor = nextMonth;
  }
  return ticks;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "高い",
  medium: "ふつう",
  low: "低い",
  unknown: "未評価",
};

/**
 * textarea を中身の高さへ合わせる。読んでいるときと編集中で欄の大きさが変わると、
 * 押した瞬間に画面が動いて混乱する（まさ 2026-09-10「入力状態になると欄の大きさが
 * 変わるのやめて」）。
 */
function autoSize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function fmtDate(value: string | null): string {
  return value ? value.replace(/^\d{2}(\d{2})-/, "$1-") : "—";
}

/** ツリーの中で目立たせる問い。手を打つべきものだけに絞る。 */
function needsAttention(node: QuestionNode): boolean {
  return (
    node.status === "open" &&
    (node.state === "decidable" || node.state === "stalled" || node.state === "dead_branch" || node.isOverdue)
  );
}

/**
 * 最初に開いておく枝。
 * 根と根の直下に加えて、手を打つべき問いへ至る道をすべて開く。
 * 畳まれたままだと、強調しても目に入らない。
 */
function defaultOpenIds(bundle: QuestionTreeBundle | null | undefined): Set<string> {
  const ids = new Set<string>();
  if (!bundle) return ids;
  for (const root of bundle.roots) {
    ids.add(root.id);
    for (const child of root.children) ids.add(child.id);
  }
  const byId = new Map(bundle.allQuestions.map((node) => [node.id, node]));
  const openTrail = (from: string | null) => {
    let cursor = from;
    while (cursor) {
      ids.add(cursor);
      cursor = byId.get(cursor)?.parentId ?? null;
    }
  };
  for (const node of bundle.allQuestions) {
    if (!needsAttention(node)) continue;
    openTrail(node.parentId);
  }
  // 未承認のTODOが畳まれた枝の中にいると、光らせても見えない。
  // ぶら下がっている問いから根までと、親を持つTODOの親から上を開いておく
  // （まさ確定 2026-09-12）。
  const actionById = new Map(bundle.allActions.map((action) => [action.id, action]));
  const openActionTrail = (from: string | null) => {
    let cursor = from;
    while (cursor) {
      ids.add(cursor);
      cursor = actionById.get(cursor)?.parentId ?? null;
    }
  };
  for (const action of bundle.allActions) {
    if (!action.isProposed) continue;
    openActionTrail(action.parentId);
    ids.add(action.id);
  }
  for (const node of bundle.allQuestions) {
    const carriesProposed =
      node.isProposed ||
      node.actions.some((action) => action.isProposed || hasProposedDescendant(action));
    if (!carriesProposed) continue;
    ids.add(node.id);
    openTrail(node.parentId);
  }
  return ids;
}

/** そのTODOの下（孫まで）に未承認があるか。あるなら親を開いて見せる。 */
function hasProposedDescendant(action: ActionNode): boolean {
  return action.children.some((child) => child.isProposed || hasProposedDescendant(child));
}

/** 落とし先。上下の縁なら兄弟として挿し、真ん中ならその問いの子にする。 */
type DropPosition = "before" | "after" | "inside";

const DRAG_THRESHOLD_PX = 4;
const DRAG_EDGE_PX = 120;
const DRAG_MAX_SPEED_PX = 12;

/**
 * 掴んでいる行の複製。カーソルへ追従させないと「動かない一覧」に見える。
 * body 直下へ置くので CSS 変数の継承が切れる。掴んだ行で実際に効いていた値を移して、
 * 文字と枠が読める色のままにする。
 */
function createDragGhost(row: HTMLElement): HTMLElement {
  const rect = row.getBoundingClientRect();
  const clone = row.cloneNode(true) as HTMLElement;
  clone.style.width = `${rect.width}px`;
  clone.style.margin = "0";

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  const inherited = window.getComputedStyle(row);
  for (const name of [
    "--sheet", "--ink", "--muted", "--quiet", "--line",
    "--amd-action", "--amd-action-strong", "--amd-action-soft", "--amd-action-line",
    "--amber", "--amber-soft", "--red", "--red-soft", "--violet", "--violet-soft",
    "--green", "--green-soft",
  ]) {
    const value = inherited.getPropertyValue(name);
    if (value) host.style.setProperty(name, value);
  }
  host.style.font = inherited.font;
  host.style.color = inherited.color;
  host.style.position = "fixed";
  host.style.left = "0";
  host.style.top = "0";
  host.style.zIndex = "120";
  host.style.width = `${Math.min(rect.width, window.innerWidth - 32)}px`;
  host.style.overflow = "hidden";
  host.style.pointerEvents = "none";
  host.style.background = "#ffffff";
  host.style.border = "1px solid #027FDC";
  host.style.borderRadius = "4px";
  host.style.boxShadow = "0 14px 30px rgba(2, 127, 220, .28)";
  host.style.opacity = "1";
  host.style.willChange = "transform";
  host.appendChild(clone);
  document.body.appendChild(host);
  return host;
}

export function QuestionTreeView({
  initialBundle,
  projectId,
  projectName,
  embedded = false,
  mode = "tree",
}: {
  /** サーバ側で先に読めているときだけ渡す。無ければ開いたときに自分で取りに行く */
  initialBundle?: QuestionTreeBundle;
  projectId: string;
  projectName: string;
  /** PJワークスペースのタブに埋め込むとき。ページとしての枠を外す */
  embedded?: boolean;
  /**
   * 同じツリーを2つの面で見せる（3-22 §2）。tree は論点・仮説タブ、gantt はガントタブ。
   * ツリー・モーダル・その場編集・保存経路は共有し、行の右側だけを入れ替える。
   */
  mode?: "tree" | "gantt";
}) {
  // 読み込み済みなら同期で描く。タブを行き来するたびに往復を払わない（spec 5-10）。
  const [bundle, setBundle] = useState<QuestionTreeBundle | null>(
    () => initialBundle ?? peekQuestionTree(projectId) ?? null,
  );
  const [openIds, setOpenIds] = useState<Set<string>>(() =>
    defaultOpenIds(initialBundle ?? peekQuestionTree(projectId)),
  );
  const [selected, setSelected] = useState<{ kind: "question" | "action"; id: string } | null>(null);
  const [formKind, setFormKind] = useState<FormKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  /** 「消す」を押した行。同じ場所で2段階目を出すため、idで持つ */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ---- ガント ------------------------------------------------------------
  /** 横軸の実px幅。日数→pxの換算に使う */
  const axisRef = useRef<HTMLDivElement | null>(null);
  const [axisWidth, setAxisWidth] = useState(0);
  const ganttBodyRef = useRef<HTMLDivElement | null>(null);
  const barRefs = useRef(new Map<string, HTMLElement>());
  const [depPaths, setDepPaths] = useState<{ key: string; path: string }[]>([]);
  const [barDrag, setBarDrag] = useState<{
    actionId: string;
    handle: "move" | "start" | "end";
    startX: number;
    original: { plannedStart: string; plannedEnd: string };
    preview: { plannedStart: string; plannedEnd: string };
    moved: boolean;
  } | null>(null);
  /** 前後関係をつなぐ途中。「＋」で起点を決め、次に押したバーが後ろになる。 */
  const [depDraft, setDepDraft] = useState<string | null>(null);

  useEffect(() => {
    if (initialBundle) return;
    let cancelled = false;
    // キャッシュに載っていれば往復せずに返る。載っていなければ1回だけ取りに行き、
    // 同時に開いた面があっても1本へ束ねる（spec 5-10 の層3）。
    const hadCache = Boolean(peekQuestionTree(projectId));
    void loadQuestionTree(projectId)
      .then((payload) => {
        if (cancelled) return;
        setBundle(payload);
        // 開いている枝は人が触った結果なので、キャッシュから即描いたときは畳み直さない。
        if (!hadCache) setOpenIds(defaultOpenIds(payload));
      })
      .catch((caught: unknown) => {
        if (!cancelled) setLoadFailed(caught instanceof Error ? caught.message : "読み込めなかったよ");
      });
    return () => {
      cancelled = true;
    };
  }, [initialBundle, projectId]);

  // ガントは確認するだけの面。未承認の到達点・論点はツリーでだけ扱う
  // （まさ確定 2026-09-12）。根も同じ扱いにしないと、未承認の到達点が
  // 外部メンバーの開くガントに出る。
  const roots = useMemo(() => {
    const all = bundle?.roots ?? [];
    return mode === "gantt" ? all.filter((root) => !root.isProposed) : all;
  }, [bundle, mode]);

  /** 最後にドラッグを終えた時刻。直後の click を詳細表示に使わないための目印。 */
  const draggedAtRef = useRef(0);

  /**
   * 行と行のあいだに置く「＋」の行き先（まさ 2026-09-12「それぞれの項目の間に
   * マウスオーバーしたら左側に＋マークが出て、それを押すとその間に論点を追加できる
   * ようにして。追加される論点はその直上の子として追加して」）。
   *
   * 画面に出ている順に並べ直して、各行の1つ上の行を引けるようにする。1つ上が問いなら
   * その子として入れる。1つ上がTODOのときは出さない（TODOの下に論点はぶら下がらない）。
   */
  const parentForGapAbove = useMemo(() => {
    const map = new Map<string, string>();
    let previousQuestionId: string | null = null;
    let previousWasQuestion = false;
    const walkAction = (action: ActionNode) => {
      previousWasQuestion = false;
      if (action.children.length > 0 && openIds.has(action.id)) action.children.forEach(walkAction);
    };
    const walkQuestion = (node: QuestionNode) => {
      if (previousWasQuestion && previousQuestionId) map.set(node.id, previousQuestionId);
      previousQuestionId = node.id;
      previousWasQuestion = true;
      if (!openIds.has(node.id)) return;
      for (const child of node.children) walkQuestion(child);
      for (const action of node.actions) walkAction(action);
    };
    if (mode === "gantt") return map;
    for (const root of roots) walkQuestion(root);
    return map;
  }, [roots, openIds, mode]);

  /**
   * ＋を押した位置。ここに1行の入力欄を出す。値は「その行のすぐ上」を指す行ID。
   */
  const [insertAbove, setInsertAbove] = useState<string | null>(null);

  const questionById = useMemo(() => {
    const map = new Map<string, QuestionNode>();
    const walk = (nodes: QuestionNode[]) => {
      for (const node of nodes) {
        map.set(node.id, node);
        walk(node.children);
      }
    };
    walk(roots);
    return map;
  }, [roots]);

  const ganttDomain = useMemo(
    () => (bundle ? buildGanttDomain(bundle.allActions, bundle.asOf) : null),
    [bundle],
  );

  const monthTicks = useMemo(() => (ganttDomain ? buildMonthTicks(ganttDomain) : []), [ganttDomain]);

  /**
   * まだバーを引けないTODO。会議で出たまま日程が決まっていないもので、
   * ここがアサインの作業面になる（3-22 §4）。終わった仕事は並べない。
   */
  const undatedActions = useMemo(() => {
    if (!bundle) return [];
    return bundle.allActions.filter(
      (action) =>
        !action.isProposed &&
        !barRangeOf(action) &&
        action.status !== "done" &&
        action.status !== "dropped",
    );
  }, [bundle]);

  /**
   * 問いの行に出す、配下TODOの広がり。到達点やMSが「いつ動いている枝なのか」を
   * バーの位置で読めるようにする。人が編集する値ではない。
   */
  const rollupById = useMemo(() => {
    const map = new Map<string, { start: string; end: string }>();
    const visit = (node: QuestionNode): { start: string; end: string } | null => {
      let start: string | null = null;
      let end: string | null = null;
      const absorb = (range: { start: string; end: string } | null) => {
        if (!range) return;
        if (!start || range.start < start) start = range.start;
        if (!end || range.end > end) end = range.end;
      };
      for (const action of node.actions) absorb(barRangeOf(action));
      for (const child of node.children) absorb(visit(child));
      if (!start || !end) return null;
      const range = { start, end };
      map.set(node.id, range);
      return range;
    };
    for (const root of roots) visit(root);
    return map;
  }, [roots]);

  // 横軸の幅が変われば、1日あたりのpxも依存線の座標も変わる。
  useEffect(() => {
    if (mode !== "gantt") return;
    const element = axisRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setAxisWidth(entry.contentRect.width);
    });
    observer.observe(element);
    setAxisWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, [mode, bundle]);

  const pxPerDay = ganttDomain && axisWidth > 0 ? axisWidth / ganttDomain.totalDays : 0;

  /**
   * 依存線。バーの実座標から引く。畳まれている枝や日程未設定の端点は
   * バーが無いので線を引かない（宙に浮いた線を残さない）。
   */
  useEffect(() => {
    if (mode !== "gantt" || !bundle) {
      setDepPaths([]);
      return;
    }
    const frame = ganttBodyRef.current;
    if (!frame) return;
    const lane = frame.querySelector(`.${styles.ganttOverlayLane}`);
    if (!lane) return;
    const box = lane.getBoundingClientRect();
    const next: { key: string; path: string }[] = [];
    for (const dependency of bundle.dependencies) {
      const from = barRefs.current.get(dependency.predecessorActionId);
      const to = barRefs.current.get(dependency.successorActionId);
      if (!from || !to || !from.isConnected || !to.isConnected) continue;
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      next.push({
        key: `${dependency.predecessorActionId}->${dependency.successorActionId}`,
        path: buildFinishToStartRoute(
          { x: a.right - box.left, y: a.top + a.height / 2 - box.top },
          { x: b.left - box.left, y: b.top + b.height / 2 - box.top },
        ).path,
      });
    }
    setDepPaths(next);
  }, [mode, bundle, openIds, axisWidth, barDrag]);

  const toggle = useCallback((id: string) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const select = useCallback((kind: "question" | "action", id: string) => {
    setSelected((current) => (current && current.kind === kind && current.id === id ? null : { kind, id }));
    setFormKind(null);
    setEditingField(null);
    setError(null);
  }, []);

  const closeDetail = useCallback(() => {
    setSelected(null);
    setFormKind(null);
    setEditingField(null);
    setError(null);
  }, []);

  const send = useCallback(
    async (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        // 書き込みもキャッシュ層を通す。層の中で最新の束へ差し替わるので、
        // 別のタブへ移っても自分の書き込みが古く見えない（spec 5-10）。
        const payload = await mutateQuestionTree(projectId, method, body);
        if (payload.bundle) setBundle(payload.bundle);
        setFormKind(null);
        return true;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "保存できなかったよ");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [projectId],
  );

  /** バーを掴んで日程を変える。3-16 の現行ガントと同じ3操作（移動・開始・完了）。 */
  useEffect(() => {
    if (!barDrag || pxPerDay <= 0) return;
    const onMove = (event: PointerEvent) => {
      const deltaPx = event.clientX - barDrag.startX;
      const moved = !isWithinClickThreshold(deltaPx, 0);
      if (!moved) return;
      const days = pxToDayDelta(deltaPx, pxPerDay);
      if (days === 0 && barDrag.moved) return;
      const next =
        barDrag.handle === "move"
          ? computeBarMove(barDrag.original, deltaPx, pxPerDay)
          : barDrag.handle === "start"
            ? { ...barDrag.original, ...computeBarResizeStart(barDrag.original, deltaPx, pxPerDay) }
            : { ...barDrag.original, ...computeBarResizeEnd(barDrag.original, deltaPx, pxPerDay) };
      setBarDrag((current) => (current ? { ...current, preview: next, moved: true } : current));
    };
    const onUp = () => {
      const drag = barDrag;
      setBarDrag(null);
      if (drag?.moved) draggedAtRef.current = Date.now();
      if (!drag?.moved) return;
      if (
        drag.preview.plannedStart === drag.original.plannedStart &&
        drag.preview.plannedEnd === drag.original.plannedEnd
      ) {
        return;
      }
      void send("PATCH", {
        resource: "action",
        id: drag.actionId,
        fields: { planned_start: drag.preview.plannedStart, planned_end: drag.preview.plannedEnd },
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [barDrag, pxPerDay, send]);

  /**
   * 未アサインのTODOのうち、ツリーの上から見て最初のものへ移る。
   * アサインはツリーの上で行う（3-22 §4 まさ確定 2026-09-11）ので、
   * 件数からその作業の入口へ直接つなぐ。上部へ一覧を抜き出すことはしない。
   */
  const goToFirstUnassigned = useCallback(() => {
    if (!bundle) return;
    const trail: string[] = [];
    let target: { actionId: string; path: string[] } | null = null;
    const walk = (node: QuestionNode) => {
      if (target) return;
      trail.push(node.id);
      for (const action of node.actions) {
        if (action.isUnassigned) {
          target = { actionId: action.id, path: [...trail] };
          break;
        }
      }
      if (!target) for (const child of node.children) walk(child);
      trail.pop();
    };
    for (const root of bundle.roots) walk(root);
    if (!target) return;
    const found: { actionId: string; path: string[] } = target;
    // 畳まれた枝の中にあると、スクロールしても何も見えない。道を先に開く。
    setOpenIds((current) => new Set([...current, ...found.path]));
    window.setTimeout(() => {
      const row = document.querySelector(`[data-action-row="${found.actionId}"]`);
      row?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
  }, [bundle]);

  // 前後関係を中止。掴んでいる途中と同じく Esc で降りられるようにする。
  useEffect(() => {
    if (!depDraft) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDepDraft(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [depDraft]);

  /**
   * ツリーから削除する。取り下げ（`status='dropped'`、取り消し線で残す）とは別の操作で、
   * 論点でも仮説でもTODOでもないものをツリーから外すために使う（まさ 2026-09-11
   * 「論点でも仮説でもタスクでもないものは全部消す」「取り消し線になるだけで消せない」）。
   * 入口は詳細の末尾、同じ場所で2段階確認、第2モーダルは開かない（3-16 の作法）。
   * 実体は論理削除なので、間違えても復元できる。
   */
  const renderDeleteAction = (
    resource: "question" | "action",
    id: string,
    blocked: boolean,
    blockedReason: string,
  ) => {
    if (!canManage) return null;
    if (blocked) {
      return <span className={styles.deleteBlocked}>{blockedReason}</span>;
    }
    if (confirmDeleteId !== id) {
      return (
        <button
          type="button"
          className={styles.btn}
          data-variant="danger"
          onClick={() => setConfirmDeleteId(id)}
        >
          消す
        </button>
      );
    }
    return (
      <span className={styles.deleteConfirm}>
        <span>削除しますか</span>
        <button
          type="button"
          className={styles.btn}
          data-variant="danger"
          disabled={busy}
          onClick={async () => {
            const ok = await send("DELETE", { resource, id });
            setConfirmDeleteId(null);
            if (ok) closeDetail();
          }}
        >
          消す
        </button>
        <button
          type="button"
          className={styles.btn}
          data-variant="quiet"
          onClick={() => setConfirmDeleteId(null)}
        >
          やめる
        </button>
      </span>
    );
  };

  /** 到達点は親を持たないので、ツリーのいちばん上の導線から直接足す。 */
  const addGoal = useCallback(
    async (form: HTMLFormElement) => {
      const data = new FormData(form);
      const text = (key: string) => String(data.get(key) ?? "").trim();
      const ok = await send("POST", {
        resource: "question",
        fields: {
          title: text("title"),
          question_kind: "goal",
          due_date: text("due_date"),
          background: text("background"),
        },
      });
      if (ok) setGoalFormOpen(false);
    },
    [send],
  );

  const submitForm = useCallback(
    async (kind: Exclude<FormKind, null>, node: QuestionNode, form: HTMLFormElement) => {
      const data = new FormData(form);
      const text = (key: string) => String(data.get(key) ?? "").trim();

      if (kind === "answer") {
        await send("PATCH", {
          resource: "question",
          id: node.id,
          fields: { status: "answered", answer: text("answer"), confidence: text("confidence") || "medium" },
        });
        return;
      }
      if (kind === "drop") {
        await send("PATCH", {
          resource: "question",
          id: node.id,
          fields: { status: "dropped", drop_reason: text("drop_reason") },
        });
        return;
      }
      if (kind === "child") {
        // 子として足せるのは、論点 / 仮説 / 決めること / TODO。
        // 種類ごとに別ボタンを置くとボタンが増えるので、1つのフォームで選ばせる
        // （まさ 2026-09-10「ボタンが無駄に増えるとUXがどんどん悪くなる」）。
        const childKind = text("child_kind") || "open";
        if (childKind === "measure" || childKind === "work") {
          let payload: { id?: string | null };
          try {
            payload = await mutateQuestionTree(projectId, "POST", {
              resource: "action",
              fields: {
                title: text("title"),
                action_kind: childKind,
                owner_label: text("owner_label") || "担当未確認",
                planned_end: text("due_date"),
                detail: text("detail"),
                origin_question_id: node.id,
              },
            });
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "TODOを追加できませんでした");
            return;
          }
          if (!payload.id) {
            setError("TODOを追加できませんでした");
            return;
          }
          await send("POST", {
            resource: "question_action",
            fields: { question_id: node.id, action_id: payload.id },
          });
          return;
        }
        const questionKind =
          childKind === "decision" || childKind === "milestone" || childKind === "hypothesis"
            ? childKind
            : "open";
        await send("POST", {
          resource: "question",
          fields: {
            parent_id: node.id,
            title: text("title"),
            question_kind: questionKind,
            owner_label: text("owner_label") || "担当未確認",
            due_date: text("due_date"),
            origin_question_id: node.id,
          },
        });
        return;
      }
      if (kind === "finding") {
        let payload: { id?: string | null };
        try {
          payload = await mutateQuestionTree(projectId, "POST", {
            resource: "finding",
            fields: {
              summary: text("summary"),
              finding_kind: text("finding_kind") || "neutral",
              source_label: text("source_label") || "出どころ未確認",
              observed_on: text("observed_on"),
            },
          });
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "分かったことを足せなかったよ");
          return;
        }
        if (!payload.id) {
          setError("分かったことを足せなかったよ");
          return;
        }
        await send("POST", {
          resource: "question_finding",
          fields: { question_id: node.id, finding_id: payload.id },
        });
      }
    },
    [projectId, send],
  );

  // 掴んで動かす（まさ 2026-09-10「同じ階層内限定でいいから順番は入れ替えたい」
  // 「親を変える場合は別の親のところにドラッグアンドドロップすればいい」）。
  // ボタンを増やさず、1つの操作で並び替えと付け替えの両方をやる。
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; position: DropPosition } | null>(null);
  const dragStateRef = useRef<{ id: string; startX: number; startY: number; dragging: boolean } | null>(null);
  const dropHintRef = useRef<{ id: string; position: DropPosition } | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollRef = useRef(0);
  const bundleRef = useRef<QuestionTreeBundle | null>(bundle);
  bundleRef.current = bundle;

  const teardownDrag = useCallback(() => {
    ghostRef.current?.remove();
    ghostRef.current = null;
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = 0;
    }
    if (dragStateRef.current?.dragging) draggedAtRef.current = Date.now();
    pointerRef.current = null;
    dragStateRef.current = null;
    dropHintRef.current = null;
    setDragId(null);
    setDropHint(null);
  }, []);

  /** カーソルの下の行と、その行のどこへ落ちるかを決める。上下の縁は兄弟、真ん中は子。 */
  const resolveDrop = useCallback((x: number, y: number) => {
    const state = dragStateRef.current;
    if (!state) return null;
    const row = document
      .elementsFromPoint(x, y)
      .find((node): node is HTMLElement => node instanceof HTMLElement && Boolean(node.dataset.questionRow));
    if (!row) return null;
    const id = row.dataset.questionRow as string;
    if (id === state.id) return null;
    const rect = row.getBoundingClientRect();
    const ratio = (y - rect.top) / Math.max(rect.height, 1);
    const position: DropPosition = ratio < 0.3 ? "before" : ratio > 0.7 ? "after" : "inside";
    return { id, position };
  }, []);

  const applyMove = useCallback(
    async (movedId: string, target: { id: string; position: DropPosition }) => {
      const all = bundleRef.current?.allQuestions ?? [];
      const byId = new Map(all.map((node) => [node.id, node]));
      const targetNode = byId.get(target.id);
      if (!targetNode || !byId.has(movedId)) return;

      const newParentId = target.position === "inside" ? target.id : targetNode.parentId;

      // 自分の子孫の下へは動かせない。DB側でも弾くが、画面で先に止めて理由を出す。
      let cursor: string | null = newParentId;
      while (cursor) {
        if (cursor === movedId) {
          setError("自分の下にある問いへは動かせないよ");
          return;
        }
        cursor = byId.get(cursor)?.parentId ?? null;
      }

      const orderedIds = all
        .filter((node) => node.parentId === newParentId && node.id !== movedId)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "ja"))
        .map((node) => node.id);
      if (target.position === "inside") {
        orderedIds.push(movedId);
      } else {
        const index = orderedIds.indexOf(target.id);
        if (index < 0) orderedIds.push(movedId);
        else orderedIds.splice(target.position === "before" ? index : index + 1, 0, movedId);
      }

      await send("POST", {
        resource: "question_move",
        fields: { id: movedId, parent_id: newParentId, ordered_ids: orderedIds },
      });
      // 付け替えた先が畳まれていると、動かしたものが画面から消える
      if (newParentId) setOpenIds((current) => new Set([...current, newParentId]));
    },
    [send],
  );

  useEffect(() => {
    if (!dragId) return;

    // 端に居るあいだは送り続ける。pointermove だけだと、指を止めた瞬間に止まる。
    const step = () => {
      autoScrollRef.current = requestAnimationFrame(step);
      const pointer = pointerRef.current;
      if (!pointer || !dragStateRef.current?.dragging) return;
      const topOvershoot = DRAG_EDGE_PX - pointer.y;
      const bottomOvershoot = pointer.y - (window.innerHeight - DRAG_EDGE_PX);
      const overshoot = topOvershoot > 0 ? -topOvershoot : bottomOvershoot > 0 ? bottomOvershoot : 0;
      if (overshoot === 0) return;
      const speed = Math.min(DRAG_MAX_SPEED_PX, Math.max(4, Math.abs(overshoot) / 4));
      window.scrollBy(0, overshoot > 0 ? speed : -speed);
      const next = resolveDrop(pointer.x, pointer.y);
      dropHintRef.current = next;
      setDropHint(next);
    };
    autoScrollRef.current = requestAnimationFrame(step);

    const onMove = (event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      if (!state.dragging) {
        if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < DRAG_THRESHOLD_PX) return;
        const row = document.querySelector<HTMLElement>(`[data-question-row="${state.id}"]`);
        if (!row) return;
        state.dragging = true;
        ghostRef.current = createDragGhost(row);
      }
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate3d(${event.clientX - 18}px, ${event.clientY - 14}px, 0)`;
      }
      const next = resolveDrop(event.clientX, event.clientY);
      dropHintRef.current = next;
      setDropHint(next);
      event.preventDefault();
    };

    const onUp = () => {
      const state = dragStateRef.current;
      const target = dropHintRef.current;
      const dragging = Boolean(state?.dragging);
      const movedId = state?.id ?? null;
      teardownDrag();
      if (dragging && movedId && target) void applyMove(movedId, target);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") teardownDrag();
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKeyDown);
      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current);
        autoScrollRef.current = 0;
      }
    };
  }, [dragId, applyMove, resolveDrop, teardownDrag]);

  const actionById = useMemo(
    () => new Map((bundle?.allActions ?? []).map((action) => [action.id, action])),
    [bundle],
  );
  const selectedNode = selected?.kind === "question" ? questionById.get(selected.id) ?? null : null;
  const selectedAction = selected?.kind === "action" ? actionById.get(selected.id) ?? null : null;
  const openPanel = selectedNode ?? selectedAction;
  const panelRef = useRef<HTMLElement | null>(null);

  // 背面のスクロールとfocusを止める。詳細は行の下へ展開せず、必ずこのモーダルで開く
  // （まさ 2026-09-10「トグルで開くんじゃなくてモーダルにしてくれた方が分かりやすい」）。
  useModalContainment({
    dialogRef: panelRef,
    initialFocusRef: panelRef,
    onClose: closeDetail,
    active: Boolean(openPanel),
  });

  // 以降は bundle が確定してから。hooks はすべてこの上で呼び終えている。
  if (!bundle) {
    return (
      <div className={styles.page} data-embedded={embedded || undefined}>
        <div className={styles.shell}>
          <section className={styles.section}>
            {loadFailed ? (
              <p className={styles.notice}>{loadFailed}</p>
            ) : (
              <p className={styles.emptyState}>読み込んでいる…</p>
            )}
          </section>
        </div>
      </div>
    );
  }

  const { counts, looseActions, canManage, members } = bundle;

  // 未承認は論点もTODOもツリーの中で光らせて決める。上へ抜き出す一覧は置かない
  // （まさ確定 2026-09-12「未承認リストが上にあるのもイケてない」）。
  const looseUnapprovedCount = looseActions.filter((action) => action.isProposed).length;
  /**
   * 未承認を先頭へ。下へ埋もれると、承認すべきものに気づけない。
   * ガントは確認するだけの面なので、未承認は出さない（まさ確定 2026-09-12）。
   */
  const orderedLooseActions =
    mode === "gantt"
      ? looseActions.filter((action) => !action.isProposed)
      : [
          ...looseActions.filter((action) => action.isProposed),
          ...looseActions.filter((action) => !action.isProposed),
        ];

  /** 根からこの問いまでの道。モーダルで文脈を見失わないために出す。 */
  const ancestorsOf = (node: QuestionNode): QuestionNode[] => {
    const trail: QuestionNode[] = [];
    let cursor = node.parentId;
    while (cursor) {
      const parent = questionById.get(cursor);
      if (!parent) break;
      trail.unshift(parent);
      cursor = parent.parentId;
    }
    return trail;
  };

  const renderAction = (action: ActionNode) => (
    <div className={styles.item} key={action.id}>
      <span className={styles.itemKind} data-kind={action.actionKind}>
        {action.actionKind === "measure" ? "確かめる" : "作業"}
      </span>
      <span className={styles.itemTitle} title={action.title}>
        {action.title}
      </span>
      <span className={styles.meta}>{ownerText(action)}</span>
      <span className={styles.meta} data-alert={action.isOverdue ? "true" : undefined}>
        {fmtDate(action.plannedEnd)}
      </span>
      <span className={styles.meta}>{ACTION_STATUS_LABEL[action.status]}</span>
    </div>
  );

  /**
   * その場で直せる欄。値を押すと、その位置だけが入力欄へ変わる
   * （まさ 2026-09-10「それぞれの枠のクリックで編集できるようにして」）。
   * 導出値（状態・次の期限・最終更新）は人が触れないので押せない。
   */
  const renderInline = (
    resource: "question" | "action",
    id: string,
    label: string,
    field: string,
    raw: string | null,
    display: string,
    kind: "text" | "date" | "multiline" | "select" = "text",
    options?: { value: string; label: string }[],
  ) => {
    const key = `${id}:${field}`;
    if (editingField !== key) {
      return (
        <div className={styles.field} key={key}>
          <span>{label}</span>
          {canManage ? (
            <button
              type="button"
              className={styles.fieldValue}
              data-single={kind === "multiline" ? undefined : "true"}
              onClick={() => {
                setEditingField(key);
                setError(null);
              }}
              title={display ? `${display}（押すと直せる）` : "押すと直せる"}
            >
              {display || "—"}
            </button>
          ) : (
            <b>{display || "—"}</b>
          )}
        </div>
      );
    }
    return (
      <form
        className={styles.field}
        key={key}
        onSubmit={(event) => {
          event.preventDefault();
          const value = String(new FormData(event.currentTarget).get("value") ?? "").trim();
          void send("PATCH", { resource, id, fields: { [field]: value } }).then((ok) => {
            if (ok) setEditingField(null);
          });
        }}
      >
        <span>{label}</span>
        {kind === "multiline" ? (
          <textarea
            name="value"
            defaultValue={raw ?? ""}
            autoFocus
            ref={autoSize}
            onInput={(event) => autoSize(event.currentTarget)}
          />
        ) : kind === "select" ? (
          <select name="value" defaultValue={raw ?? ""} autoFocus>
            {(options ?? []).map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input name="value" type={kind === "date" ? "date" : "text"} defaultValue={raw ?? ""} autoFocus />
        )}
        <div className={styles.inlineActions}>
          <button type="submit" className={styles.btn} data-variant="primary" disabled={busy}>
            {busy ? "保存中…" : "保存"}
          </button>
          <button
            type="button"
            className={styles.btn}
            data-variant="quiet"
            onClick={() => setEditingField(null)}
          >
            取消
          </button>
        </div>
      </form>
    );
  };

  /** ガントのバーの位置。横軸いっぱいを100%として日数で割る。 */
  const barStyle = (range: { start: string; end: string }) => {
    if (!ganttDomain) return undefined;
    const left = (diffDays(ganttDomain.start, range.start) / ganttDomain.totalDays) * 100;
    const width = ((diffDays(range.start, range.end) + 1) / ganttDomain.totalDays) * 100;
    return { left: `${left}%`, width: `${Math.max(width, 0.6)}%` };
  };

  /** TODOのバー。掴めるのは編集できる人だけ。押しただけなら詳細が開く。 */
  const renderActionLane = (action: ActionNode) => {
    const dragging = barDrag?.actionId === action.id;
    const range = dragging
      ? { start: barDrag.preview.plannedStart, end: barDrag.preview.plannedEnd }
      : barRangeOf(action);
    return (
      <div className={styles.lane}>
        {range && (
          <div
            ref={(element) => {
              if (element) barRefs.current.set(action.id, element);
              else barRefs.current.delete(action.id);
            }}
            className={styles.bar}
            data-bar="true"
            data-status={action.status}
            data-dragging={dragging ? "true" : undefined}
            data-overdue={action.isOverdue ? "true" : undefined}
            style={barStyle(range)}
            role="button"
            tabIndex={0}
            title={`${action.title}（${fmtDate(range.start)} 〜 ${fmtDate(range.end)}）`}
            onClick={() => {
              if (barDrag?.moved) return;
              // 前後関係をつないでいる途中なら、押したバーが「後ろ」になる。
              if (depDraft && depDraft !== action.id) {
                void send("POST", {
                  resource: "dependency",
                  fields: { predecessor_action_id: depDraft, successor_action_id: action.id },
                });
                setDepDraft(null);
                return;
              }
              if (depDraft === action.id) {
                setDepDraft(null);
                return;
              }
              select("action", action.id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                select("action", action.id);
              }
            }}
            onPointerDown={(event) => {
              if (!canManage || event.button !== 0 || !action.plannedEnd) return;
              const target = event.target as HTMLElement;
              const handle = target.dataset.handle === "start"
                ? "start"
                : target.dataset.handle === "end"
                  ? "end"
                  : "move";
              const original = {
                plannedStart: action.plannedStart ?? action.plannedEnd,
                plannedEnd: action.plannedEnd,
              };
              setBarDrag({
                actionId: action.id,
                handle,
                startX: event.clientX,
                original,
                preview: original,
                moved: false,
              });
            }}
          >
            {canManage && <span className={styles.barHandle} data-handle="start" aria-hidden="true" />}
            <span className={styles.barLabel}>{action.title}</span>
            {canManage && <span className={styles.barHandle} data-handle="end" aria-hidden="true" />}
          </div>
        )}
        {/* 前後関係をつなぐ「＋」。日程ドラッグの取っ手と重ならない位置へ常設する
            （3-16「依存線は常設の＋ポートから引く」）。押して起点を決め、
            次に押したバーが後ろになる。Escでやめる。 */}
        {range && canManage && (
          <button
            type="button"
            className={styles.depPort}
            data-armed={depDraft === action.id ? "true" : undefined}
            style={
              ganttDomain
                ? {
                    left: `calc(${
                      ((diffDays(ganttDomain.start, range.end) + 1) / ganttDomain.totalDays) * 100
                    }% + 6px)`,
                  }
                : undefined
            }
            title={depDraft === action.id ? "中止" : "後続を選択"}
            onClick={(event) => {
              event.stopPropagation();
              setDepDraft((current) => (current === action.id ? null : action.id));
            }}
          >
            ＋
          </button>
        )}
      </div>
    );
  };

  /** 問いの行に出す、配下TODOの広がり。押せない（人が編集する値ではない）。 */
  const renderRollupLane = (node: QuestionNode) => {
    const range = rollupById.get(node.id) ?? null;
    return (
      <div className={styles.lane}>
        {range && (
          <div
            className={styles.rollupBar}
            data-kind={node.questionKind}
            style={barStyle(range)}
            aria-hidden="true"
          />
        )}
      </div>
    );
  };

  /**
   * TODOの担当。押すとその場で付け外しする。
   * 担当が付いた瞬間が委託にあたる（3-22 §4）ので、フォームの保存を挟まない。
   */
  const renderOwnerPicker = (action: ActionNode) => (
    <div className={styles.ownerPicker}>
      <span className={styles.ownerPickerLabel}>担当</span>
      <div className={styles.ownerChips}>
        {members.length === 0 && <span className={styles.ownerEmpty}>名簿が読めなかったよ</span>}
        {members.map((member) => {
          const on = action.owners.some((owner) => owner.memberId === member.memberId);
          return (
            <button
              key={member.memberId}
              type="button"
              className={styles.ownerChip}
              data-on={on ? "true" : undefined}
              disabled={busy || !canManage}
              aria-pressed={on}
              onClick={() =>
                void send(on ? "DELETE" : "POST", {
                  resource: "action_owner",
                  fields: { action_id: action.id, member_id: member.memberId },
                })
              }
            >
              {member.displayName}
            </button>
          );
        })}
      </div>
    </div>
  );

  /**
   * TODOの前後関係。ガントの「＋」でつないだものをここで読み、外せる。
   * 線だけ引けて外せないと、間違えたときに直す場所が無くなる。
   */
  const renderDependencies = (action: ActionNode) => {
    if (!bundle) return null;
    const before = bundle.dependencies
      .filter((dependency) => dependency.successorActionId === action.id)
      .map((dependency) => ({ dependency, other: actionById.get(dependency.predecessorActionId) }));
    const after = bundle.dependencies
      .filter((dependency) => dependency.predecessorActionId === action.id)
      .map((dependency) => ({ dependency, other: actionById.get(dependency.successorActionId) }));
    if (before.length === 0 && after.length === 0) return null;
    const row = (
      label: string,
      list: { dependency: { predecessorActionId: string; successorActionId: string }; other?: ActionNode }[],
    ) =>
      list.length === 0 ? null : (
        <div className={styles.depRow} key={label}>
          <span className={styles.ownerPickerLabel}>{label}</span>
          <div className={styles.depItems}>
            {list.map(({ dependency, other }) => (
              <span
                className={styles.depItem}
                key={`${dependency.predecessorActionId}->${dependency.successorActionId}`}
              >
                <button
                  type="button"
                  className={styles.depItemTitle}
                  onClick={() => other && select("action", other.id)}
                >
                  {other?.title ?? "（見つからないTODO）"}
                </button>
                {canManage && (
                  <button
                    type="button"
                    className={styles.depItemRemove}
                    disabled={busy}
                    aria-label="この前後関係を外す"
                    onClick={() =>
                      void send("DELETE", {
                        resource: "dependency",
                        fields: {
                          predecessor_action_id: dependency.predecessorActionId,
                          successor_action_id: dependency.successorActionId,
                        },
                      })
                    }
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      );
    return (
      <div className={styles.depBlock}>
        {row("先行", before)}
        {row("後続", after)}
      </div>
    );
  };

  const renderActionDetailBody = (action: ActionNode) => {
    const owners = action.questionIds
      .map((id) => questionById.get(id))
      .filter((item): item is QuestionNode => Boolean(item));
    return (
      <div className={styles.panelBody}>
        <div className={styles.detailGrid}>
          {renderInline("action", action.id, "種類", "action_kind", action.actionKind, action.actionKind === "measure" ? "確かめる" : "作業", "select", [
            { value: "measure", label: "確かめる（測る / 調べる / 聞く）" },
            { value: "work", label: "作業（決まったことを実行する）" },
          ])}
          {renderInline("action", action.id, "状態", "status", action.status, ACTION_STATUS_LABEL[action.status], "select", [
            { value: "unassessed", label: "進捗未登録" },
            { value: "not_started", label: "未着手" },
            { value: "running", label: "実行中" },
            { value: "blocked", label: "止まっている" },
            { value: "done", label: "完了" },
            { value: "dropped", label: "やめた" },
          ])}
          {/* 相手側の人や役割名（こたさん、研究側）はここに残す。AMD側の担当は下の欄で選ぶ。 */}
          {renderInline("action", action.id, "担当メモ", "owner_label", action.ownerLabel, action.ownerLabel)}
          {renderInline("action", action.id, "期限", "planned_end", action.plannedEnd, action.plannedEnd ? fmtDate(action.plannedEnd) : "期限なし", "date")}
          {renderInline("action", action.id, "着手予定", "planned_start", action.plannedStart, action.plannedStart ? fmtDate(action.plannedStart) : "—", "date")}
          {renderInline("action", action.id, "完了日", "actual_end", action.actualEnd, action.actualEnd ? fmtDate(action.actualEnd) : "—", "date")}
          {/* 見積ptはMS・月次タブで決めて並べる。ここには出さない（外部も開く面） */}
          {action.actionKind === "measure" && (
            <>
              {renderInline("action", action.id, "目標値", "target", action.target, action.target ?? "—")}
              {renderInline("action", action.id, "実測値", "actual", action.actual, action.actual ?? "—")}
              {renderInline("action", action.id, "単位", "unit", action.unit, action.unit ?? "—")}
            </>
          )}
        </div>

        {renderOwnerPicker(action)}
        {renderDependencies(action)}

        {renderInline("action", action.id, "方法・条件", "detail", action.detail, action.detail ?? "", "multiline")}
        {renderInline("action", action.id, "完了条件", "done_criteria", action.doneCriteria, action.doneCriteria ?? "", "multiline")}
        {renderInline("action", action.id, "完了の証跡", "done_evidence", action.doneEvidence, action.doneEvidence ?? "", "multiline")}
        {renderInline("action", action.id, "詰まっていること", "blocker", action.blocker, action.blocker ?? "", "multiline")}

        <div className={styles.actions}>
          {renderDeleteAction(
            "action",
            action.id,
            action.children.length > 0,
            "下位のTODOがあるため削除できません。先に移動または削除してください",
          )}
        </div>

        {owners.length > 0 && (
          <div>
            <div className={styles.subHead}>対応する論点（{owners.length}）</div>
            <div className={styles.itemList}>
              {owners.map((owner) => (
                <button
                  type="button"
                  className={styles.item}
                  key={owner.id}
                  onClick={() => select("question", owner.id)}
                  style={{ textAlign: "left", cursor: "pointer", background: "none", border: 0, borderBottom: "1px solid #f0f0f2", width: "100%" }}
                >
                  <span className={styles.itemKind}>論点</span>
                  <span className={styles.itemTitle}>{owner.title}</span>
                  <span className={styles.meta}>{owner.ownerLabel}</span>
                  <span className={styles.meta}>{fmtDate(owner.nextDueDate)}</span>
                  <span className={styles.meta}>{QUESTION_STATE_LABEL[owner.state]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {action.findings.length > 0 && (
          <div>
            <div className={styles.subHead}>分かったこと（{action.findings.length}）</div>
            <div className={styles.itemList}>
              {action.findings.map((finding) => (
                <div className={styles.item} key={finding.id}>
                  <span className={styles.itemKind}>{FINDING_KIND_LABEL[finding.findingKind]}</span>
                  <span className={styles.itemTitle}>{finding.summary}</span>
                  <span className={styles.meta}>{finding.sourceLabel}</span>
                  <span className={styles.meta}>{fmtDate(finding.observedOn)}</span>
                  <span className={styles.meta}>{finding.confidence}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className={styles.notice}>{error}</p>}
      </div>
    );
  };

  const renderDetailBody = (node: QuestionNode) => {
    const derived = node.derivedQuestionIds
      .map((id) => questionById.get(id))
      .filter((item): item is QuestionNode => Boolean(item));
    return (
      <div className={styles.panelBody}>
        <div className={styles.detailGrid}>
          <div className={styles.field}>
            <span>状態（自動）</span>
            <b>{QUESTION_STATE_LABEL[node.state]}</b>
          </div>
          {renderInline("question", node.id, "担当", "owner_label", node.ownerLabel, node.ownerLabel)}
          {renderInline("question", node.id, "期限", "due_date", node.dueDate, node.dueDate ? fmtDate(node.dueDate) : "期限なし", "date")}
          {renderInline("question", node.id, "確からしさ", "confidence", node.confidence, CONFIDENCE_LABEL[node.confidence], "select", [
            { value: "high", label: "高い" },
            { value: "medium", label: "ふつう" },
            { value: "low", label: "低い" },
            { value: "unknown", label: "未評価" },
          ])}
          {node.questionKind !== "goal" &&
            node.questionKind !== "milestone" &&
            renderInline("question", node.id, "種類", "question_kind", node.questionKind, QUESTION_KIND_LABEL[node.questionKind], "select", [
              { value: "open", label: "論点（答えが出れば閉じる問い）" },
              { value: "hypothesis", label: "仮説（検証して真偽を確かめる主張）" },
              { value: "decision", label: "決めること（意思で決まる）" },
            ])}
          {/* 「どれか1つでよいか」は親が持つ。子が仮説かどうかとは別の軸
              （まさ確定 2026-09-12「仮説はそれぞれ検証されるべき。一方で、どれか１つが
              完了すればOKっていう論点もある」）。子が無いあいだは出さない。 */}
          {node.children.length > 0 &&
            renderInline("question", node.id, "子の扱い", "children_logic", node.childrenLogic, CHILDREN_LOGIC_LABEL[node.childrenLogic], "select", [
              { value: "all", label: CHILDREN_LOGIC_LABEL.all },
              { value: "any", label: CHILDREN_LOGIC_LABEL.any },
            ])}
          <div className={styles.field}>
            <span>次の期限（自動）</span>
            <b>{fmtDate(node.nextDueDate)}</b>
          </div>
          <div className={styles.field}>
            <span>最終更新（自動）</span>
            <b>
              {fmtDate(node.latestVerifiedAt)}
              {node.isStale ? "（更新切れ）" : ""}
            </b>
          </div>
        </div>


        {node.status === "answered" &&
          renderInline(
            "question",
            node.id,
            `答え${node.answeredOn ? `（${fmtDate(node.answeredOn)}${node.answeredBy ? ` / ${node.answeredBy}` : ""}）` : ""}`,
            "answer",
            node.answer,
            node.answer ?? "",
            "multiline",
          )}
        {node.status === "dropped" &&
          renderInline("question", node.id, "取り下げた理由", "drop_reason", node.dropReason, node.dropReason ?? "", "multiline")}

        {renderInline("question", node.id, "背景・前提", "background", node.background, node.background ?? "", "multiline")}

        <div>
          <div className={styles.subHead}>TODO（{node.actions.length}）</div>
          <div className={styles.itemList}>
            {node.actions.length === 0 ? (
              <p className={styles.empty}>
                ぶら下がっていない。この問いは、確かめる手が無いまま置かれている。
              </p>
            ) : (
              node.actions.map(renderAction)
            )}
          </div>
        </div>

        {node.findings.length > 0 && (
          <div>
            <div className={styles.subHead}>分かったこと（{node.findings.length}）</div>
            <div className={styles.itemList}>
              {node.findings.map((finding) => (
                <div className={styles.item} key={finding.id}>
                  <span className={styles.itemKind}>{FINDING_KIND_LABEL[finding.findingKind]}</span>
                  <span className={styles.itemTitle} title={finding.summary}>
                    {finding.summary}
                  </span>
                  <span className={styles.meta}>{finding.sourceLabel}</span>
                  <span className={styles.meta}>{fmtDate(finding.observedOn)}</span>
                  <span className={styles.meta}>{finding.confidence}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {derived.length > 0 && (
          <div>
            <div className={styles.subHead}>この問いから生まれたもの（{derived.length}）</div>
            <div className={styles.itemList}>
              {derived.map((item) => (
                <div className={styles.item} key={item.id}>
                  <span className={styles.itemKind}>問い</span>
                  <span className={styles.itemTitle}>{item.title}</span>
                  <span className={styles.meta}>{item.ownerLabel}</span>
                  <span className={styles.meta}>{fmtDate(item.nextDueDate)}</span>
                  <span className={styles.meta}>{QUESTION_STATE_LABEL[item.state]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className={styles.notice}>{error}</p>}

        {canManage && formKind === null && (
          <div className={styles.actions}>
            {node.status === "open" && (
              <button type="button" className={styles.btn} data-variant="primary" onClick={() => setFormKind("answer")}>
                解決にする
              </button>
            )}
            <button type="button" className={styles.btn} onClick={() => setFormKind("child")}>
              子を追加
            </button>
            <button type="button" className={styles.btn} onClick={() => setFormKind("finding")}>
              根拠を追加
            </button>
            {node.status === "open" && (
              <button type="button" className={styles.btn} data-variant="quiet" onClick={() => setFormKind("drop")}>
                取り下げ
              </button>
            )}
            {/* 取り下げ（取り消し線で残す）と削除（ツリーから削除する）は別。論点でも仮説でも
                TODOでもないものは、取り消し線で残すのではなく消す（まさ 2026-09-11）。
                入口は詳細の末尾、同じ場所で2段階確認、第2モーダルは開かない（3-16 の作法）。 */}
            {renderDeleteAction("question", node.id, node.children.length > 0, "下位の項目があるため削除できません。先に移動または削除してください")}
          </div>
        )}

        {canManage && formKind && (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void submitForm(formKind, node, event.currentTarget);
            }}
          >
            {formKind === "answer" && (
              <>
                <label>
                  答え（1行でいい）
                  <textarea name="answer" required placeholder="この問いに対して、いま言えること" />
                </label>
                <div className={styles.formRow}>
                  <label>
                    確からしさ
                    <select name="confidence" defaultValue="medium">
                      <option value="high">高い</option>
                      <option value="medium">ふつう</option>
                      <option value="low">低い</option>
                    </select>
                  </label>
                </div>
              </>
            )}
            {formKind === "drop" && (
              <label>
                追わないと決めた理由
                <textarea name="drop_reason" required placeholder="なぜこの枝を捨てるのか" />
              </label>
            )}
            {formKind === "child" && (
              <>
                <div className={styles.formRow}>
                  <label>
                    種類
                    <select name="child_kind" defaultValue={node.questionKind === "goal" ? "milestone" : "open"}>
                      {/* MSは到達点の直下だけ。ほかの場所では選択肢に出さない（3-22 §3） */}
                      {node.questionKind === "goal" && (
                        <option value="milestone">MS（到達点を成り立たせる条件）</option>
                      )}
                      <option value="open">論点（答えが出れば閉じる問い）</option>
                      <option value="hypothesis">仮説（検証して真偽を確かめる主張）</option>
                      <option value="decision">決めること（意思で決まる）</option>
                      <option value="measure">TODO・確認（測る / 調べる / 聞く）</option>
                      <option value="work">TODO・作業（決まったことを実行する）</option>
                    </select>
                  </label>
                </div>
                <label>
                  内容
                  <input name="title" required placeholder="〜は成立するか / 〜を測る" />
                </label>
                <div className={styles.formRow}>
                  <label>
                    担当
                    <input name="owner_label" placeholder="担当未確認" />
                  </label>
                  <label>
                    期限
                    <input name="due_date" type="date" />
                  </label>
                </div>
                <label>
                  補足（TODOなら方法・条件）
                  <textarea name="detail" placeholder="必要なら書く" />
                </label>
              </>
            )}
            {formKind === "finding" && (
              <>
                <label>
                  分かったこと
                  <textarea name="summary" required placeholder="何が分かったか" />
                </label>
                <div className={styles.formRow}>
                  <label>
                    種類
                    <select name="finding_kind" defaultValue="supports">
                      <option value="supports">裏づけ</option>
                      <option value="contradicts">反証</option>
                      <option value="neutral">観測</option>
                      <option value="missing">不足（分かっていないと分かった）</option>
                    </select>
                  </label>
                  <label>
                    出どころ
                    <input name="source_label" placeholder="議事録 / 論文 / 実験 / 相手の発言" />
                  </label>
                  <label>
                    いつ
                    <input name="observed_on" type="date" />
                  </label>
                </div>
              </>
            )}
            <div className={styles.actions}>
              <button type="submit" className={styles.btn} data-variant="primary" disabled={busy}>
                {busy ? "保存中…" : "保存"}
              </button>
              <button type="button" className={styles.btn} data-variant="quiet" onClick={() => setFormKind(null)}>
                やめる
              </button>
            </div>
          </form>
        )}
      </div>
    );
  };

  /**
   * ツリーの罫線。1階層につき2枡進める（罫線の枡＋開閉マークの枡）。
   * こうすると子の `├` が、親のタイトルの1文字目の真下へ来る
   * （まさ 2026-09-10「子側の『├』は、『バイオディーゼル事業〜』の『バ』の下にないと変」）。
   * lines[k-1] = 深さ k の祖先がまだ兄弟を残しているか（残していれば縦線を継ぐ）。
   */
  /**
   * 親子のつながりを線で描く。罫線の文字（├ └ │）は字体とフォントで太さも位置も
   * 変わるので、CSSの1pxの線で引く。枡の幅（15px）と「子の枝が親のタイトルの
   * 1文字目の真下から出る」関係は 3-21 のまま変えない。
   *
   * `hasTwisty` は、この行が開閉マークを持つか。持たない行は枝の横線を
   * マークの枡ぶんまで伸ばして、タイトルまで線を届かせる。
   */
  const renderRail = (
    lines: boolean[],
    isLast: boolean,
    depth: number,
    twisty: React.ReactNode,
    hasTwisty: boolean,
  ) => {
    const cells: React.ReactNode[] = [];
    for (let index = 0; index < depth * 2; index += 1) {
      let kind: "pass" | "through" | "last" | null = null;
      if (index === depth * 2 - 1) kind = isLast ? "last" : "through";
      else if (index % 2 === 1 && lines[(index - 1) / 2]) kind = "pass";
      cells.push(
        <span
          className={styles.railCell}
          data-line={kind ?? undefined}
          key={index}
          style={
            kind === "through" || kind === "last"
              ? ({ "--rail-arm": hasTwisty ? "8px" : "23px" } as React.CSSProperties)
              : undefined
          }
        />,
      );
    }
    return (
      <span className={styles.rail} aria-hidden="true">
        {cells}
        {twisty}
      </span>
    );
  };


  /** 行のすぐ上に論点を足す。押した位置の直上の子として、その先頭へ入れる。 */
  const addQuestionAbove = async (rowId: string, title: string) => {
    const parentId = parentForGapAbove.get(rowId);
    if (!parentId) return;
    const parent = questionById.get(parentId);
    const minOrder = parent?.children.reduce(
      (min, child) => Math.min(min, child.sortOrder),
      Number.POSITIVE_INFINITY,
    );
    const sortOrder = minOrder !== undefined && Number.isFinite(minOrder) ? minOrder - 10 : 10;
    const ok = await send("POST", {
      resource: "question",
      fields: {
        parent_id: parentId,
        title,
        question_kind: "open",
        owner_label: "担当未確認",
        sort_order: sortOrder,
      },
    });
    if (ok) {
      setOpenIds((current) => new Set([...current, parentId]));
      setInsertAbove(null);
    }
  };

  /** 行のすぐ上に出す帯。ホバーしたときだけ＋が見える。 */
  const renderGapAbove = (rowId: string) => {
    if (!canManage || !parentForGapAbove.has(rowId)) return null;
    if (insertAbove === rowId) {
      return (
        <form
          className={styles.gapForm}
          onSubmit={(event) => {
            event.preventDefault();
            const value = String(new FormData(event.currentTarget).get("value") ?? "").trim();
            if (!value) {
              setInsertAbove(null);
              return;
            }
            void addQuestionAbove(rowId, value);
          }}
        >
          <input
            name="value"
            autoFocus
            placeholder="ここに入れる論点"
            onKeyDown={(event) => {
              if (event.key === "Escape") setInsertAbove(null);
            }}
          />
          <button type="submit" className={styles.btn} data-variant="primary" disabled={busy}>
            {busy ? "追加中…" : "追加"}
          </button>
          <button
            type="button"
            className={styles.btn}
            data-variant="quiet"
            onClick={() => setInsertAbove(null)}
          >
            取消
          </button>
        </form>
      );
    }
    return (
      <div className={styles.gap}>
        <button
          type="button"
          className={styles.gapAdd}
          aria-label="ここに論点を足す"
          title="ここに論点を足す"
          onClick={(event) => {
            event.stopPropagation();
            setInsertAbove(rowId);
          }}
        >
          ＋
        </button>
      </div>
    );
  };

  /**
   * 行のどこを押しても詳細を開く（まさ 2026-09-12「その行のどこをクリックしても
   * モーダルが開くようにして。現状だとタイトルの文字の上しかモーダルが開かない」）。
   * 承認・却下・つまみ・開閉のしるし・ガントのバーなど、それ自体に用のあるものは除く。
   */
  const openRowFrom = (kind: "question" | "action", id: string) => (event: React.MouseEvent) => {
    // つまみやバーを離した直後にも click は飛んでくる。動かしただけで詳細が開くと邪魔。
    if (Date.now() - draggedAtRef.current < 300) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, select, textarea, label, [role='button'], [data-bar]")) return;
    select(kind, id);
  };

  /**
   * モーダルの見出しを、その場で直せるようにする。別欄を作らない
   * （まさ 2026-09-12「タイトルがそのまま編集できずに、代わりに別の場所に『見出し』って
   * いうところがあってそこで編集するのがめちゃくちゃ分かりにくい」）。
   * 保存経路は renderInline と同じ。
   */
  const renderTitleEditor = (resource: "question" | "action", id: string, title: string) => {
    const key = `${id}:title`;
    if (editingField !== key) {
      if (!canManage) return <h3>{title}</h3>;
      return (
        <h3>
          <button
            type="button"
            className={styles.titleEdit}
            onClick={() => {
              setEditingField(key);
              setError(null);
            }}
            title="押すと直せる"
          >
            {title}
          </button>
        </h3>
      );
    }
    return (
      <form
        className={styles.titleForm}
        onSubmit={(event) => {
          event.preventDefault();
          const value = String(new FormData(event.currentTarget).get("value") ?? "").trim();
          if (!value) {
            setError("見出しは空にできないよ");
            return;
          }
          void send("PATCH", { resource, id, fields: { title: value } }).then((ok) => {
            if (ok) setEditingField(null);
          });
        }}
      >
        <textarea
          name="value"
          defaultValue={title}
          autoFocus
          ref={autoSize}
          onInput={(event) => autoSize(event.currentTarget)}
        />
        <div className={styles.inlineActions}>
          <button type="submit" className={styles.btn} data-variant="primary" disabled={busy}>
            {busy ? "保存中…" : "保存"}
          </button>
          <button
            type="button"
            className={styles.btn}
            data-variant="quiet"
            onClick={() => setEditingField(null)}
          >
            取消
          </button>
        </div>
      </form>
    );
  };

  /**
   * 未承認の印と、その場で決めるボタン。論点・到達点・MSとTODOで同じ形にする
   * （まさ確定 2026-09-12「ツリーの中に未承認として目立たせて表示して」）。
   * 送り先は POST 側のハンドラ。PATCH へ投げると 400 になる。
   */
  const renderProposedControls = (kind: "question" | "action", id: string) => (
    <>
      <span className={styles.chip} data-kind="proposed">
        未承認
      </span>
      {canManage && (
        <>
          <button
            type="button"
            className={styles.inlineApprove}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              void send("POST", { resource: "proposal_accept", fields: { kind, id } });
            }}
          >
            承認
          </button>
          <button
            type="button"
            className={styles.inlineReject}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              void send("POST", { resource: "proposal_reject", fields: { kind, id } });
            }}
          >
            却下
          </button>
        </>
      )}
    </>
  );

  /** TODOもツリーの子として出す。問いの下に何が積まれているかを1つのツリーで読む。 */
  const renderActionRow = (action: ActionNode, lines: boolean[], isLast: boolean, depth: number) => {
    const closed = action.status === "done" || action.status === "dropped";
    // ガントは日程のあるTODOだけを並べる面なので、子もそこで絞る。
    const childActions =
      mode === "gantt"
        ? action.children.filter((child) => !child.isProposed && barRangeOf(child))
        : action.children;
    const hasChildren = childActions.length > 0;
    const isOpen = openIds.has(action.id);
    const childLines = [...lines, !isLast];
    return (
      <div className={styles.node} key={`action-${action.id}`}>
        {renderGapAbove(action.id)}
        <div
          className={styles.row}
          data-row-kind="action"
          data-action-row={action.id}
          data-proposed={action.isProposed ? "true" : undefined}
          data-unassigned={action.isUnassigned ? "true" : undefined}
          data-open={selected?.kind === "action" && selected.id === action.id ? "true" : undefined}
          role="presentation"
          onClick={openRowFrom("action", action.id)}
        >
          <div className={styles.rowLead}>
            {canManage && <span className={styles.gripSpacer} aria-hidden="true" />}
            {renderRail(
              lines,
              isLast,
              depth,
              <span
                className={styles.twisty}
                onClick={(event) => {
                  event.stopPropagation();
                  if (hasChildren) toggle(action.id);
                }}
                role={hasChildren ? "button" : undefined}
                aria-label={hasChildren ? (isOpen ? "たたむ" : "ひらく") : undefined}
              >
                {hasChildren ? (isOpen ? "▾" : "▸") : ""}
              </span>,
              hasChildren,
            )}
            <button
              type="button"
              className={styles.title}
              data-closed={closed ? "true" : undefined}
              data-parent={hasChildren ? "true" : undefined}
              onClick={() => select("action", action.id)}
              title={action.title}
            >
              {action.title}
            </button>
            <span className={styles.chip} data-kind={action.actionKind}>
              {action.actionKind === "measure" ? "確かめる" : "作業"}
            </span>
            {action.isProposed && renderProposedControls("action", action.id)}
            {action.isUnassigned && !action.isProposed && (
              <span className={styles.chip} data-kind="unassigned">
                未アサイン
              </span>
            )}
            <span className={styles.flagDot} data-flag={action.isOverdue ? "overdue" : undefined} />
          </div>
          {mode === "gantt" ? (
            renderActionLane(action)
          ) : (
            <>
              <span className={styles.state} data-state="action">
                {ACTION_STATUS_LABEL[action.status]}
              </span>
              <span className={styles.meta}>{ownerText(action)}</span>
              <span className={styles.meta} data-alert={action.isOverdue ? "true" : undefined}>
                {action.plannedEnd ? fmtDate(action.plannedEnd) : "期限なし"}
              </span>
            </>
          )}
        </div>
        {/* TODOの下にぶら下がるTODO。描かないと、親を持つ行がツリーのどこにも出ない
            （2026-09-12 本番で確認。ZMPは未承認70件のうち52件がこの形で隠れていた）。 */}
        {hasChildren &&
          isOpen &&
          childActions.map((child, index) =>
            renderActionRow(child, childLines, index === childActions.length - 1, depth + 1),
          )}
      </div>
    );
  };

  const renderNode = (node: QuestionNode, lines: boolean[] = [], isLast = true, depth = 0) => {
    const isOpen = openIds.has(node.id);
    const isSelected = selected?.kind === "question" && selected.id === node.id;
    // ガントは確認するだけの面。未承認はツリーでだけ扱う（まさ確定 2026-09-12）。
    const childQuestions =
      mode === "gantt" ? node.children.filter((child) => !child.isProposed) : node.children;
    // ガントでは日程の無いTODOをツリーの中に出さない。下の「日程未設定」へまとめて
    // 集め、そこで担当・期限・見積ptを入れる（3-22 §4 会議後のアサイン）。
    // ガントは確認するだけの面。未承認はツリーでだけ扱う（まさ確定 2026-09-12）。
    const childActions =
      mode === "gantt"
        ? node.actions.filter((action) => !action.isProposed && barRangeOf(action))
        : node.actions;
    const childCount = childQuestions.length + childActions.length;
    const hasChildren = childCount > 0;
    // 根同士のあいだには縦線を引かない。子から先が枝分かれの表現になる。
    const childLines = depth === 0 ? [] : [...lines, !isLast];
    return (
      <div className={styles.node} key={node.id}>
        {renderGapAbove(node.id)}
        <div
          className={styles.row}
          data-question-row={node.id}
          data-row-kind="question"
          data-open={isSelected ? "true" : undefined}
          data-proposed={node.isProposed ? "true" : undefined}
          data-flag={!node.isProposed && needsAttention(node) ? node.state : undefined}
          data-overdue={node.isOverdue ? "true" : undefined}
          data-dragging={dragId === node.id ? "true" : undefined}
          data-drop={dropHint?.id === node.id ? dropHint.position : undefined}
          role="presentation"
          onClick={openRowFrom("question", node.id)}
        >
          <div className={styles.rowLead}>
            {canManage && (
              <span
                className={styles.grip}
                role="button"
                tabIndex={-1}
                aria-label={`${node.title} を掴んで動かす`}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
                  dragStateRef.current = {
                    id: node.id,
                    startX: event.clientX,
                    startY: event.clientY,
                    dragging: false,
                  };
                  pointerRef.current = { x: event.clientX, y: event.clientY };
                  setDragId(node.id);
                }}
              >
                <GripVertical width={12} height={12} aria-hidden="true" />
              </span>
            )}
            {renderRail(
              lines,
              isLast,
              depth,
              <span
                className={styles.twisty}
                onClick={(event) => {
                  event.stopPropagation();
                  if (hasChildren) toggle(node.id);
                }}
                role={hasChildren ? "button" : undefined}
                aria-label={hasChildren ? (isOpen ? "たたむ" : "ひらく") : undefined}
              >
                {hasChildren ? (isOpen ? "▾" : "▸") : ""}
              </span>,
              hasChildren,
            )}
            <button
              type="button"
              className={styles.title}
              data-closed={node.status !== "open" ? "true" : undefined}
              data-parent={hasChildren ? "true" : undefined}
              onClick={() => select("question", node.id)}
              title={node.title}
            >
              {node.title}
            </button>
            {/* 印はタイトルの後ろへ置く。前に置くと幅が可変なぶん、子の ├ と
                親のタイトル位置がずれる（まさ 2026-09-10 の指摘の実体）。 */}
            {node.questionKind === "hypothesis" && (
              <span className={styles.chip} data-kind="alternative">
                仮説
              </span>
            )}
            {node.questionKind === "decision" && (
              <span className={styles.chip} data-kind="decision">
                決める
              </span>
            )}
            {/* 「どれか1つで解ける」は親の性質。子ごとの印ではない
                （まさ確定 2026-09-12）。既定の all は印を出さない。 */}
            {node.childrenLogic === "any" && node.children.length > 0 && (
              <span className={styles.chip} data-kind="anyOf" title="子のどれか1つ解ければ、この問いは解ける">
                どれか1つ
              </span>
            )}
            {/* 到達点とMSはツリーの骨格。3-21 の判定色は増やさず、印と字体だけで区別する。 */}
            {(node.questionKind === "goal" || node.questionKind === "milestone") && (
              <span className={styles.chip} data-kind={node.questionKind}>
                {QUESTION_KIND_LABEL[node.questionKind]}
              </span>
            )}
            {node.isProposed && renderProposedControls("question", node.id)}
            {/* ptはここに出さない。ツリーとガントは外部メンバーも見る面で、
                報酬に直結する数字を置けない（まさ 2026-09-11）。
                ptを並べて比べるのはMS・月次タブ。ここではTODOの数だけ出す。 */}
            {(node.questionKind === "goal" || node.questionKind === "milestone") &&
              node.todoCount > 0 && (
                <span className={styles.chip} data-kind="rollup">
                  TODO {node.todoCount}
                  {node.unassignedCount > 0 ? `（未${node.unassignedCount}）` : ""}
                </span>
              )}
            {/* 状態は縦棒でなく丸で示す。縦棒は罫線と重なって読みにくい
                （まさ 2026-09-10「丸の方が信号っぽい」）。タイトルの後ろへ置くと
                子の罫線と親のタイトル位置がずれない。 */}
            <span className={styles.flagDot} data-flag={needsAttention(node) ? node.state : undefined} />
          </div>
          {mode === "gantt" ? (
            renderRollupLane(node)
          ) : (
            <>
              <span className={styles.state} data-state={node.state}>
                {QUESTION_STATE_LABEL[node.state]}
              </span>
              <span className={styles.meta}>{node.ownerLabel}</span>
              <span className={styles.meta} data-alert={node.isOverdue ? "true" : undefined}>
                {node.nextDueDate ? fmtDate(node.nextDueDate) : "期限なし"}
              </span>
            </>
          )}
        </div>
        {isOpen && (
          <>
            {childQuestions.map((child, index) =>
              renderNode(child, childLines, index === childCount - 1, depth + 1),
            )}
            {childActions.map((action, index) =>
              renderActionRow(
                action,
                childLines,
                childQuestions.length + index === childCount - 1,
                depth + 1,
              ),
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={styles.page} data-embedded={embedded || undefined}>
      <div className={styles.shell}>
        <header className={styles.header}>
          {/* ガントタブには「ガント」の見出しが既にある。同じツリーに2つ見出しを付けない。 */}
          {mode !== "gantt" && (
            <div className={styles.headerTitle}>
              <h1>{embedded ? "ゴールツリー" : projectName}</h1>
              <p>
                
              </p>
            </div>
          )}
          <div className={styles.summary}>
            <span className={styles.stat}>
              論点<b>{counts.questions}</b>
            </span>
            <span className={styles.stat}>
              未閉じ<b>{counts.open}</b>
            </span>
            <span className={styles.stat} data-tone="action">
              判断できる<b>{counts.decidable}</b>
            </span>
            <span className={styles.stat} data-tone="warn">
              手が止まっている<b>{counts.stalled}</b>
            </span>
            <span className={styles.stat} data-tone="bad">
              枝が死んだ<b>{counts.deadBranch}</b>
            </span>
            <span className={styles.stat} data-tone={counts.overdue > 0 ? "bad" : undefined}>
              期限超過<b>{counts.overdue}</b>
            </span>
            {/* アサインはツリーの上で行う（3-22 §4）。件数から最初の未アサイン行へ移す。 */}
            <button
              type="button"
              className={styles.stat}
              data-tone={counts.unassignedActions > 0 ? "warn" : undefined}
              data-clickable={counts.unassignedActions > 0 ? "true" : undefined}
              disabled={counts.unassignedActions === 0}
              title={
                counts.unassignedActions > 0
                  ? "担当か期限が空のTODOの、いちばん上へ移る"
                  : undefined
              }
              onClick={goToFirstUnassigned}
            >
              未アサイン<b>{counts.unassignedActions}</b>
            </button>
            <span className={styles.stat}>
              答えが出た<b>{counts.answered}</b>
            </span>
          </div>
        </header>

        <section className={styles.section}>
          {/* 到達点はツリーのいちばん上に置くので、どの行の「子を追加」からも作れない。
              ツリーのいちばん上に導線を1つだけ置く（3-22 §3）。 */}
          {canManage && (
            <div className={styles.goalAdd}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setGoalFormOpen((open) => !open)}
              >
                {goalFormOpen ? "やめる" : "到達点を追加"}
              </button>
              {goalFormOpen && (
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void addGoal(event.currentTarget);
                  }}
                >
                  <label>
                    到達点
                    <input
                      name="title"
                      required
                      placeholder="2027年4月1日にNewCoを設立し事業を開始している"
                    />
                  </label>
                  <div className={styles.formRow}>
                    <label>
                      期日
                      <input name="due_date" type="date" />
                    </label>
                  </div>
                  <label>
                    背景（任意）
                    <textarea name="background" placeholder="なぜこれが到達点なのか" />
                  </label>
                  <div className={styles.formActions}>
                    <button type="submit" className={styles.btn} data-variant="primary" disabled={busy}>
                      保存
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
          {roots.length === 0 ? (
            <p className={styles.emptyState}>まだ登録されていない。</p>
          ) : mode === "gantt" ? (
            <div className={styles.gantt}>
              <div className={styles.ganttHead}>
                <div className={styles.ganttHeadLead}>
                  <span>
                    {depDraft
                      ? "後続にするバーを選択（Esc で中止）"
                      : "到達点 → MS → 論点 → TODO"}
                  </span>
                </div>
                <div className={styles.ganttAxis} ref={axisRef}>
                  {monthTicks.map((tick) => (
                    <span
                      key={tick.key}
                      className={styles.monthTick}
                      style={{ left: `${tick.leftPct}%`, width: `${tick.widthPct}%` }}
                    >
                      {tick.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className={styles.ganttBody} ref={ganttBodyRef}>
                {/* 今日の線と依存線は行に属さないので、全行を覆う面へ置く。 */}
                <div className={styles.ganttOverlay} aria-hidden="true">
                  <div className={styles.ganttOverlayLead} />
                  <div className={styles.ganttOverlayLane}>
                    {ganttDomain && bundle.asOf >= ganttDomain.start && bundle.asOf <= ganttDomain.end && (
                      <span
                        className={styles.todayLine}
                        style={{
                          left: `${(diffDays(ganttDomain.start, bundle.asOf) / ganttDomain.totalDays) * 100}%`,
                        }}
                      />
                    )}
                    <svg className={styles.depLayer}>
                      {depPaths.map((segment) => (
                        <path key={segment.key} d={segment.path} />
                      ))}
                    </svg>
                  </div>
                </div>
                <div className={styles.tree} data-mode="gantt">
                  {roots.map((root, index) => renderNode(root, [], index === roots.length - 1, 0))}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.tree}>
              {roots.map((root, index) => renderNode(root, [], index === roots.length - 1, 0))}
            </div>
          )}
        </section>

        {mode === "gantt" && undatedActions.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>日程未設定</h2>
              <span>
                {undatedActions.length}件。ここで日程を付けると上のガントに並ぶ。担当と見積ptは
                ゴールツリータブで付ける
              </span>
            </div>
            <div className={styles.undated}>
              {undatedActions.map((action) => (
                <div className={styles.undatedRow} key={action.id}>
                  <button
                    type="button"
                    className={styles.undatedTitle}
                    onClick={() => select("action", action.id)}
                    title={action.title}
                  >
                    {action.title}
                  </button>
                  {/* 担当と見積ptはここで付けない。アサインはゴールツリーの上で行う
                      （まさ確定 2026-09-11、3-22 §4）。ここは日程だけ。
                      すでに決まっている担当は、誰の仕事かが分かるように読み取りで出す。 */}
                  <span className={styles.undatedOwnerText}>
                    {action.owners.length > 0 ? ownerText(action) : "担当はツリーで"}
                  </span>
                  <input
                    className={styles.undatedInput}
                    type="date"
                    aria-label={`${action.title} の着手予定`}
                    defaultValue={action.plannedStart ?? ""}
                    disabled={busy || !canManage}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      if (!value) return;
                      void send("PATCH", {
                        resource: "action",
                        id: action.id,
                        fields: { planned_start: value },
                      });
                    }}
                  />
                  <input
                    className={styles.undatedInput}
                    type="date"
                    aria-label={`${action.title} の期限`}
                    defaultValue={action.plannedEnd ?? ""}
                    disabled={busy || !canManage}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      if (!value) return;
                      void send("PATCH", {
                        resource: "action",
                        id: action.id,
                        fields: { planned_end: value },
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {orderedLooseActions.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>論点に紐づいていないTODO</h2>
              <span>
                {orderedLooseActions.length}件
                {mode !== "gantt" && looseUnapprovedCount > 0
                  ? `（うち未承認 ${looseUnapprovedCount}）`
                  : ""}
              </span>
            </div>
            {mode === "gantt" ? (
              <div className={styles.itemList} style={{ border: 0, borderRadius: 0 }}>
                {orderedLooseActions.slice(0, 40).map(renderAction)}
              </div>
            ) : (
              /* ツリーの行と同じ形で描く。未承認はここでも光り、その場で承認・却下できる
                 （まさ確定 2026-09-12「ツリーの中に未承認として目立たせて表示して」）。
                 件数で切らない。切ると未承認が黙って隠れる。 */
              <div className={styles.tree}>
                {orderedLooseActions.map((action, index) =>
                  renderActionRow(action, [], index === orderedLooseActions.length - 1, 0),
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {openPanel &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={styles.backdrop}
            role="presentation"
            data-modal-layer="question-tree-detail"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeDetail();
            }}
          >
            <section
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={`${openPanel.title} の詳細`}
              className={styles.panel}
            >
              <header className={styles.panelHead}>
                <div className={styles.panelTitle}>
                  <div className={styles.panelEyebrow}>
                    {/* どの論点の下の話なのかを、開いた先でも見失わないようにする */}
                    {selectedNode &&
                      ancestorsOf(selectedNode).map((ancestor) => (
                        <button
                          type="button"
                          className={styles.crumb}
                          key={ancestor.id}
                          onClick={() => select("question", ancestor.id)}
                          title={ancestor.title}
                        >
                          {ancestor.title}
                        </button>
                      ))}
                    {selectedNode && selectedNode.questionKind !== "open" && (
                      <span className={styles.chip} data-kind={selectedNode.questionKind === "hypothesis" ? "alternative" : selectedNode.questionKind}>
                        {QUESTION_KIND_LABEL[selectedNode.questionKind]}
                      </span>
                    )}
                    {selectedNode?.childrenLogic === "any" && selectedNode.children.length > 0 && (
                      <span className={styles.chip} data-kind="anyOf">
                        どれか1つ
                      </span>
                    )}
                    {selectedAction && (
                      <span className={styles.chip} data-kind={selectedAction.actionKind}>
                        {selectedAction.actionKind === "measure" ? "確かめる" : "作業"}
                      </span>
                    )}
                  </div>
                  {renderTitleEditor(
                    selectedNode ? "question" : "action",
                    selectedNode ? selectedNode.id : (selectedAction as ActionNode).id,
                    openPanel.title,
                  )}
                </div>
                <button type="button" className={styles.panelClose} onClick={closeDetail} aria-label="閉じる">
                  ×
                </button>
              </header>
              {selectedNode ? renderDetailBody(selectedNode) : selectedAction ? renderActionDetailBody(selectedAction) : null}
            </section>
          </div>,
          document.body,
        )}
    </div>
  );
}
