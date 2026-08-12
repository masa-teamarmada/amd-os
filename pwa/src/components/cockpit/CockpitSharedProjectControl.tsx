"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, RefreshCw, ShieldCheck } from "lucide-react";
import type { SxManagementBundle, SxManagementMilestone, SxTrackSummary } from "@/lib/sx-management";
import styles from "./cockpit-shared-project-control.module.css";

type LoadState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; management: SxManagementBundle };

type PublicationCandidate = {
  sourceTable: string;
  sourceId: string;
  sourceVersion: number;
  label: string;
  pillarKey: string | null;
  state: string;
  dueDate: string | null;
  group: string;
};

type PublicationContext = {
  configured: boolean;
  actorPrincipalId: string | null;
  parties: Array<{ partyId: string; kind: "amd" | "research" | "startup"; displayLabel: string }>;
  latestRevision: { id: string; number: number } | null;
};

type PublicationLoad =
  | { state: "loading" }
  | { state: "error"; message: string }
  | {
      state: "ready";
      publication: { state: string; revision?: { number: number; publishedAt: string } };
      candidates: PublicationCandidate[];
      context: PublicationContext | null;
    };

type SelectedCandidate = { pillarKey: string; ballPartyId: string; jointDecision: boolean };

const PILLAR_OPTIONS = [
  { key: "business_development", label: "事業開発" },
  { key: "technology_development", label: "技術開発" },
  { key: "organizational_building", label: "組織構築" },
  { key: "funding", label: "資金調達" },
] as const;

const TERMINAL_STATES = new Set(["completed", "closed", "decided", "cancelled"]);

function formatDate(value: string | null): string {
  if (!value) return "期限未設定";
  return new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric" }).format(
    new Date(`${value}T00:00:00+09:00`),
  );
}

function trackTone(track: SxTrackSummary): string {
  if (["blocked", "at_risk"].includes(track.status)) return styles.critical;
  if (["attention"].includes(track.status)) return styles.attention;
  if (["unassessed", "not_started"].includes(track.status)) return styles.unknown;
  return styles.onTrack;
}

function currentCriticalMilestone(bundle: SxManagementBundle): SxManagementMilestone | null {
  const bySlug = new Map(bundle.milestones.map((milestone) => [milestone.slug, milestone]));
  return bundle.judgment.criticalPathSlugs
    .map((slug) => bySlug.get(slug) ?? null)
    .find((milestone) => milestone !== null && !TERMINAL_STATES.has(milestone.status)) ?? null;
}

function nextDue(bundle: SxManagementBundle): { label: string; due: string } | null {
  const candidates: Array<{ label: string; due: string; identity: string }> = [];
  for (const milestone of bundle.milestones) {
    if (TERMINAL_STATES.has(milestone.status)) continue;
    const due = milestone.forecastEnd ?? milestone.plannedEnd;
    if (due) candidates.push({ label: milestone.title, due, identity: `milestone:${milestone.id}` });
  }
  for (const issue of bundle.issues) {
    if (TERMINAL_STATES.has(issue.status)) continue;
    if (issue.dueDate) candidates.push({ label: issue.title, due: issue.dueDate, identity: `issue:${issue.id}` });
  }
  for (const decision of bundle.decisions) {
    if (TERMINAL_STATES.has(decision.status)) continue;
    if (decision.dueDate) candidates.push({ label: decision.title, due: decision.dueDate, identity: `decision:${decision.id}` });
  }
  for (const action of bundle.actions) {
    if (TERMINAL_STATES.has(action.status)) continue;
    if (action.dueDate) candidates.push({ label: action.title, due: action.dueDate, identity: `action:${action.id}` });
  }
  for (const item of bundle.partnerWorkItems) {
    if (TERMINAL_STATES.has(item.status)) continue;
    if (item.dueDate) candidates.push({ label: item.title, due: item.dueDate, identity: `partner:${item.id}` });
  }
  candidates.sort((left, right) => left.due.localeCompare(right.due) || left.identity.localeCompare(right.identity));
  return candidates[0] ?? null;
}

