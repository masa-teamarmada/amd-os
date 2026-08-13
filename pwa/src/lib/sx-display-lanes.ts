/**
 * PJ経営管理ワークスペースの「表示レーン」導出。柱(track)はDB由来でPJごとに数・キーが違う
 * (2026-08-13 柱の汎用化 — migration 273)。ガントの描画とMS/タスク編集フォームの両方が同じ
 * レーン集合を見る必要があるため、その導出ロジックをここへ1本化する
 * (以前は SxUnifiedTimeline.tsx と SxWeeklyControlDashboard.tsx にほぼ同じものが手で複製されて
 * いた — p21専用の3レーン化ルールがPJ非依存のコードへ紛れ込む温床だったので統合した)。
 *
 * 純粋な .ts (server-onlyでない) — クライアントコンポーネントからもimportできる。
 */

/** Display lane key. For most projects this is identical to the track key (one lane per bundle
 * track). p21 is the sole exception — see P21_* below. */
export type SxDisplayLaneKey = string;

/** Track definition shape needed to derive display lanes. Matches (a subset of)
 * SxManagementBundle["tracks"] so callers can pass `management.tracks` directly. */
export type SxDisplayLaneTrackDef = {
  key: string;
  label: string;
  shortLabel: string;
  sortOrder: number;
};

/** p21 (SolvioraX) folds its 4 tracks into 3 gantt display lanes: 資金調達(funding) has no
 * dedicated lane of its own — it merges into 組織開発 alongside organizational_building. There
 * is no separate "設立前提" lane; the two blocking milestones are forced into these 3 lanes
 * directly (see P21_BLOCKING_MILESTONE_LANE below), not rendered as a 4th synthetic lane. This is
 * a deliberate, PJ-specific density decision for SolvioraX only — it must never change p21's
 * pixel output, and must never apply to any other project (2026-08-13 柱の汎用化 — p21固定→DB由来). */
const P21_TRACK_KEYS = ["business_development", "technology_development", "funding", "organizational_building"];

export const P21_LANE_ORDER: SxDisplayLaneKey[] = [
  "business_development",
  "technology_development",
  "organization",
];

export const P21_LANE_LABEL: Record<string, string> = {
  business_development: "事業開発",
  technology_development: "技術開発",
  organization: "組織開発",
};

function p21LaneKeyForTrack(trackKey: string | null | undefined): SxDisplayLaneKey {
  if (trackKey === "business_development") return "business_development";
  if (trackKey === "technology_development") return "technology_development";
  return "organization"; // funding + organizational_building fold together
}

/** The 2 blocking milestones never follow their own track column — each is forced into a fixed
 * display lane regardless of its project_management_milestones.track value. p21-only: no other
 * project has these milestone slugs. */
const P21_BLOCKING_MILESTONE_LANE: Record<string, SxDisplayLaneKey> = {
  "business-paid-poc-oral-agreement": "business_development",
  "funding-investment-oral-agreement": "organization",
};

/** How bundle tracks map onto display lanes. p21 keeps its historical 3-lane fold
 * (pixel-identical to before); every other project gets one lane per track, in DB sort_order —
 * no folding, no blocking-milestone overrides. Unknown/missing track keys fall back to the
 * project's first track rather than inventing a lane. */
export type SxLaneFold = {
  isP21Fold: boolean;
  order: SxDisplayLaneKey[];
  laneKeyForTrack: (trackKey: string | null | undefined) => SxDisplayLaneKey;
  labelFor: (key: SxDisplayLaneKey) => string;
  trackForLane: (key: SxDisplayLaneKey) => string;
  blockingMilestoneLane: (slug: string) => SxDisplayLaneKey | null;
};

export function buildSxLaneFold(tracks: SxDisplayLaneTrackDef[]): SxLaneFold {
  const sorted = [...tracks].sort((a, b) => a.sortOrder - b.sortOrder);
  const isP21Fold =
    sorted.length === P21_TRACK_KEYS.length &&
    P21_TRACK_KEYS.every((key) => sorted.some((track) => track.key === key));
  if (isP21Fold) {
    return {
      isP21Fold: true,
      order: P21_LANE_ORDER,
      laneKeyForTrack: p21LaneKeyForTrack,
      labelFor: (key) => P21_LANE_LABEL[key] ?? key,
      trackForLane: (key) => (key === "organization" ? "organizational_building" : key),
      blockingMilestoneLane: (slug) => P21_BLOCKING_MILESTONE_LANE[slug] ?? null,
    };
  }
  const order = sorted.map((track) => track.key);
  const byKey = new Map(sorted.map((track) => [track.key, track]));
  const fallbackKey = order[0] ?? "";
  return {
    isP21Fold: false,
    order,
    laneKeyForTrack: (trackKey) => (trackKey && byKey.has(trackKey) ? trackKey : fallbackKey),
    labelFor: (key) => byKey.get(key)?.label ?? key,
    trackForLane: (key) => key,
    blockingMilestoneLane: () => null,
  };
}
