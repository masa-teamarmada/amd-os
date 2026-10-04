/**
 * PJ経営管理ワークスペースの「表示レーン」導出。柱(track)はDB由来でPJごとに数・キーが違う
 * (2026-08-13 柱の汎用化 — migration 273)。ガントの描画とMS/タスク編集フォームの両方が同じ
 * レーン集合を見る必要があるため、その導出ロジックをここへ1本化する。
 *
 * 決まりは柱の形だけで決まり、PJ番号では分けない（2026-10-04 まさ「特定のPJだけの特例を入れたら
 * システムにならない」、spec 3-23 §6）。
 *
 * 純粋な .ts (server-onlyでない) — クライアントコンポーネントからもimportできる。
 */

/** Display lane key. Identical to the track key, except that the standard 4-track set folds
 * 資金調達 and 体制構築 into one 組織開発 lane (see STANDARD_* below). */
export type SxDisplayLaneKey = string;

/** Track definition shape needed to derive display lanes. Matches (a subset of)
 * SxManagementBundle["tracks"] so callers can pass `management.tracks` directly. */
export type SxDisplayLaneTrackDef = {
  key: string;
  label: string;
  shortLabel: string;
  sortOrder: number;
};

/** The standard 4 tracks (事業開発・技術開発・資金調達・体制構築) — every project that has exactly
 * this set gets the same 3 gantt lanes: 資金調達(funding) has no lane of its own and folds into
 * 組織開発 with organizational_building. Projects with any other track set get one lane per
 * track, in DB sort_order. */
const STANDARD_TRACK_KEYS = ["business_development", "technology_development", "funding", "organizational_building"];

export const STANDARD_LANE_ORDER: SxDisplayLaneKey[] = [
  "business_development",
  "technology_development",
  "organization",
];

export const STANDARD_LANE_LABEL: Record<string, string> = {
  business_development: "事業開発",
  technology_development: "技術開発",
  organization: "組織開発",
};

function standardLaneKeyForTrack(trackKey: string | null | undefined): SxDisplayLaneKey {
  if (trackKey === "business_development") return "business_development";
  if (trackKey === "technology_development") return "technology_development";
  return "organization"; // funding + organizational_building fold together
}

/** How bundle tracks map onto display lanes. Unknown/missing track keys fall back to the
 * project's first track rather than inventing a lane. */
export type SxLaneFold = {
  /** true when the project has the standard 4 tracks folded into 3 lanes. */
  isStandardFold: boolean;
  order: SxDisplayLaneKey[];
  laneKeyForTrack: (trackKey: string | null | undefined) => SxDisplayLaneKey;
  labelFor: (key: SxDisplayLaneKey) => string;
  trackForLane: (key: SxDisplayLaneKey) => string;
};

export function buildSxLaneFold(tracks: SxDisplayLaneTrackDef[]): SxLaneFold {
  const sorted = [...tracks].sort((a, b) => a.sortOrder - b.sortOrder);
  const isStandardFold =
    sorted.length === STANDARD_TRACK_KEYS.length &&
    STANDARD_TRACK_KEYS.every((key) => sorted.some((track) => track.key === key));
  if (isStandardFold) {
    return {
      isStandardFold: true,
      order: STANDARD_LANE_ORDER,
      laneKeyForTrack: standardLaneKeyForTrack,
      labelFor: (key) => STANDARD_LANE_LABEL[key] ?? key,
      trackForLane: (key) => (key === "organization" ? "organizational_building" : key),
    };
  }
  const order = sorted.map((track) => track.key);
  const byKey = new Map(sorted.map((track) => [track.key, track]));
  const fallbackKey = order[0] ?? "";
  return {
    isStandardFold: false,
    order,
    laneKeyForTrack: (trackKey) => (trackKey && byKey.has(trackKey) ? trackKey : fallbackKey),
    labelFor: (key) => byKey.get(key)?.label ?? key,
    trackForLane: (key) => key,
  };
}
