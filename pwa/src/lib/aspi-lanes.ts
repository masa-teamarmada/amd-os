/**
 * ASPI Critical Technology Tracker 8 domains の型 + 定数。
 *
 * 正本: pwa/design/aspi_lanes.md
 * 形式: PJ.lanes は [{"domain": "<id>", "weight": 0-1}]、合計 = 1.0
 *
 * このモジュールは server / client の両方から import できるよう、
 * server-only な依存 (next/headers / Supabase server client) を持たない。
 */

export type AspiDomainId =
  | "advanced_ict"
  | "advanced_materials_manufacturing"
  | "ai_technologies"
  | "biotechnology"
  | "defence_space_robotics_transport"
  | "energy_environment"
  | "quantum"
  | "sensing_timing_navigation";

export const ASPI_DOMAIN_IDS: readonly AspiDomainId[] = [
  "advanced_ict",
  "advanced_materials_manufacturing",
  "ai_technologies",
  "biotechnology",
  "defence_space_robotics_transport",
  "energy_environment",
  "quantum",
  "sensing_timing_navigation",
];

export const ASPI_DOMAIN_LABEL_JP: Record<AspiDomainId, string> = {
  advanced_ict: "通信・ICT",
  advanced_materials_manufacturing: "先端材料・製造",
  ai_technologies: "AI",
  biotechnology: "バイオ・医療",
  defence_space_robotics_transport: "防衛・宇宙・ロボ",
  energy_environment: "エネルギー・環境",
  quantum: "量子",
  sensing_timing_navigation: "センシング",
};

export const ASPI_DOMAIN_SHORT_LABEL: Record<AspiDomainId, string> = {
  advanced_ict: "ICT",
  advanced_materials_manufacturing: "材料",
  ai_technologies: "AI",
  biotechnology: "バイオ",
  defence_space_robotics_transport: "防衛/宇宙/ロボ",
  energy_environment: "エネ/環境",
  quantum: "量子",
  sensing_timing_navigation: "センシング",
};

export interface LaneWeight {
  domain: AspiDomainId;
  weight: number; // 0-1、配列内合計 = 1.0
}
