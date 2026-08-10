import "server-only";

import {
  buildBzm2Observatory,
  type Bzm2ObservationRow,
  type Bzm2Observatory,
  type Bzm2RevisionRow,
} from "@/lib/bzm-2-observatory";
import { createAdminClient } from "@/lib/supabase/admin";

const REVISION_SELECT = [
  "revision_id",
  "revision_key",
  "revision_order",
  "theory_version",
  "model_version",
  "measurement_status",
  "information_cutoff",
  "forward_validation_count",
  "revision_reason",
  "source_ref",
  "created_at",
].join(",");

const OBSERVATION_SELECT = [
  "observation_id",
  "revision_id",
  "parameter_key",
  "symbol",
  "label",
  "parameter_group",
  "value_json",
  "display_value",
  "value_status",
  "unit",
  "evidence_kind",
  "evidence_ref",
  "affects",
  "condition_json",
  "note",
  "sort_order",
  "created_at",
].join(",");

export async function fetchBzm2Observatory(projectId: string): Promise<Bzm2Observatory> {
  try {
    const db = createAdminClient();
    const revisionsResult = await db
      .from("bzm_2_model_revisions")
      .select(REVISION_SELECT)
      .eq("project_id", projectId)
      .order("revision_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (revisionsResult.error) {
      return buildBzm2Observatory({
        projectId,
        storageState: "unavailable",
        storageMessage: "BZM 2.0観測台帳をまだ初期化できていない。式と必須パラメータだけ表示している。",
      });
    }

    const revisionRows = (revisionsResult.data ?? []) as unknown as Bzm2RevisionRow[];
    const revisionIds = revisionRows.map((row) => row.revision_id);
    if (revisionIds.length === 0) {
      return buildBzm2Observatory({ projectId, revisionRows });
    }

    const observationsResult = await db
      .from("bzm_2_parameter_observations")
      .select(OBSERVATION_SELECT)
      .in("revision_id", revisionIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (observationsResult.error) {
      return buildBzm2Observatory({
        projectId,
        revisionRows,
        storageState: "unavailable",
        storageMessage: "版は確認できたが、パラメータ観測を読み出せなかった。数値を0で補完していない。",
      });
    }

    return buildBzm2Observatory({
      projectId,
      revisionRows,
      observationRows: (observationsResult.data ?? []) as unknown as Bzm2ObservationRow[],
    });
  } catch {
    return buildBzm2Observatory({
      projectId,
      storageState: "unavailable",
      storageMessage: "BZM 2.0観測台帳へ接続できなかった。数値を推定せず欠測として表示している。",
    });
  }
}
