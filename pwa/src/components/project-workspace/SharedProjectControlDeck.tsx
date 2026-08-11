"use client";

import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  CircleHelp,
  Clock3,
  GitBranch,
  Hand,
  Hourglass,
  Users,
} from "lucide-react";
import {
  deriveSharedProjectControlView,
  sharedProjectPartyLabel,
  type SharedProjectControlBucketKey,
  type SharedProjectControlItem,
  type SharedProjectControlSnapshot,
  type SharedProjectControlState,
  type SharedProjectPillar,
  type ViewerLens,
} from "@/lib/shared-project-control";
import styles from "./shared-project-control.module.css";

export type SharedProjectControlDeckProps = {
  snapshot: SharedProjectControlSnapshot | null;
  lens: ViewerLens;
  state?: "ready" | "loading" | "unpublished" | "error";
  errorMessage?: string;
  className?: string;
  onActivate?: (item: SharedProjectControlItem) => void;
};

const PILLAR_SHORT_LABEL: Record<SharedProjectPillar["key"], string> = {
  business_development: "事業",
  technology_development: "技術",
  organizational_building: "体制",
  funding: "資金",
};

const BUCKET_META: Record<
  SharedProjectControlBucketKey,
  { title: string; description: string; Icon: typeof Hand }
> = {
  my: { title: "自分のボール", description: "自組織が次に動く項目", Icon: Hand },
  joint: { title: "共同判断", description: "複数組織で揃える項目", Icon: Users },
  waiting: { title: "相手待ち", description: "他組織の応答を待つ項目", Icon: Hourglass },
  unknown: { title: "主体未確認", description: "保有主体を共有できていない項目", Icon: CircleHelp },
};

const STATE_LABEL: Record<SharedProjectControlState, string> = {
  active: "進行中",
  accepted: "受入済み",
  accepted_done: "受入完了",
  at_risk: "危険",
  attention: "要注意",
  blocked: "停止",
  cancelled: "取消",
  closed: "完了",
  committed: "合意済み",
  completed: "完了",
  confirmed: "確認済み",
  critical: "危険",
  decided: "決定済み",
  deferred: "保留",
  failed: "不成立",
  filled: "充足",
  in_progress: "進行中",
  missing: "未共有",
  monitoring: "確認中",
  not_started: "未着手",
  on_hold: "保留",
  on_track: "オンスケ",
  open: "未完了",
  passed: "成立",
  pending: "確認待ち",
  planned: "予定",
  proposed: "提案中",
  rejected: "不採用",
  running: "実施中",
  submitted: "提出済み",
  unassessed: "未評価",
  unshared: "未共有",
  unknown: "未確認",
  validated: "検証済み",
  validating: "検証中",
  waiting: "待ち",
};

const COMPLETE_STATES = new Set<SharedProjectControlState>([
  "accepted_done",
  "closed",
  "completed",
  "confirmed",
  "decided",
  "filled",
  "passed",
  "validated",
]);
const NEUTRAL_TERMINAL_STATES = new Set<SharedProjectControlState>(["cancelled", "rejected"]);

function stateTone(state: SharedProjectControlState | SharedProjectControlSnapshot["verdict"]["state"]) {
  if (["critical", "blocked", "at_risk", "failed"].includes(state)) return "critical";
  if (["attention", "waiting", "pending", "on_hold", "deferred", "changes_requested"].includes(state)) return "warning";
  if (["unknown", "missing", "unshared", "unassessed"].includes(state)) return "unknown";
  if (NEUTRAL_TERMINAL_STATES.has(state as SharedProjectControlState)) return "neutral";
  if (COMPLETE_STATES.has(state as SharedProjectControlState)) return "complete";
  return "active";
}

function StateIcon({ state }: { state: SharedProjectControlState }) {
  const tone = stateTone(state);
  if (tone === "critical") return <Ban aria-hidden="true" />;
  if (tone === "neutral") return <Ban aria-hidden="true" />;
  if (tone === "warning") return <AlertTriangle aria-hidden="true" />;
  if (tone === "complete") return <Check aria-hidden="true" />;
  if (tone === "unknown") return <CircleHelp aria-hidden="true" />;
  return <ArrowRight aria-hidden="true" />;
}

function formatDate(value: string | null) {
  if (!value) return "期限未共有";
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "期限未共有";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(instant);
}

function freshnessLabel(snapshot: SharedProjectControlSnapshot) {
  const freshness = snapshot.freshness;
  if (freshness.state === "unknown") return "最終確認 未共有";
  if (freshness.ageDays === 0) return "本日確認";
  return freshness.state === "stale"
    ? `更新注意・${freshness.ageDays}日前に確認`
    : `${freshness.ageDays}日前に確認`;
}