function SharedControlBody({ projectId, bundle, publicationControl }: { projectId: string; bundle: SxManagementBundle; publicationControl: ReactNode }) {
  const current = currentCriticalMilestone(bundle);
  const deadline = nextDue(bundle);
  const firstDecision = bundle.judgment.decisionQueue[0] ?? null;
  const openItems = bundle.milestones.filter((item) => !TERMINAL_STATES.has(item.status)).length
    + bundle.issues.filter((item) => !TERMINAL_STATES.has(item.status)).length
    + bundle.decisions.filter((item) => !TERMINAL_STATES.has(item.status)).length
    + bundle.actions.filter((item) => !TERMINAL_STATES.has(item.status)).length
    + bundle.partnerWorkItems.filter((item) => !TERMINAL_STATES.has(item.status)).length;

  return (
    <section className={styles.shell} aria-labelledby="shared-project-control-heading" data-shared-control-lens="amd">
      <div className={styles.headingRow}>
        <div>
          <p>三者共通のPJ正本・AMDレンズ</p>
          <h2 id="shared-project-control-heading">いま動かすもの</h2>
        </div>
        <div className={styles.sourceState}>
          <ShieldCheck aria-hidden="true" size={15} />
          <span>ワークスペースと同期</span>
          <small>{bundle.asOf} 時点</small>
        </div>
      </div>

      <div className={styles.decisionStrip}>
        <article>
          <span>現在地</span>
          <strong>{current?.title ?? "重要経路は完了、または未設定"}</strong>
          <small>{current ? `${current.ownerLabel}・${current.nextDeliverable || "次成果物未設定"}` : "推測値は表示していない"}</small>
        </article>
        <article>
          <span>AMDが判断する</span>
          <strong>{firstDecision?.title ?? "保留中の判断なし"}</strong>
          <small>{firstDecision ? `${firstDecision.ownerLabel}・${formatDate(firstDecision.dueDate)}` : "新しい判断が登録されるまで待機"}</small>
        </article>
        <article>
          <span>次の期限</span>
          <strong>{deadline ? formatDate(deadline.due) : "期限未設定"}</strong>
          <small>{deadline?.label ?? "確定した次期限はまだない"}</small>
        </article>
        <article>
          <span>未完了の管制項目</span>
          <strong>{openItems}件</strong>
          <small>MS・論点・判断・タスク・関係先を同じ正本から集計</small>
        </article>
      </div>

      <div className={styles.pillars} aria-label="PJの4本柱">
        {bundle.tracks.map((track, index) => (
          <div key={track.key} className={styles.pillar}>
            <div><span>{String(index + 1).padStart(2, "0")}</span><em className={trackTone(track)}>{track.statusLabel}</em></div>
            <strong>{track.label}</strong>
            <p>{track.gate || "現在ゲート未設定"}</p>
            <small>{track.nextDeliverable || formatDate(track.forecastEnd ?? track.plannedEnd)}</small>
          </div>
        ))}
      </div>

      <div className={styles.footerRow}>
        <p>
          <CircleAlert aria-hidden="true" size={14} />
          大学・SU側には、ここから承認された共有版だけを表示する。AMD内部値の自動流用はしない。
        </p>
        <Link href={`/project/${encodeURIComponent(projectId)}/workspace`}>
          詳細を更新 <ArrowRight aria-hidden="true" size={14} />
        </Link>
      </div>
      {publicationControl}
    </section>
  );
}

