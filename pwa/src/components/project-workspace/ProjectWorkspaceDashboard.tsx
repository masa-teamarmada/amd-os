import { Activity, ArrowRight, CalendarDays, CheckCircle2, Database, FlaskConical, LockKeyhole, UsersRound } from "lucide-react";
import type { CurrentMemberAccess, ProjectWorkspaceBundle } from "@/lib/project-workspace";
import { EFFORT_CATEGORIES, type EffortCategory } from "@/lib/project-workspace-types";
import { EffortEntryForm } from "./EffortEntryForm";

const CATEGORY_STYLE: Record<EffortCategory, { background: string; color: string }> = {
  basic: { background: "#315f7d", color: "#ffffff" },
  applied: { background: "#5f879e", color: "#ffffff" },
  development: { background: "#38745d", color: "#ffffff" },
  su: { background: "#bf7b2c", color: "#ffffff" },
  coordination: { background: "#76637b", color: "#ffffff" },
};

const SOURCE_LABELS: Record<string, string> = {
  member_weekly: "週次抽出",
  gmail: "メール",
  calendar: "カレンダー",
  gmeet: "Meet",
  slack: "Slack",
  notion: "Notion",
  drive: "Drive",
  inferred: "既存情報から推定",
  manual: "手入力",
};

function hours(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatWeekStart(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", timeZone: "UTC" }).format(date);
}

function formatActivityDate(value: string | null) {
  if (!value) return "未取得";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未取得";
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" }).format(date);
}

function compactYm(ym: string | null) {
  if (!ym || ym.length !== 6) return "—";
  return `${Number(ym.slice(4, 6))}月`;
}

function CategoryBand({ categories, muted = false }: { categories: Record<EffortCategory, number>; muted?: boolean }) {
  const total = EFFORT_CATEGORIES.reduce((sum, item) => sum + categories[item.key], 0);
  return (
    <div className="flex min-w-[320px] overflow-hidden rounded-lg border border-black/10 sm:min-w-[420px]" aria-label="研究からSUまでの時間配分">
      {EFFORT_CATEGORIES.map((item) => {
        const value = categories[item.key];
        const width = total > 0 ? Math.max(9, (value / total) * 100) : 20;
        return (
          <div
            key={item.key}
            className="flex min-h-16 flex-col justify-center border-r border-white/25 px-3 last:border-r-0"
            style={{
              flexBasis: `${width}%`,
              background: muted ? `${CATEGORY_STYLE[item.key].background}26` : CATEGORY_STYLE[item.key].background,
              color: muted ? "#5f5b52" : CATEGORY_STYLE[item.key].color,
            }}
          >
            <span className="whitespace-nowrap text-[10px] font-semibold tracking-wide">{item.shortLabel}</span>
            <span className="mt-0.5 text-sm font-semibold">{total > 0 ? `${hours(value)}h` : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ProjectWorkspaceDashboard({
  bundle,
  access,
}: {
  bundle: ProjectWorkspaceBundle;
  access: CurrentMemberAccess;
}) {
  const maxEvidence = Math.max(1, ...bundle.evidenceByMonth.map((item) => item.count));
  const visibleTrend = bundle.weeklyTrend.slice(-6);
  const maxTrend = Math.max(1, ...visibleTrend.flatMap((item) => [item.plannedHours, item.actualHours]));

  return (
    <div className="amd-desk-page-skin min-h-screen px-3 py-4 sm:px-5 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1480px] space-y-5">
        <header className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/92 px-5 py-5 shadow-[0_10px_35px_rgba(61,56,44,0.05)] sm:px-7 sm:py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dfeee6] px-2.5 py-1 font-semibold text-[#256c55]">
                  <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                  研究開発マネジメント
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d6cebf] bg-[#fffdf7] px-2.5 py-1 text-[#69665d]">
                  <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                  {access.scope === "project" ? "参加PJ限定" : "PJ共有ビュー"}
                </span>
              </div>
              <p className="font-mono text-[11px] tracking-[0.14em] text-[#928d82]">{bundle.project.projectId}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#24231f] sm:text-3xl">
                {bundle.project.projectName} ダッシュボード
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#69665d]">
                誰が基礎・応用・開発・SUのどこに時間を使っているかを、週単位で揃えて見る場所。
                メールなどから抽出済みの活動件数と、本人が確定した時間は分けて表示してるよ。
              </p>
            </div>
            <dl className="grid shrink-0 grid-cols-3 divide-x divide-[#d6cebf] rounded-lg border border-[#d6cebf] bg-[#f8f5ec] px-2 py-3 sm:min-w-[390px]">
              <div className="px-3">
                <dt className="text-[10px] font-semibold text-[#928d82]">今週</dt>
                <dd className="mt-1 text-sm font-semibold text-[#24231f]">{formatWeekStart(bundle.currentWeekStart)}〜</dd>
              </div>
              <div className="px-3">
                <dt className="text-[10px] font-semibold text-[#928d82]">メンバー</dt>
                <dd className="mt-1 text-sm font-semibold text-[#24231f]">{bundle.memberCount}人</dd>
              </div>
              <div className="px-3">
                <dt className="text-[10px] font-semibold text-[#928d82]">抽出済み</dt>
                <dd className="mt-1 text-sm font-semibold text-[#24231f]">{bundle.evidenceCount}件</dd>
              </div>
            </dl>
          </div>
        </header>

        <section className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/92 p-5 sm:p-6" aria-labelledby="allocation-heading">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-[#256c55]">THIS WEEK</p>
              <h2 id="allocation-heading" className="mt-1 text-lg font-semibold text-[#24231f]">研究からSUまでの時間配分</h2>
            </div>
            <div className="flex items-baseline gap-5 text-sm text-[#69665d]">
              <span>予定 <b className="ml-1 text-lg text-[#24231f]">{hours(bundle.effort.plannedHours)}h</b></span>
              <span>実績 <b className="ml-1 text-lg text-[#24231f]">{hours(bundle.effort.actualHours)}h</b></span>
            </div>
          </div>
          <div className="overflow-x-auto pb-1">
            <CategoryBand categories={bundle.effort.categories} muted={!bundle.effort.hasEntries} />
          </div>
          {!bundle.effort.hasEntries && (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-[#e3c994] bg-[#fbf1dc] px-4 py-3 text-sm text-[#765022]">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>今週の時間はまだ未確定。下の入力欄で予定と実績を入れると、この帯にそのまま反映されるよ。</p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/92 p-5 sm:p-6" aria-labelledby="team-heading">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-[#315f7d]">TEAM ALLOCATION</p>
              <h2 id="team-heading" className="mt-1 text-lg font-semibold text-[#24231f]">メンバー別の現在地</h2>
            </div>
            <UsersRound className="h-5 w-5 text-[#928d82]" aria-hidden="true" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-y border-[#ddd5c7] bg-[#f8f5ec] text-left text-[11px] font-semibold text-[#777166]">
                  <th className="px-3 py-2.5">メンバー</th>
                  <th className="px-3 py-2.5">今週の配分</th>
                  <th className="px-3 py-2.5 text-right">予定</th>
                  <th className="px-3 py-2.5 text-right">実績</th>
                  <th className="px-3 py-2.5 text-right">抽出活動</th>
                  <th className="px-3 py-2.5 text-right">最終活動</th>
                </tr>
              </thead>
              <tbody>
                {bundle.members.map((member) => {
                  const categoryTotal = EFFORT_CATEGORIES.reduce((sum, item) => sum + member.categories[item.key], 0);
                  return (
                    <tr key={member.memberId} className="border-b border-[#e4ddd0] last:border-b-0">
                      <td className="px-3 py-4">
                        <div className="font-semibold text-[#24231f]">{member.codeName}</div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-[#928d82]">
                          <span className="font-mono">{member.memberId}</span>
                          {member.roleLabel && <span>{member.roleLabel}</span>}
                          {member.isLead && <span className="rounded bg-[#dfeee6] px-1.5 py-0.5 font-semibold text-[#256c55]">LEAD</span>}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        {categoryTotal > 0 ? (
                          <div className="flex h-7 min-w-72 overflow-hidden rounded-md bg-[#ece7dc]">
                            {EFFORT_CATEGORIES.map((item) => {
                              const value = member.categories[item.key];
                              if (value <= 0) return null;
                              return (
                                <div
                                  key={item.key}
                                  className="grid min-w-8 place-items-center text-[9px] font-semibold text-white"
                                  style={{ width: `${Math.max(8, (value / categoryTotal) * 100)}%`, background: CATEGORY_STYLE[item.key].background }}
                                  title={`${item.label}: ${hours(value)}h`}
                                >
                                  {item.shortLabel}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-[#928d82]">時間未入力</span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-right font-medium text-[#514e47]">{hours(member.plannedHours)}h</td>
                      <td className="px-3 py-4 text-right font-semibold text-[#24231f]">{hours(member.actualHours)}h</td>
                      <td className="px-3 py-4 text-right text-[#514e47]">{member.evidenceCount}件</td>
                      <td className="px-3 py-4 text-right text-xs text-[#777166]">{formatActivityDate(member.lastActivityAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/92 p-5 sm:p-6" aria-labelledby="entry-heading">
          <div className="mb-5">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[#256c55]">CONFIRM EFFORT</p>
            <h2 id="entry-heading" className="mt-1 text-lg font-semibold text-[#24231f]">週次エフォートを確定</h2>
            <p className="mt-2 text-xs leading-5 text-[#777166]">
              {access.scope === "project" ? "自分の予定・実績だけ更新できるよ。" : "AMDメンバーはPJ全員分を更新できるよ。"}
              同じ週・メンバー・区分を保存すると上書きされる。
            </p>
          </div>
          <EffortEntryForm
            projectId={bundle.project.projectId}
            currentWeekStart={bundle.currentWeekStart}
            currentMemberId={access.memberId}
            accessScope={access.scope}
            members={bundle.members.map((member) => ({ memberId: member.memberId, codeName: member.codeName }))}
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/92 p-5 sm:p-6" aria-labelledby="milestone-heading">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.14em] text-[#bf7b2c]">CURRENT FOCUS</p>
                <h2 id="milestone-heading" className="mt-1 text-lg font-semibold text-[#24231f]">いま追っている成果</h2>
              </div>
              <ArrowRight className="h-4 w-4 text-[#928d82]" aria-hidden="true" />
            </div>
            {bundle.milestones.length > 0 ? (
              <div className="space-y-4">
                {bundle.milestones.map((milestone) => (
                  <div key={milestone.milestoneId}>
                    <div className="mb-2 flex items-start justify-between gap-4 text-sm">
                      <span className="font-medium leading-5 text-[#24231f]">{milestone.title}</span>
                      <span className="shrink-0 font-mono text-xs font-semibold text-[#514e47]">{milestone.progressPct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#e8e2d6]">
                      <div className="h-full rounded-full bg-[#38745d]" style={{ width: `${milestone.progressPct}%` }} />
                    </div>
                    <p className="mt-1.5 text-[10px] text-[#928d82]">進捗 {compactYm(milestone.progressYm)} / 目標 {compactYm(milestone.targetYm)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-[#d6cebf] px-4 py-8 text-center text-sm text-[#777166]">有効なマイルストーンはまだないよ。</p>
            )}
          </section>

          <section className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/92 p-5 sm:p-6" aria-labelledby="evidence-heading">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.14em] text-[#315f7d]">EXTRACTION COVERAGE</p>
                <h2 id="evidence-heading" className="mt-1 text-lg font-semibold text-[#24231f]">OSがすでに把握している活動</h2>
              </div>
              <Database className="h-5 w-5 text-[#928d82]" aria-hidden="true" />
            </div>
            <div className="flex h-40 items-end gap-3 border-b border-[#d6cebf] pb-3">
              {bundle.evidenceByMonth.map((item) => (
                <div key={item.ym} className="flex h-full flex-1 flex-col justify-end gap-2 text-center">
                  <span className="text-[10px] font-semibold text-[#514e47]">{item.count}</span>
                  <div className="mx-auto w-full max-w-10 rounded-t bg-[#5f879e]" style={{ height: `${Math.max(item.count ? 8 : 2, (item.count / maxEvidence) * 100)}%` }} />
                  <span className="text-[10px] text-[#928d82]">{compactYm(item.ym)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {bundle.evidenceBySource.map((item) => (
                <span key={item.source} className="rounded-full border border-[#d6cebf] bg-[#f8f5ec] px-2.5 py-1 text-[11px] text-[#69665d]">
                  {SOURCE_LABELS[item.source] || item.source} {item.count}
                </span>
              ))}
            </div>
            <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-[#777166]">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#256c55]" aria-hidden="true" />
              外部メンバーには件数と更新日の集計だけを共有。メール本文・生データ・AMD内部の報酬や戦略情報は返してないよ。
            </p>
          </section>
        </div>

        <section className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/92 p-5 sm:p-6" aria-labelledby="trend-heading">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-[#76637b]">SIX WEEK RHYTHM</p>
              <h2 id="trend-heading" className="mt-1 text-lg font-semibold text-[#24231f]">予定と実績の推移</h2>
            </div>
            <Activity className="h-5 w-5 text-[#928d82]" aria-hidden="true" />
          </div>
          <div className="flex h-44 items-end gap-3 sm:gap-6">
            {visibleTrend.map((item) => (
              <div key={item.weekStart} className="flex h-full flex-1 flex-col justify-end">
                <div className="flex flex-1 items-end justify-center gap-1 sm:gap-2">
                  <div className="w-3 rounded-t bg-[#b7c8d2] sm:w-5" style={{ height: `${Math.max(item.plannedHours ? 4 : 1, (item.plannedHours / maxTrend) * 100)}%` }} title={`予定 ${hours(item.plannedHours)}h`} />
                  <div className="w-3 rounded-t bg-[#38745d] sm:w-5" style={{ height: `${Math.max(item.actualHours ? 4 : 1, (item.actualHours / maxTrend) * 100)}%` }} title={`実績 ${hours(item.actualHours)}h`} />
                </div>
                <div className="mt-2 border-t border-[#d6cebf] pt-2 text-center text-[10px] text-[#928d82]">{formatWeekStart(item.weekStart)}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-4 text-[10px] text-[#777166]">
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#b7c8d2]" />予定</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#38745d]" />実績</span>
          </div>
        </section>
      </div>
    </div>
  );
}
