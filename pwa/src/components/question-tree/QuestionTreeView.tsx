"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ACTION_STATUS_LABEL,
  FINDING_KIND_LABEL,
  QUESTION_STATE_LABEL,
  type ActionNode,
  type QuestionNode,
  type QuestionTreeBundle,
} from "@/lib/question-tree-types";

import styles from "./question-tree.module.css";

/**
 * 問いの木。正本は pwa/spec/3-21-question-tree-current-spec.md。
 *
 * 状態は導出値なので編集させない。人が書くのは、答え・追わない理由・
 * 子の問い・やること・分かったことだけ。
 */

type FormKind = "answer" | "drop" | "child" | "action" | "finding" | null;

const CONTRIBUTION_LABEL: Record<string, string> = {
  required: "必須",
  alternative: "代替",
};

function fmtDate(value: string | null): string {
  return value ? value.replace(/^\d{2}(\d{2})-/, "$1-") : "—";
}

/** 最初は根と、根の直下だけ開く。全部たたむと何も見えず、全部開くと読めない。 */
function defaultOpenIds(bundle: QuestionTreeBundle | null | undefined): Set<string> {
  const ids = new Set<string>();
  for (const root of bundle?.roots ?? []) {
    ids.add(root.id);
    for (const child of root.children) ids.add(child.id);
  }
  return ids;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formKind, setFormKind] = useState<FormKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);

  useEffect(() => {
    if (initialBundle) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/project/${projectId}/question-tree`);
        const payload = (await response.json()) as QuestionTreeBundle & { error?: string };
        if (cancelled) return;
        if (!response.ok) throw new Error(payload.error || "問いの木を読めなかったよ");
        setBundle(payload);
        setOpenIds(defaultOpenIds(payload));
      } catch (caught) {
        if (!cancelled) setLoadFailed(caught instanceof Error ? caught.message : "問いの木を読めなかったよ");
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

  const select = useCallback((id: string) => {
    setSelectedId((current) => (current === id ? null : id));
    setFormKind(null);
    setError(null);
  }, []);

  /** 「次につぶすべき」から飛ぶとき、その行までの親をすべて開く */
  const reveal = useCallback(
    (id: string) => {
      const path: string[] = [];
      let cursor = questionById.get(id);
      while (cursor) {
        path.push(cursor.id);
        cursor = cursor.parentId ? questionById.get(cursor.parentId) : undefined;
      }
      setOpenIds((current) => new Set([...current, ...path]));
      setSelectedId(id);
      setFormKind(null);
    },
    [questionById],
  );

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
        await send("POST", {
          resource: "question",
          fields: {
            parent_id: node.id,
            contribution: text("contribution") || "required",
            title: text("title"),
            question_kind: text("question_kind") || "open",
            owner_label: text("owner_label") || "担当未確認",
            due_date: text("due_date"),
            origin_question_id: node.id,
          },
        });
        return;
      }
      if (kind === "action") {
        const created = await fetch(`/api/project/${projectId}/question-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resource: "action",
            fields: {
              title: text("title"),
              action_kind: text("action_kind") || "measure",
              owner_label: text("owner_label") || "担当未確認",
              planned_end: text("planned_end"),
              detail: text("detail"),
              origin_question_id: node.id,
            },
          }),
        });
        const payload = (await created.json()) as { id?: string; bundle?: QuestionTreeBundle; error?: string };
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

  // 以降は bundle が確定してから。hooks はすべてこの上で呼び終えている。
  if (!bundle) {
    return (
      <div className={styles.page} data-embedded={embedded || undefined}>
        <div className={styles.shell}>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>問いの木</h2>
              <span>{loadFailed ? "読み込めなかった" : "読み込み中"}</span>
            </div>
            {loadFailed ? (
              <p className={styles.notice}>{loadFailed}</p>
            ) : (
              <p className={styles.emptyState}>問いとやることを読んでいる…</p>
            )}
          </section>
        </div>
      </div>
    );
  }

  const { counts, nextUp, looseActions, canManage } = bundle;

  const renderAction = (action: ActionNode) => (
    <div className={styles.item} key={action.id}>
      <span className={styles.itemKind} data-kind={action.actionKind}>
        {action.actionKind === "measure" ? "確かめる" : "作業"}
      </span>
      <span className={styles.itemTitle} title={action.title}>
        {action.title}
      </span>
      <span className={styles.meta}>{action.ownerLabel}</span>
      <span className={styles.meta} data-alert={action.isOverdue ? "true" : undefined}>
        {fmtDate(action.plannedEnd)}
      </span>
      <span className={styles.meta}>{ACTION_STATUS_LABEL[action.status]}</span>
    </div>
  );

  const renderDetail = (node: QuestionNode) => {
    const derived = node.derivedQuestionIds
      .map((id) => questionById.get(id))
      .filter((item): item is QuestionNode => Boolean(item));
    return (
      <div className={styles.detail}>
        <div className={styles.detailGrid}>
          <div className={styles.field}>
            <span>状態</span>
            <b>{QUESTION_STATE_LABEL[node.state]}</b>
          </div>
          <div className={styles.field}>
            <span>担当</span>
            <b>{node.ownerLabel}</b>
          </div>
          <div className={styles.field}>
            <span>次の期限</span>
            <b>{fmtDate(node.nextDueDate)}</b>
          </div>
          <div className={styles.field}>
            <span>最終更新</span>
            <b>
              {fmtDate(node.latestVerifiedAt)}
              {node.isStale ? "（更新切れ）" : ""}
            </b>
          </div>
        </div>

        {node.answer && (
          <div className={styles.field}>
            <span>答え</span>
            <b>
              {node.answer}
              {node.answeredOn ? `（${fmtDate(node.answeredOn)}${node.answeredBy ? ` / ${node.answeredBy}` : ""}）` : ""}
            </b>
          </div>
        )}
        {node.dropReason && (
          <div className={styles.field}>
            <span>追わない理由</span>
            <b>{node.dropReason}</b>
          </div>
        )}
        {node.background && (
          <div>
            <div className={styles.subHead}>背景・前提</div>
            <p className={styles.background}>{node.background}</p>
          </div>
        )}

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
                答えを書いて閉じる
              </button>
            )}
            <button type="button" className={styles.btn} onClick={() => setFormKind("child")}>
              子の問いを足す
            </button>
            <button type="button" className={styles.btn} onClick={() => setFormKind("action")}>
              やることを足す
            </button>
            <button type="button" className={styles.btn} onClick={() => setFormKind("finding")}>
              分かったことを足す
            </button>
            {node.status === "open" && (
              <button type="button" className={styles.btn} data-variant="quiet" onClick={() => setFormKind("drop")}>
                この枝は追わない
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
                <label>
                  問い
                  <input name="title" required placeholder="〜は成立するか / 〜はどうか" />
                </label>
                <div className={styles.formRow}>
                  <label>
                    親との関係
                    <select name="contribution" defaultValue="required">
                      <option value="required">必須（これが解けないと親は解けない）</option>
                      <option value="alternative">代替（どれか1つ立てばいい）</option>
                    </select>
                  </label>
                  <label>
                    種類
                    <select name="question_kind" defaultValue="open">
                      <option value="open">分からないこと</option>
                      <option value="decision">決めること</option>
                    </select>
                  </label>
                  <label>
                    担当
                    <input name="owner_label" placeholder="担当未確認" />
                  </label>
                  <label>
                    いつまでに答えを出すか
                    <input name="due_date" type="date" />
                  </label>
                </div>
              </>
            )}
            {formKind === "action" && (
              <>
                <label>
                  やること
                  <input name="title" required placeholder="測る / 調べる / 見積もる / 相手に聞く" />
                </label>
                <div className={styles.formRow}>
                  <label>
                    種類
                    <select name="action_kind" defaultValue="measure">
                      <option value="measure">確かめる行為</option>
                      <option value="work">作業</option>
                    </select>
                  </label>
                  <label>
                    担当
                    <input name="owner_label" placeholder="担当未確認" />
                  </label>
                  <label>
                    期限
                    <input name="planned_end" type="date" />
                  </label>
                </div>
                <label>
                  方法・条件
                  <textarea name="detail" placeholder="どうやって確かめるか" />
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

  const renderNode = (node: QuestionNode) => {
    const isOpen = openIds.has(node.id);
    const isSelected = selectedId === node.id;
    const hasChildren = node.children.length > 0;
    return (
      <div className={styles.node} key={node.id}>
        <div className={styles.row} data-open={isSelected ? "true" : undefined} role="presentation">
          <div className={styles.rowLead} style={{ paddingLeft: `${14 + node.depth * 18}px` }}>
            <span
              className={styles.twisty}
              onClick={(event) => {
                event.stopPropagation();
                if (hasChildren) toggle(node.id);
              }}
              role={hasChildren ? "button" : undefined}
              aria-label={hasChildren ? (isOpen ? "たたむ" : "ひらく") : undefined}
            >
              {hasChildren ? (isOpen ? "▼" : "▶") : "・"}
            </span>
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
            <button
              type="button"
              className={styles.title}
              data-closed={node.status !== "open" ? "true" : undefined}
              onClick={() => select(node.id)}
              title={node.title}
              style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}
            >
              {node.title}
            </button>
          </div>
          <span className={styles.state} data-state={node.state}>
            {QUESTION_STATE_LABEL[node.state]}
          </span>
          <span className={styles.meta}>{node.ownerLabel}</span>
          <span className={styles.meta} data-alert={node.isOverdue ? "true" : undefined}>
            {node.nextDueDate ? fmtDate(node.nextDueDate) : "期限なし"}
            {node.openMeasureCountDeep > 0 ? ` / 確認${node.openMeasureCountDeep}` : ""}
          </span>
        </div>
        {isSelected && renderDetail(node)}
        {isOpen && hasChildren && node.children.map(renderNode)}
      </div>
    );
  };

  return (
    <div className={styles.page} data-embedded={embedded || undefined}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <h1>{embedded ? "論点・仮説" : `${projectName} ・ 問いの木`}</h1>
            <p>
              分からないことを分解して、確かめる行為をぶら下げる。答えが出た問いだけが閉じる。
            </p>
          </div>
          <div className={styles.summary}>
            <span className={styles.stat}>
              問い<b>{counts.questions}</b>
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
            <span className={styles.stat}>
              答えが出た<b>{counts.answered}</b>
            </span>
          </div>
        </header>

        {nextUp.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>次につぶすべき問い</h2>
              <span>判断できるもの、手が止まっているもの、期限を過ぎたものの順</span>
            </div>
            <div className={styles.nextList}>
              {nextUp.map((node) => (
                <button type="button" className={styles.nextRow} key={node.id} onClick={() => reveal(node.id)}>
                  <span className={styles.state} data-state={node.state}>
                    {QUESTION_STATE_LABEL[node.state]}
                  </span>
                  <span className={styles.nextTitle}>{node.title}</span>
                  <span className={styles.nextMeta}>{node.ownerLabel}</span>
                  <span className={styles.nextMeta} data-alert={node.isOverdue ? "true" : undefined}>
                    {node.nextDueDate ? fmtDate(node.nextDueDate) : "期限なし"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>問いの木</h2>
            <span>
              {roots.length}本の根 ・ やること{counts.actions}件（未完了の確認{counts.openMeasures}件）
            </span>
          </div>
          {roots.length === 0 ? (
            <p className={styles.emptyState}>まだ問いが登録されていない。</p>
          ) : (
            <div className={styles.tree}>{roots.map(renderNode)}</div>
          )}
        </section>

        {looseActions.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>どの問いにもつながっていないやること</h2>
              <span>{looseActions.length}件。実行だけで答えを出さない作業か、つなぎ忘れ</span>
            </div>
            <div className={styles.itemList} style={{ border: 0, borderRadius: 0 }}>
              {looseActions.slice(0, 40).map(renderAction)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
