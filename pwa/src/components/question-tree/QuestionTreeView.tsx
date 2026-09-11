"use client";

import { GripVertical } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useModalContainment } from "@/components/project-workspace/useModalContainment";
import {
  ACTION_STATUS_LABEL,
  FINDING_KIND_LABEL,
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
 * 子の問い・やること・分かったことだけ。
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

const CONTRIBUTION_LABEL: Record<string, string> = {
  required: "必須",
  alternative: "代替",
};

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

/** 木の中で目立たせる問い。手を打つべきものだけに絞る。 */
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
  for (const node of bundle.allQuestions) {
    if (!needsAttention(node)) continue;
    let cursor = node.parentId;
    while (cursor) {
      ids.add(cursor);
      cursor = byId.get(cursor)?.parentId ?? null;
    }
  }
  return ids;
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
}: {
  /** サーバ側で先に読めているときだけ渡す。無ければ開いたときに自分で取りに行く */
  initialBundle?: QuestionTreeBundle;
  projectId: string;
  projectName: string;
  /** PJワークスペースのタブに埋め込むとき。ページとしての枠を外す */
  embedded?: boolean;
}) {
  const [bundle, setBundle] = useState<QuestionTreeBundle | null>(initialBundle ?? null);
  const [openIds, setOpenIds] = useState<Set<string>>(() => defaultOpenIds(initialBundle));
  const [selected, setSelected] = useState<{ kind: "question" | "action"; id: string } | null>(null);
  const [formKind, setFormKind] = useState<FormKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [goalFormOpen, setGoalFormOpen] = useState(false);

  useEffect(() => {
    if (initialBundle) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/project/${projectId}/question-tree`);
        const payload = (await response.json()) as QuestionTreeBundle & { error?: string };
        if (cancelled) return;
        if (!response.ok) throw new Error(payload.error || "読み込めなかったよ");
        setBundle(payload);
        setOpenIds(defaultOpenIds(payload));
      } catch (caught) {
        if (!cancelled) setLoadFailed(caught instanceof Error ? caught.message : "読み込めなかったよ");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialBundle, projectId]);

  const roots = useMemo(() => bundle?.roots ?? [], [bundle]);

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
        const response = await fetch(`/api/project/${projectId}/question-tree`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await response.json()) as { bundle?: QuestionTreeBundle; error?: string };
        if (!response.ok) throw new Error(payload.error || "保存できなかったよ");
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

  /** 到達点は親を持たないので、木の頭の導線から直接足す。 */
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
        // 子として足せるのは、論点 / 仮説（＝代替の論点）/ 決めること / やること。
        // 種類ごとに別ボタンを置くとボタンが増えるので、1つのフォームで選ばせる
        // （まさ 2026-09-10「ボタンが無駄に増えるとUXがどんどん悪くなる」）。
        const childKind = text("child_kind") || "required";
        if (childKind === "measure" || childKind === "work") {
          const created = await fetch(`/api/project/${projectId}/question-tree`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resource: "action",
              fields: {
                title: text("title"),
                action_kind: childKind,
                owner_label: text("owner_label") || "担当未確認",
                planned_end: text("due_date"),
                detail: text("detail"),
                origin_question_id: node.id,
              },
            }),
          });
          const payload = (await created.json()) as { id?: string; error?: string };
          if (!created.ok || !payload.id) {
            setError(payload.error || "やることを足せなかったよ");
            return;
          }
          await send("POST", {
            resource: "question_action",
            fields: { question_id: node.id, action_id: payload.id },
          });
          return;
        }
        const questionKind =
          childKind === "decision" ? "decision" : childKind === "milestone" ? "milestone" : "open";
        await send("POST", {
          resource: "question",
          fields: {
            parent_id: node.id,
            // MSは到達点を成り立たせる条件なので、必ず「必須」で入る。
            contribution: childKind === "alternative" ? "alternative" : "required",
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
        const created = await fetch(`/api/project/${projectId}/question-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resource: "finding",
            fields: {
              summary: text("summary"),
              finding_kind: text("finding_kind") || "neutral",
              source_label: text("source_label") || "出どころ未確認",
              observed_on: text("observed_on"),
            },
          }),
        });
        const payload = (await created.json()) as { id?: string; bundle?: QuestionTreeBundle; error?: string };
        if (!created.ok || !payload.id) {
          setError(payload.error || "分かったことを足せなかったよ");
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

  const { counts, looseActions, canManage, proposals, members } = bundle;

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

  /** やることの詳細。問いと同じく、値を押すとその位置が入力欄へ変わる。 */
  /**
   * TODOの担当（複数可）。押すとその場で付け外しする。
   * 担当が付いた瞬間が委託にあたる（3-22 §4）ので、フォームの保存を挟まない。
   */
  const renderOwnerPicker = (action: ActionNode) => (
    <div className={styles.ownerPicker}>
      <span className={styles.ownerPickerLabel}>担当（複数可）</span>
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
          {renderInline("action", action.id, "見積pt", "estimated_pt", action.estimatedPt === null ? null : String(action.estimatedPt), ptText(action.estimatedPt))}
          {action.actionKind === "measure" && (
            <>
              {renderInline("action", action.id, "目標値", "target", action.target, action.target ?? "—")}
              {renderInline("action", action.id, "実測値", "actual", action.actual, action.actual ?? "—")}
              {renderInline("action", action.id, "単位", "unit", action.unit, action.unit ?? "—")}
            </>
          )}
        </div>

        {renderOwnerPicker(action)}

        {renderInline("action", action.id, "見出し", "title", action.title, action.title, "multiline")}
        {renderInline("action", action.id, "方法・条件", "detail", action.detail, action.detail ?? "", "multiline")}
        {renderInline("action", action.id, "完了条件", "done_criteria", action.doneCriteria, action.doneCriteria ?? "", "multiline")}
        {renderInline("action", action.id, "完了の証跡", "done_evidence", action.doneEvidence, action.doneEvidence ?? "", "multiline")}
        {renderInline("action", action.id, "詰まっていること", "blocker", action.blocker, action.blocker ?? "", "multiline")}

        {owners.length > 0 && (
          <div>
            <div className={styles.subHead}>これが答えを出す論点（{owners.length}）</div>
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
            <div className={styles.subHead}>この結果として分かったこと（{action.findings.length}）</div>
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
          {renderInline("question", node.id, "種類", "question_kind", node.questionKind, node.questionKind === "decision" ? "決めること" : "分からないこと", "select", [
            { value: "open", label: "分からないこと" },
            { value: "decision", label: "決めること" },
          ])}
          {node.parentId &&
            renderInline("question", node.id, "親との関係", "contribution", node.contribution, node.contribution ? CONTRIBUTION_LABEL[node.contribution] : "—", "select", [
              { value: "required", label: "論点（これが解けないと親が解けない）" },
              { value: "alternative", label: "仮説（どれか1つ立てば足りる）" },
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

        {renderInline("question", node.id, "見出し", "title", node.title, node.title, "multiline")}

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
          <div className={styles.subHead}>やること（{node.actions.length}）</div>
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
                    <select name="child_kind" defaultValue={node.questionKind === "goal" ? "milestone" : "required"}>
                      {/* MSは到達点の直下だけ。ほかの場所では選択肢に出さない（3-22 §3） */}
                      {node.questionKind === "goal" && (
                        <option value="milestone">MS（到達点を成り立たせる条件）</option>
                      )}
                      <option value="required">論点（これが解けないと親が解けない）</option>
                      <option value="alternative">仮説（どれか1つ立てば足りる答えの候補）</option>
                      <option value="decision">決めること（意思で決まる）</option>
                      <option value="measure">やること・確かめる（測る / 調べる / 聞く）</option>
                      <option value="work">やること・作業（決まったことを実行する）</option>
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
                  補足（やることなら方法・条件）
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
  const renderRail = (lines: boolean[], isLast: boolean, depth: number, twisty: React.ReactNode) => {
    const cells: React.ReactNode[] = [];
    for (let index = 0; index < depth * 2; index += 1) {
      let glyph = "";
      if (index === depth * 2 - 1) glyph = isLast ? "└" : "├";
      else if (index % 2 === 1 && lines[(index - 1) / 2]) glyph = "│";
      cells.push(
        <span className={styles.railCell} key={index}>
          {glyph}
        </span>,
      );
    }
    return (
      <span className={styles.rail} aria-hidden="true">
        {cells}
        {twisty}
      </span>
    );
  };

  /** やることも木の子として出す。問いの下に何が積まれているかを1つの木で読む。 */
  const renderActionRow = (action: ActionNode, lines: boolean[], isLast: boolean, depth: number) => {
    const closed = action.status === "done" || action.status === "dropped";
    return (
      <div className={styles.node} key={`action-${action.id}`}>
        <div
          className={styles.row}
          data-row-kind="action"
          data-open={selected?.kind === "action" && selected.id === action.id ? "true" : undefined}
          role="presentation"
        >
          <div className={styles.rowLead}>
            {canManage && <span className={styles.gripSpacer} aria-hidden="true" />}
            {renderRail(lines, isLast, depth, <span className={styles.twisty} aria-hidden="true" />)}
            <button
              type="button"
              className={styles.title}
              data-closed={closed ? "true" : undefined}
              onClick={() => select("action", action.id)}
              title={action.title}
            >
              {action.title}
            </button>
            <span className={styles.chip} data-kind={action.actionKind}>
              {action.actionKind === "measure" ? "確かめる" : "作業"}
            </span>
            {action.estimatedPt !== null && (
              <span className={styles.chip} data-kind="pt">
                {ptText(action.estimatedPt)}
              </span>
            )}
            {/* 会議中に足したまま、担当か期限が決まっていないもの。上部へ抜き出さず
                行の中で示す（3-21「上部へ抜き出さない」、3-22 §4）。 */}
            {action.isUnassigned && (
              <span className={styles.chip} data-kind="unassigned">
                未アサイン
              </span>
            )}
            <span className={styles.flagDot} data-flag={action.isOverdue ? "overdue" : undefined} />
          </div>
          <span className={styles.state} data-state="action">
            {ACTION_STATUS_LABEL[action.status]}
          </span>
          <span className={styles.meta}>{ownerText(action)}</span>
          <span className={styles.meta} data-alert={action.isOverdue ? "true" : undefined}>
            {action.plannedEnd ? fmtDate(action.plannedEnd) : "期限なし"}
          </span>
        </div>
      </div>
    );
  };

  const renderNode = (node: QuestionNode, lines: boolean[] = [], isLast = true, depth = 0) => {
    const isOpen = openIds.has(node.id);
    const isSelected = selected?.kind === "question" && selected.id === node.id;
    const childQuestions = node.children;
    const childActions = node.actions;
    const childCount = childQuestions.length + childActions.length;
    const hasChildren = childCount > 0;
    // 根同士のあいだには縦線を引かない。子から先が枝分かれの表現になる。
    const childLines = depth === 0 ? [] : [...lines, !isLast];
    return (
      <div className={styles.node} key={node.id}>
        <div
          className={styles.row}
          data-question-row={node.id}
          data-row-kind="question"
          data-open={isSelected ? "true" : undefined}
          data-flag={needsAttention(node) ? node.state : undefined}
          data-overdue={node.isOverdue ? "true" : undefined}
          data-dragging={dragId === node.id ? "true" : undefined}
          data-drop={dropHint?.id === node.id ? dropHint.position : undefined}
          role="presentation"
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
            {node.contribution && (
              <span className={styles.chip} data-kind={node.contribution}>
                {CONTRIBUTION_LABEL[node.contribution]}
              </span>
            )}
            {node.questionKind === "decision" && (
              <span className={styles.chip} data-kind="decision">
                決める
              </span>
            )}
            {/* 到達点とMSは木の骨格。3-21 の判定色は増やさず、印と字体だけで区別する。 */}
            {(node.questionKind === "goal" || node.questionKind === "milestone") && (
              <span className={styles.chip} data-kind={node.questionKind}>
                {QUESTION_KIND_LABEL[node.questionKind]}
              </span>
            )}
            {/* 状態は縦棒でなく丸で示す。縦棒は罫線と重なって読みにくい
                （まさ 2026-09-10「丸の方が信号っぽい」）。タイトルの後ろへ置くと
                子の罫線と親のタイトル位置がずれない。 */}
            <span className={styles.flagDot} data-flag={needsAttention(node) ? node.state : undefined} />
          </div>
          <span className={styles.state} data-state={node.state}>
            {QUESTION_STATE_LABEL[node.state]}
          </span>
          <span className={styles.meta}>{node.ownerLabel}</span>
          <span className={styles.meta} data-alert={node.isOverdue ? "true" : undefined}>
            {node.nextDueDate ? fmtDate(node.nextDueDate) : "期限なし"}
          </span>
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
          <div className={styles.headerTitle}>
            <h1>{embedded ? "論点・仮説" : projectName}</h1>
            <p>
              分からないことを分解して、確かめる手をぶら下げる。答えが出たものから閉じる。
            </p>
          </div>
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
            <span className={styles.stat} data-tone={counts.unassignedActions > 0 ? "warn" : undefined}>
              未アサイン<b>{counts.unassignedActions}</b>
            </span>
            <span className={styles.stat}>
              答えが出た<b>{counts.answered}</b>
            </span>
          </div>
        </header>

        {proposals.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>つくよみが拾った、まだ木に無いもの（{proposals.length}）</h2>
              <span>会議の記録に出ていたのに登録されていないもの。足すか、いらないかを決める</span>
            </div>
            <div className={styles.itemList} style={{ border: 0, borderRadius: 0 }}>
              {proposals.map((proposal) => (
                <div className={styles.proposal} key={`${proposal.kind}-${proposal.id}`}>
                  <div className={styles.proposalMain}>
                    <span className={styles.chip} data-kind={proposal.kind === "action" ? "measure" : proposal.kind === "finding" ? "work" : "required"}>
                      {proposal.kind === "question" ? "論点" : proposal.kind === "action" ? "やること" : "分かったこと"}
                    </span>
                    <span className={styles.proposalTitle}>{proposal.title}</span>
                  </div>
                  <p className={styles.proposalWhere}>
                    {proposal.proposedParentTitle ? (
                      <>
                        <b>{proposal.proposedParentTitle}</b> の下
                        {proposal.proposedContribution
                          ? `（${CONTRIBUTION_LABEL[proposal.proposedContribution]}）`
                          : ""}
                      </>
                    ) : (
                      "付ける先は未推定（根に入る）"
                    )}
                    {proposal.reason ? ` ・ ${proposal.reason}` : ""}
                    {proposal.originRef ? ` ・ 出どころ: ${proposal.originRef}` : ""}
                  </p>
                  {canManage && (
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.btn}
                        data-variant="primary"
                        disabled={busy}
                        onClick={() =>
                          void send("POST", {
                            resource: "proposal_accept",
                            fields: { kind: proposal.kind, id: proposal.id },
                          })
                        }
                      >
                        木に入れる
                      </button>
                      <button
                        type="button"
                        className={styles.btn}
                        data-variant="quiet"
                        disabled={busy}
                        onClick={() =>
                          void send("POST", {
                            resource: "proposal_reject",
                            fields: { kind: proposal.kind, id: proposal.id },
                          })
                        }
                      >
                        いらない
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className={styles.section}>
          {/* 到達点は木のいちばん上に置くので、どの行の「子を追加」からも作れない。
              木の頭に導線を1つだけ置く（3-22 §3）。 */}
          {canManage && (
            <div className={styles.goalAdd}>
              <button
                type="button"
                className={styles.btn}
                data-variant={goalFormOpen ? undefined : "primary"}
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
                    到達点（シーズンの終わりに、こうなっている）
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
          ) : (
            <div className={styles.tree}>
              {roots.map((root, index) => renderNode(root, [], index === roots.length - 1, 0))}
            </div>
          )}
        </section>

        {looseActions.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>どの論点にもつながっていないやること</h2>
              <span>{looseActions.length}件。実行だけで答えを出さない作業か、つなぎ忘れ</span>
            </div>
            <div className={styles.itemList} style={{ border: 0, borderRadius: 0 }}>
              {looseActions.slice(0, 40).map(renderAction)}
            </div>
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
                    {selectedNode?.contribution && (
                      <span className={styles.chip} data-kind={selectedNode.contribution}>
                        {CONTRIBUTION_LABEL[selectedNode.contribution]}
                      </span>
                    )}
                    {selectedNode?.questionKind === "decision" && (
                      <span className={styles.chip} data-kind="decision">
                        決める
                      </span>
                    )}
                    {selectedAction && (
                      <span className={styles.chip} data-kind={selectedAction.actionKind}>
                        {selectedAction.actionKind === "measure" ? "確かめる" : "作業"}
                      </span>
                    )}
                  </div>
                  <h3>{openPanel.title}</h3>
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