function CockpitPublicationControl({ projectId }: { projectId: string }) {
  const [load, setLoad] = useState<PublicationLoad>({ state: "loading" });
  const [selected, setSelected] = useState<Record<string, SelectedCandidate>>({});
  const [audiencePartyId, setAudiencePartyId] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const reload = useCallback(() => {
    fetch(`/api/project/${encodeURIComponent(projectId)}/shared-publication`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as {
          ok?: boolean;
          publication?: PublicationLoad extends { state: "ready"; publication: infer T } ? T : never;
          candidates?: PublicationCandidate[];
          context?: PublicationContext | null;
          error?: string;
        };
        if (!response.ok || !payload.ok || !payload.publication || !payload.candidates) {
          throw new Error(payload.error || "共有版の状態を読み込めなかった");
        }
        setLoad({ state: "ready", publication: payload.publication, candidates: payload.candidates, context: payload.context ?? null });
      })
      .catch((error) => setLoad({ state: "error", message: error instanceof Error ? error.message : "共有版の状態を読み込めなかった" }));
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  if (load.state === "loading") return <div className={styles.publicationBar}>共有版の状態を確認中</div>;
  if (load.state === "error") return <div className={styles.publicationBar}>共有版の状態を確認できなかった</div>;

  const context = load.context;
  const externalParties = context?.parties.filter((party) => party.kind !== "amd") ?? [];
  const activeCandidates = load.candidates.filter((candidate) => !TERMINAL_STATES.has(candidate.state));
  const selectedEntries = activeCandidates.filter((candidate) => selected[candidate.sourceId]);
  const canPublish = Boolean(
    context?.configured && audiencePartyId && selectedEntries.length > 0 && reviewed
      && selectedEntries.every((candidate) => {
        const value = selected[candidate.sourceId];
        return value.pillarKey && value.ballPartyId;
      }),
  );

  async function publish() {
    if (!canPublish) return;
    setPublishing(true);
    setFeedback(null);
    try {
      const sourceRefs = selectedEntries.map((candidate, index) => ({
        sourceTable: candidate.sourceTable,
        sourceId: candidate.sourceId,
        sourceVersion: candidate.sourceVersion,
        pillarKey: selected[candidate.sourceId].pillarKey,
        ballPartyIds: [selected[candidate.sourceId].ballPartyId],
        jointDecision: selected[candidate.sourceId].jointDecision,
        criticalRank: index + 1,
        dependencyItemIds: index === 0 ? [] : [`${selectedEntries[index - 1].sourceTable}:${selectedEntries[index - 1].sourceId}`],
      }));
      const response = await fetch(`/api/project/${encodeURIComponent(projectId)}/shared-publication`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audiencePartyIds: [audiencePartyId], sourceRefs }),
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "共有版を公開できなかった");
      setFeedback("承認済み共有版を公開した");
      setSelected({});
      setReviewed(false);
      reload();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "共有版を公開できなかった");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <details className={styles.publicationControl}>
      <summary>
        <span>
          <strong>外部共有版</strong>
          <small>{load.publication.state === "published" && load.publication.revision
            ? `承認済み #${load.publication.revision.number}`
            : context?.configured ? "未公開" : "共有先の設定待ち"}</small>
        </span>
        <span>内容を確認して公開</span>
      </summary>
      <div className={styles.publicationBody}>
        {!context ? (
          <p>公開操作はAMD管理者だけが使える。表示中のPJ正本は全AMDメンバーで同じだよ。</p>
        ) : !context.configured || externalParties.length === 0 ? (
          <p>
            先に外部メンバーへこのPJの権限を追加してね。
            <Link href="/admin/access">アクセス管理を開く</Link>
          </p>
        ) : (
          <>
            <div className={styles.audienceRow}>
              <label htmlFor="publication-audience">共有先</label>
              <select id="publication-audience" value={audiencePartyId} onChange={(event) => {
                setAudiencePartyId(event.target.value);
                setReviewed(false);
              }}>
                <option value="">選択してね</option>
                {externalParties.map((party) => <option key={party.partyId} value={party.partyId}>{party.displayLabel}</option>)}
              </select>
              <span>最新版だけがこの共有先に表示される</span>
            </div>
            <div className={styles.candidateList}>
              {activeCandidates.map((candidate) => {
                const value = selected[candidate.sourceId];
                return (
                  <div key={`${candidate.sourceTable}:${candidate.sourceId}`} className={value ? styles.selectedCandidate : undefined}>
                    <label className={styles.candidateCheck}>
                      <input type="checkbox" checked={Boolean(value)} onChange={(event) => {
                        setReviewed(false);
                        setSelected((current) => {
                          if (!event.target.checked) {
                            const next = { ...current };
                            delete next[candidate.sourceId];
                            return next;
                          }
                          return {
                            ...current,
                            [candidate.sourceId]: {
                              pillarKey: candidate.pillarKey ?? "",
                              ballPartyId: "",
                              jointDecision: false,
                            },
                          };
                        });
                      }} />
                      <span><small>{candidate.group}・{candidate.state}</small><strong>{candidate.label}</strong></span>
                    </label>
                    {value ? (
                      <div className={styles.candidateFields}>
                        <select aria-label={`${candidate.label}の柱`} value={value.pillarKey} onChange={(event) => {
                          setReviewed(false);
                          setSelected((current) => ({ ...current, [candidate.sourceId]: { ...value, pillarKey: event.target.value } }));
                        }}>
                          <option value="">柱を選択</option>
                          {PILLAR_OPTIONS.map((pillar) => <option key={pillar.key} value={pillar.key}>{pillar.label}</option>)}
                        </select>
                        <select aria-label={`${candidate.label}のボール保持者`} value={value.ballPartyId} onChange={(event) => {
                          setReviewed(false);
                          setSelected((current) => ({ ...current, [candidate.sourceId]: { ...value, ballPartyId: event.target.value } }));
                        }}>
                          <option value="">ボール保持者</option>
                          {context.parties.map((party) => <option key={party.partyId} value={party.partyId}>{party.displayLabel}</option>)}
                        </select>
                        <label><input type="checkbox" checked={value.jointDecision} onChange={(event) => {
                          setReviewed(false);
                          setSelected((current) => ({ ...current, [candidate.sourceId]: { ...value, jointDecision: event.target.checked } }));
                        }} />共同判断</label>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className={styles.publishRow}>
              <label><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />選んだ項目・柱・ボール保持者を確認した</label>
              <button type="button" disabled={!canPublish || publishing} onClick={publish}>
                {publishing ? "公開中…" : context.latestRevision ? "新版として公開" : "初版を公開"}
              </button>
            </div>
            {feedback ? <p className={styles.feedback}>{feedback}</p> : null}
          </>
        )}
      </div>
    </details>
  );
}

export function CockpitSharedProjectControl({ projectId }: { projectId: string }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [load, setLoad] = useState<LoadState>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/project-workspace/${encodeURIComponent(projectId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { ok?: boolean; bundle?: { sxManagement?: SxManagementBundle }; error?: string };
        if (!response.ok || !payload.ok || !payload.bundle?.sxManagement) {
          throw new Error(payload.error || "PJ正本を読み込めなかった");
        }
        return payload.bundle.sxManagement;
      })
      .then((management) => {
        if (!cancelled) setLoad({ state: "ready", management });
      })
      .catch((error) => {
        if (!cancelled) setLoad({ state: "error", message: error instanceof Error ? error.message : "PJ正本を読み込めなかった" });
      });
    return () => { cancelled = true; };
  }, [projectId, reloadKey]);

  if (load.state === "loading") {
    return <div className={styles.loading}><RefreshCw aria-hidden="true" /> PJ正本を同期中</div>;
  }
  if (load.state === "error") {
    return (
      <div className={styles.loading} role="alert">
        <CircleAlert aria-hidden="true" /> {load.message}
        <button type="button" onClick={() => {
          setLoad({ state: "loading" });
          setReloadKey((value) => value + 1);
        }}>再読込</button>
      </div>
    );
  }
  return (
    <SharedControlBody
      projectId={projectId}
      bundle={load.management}
      publicationControl={<CockpitPublicationControl projectId={projectId} />}
    />
  );
}
