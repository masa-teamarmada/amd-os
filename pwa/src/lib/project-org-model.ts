/**
 * PJコックピット「スコア詳細」タブの《組織》セクションで、API と画面が共有する形。
 *
 * 中身の意味の正本はモデル台帳（`model/MODEL_VERSION_LEDGER.md` §6.B・§6.C）。
 * ここは受け渡しの型だけを持ち、機能の一覧・判定条件・機能の説明を書き起こさない。
 */

import type { TeamFunctionDef } from "@/lib/bzm30/team-functions";
import type { FunctionJudgement, OrgObservation } from "@/lib/bzm30/team-fulfillment";

export type OrgMemberGroup = "amd" | "startup" | "university" | "partner" | "vc" | "other";

export interface OrgMember {
  name: string;
  affiliation: string | null;
  role: string | null;
  group: OrgMemberGroup;
  /** active = いま動いている / tentative = 関与が確定していない / inactive = 過去または誤抽出 */
  status: "active" | "tentative" | "inactive";
  note: string | null;
  /** 最後にこの人が観測された日。 */
  lastSeen: string | null;
  /** どこから来たか。同じ人が複数に出ていたら束ねた元をすべて並べる。 */
  sources: string[];
}

/** まだ誰も入っていない役職。人の一覧とは別に出す。 */
export interface OrgRoleSlot {
  roleName: string;
  candidate: string | null;
  joinCondition: string | null;
  dueDate: string | null;
  vacant: boolean;
}

/** 機能1行 = 正本の定義 + この PJ での判定。 */
export type OrgFunctionRow = TeamFunctionDef & {
  /** 正本の「拡張枠」。まだ機能ではないので充足を判定しない。 */
  placeholder: boolean;
  judgement: FunctionJudgement;
};

export interface ProjectOrgPayload {
  ok: true;
  /** 判定の基準日。直近性はこの日から数えている。 */
  asOf: string;
  /** 記帳が薄く、空席かどうかの判定を保留している状態（§6.C-3 の3）。 */
  thinRecord: boolean;
  functions: OrgFunctionRow[];
  observations: OrgObservation[];
  members: OrgMember[];
  roleSlots: OrgRoleSlot[];
}

export const MEMBER_GROUP_LABEL: Record<OrgMemberGroup, string> = {
  startup: "SU側",
  amd: "AMD",
  university: "大学・研究機関",
  partner: "連携企業",
  vc: "投資家",
  other: "その他",
};

export const MEMBER_STATUS_LABEL: Record<OrgMember["status"], string> = {
  active: "活動中",
  tentative: "未確定",
  inactive: "過去・無効",
};
