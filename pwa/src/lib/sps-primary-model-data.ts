import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type SpsPrimaryModelState = {
  storageState: "available" | "unavailable" | "not_registered";
  primaryModel: "legacy_sps" | "sps_2_1";
  switchStatus: "preparing" | "active" | "rolled_back" | "not_registered";
  activeBzm21RevisionId: string | null;
  switchedAt: string | null;
  rollbackNote: string | null;
  legacyArchive: {
    archiveId: string;
    snapshotKey: string;
    snapshotAt: string;
    sourceCutoff: string;
    sourceCounts: Record<string, number>;
    payloadHash: string;
  } | null;
};

function unavailable(): SpsPrimaryModelState {
  return {
    storageState: "unavailable",
    primaryModel: "legacy_sps",
    switchStatus: "not_registered",
    activeBzm21RevisionId: null,
    switchedAt: null,
    rollbackNote: null,
    legacyArchive: null,
  };
}

function retiredPrimaryRegistry(): boolean {
  return true;
}

export async function fetchSpsPrimaryModelState(
  projectId: string,
): Promise<SpsPrimaryModelState> {
  if (retiredPrimaryRegistry()) {
    throw new Error(`retired SPS registry access for ${projectId}: use sps-ind-tier0-v1`);
  }
  try {
    const db = createAdminClient();
    const registry = await db
      .from("sps_primary_model_registry")
      .select(
        "project_id,primary_model,switch_status,legacy_archive_id,active_bzm_2_1_revision_id,switched_at,rollback_note",
      )
      .eq("project_id", projectId)
      .maybeSingle();
    if (registry.error) return unavailable();
    if (!registry.data) {
      return {
        ...unavailable(),
        storageState: "not_registered",
      };
    }

    const archive = await db
      .from("sps_legacy_archives")
      .select(
        "archive_id,snapshot_key,snapshot_at,source_cutoff,source_counts_json,payload_hash",
      )
      .eq("project_id", projectId)
      .eq("archive_id", registry.data.legacy_archive_id)
      .maybeSingle();
    if (archive.error || !archive.data) return unavailable();

    const sourceCounts =
      archive.data.source_counts_json &&
      typeof archive.data.source_counts_json === "object" &&
      !Array.isArray(archive.data.source_counts_json)
        ? Object.fromEntries(
            Object.entries(archive.data.source_counts_json).flatMap(
              ([key, value]) =>
                typeof value === "number" && Number.isFinite(value)
                  ? [[key, value]]
                  : [],
            ),
          )
        : {};

    return {
      storageState: "available",
      primaryModel:
        registry.data.primary_model === "sps_2_1" ? "sps_2_1" : "legacy_sps",
      switchStatus: ["preparing", "active", "rolled_back"].includes(
        registry.data.switch_status,
      )
        ? (registry.data.switch_status as SpsPrimaryModelState["switchStatus"])
        : "not_registered",
      activeBzm21RevisionId: registry.data.active_bzm_2_1_revision_id,
      switchedAt: registry.data.switched_at,
      rollbackNote: registry.data.rollback_note,
      legacyArchive: {
        archiveId: archive.data.archive_id,
        snapshotKey: archive.data.snapshot_key,
        snapshotAt: archive.data.snapshot_at,
        sourceCutoff: archive.data.source_cutoff,
        sourceCounts,
        payloadHash: archive.data.payload_hash,
      },
    };
  } catch {
    return unavailable();
  }
}