function Overall({ snapshot, lens }: { snapshot: SharedProjectControlSnapshot; lens: ViewerLens }) {
  const tone = stateTone(snapshot.verdict.state);
  return (
    <header className={styles.overall} data-tone={tone}>
      <div className={styles.verdictMark} aria-hidden="true">
        {tone === "critical" ? <Ban /> : tone === "warning" ? <AlertTriangle /> : tone === "unknown" ? <CircleHelp /> : <Check />}
      </div>
      <div className={styles.verdictCopy}>
        <p className={styles.eyebrow}>共有PJ管制 / 公開版 r{snapshot.revision}</p>
        <div className={styles.verdictLine}>
          <strong>{snapshot.verdict.label}</strong>
          <span>{snapshot.verdict.reason}</span>
        </div>
      </div>
      <dl className={styles.snapshotFacts}>
        <div><dt>表示視点</dt><dd>{lens.label}</dd></div>
        <div><dt>基準日</dt><dd>{formatDate(snapshot.asOf)}</dd></div>
        <div data-warning={snapshot.freshness.state === "stale" || undefined}>
          <dt>鮮度</dt><dd><Clock3 aria-hidden="true" />{freshnessLabel(snapshot)}</dd>
        </div>
      </dl>
    </header>
  );
}

function PillarStrip({ pillars }: { pillars: SharedProjectControlSnapshot["pillars"] }) {
  return (
    <section className={styles.pillarSection} aria-labelledby="shared-control-pillars-title">
      <div className={styles.sectionLead}>
        <p id="shared-control-pillars-title">4本柱</p>
        <span>同じ公開版の現在ゲート</span>
      </div>
      <div className={styles.pillarGrid}>
        {pillars.map((pillar, index) => (
          <article key={pillar.key} className={styles.pillar} data-tone={stateTone(pillar.state)} data-pillar-index={index + 1}>
            <div className={styles.pillarHeading}>
              <span className={styles.pillarCode}>{PILLAR_SHORT_LABEL[pillar.key]}</span>
              <div><h3>{pillar.label}</h3><p><StateIcon state={pillar.state} />{STATE_LABEL[pillar.state]}</p></div>
            </div>
            <p className={styles.currentGate}>{pillar.currentGateLabel ?? "現在ゲート 未共有"}</p>
            <div className={styles.pillarMeta}>
              <span>次期限 {formatDate(pillar.nextDue)}</span>
              <span>{pillar.blockedCount > 0 ? `停止 ${pillar.blockedCount}件` : pillar.unknownCount > 0 ? `未確認 ${pillar.unknownCount}件` : "共有範囲内の停止なし"}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CriticalNode({
  item,
  snapshot,
  onActivate,
}: {
  item: SharedProjectControlItem;
  snapshot: SharedProjectControlSnapshot;
  onActivate?: (item: SharedProjectControlItem) => void;
}) {
  const isCurrent = snapshot.criticalPath.currentItemId === item.itemId;
  const isNext = snapshot.criticalPath.nextItemId === item.itemId;
  const isFinal = snapshot.criticalPath.finalItemId === item.itemId;
  const position = [isCurrent ? "現在地" : null, isNext ? "次" : null, isFinal ? "最終ゲート" : null].filter(Boolean).join(" / ");
  const content = (
    <>
      <span className={styles.criticalPosition}>{position}</span>
      <span className={styles.criticalTitle}><StateIcon state={item.state} />{item.label}</span>
      <span className={styles.criticalMeta}>{STATE_LABEL[item.state]}・{formatDate(item.dueDate)}</span>
      {item.downstreamImpactLabel && <span className={styles.criticalImpact}>下流影響 {item.downstreamImpactLabel}</span>}
    </>
  );
  return onActivate ? (
    <button type="button" className={styles.criticalNode} data-current={isCurrent || undefined} data-tone={stateTone(item.state)} onClick={() => onActivate(item)}>
      {content}
    </button>
  ) : (
    <div className={styles.criticalNode} data-current={isCurrent || undefined} data-tone={stateTone(item.state)}>{content}</div>
  );
}

function CriticalPath({ snapshot, onActivate }: { snapshot: SharedProjectControlSnapshot; onActivate?: (item: SharedProjectControlItem) => void }) {
  const path = snapshot.criticalPath;
  return (
    <section className={styles.criticalSection} aria-labelledby="shared-control-critical-title" data-testid="shared-project-critical-path">
      <div className={styles.sectionLead}>
        <p id="shared-control-critical-title"><GitBranch aria-hidden="true" />重要経路</p>
        <span>現在 → 次 → 最終判断</span>
      </div>
      {path.state !== "valid" ? (
        <div className={styles.pathState} data-tone={path.state === "invalid" ? "critical" : "unknown"}>
          {path.state === "invalid" ? <AlertTriangle aria-hidden="true" /> : <CircleHelp aria-hidden="true" />}
          <div><strong>{path.state === "invalid" ? "重要経路を確認できない" : "重要経路は未共有"}</strong><span>{path.reason}</span></div>
        </div>
      ) : path.visibleNodes.length === 0 ? (
        <div className={styles.pathState} data-tone="complete"><Check aria-hidden="true" /><div><strong>共有された重要経路は完了</strong><span>最終ゲートまで確認済み</span></div></div>
      ) : (
        <div className={styles.criticalRail}>
          {path.visibleNodes.map((item, index) => (
            <div className={styles.criticalStep} key={item.itemId}>
              <CriticalNode item={item} snapshot={snapshot} onActivate={onActivate} />
              {index < path.visibleNodes.length - 1 && <ArrowRight className={styles.railArrow} aria-hidden="true" />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BucketItem({ item, snapshot, onActivate }: { item: SharedProjectControlItem; snapshot: SharedProjectControlSnapshot; onActivate?: (item: SharedProjectControlItem) => void }) {
  const partyLabels = item.ballPartyIds.map((partyId) => sharedProjectPartyLabel(snapshot, partyId));
  const content = (
    <>
      <span className={styles.itemMain}>
        <span className={styles.itemState} data-tone={stateTone(item.state)}><StateIcon state={item.state} />{STATE_LABEL[item.state]}</span>
        <strong>{item.label}</strong>
      </span>
      <span className={styles.itemMeta}>
        <span>{partyLabels.length > 0 ? partyLabels.join(" × ") : "保有主体 未共有"}</span>
        <span>{formatDate(item.dueDate)}</span>
      </span>
    </>
  );
  return onActivate ? (
    <button type="button" className={styles.bucketItem} onClick={() => onActivate(item)}>{content}</button>
  ) : (
    <div className={styles.bucketItem}>{content}</div>
  );
}

function BucketGrid({ snapshot, lens, onActivate }: { snapshot: SharedProjectControlSnapshot; lens: ViewerLens; onActivate?: (item: SharedProjectControlItem) => void }) {
  const view = deriveSharedProjectControlView(snapshot, lens);
  return (
    <section className={styles.bucketSection} aria-labelledby="shared-control-buckets-title">
      <div className={styles.sectionLead}>
        <p id="shared-control-buckets-title">ボール管制</p>
        <span>表示視点だけを切替・共有事実は不変</span>
      </div>
      <div className={styles.bucketGrid}>
        {(Object.keys(BUCKET_META) as SharedProjectControlBucketKey[]).map((key) => {
          const meta = BUCKET_META[key];
          const items = view.buckets[key];
          return (
            <article key={key} className={styles.bucket} data-bucket={key}>
              <header><meta.Icon aria-hidden="true" /><div><h3>{meta.title}</h3><p>{meta.description}</p></div><span>{items.length}件</span></header>
              {items.length === 0 ? (
                <p className={styles.bucketEmpty}>該当する共有項目なし</p>
              ) : (
                <div className={styles.bucketItems}>{items.map((item) => <BucketItem key={item.itemId} item={item} snapshot={snapshot} onActivate={onActivate} />)}</div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LoadingDeck({ className = "" }: { className?: string }) {
  return (
    <section className={`${styles.deck} ${styles.loading} ${className}`} aria-label="共有PJ管制を読み込み中" aria-busy="true" data-testid="shared-project-control-loading">
      <div className={styles.skeletonWide} />
      <div className={styles.skeletonGrid}>{Array.from({ length: 4 }, (_, index) => <div key={index} />)}</div>
      <div className={styles.skeletonWide} />
      <span className="sr-only">共有PJ管制を読み込んでいます。</span>
    </section>
  );
}

export function SharedProjectControlDeck({ snapshot, lens, state, errorMessage, className = "", onActivate }: SharedProjectControlDeckProps) {
  const resolvedState = state ?? (snapshot ? "ready" : "unpublished");
  if (resolvedState === "loading") return <LoadingDeck className={className} />;
  if (resolvedState === "error") {
    return (
      <section className={`${styles.deck} ${styles.systemState} ${className}`} aria-label="共有PJ管制の読込エラー" data-testid="shared-project-control-error">
        <AlertTriangle aria-hidden="true" /><div><h2>共有PJ管制を読み込めない</h2><p>{errorMessage || "共有版の取得に失敗しました。再読み込みしてください。"}</p></div>
      </section>
    );
  }
  if (!snapshot || resolvedState === "unpublished") {
    return (
      <section className={`${styles.deck} ${styles.systemState} ${className}`} aria-label="共有PJ管制は未公開" data-testid="shared-project-control-unpublished">
        <CircleHelp aria-hidden="true" /><div><h2>共有された管制項目はまだない</h2><p>未公開を0件・順調とは扱いません。公開版が作成されるまで待ってください。</p></div>
      </section>
    );
  }
  return (
    <section
      className={`${styles.deck} ${className}`}
      aria-label="共有PJ管制: 全体判定・4本柱・重要経路・ボール"
      data-testid="shared-project-control-deck"
      data-snapshot-revision={snapshot.revision}
      data-publication-source-id={snapshot.publicationSourceId}
    >
      <Overall snapshot={snapshot} lens={lens} />
      <PillarStrip pillars={snapshot.pillars} />
      <CriticalPath snapshot={snapshot} onActivate={onActivate} />
      <BucketGrid snapshot={snapshot} lens={lens} onActivate={onActivate} />
    </section>
  );
}
