import type { KillerFactorOperatingMode, KillerFactorStatus } from "./killer-factor-risk";
export type KillerFactorItem = {
  killerFactorId: string;
  operatingMode: KillerFactorOperatingMode;
  factorType: string;
  eventDescription: string;
  observationClues: string;
  preventiveAction: string | null;
  timingGuidance: string | null;
  status: KillerFactorStatus;
  statusOn: string | null;
  targetOn: string | null;
  evidenceNote: string | null;
  recordedByMemberId: string | null;
  recordedByLabel: string | null;
  recordedAt: string | null;
};
