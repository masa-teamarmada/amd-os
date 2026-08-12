import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileCheck2,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  deriveSharedProjectControlView,
  isSharedProjectTerminalState,
  type SharedProjectControlError,
  type SharedProjectControlItem,
  type SharedProjectParty,
  type SharedProjectPublishedControl,
  type SharedProjectUnpublishedControl,
  type SharedProjectVerdictState,
} from "@/lib/shared-project-control";
import styles from "./institution-project-control.module.css";

type WorkspaceMeta = { slug: string; name: string; role: "owner" | "member" | "readonly" };
type ProjectMeta = { id: string; name: string; role: "manager" | "contributor" | "readonly" };

const PROJECT_ROLE_LABEL: Record<ProjectMeta["role"], string> = {
  manager: "PJ管理担当",
  contributor: "PJ参加者",
  readonly: "閲覧のみ",
};

const STATE_LABEL: Record<string, string> = {
  critical: "停止あり",
  attention: "要確認",
  unknown: "未確認",
  on_track: "進行中",
  blocked: "停止",
  at_risk: "重大リスク",
  in_progress: "対応中",
  open: "未着手",
  pending: "確認待ち",
  validating: "検証中",
  waiting: "相手待ち",
  on_hold: "保留",
  deferred: "延期",
  completed: "完了",
  closed: "完了",
  decided: "決定済み",
  cancelled: "取消",
};

