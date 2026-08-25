"use client";

import type { ProjectWorkspaceBundle } from "@/lib/project-workspace";
import type { CSSProperties } from "react";
import styles from "./project-theme-routes.module.css";

type ThemeData = ProjectWorkspaceBundle["themes"][number];
type MilestoneData = ThemeData["milestones"][number];

const SOURCE_LABEL: Record<string, string> = {
  routine_auto: "予定進行",
  pm_manual: "手動確定",
  pm_confirmed: "PM確定",
  pm_rejected: "修正なしで確定",
  criteria_toggle: "達成条件で確定",
  tsukuyomi_revision: "承認済み修正",
  manual: "手動記録",
  meeting_summary: "会議記録",
  calendar: "予定記録",
  gmail: "メール記録",
  slack: "Slack記録",
  drive: "資料記録",
  notion: "Notion記録",
};

const PM_LOCKED_SOURCES = new Set([
  "pm_manual",
  "pm_confirmed",
  "pm_rejected",
  "criteria_toggle",
  "tsukuyomi_revision",
]);

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "更新未確認";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "更新未確認";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function clampProgressPct(value: number): number {
  const clamped = Math.max(0, Math.min(100, value));
  return Math.round(clamped);
}

function getProgressDateLabel(milestone: MilestoneData): string {
  if (milestone.progressConfirmedAt) return formatDate(milestone.progressConfirmedAt);
  if (milestone.progressRecordedAt) return formatDate(milestone.progressRecordedAt);
  if (milestone.progressYm && /^\d{6}$/.test(milestone.progressYm)) {
    return `${milestone.progressYm.slice(0, 4)}年${Number(milestone.progressYm.slice(4, 6))}月の月次値`;
  }
  return "更新未確認";
}

function getSourceLabel(source: string | null): string {
  if (!source) return "根拠未確認";
  return SOURCE_LABEL[source] || "未確定記録";
}

function formatTargetYm(targetYm: string | null): string {
  if (!targetYm || !/^\d{6}$/.test(targetYm)) return "目標月 未設定";
  const year = targetYm.slice(0, 4);
  const monthNum = parseInt(targetYm.slice(4, 6), 10);
  return `目標 ${year}年${monthNum}月`;
}

function getProgressLineClass(source: string | null): string {
  if (source === "routine_auto") return styles.routineAuto;
  if (source && PM_LOCKED_SOURCES.has(source)) return styles.confirmed;
  return styles.unconfirmed;
}

function MilestoneRow({ milestone, themeAccent }: { milestone: MilestoneData; themeAccent: string }) {
  const sourceLabel = getSourceLabel(milestone.progressSource);
  const isRoutineAuto = milestone.progressSource === "routine_auto";
  const isConfirmed = milestone.progressSource !== null && PM_LOCKED_SOURCES.has(milestone.progressSource);
  const clampedProgress = clampProgressPct(milestone.progressPct);
  const progressKindLabel = isRoutineAuto ? "予定進行" : isConfirmed ? "確定進捗" : "未確定進捗";

  return (
    <li className={styles.milestoneItem}>
      <div className={styles.milestoneGate} style={{ "--accent-color": themeAccent } as CSSProperties}>
        <div className={styles.gateMark} />
      </div>
      <div className={styles.milestoneContent}>
        <div className={styles.milestoneHeader}>
          <h4 className={styles.milestoneName}>{milestone.title}</h4>
          <span className={`${styles.sourceLabel} ${isRoutineAuto ? styles.routineAutoLabel : ""}`}>{sourceLabel}</span>
        </div>

        <div className={styles.progressBar}>
          <div
            className={`${styles.progressFill} ${getProgressLineClass(milestone.progressSource)}`}
            style={{
              width: `${clampedProgress}%`,
              "--accent-color": themeAccent,
            } as CSSProperties}
            role="progressbar"
            aria-valuenow={clampedProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${milestone.title}: ${progressKindLabel} ${clampedProgress}%`}
          />
        </div>

        <div className={styles.milestoneDetails}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>{progressKindLabel}</span>
            <span className={styles.detailValue}>{clampedProgress}%</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>更新日</span>
            <span className={styles.detailValue}>{getProgressDateLabel(milestone)}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>根拠</span>
            <span className={styles.detailValue}>{sourceLabel}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>{formatTargetYm(milestone.targetYm)}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

function ThemeSection({ theme, themeIndex }: { theme: ThemeData; themeIndex: number }) {
  const milestoneCount = theme.milestones.length;

  return (
    <article className={styles.themeSection} style={{ "--accent-color": theme.accent } as CSSProperties}>
      <div className={styles.themeHeader}>
        <div className={styles.themeLabel}>
          THEME {String(themeIndex + 1).padStart(2, "0")}
        </div>
        <h3 className={styles.themeName}>{theme.label}</h3>
        <div className={styles.themeMetric}>
          成果目標 {milestoneCount} 件
        </div>
      </div>

      <ol className={styles.milestoneList}>
        {theme.milestones.map((milestone) => (
          <MilestoneRow key={milestone.milestoneId} milestone={milestone} themeAccent={theme.accent} />
        ))}
      </ol>
    </article>
  );
}

export function ProjectThemeRoutes({ themes }: { themes: ProjectWorkspaceBundle["themes"] }) {
  return (
    <section className={styles.container}>
      <header className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>テーマ航路</h2>
        <p className={styles.pageDescription}>3つのテーマごとに、成果目標の現在地と根拠を追う</p>
      </header>

      <div className={styles.themesGrid}>
        {themes.map((theme, index) => (
          <ThemeSection key={theme.themeKey} theme={theme} themeIndex={index} />
        ))}
      </div>
    </section>
  );
}