function formatDate(value: string | null): string {
  if (!value) return "期限未設定";
  const date = new Date(`${value}T00:00:00+09:00`);
  return new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric", weekday: "short" }).format(date);
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function stateLabel(value: string): string {
  return STATE_LABEL[value] ?? value;
}

function stateClass(value: SharedProjectVerdictState | string): string {
  if (value === "critical" || value === "blocked" || value === "at_risk") return styles.critical;
  if (value === "attention" || value === "open" || value === "pending" || value === "in_progress") {
    return styles.attention;
  }
  if (value === "on_track" || value === "completed" || value === "closed" || value === "decided") {
    return styles.onTrack;
  }
  return styles.unknown;
}

function Shell({ workspace, project, children }: { workspace: WorkspaceMeta; project: ProjectMeta; children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href={`/workspace/${encodeURIComponent(workspace.slug)}`} className={styles.backLink}>
            <ArrowLeft aria-hidden="true" size={15} />
            {workspace.name}
          </Link>
          <div className={styles.headerProject}>
            <span>{project.id}</span>
            <strong>{project.name}</strong>
          </div>
          <span className={styles.roleBadge}>{PROJECT_ROLE_LABEL[project.role]}</span>
        </div>
      </header>
      {children}
    </div>
  );
}

function partyLabel(partyIds: readonly string[], parties: readonly SharedProjectParty[]): string {
  if (partyIds.length === 0) return "担当未確認";
  const byId = new Map(parties.map((party) => [party.partyId, party.displayLabel]));
  return partyIds.map((partyId) => byId.get(partyId) ?? "確認中の関係者").join("・");
}

function nextDueItem(items: readonly SharedProjectControlItem[]): SharedProjectControlItem | null {
  return [...items]
    .filter((item) => !isSharedProjectTerminalState(item.state) && item.dueDate !== null)
    .sort((left, right) => left.dueDate!.localeCompare(right.dueDate!) || left.itemId.localeCompare(right.itemId))[0] ?? null;
}

function HandoffValue({
  eyebrow,
  value,
  detail,
  tone = "default",
}: {
  eyebrow: string;
  value: string;
  detail: string;
  tone?: "default" | "accent" | "waiting";
}) {
  return (
    <div className={`${styles.handoffValue} ${styles[tone]}`}>
      <p>{eyebrow}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}

export function InstitutionProjectControlView({
  workspace,
  project,
  control,
}: {
  workspace: WorkspaceMeta;
  project: ProjectMeta;
  control: SharedProjectPublishedControl | SharedProjectUnpublishedControl | SharedProjectControlError;
}) {
  if (control.state === "unpublished") {
    return (
      <Shell workspace={workspace} project={project}>
        <main className={styles.main}>
          <section className={styles.emptyState} aria-labelledby="publication-state-heading">
            <div className={styles.emptyIcon}><ShieldCheck aria-hidden="true" /></div>
            <p className={styles.kicker}>承認済み共有版</p>
            <h1 id="publication-state-heading">共有準備中</h1>
            <p>
              このPJの閲覧権限は確認できたけど、研究機関向けに承認された共有版はまだ公開されていない。
              AMD内部の最新値や下書きは代わりに表示していないよ。
            </p>
            <div className={styles.emptyRule}>
              <span>現在</span>
              <strong>公開待ち</strong>
              <span>共有版が確定すると、大学側の返答・相手待ち・期限がここに出る</span>
            </div>
            <Link href={`/workspace/${encodeURIComponent(workspace.slug)}`} className={styles.primaryLink}>
              研究機関ワークスペースへ戻る <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </section>
        </main>
      </Shell>
    );
  }

  if (control.state === "error") {
    return (
      <Shell workspace={workspace} project={project}>
        <main className={styles.main}>
          <section className={styles.emptyState} aria-labelledby="publication-error-heading">
            <div className={`${styles.emptyIcon} ${styles.errorIcon}`}><CircleAlert aria-hidden="true" /></div>
            <p className={styles.kicker}>安全な表示を優先</p>
            <h1 id="publication-error-heading">共有版を読み取れなかった</h1>
            <p>承認済み版を確認できなかったため、古い版や内部データへ切り替えず表示を止めている。</p>
            <a href={`/workspace/${encodeURIComponent(workspace.slug)}/project/${encodeURIComponent(project.id)}`} className={styles.primaryLink}>
              もう一度読み込む <ArrowRight aria-hidden="true" size={15} />
            </a>
          </section>
        </main>
      </Shell>
    );
  }

  const view = deriveSharedProjectControlView(control);
  const myItem = view.lanes.my.find((item) => !item.terminal) ?? null;
  const waitingItem = view.lanes.waiting.find((item) => !item.terminal) ?? null;
  const jointItem = view.lanes.joint.find((item) => !item.terminal) ?? null;
  const dueItem = nextDueItem(control.controlItems);
  const currentItem = view.criticalPath.currentItem;
  const downstreamLabel = currentItem?.downstreamImpactLabel
    ?? view.criticalPath.downstreamItems[0]?.label
    ?? "下流影響は共有版で未確認";

  return (
    <Shell workspace={workspace} project={project}>
      <main className={styles.main}>
        <section
          className={styles.decisionFrame}
          data-decision-frame="institution-project-control"
          aria-labelledby="project-control-heading"
        >
          <div className={styles.frameIntro}>
            <div>
              <p className={styles.kicker}>いまの受け渡し</p>
              <h1 id="project-control-heading">{control.summary.projectName}</h1>
            </div>
            <div className={`${styles.verdict} ${stateClass(control.summary.verdict.state)}`}>
              <span>{stateLabel(control.summary.verdict.state)}</span>
              <strong>{control.summary.verdict.label}</strong>
              <small>{control.summary.verdict.reason}</small>
            </div>
          </div>

          <div className={styles.handoffGrid}>
            <HandoffValue
              eyebrow={`${workspace.name}が返す`}
              value={myItem?.label ?? "いま返す項目はなし"}
              detail={myItem ? `${formatDate(myItem.dueDate)}・${stateLabel(myItem.state)}` : "新しい依頼が共有されるまで待機"}
              tone="accent"
            />
            <HandoffValue
              eyebrow="相手の返答待ち"
              value={waitingItem?.label ?? jointItem?.label ?? "相手待ちはなし"}
              detail={waitingItem
                ? `${partyLabel(waitingItem.ballPartyIds, control.parties)}が保持`
                : jointItem
                  ? "共同確認が必要"
                  : "現在の共有版では該当なし"}
              tone="waiting"
            />
            <HandoffValue
              eyebrow="次の期限"
              value={dueItem ? formatDate(dueItem.dueDate) : "期限未設定"}
              detail={dueItem?.label ?? "確定した次期限はまだない"}
            />
          </div>

          <div className={styles.currentLine}>
            <div>
              <span>現在地</span>
              <strong>{currentItem?.label ?? "重要経路は完了、または未設定"}</strong>
            </div>
            <div>
              <span>止まると影響する先</span>
              <strong>{downstreamLabel}</strong>
            </div>
            <div>
              <span>現在のボール</span>
              <strong>{currentItem ? partyLabel(currentItem.ballPartyIds, control.parties) : "保持者なし"}</strong>
            </div>
          </div>
        </section>

        <section className={styles.pillarSection} aria-labelledby="pillar-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>計画の4本柱</p>
              <h2 id="pillar-heading">同じPJの現在地</h2>
            </div>
            <p>各柱は公開済み項目だけで判定。未共有は未確認のまま残している。</p>
          </div>
          <div className={styles.pillarRail}>
            {control.pillars.map((pillar, index) => (
              <article key={pillar.key} className={styles.pillar}>
                <div className={styles.pillarTop}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <em className={stateClass(pillar.state)}>{stateLabel(pillar.state)}</em>
                </div>
                <h3>{pillar.label}</h3>
                <p>{pillar.currentGateLabel ?? "共有済みの現在ゲートなし"}</p>
                <small>{pillar.nextDue ? `次期限 ${formatDate(pillar.nextDue)}` : "次期限は未設定"}</small>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.controlSection} aria-labelledby="control-items-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>確認と提出</p>
              <h2 id="control-items-heading">受け渡し明細</h2>
            </div>
            <p>{control.controlItems.length}件の承認済み項目</p>
          </div>
          <div className={styles.controlColumns}>
            <ControlColumn
              icon={<FileCheck2 aria-hidden="true" />}
              title={`${workspace.name}の番`}
              empty="現在、大学側へ返答・提出を求めている項目はない。"
              items={view.lanes.my}
              parties={control.parties}
            />
            <ControlColumn
              icon={<Users aria-hidden="true" />}
              title="共同・相手待ち"
              empty="共同確認または相手待ちの項目はない。"
              items={[...view.lanes.joint, ...view.lanes.waiting]}
              parties={control.parties}
            />
          </div>
        </section>

        <footer className={styles.publicationFooter}>
          <div><ShieldCheck aria-hidden="true" size={16} /><span>承認済み共有版 #{control.revision.number}</span></div>
          <span>基準日 {formatTimestamp(control.revision.asOf)}</span>
          <span>公開 {formatTimestamp(control.revision.publishedAt)}</span>
          <code>{control.revision.contentHash.slice(0, 10)}</code>
        </footer>
      </main>
    </Shell>
  );
}

function ControlColumn({
  icon,
  title,
  empty,
  items,
  parties,
}: {
  icon: React.ReactNode;
  title: string;
  empty: string;
  items: readonly (SharedProjectControlItem & { terminal?: boolean })[];
  parties: readonly SharedProjectParty[];
}) {
  const visible = items.filter((item) => !isSharedProjectTerminalState(item.state));
  return (
    <div className={styles.controlColumn}>
      <h3>{icon}{title}</h3>
      {visible.length === 0 ? <p className={styles.columnEmpty}>{empty}</p> : (
        <ol>
          {visible.map((item) => (
            <li key={item.itemId}>
              <div className={styles.itemState}>
                {item.state === "completed" ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
                <span>{stateLabel(item.state)}</span>
              </div>
              <div>
                <strong>{item.label}</strong>
                <p>{partyLabel(item.ballPartyIds, parties)}・{formatDate(item.dueDate)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
