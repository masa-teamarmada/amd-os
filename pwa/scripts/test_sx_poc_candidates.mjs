import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  sxIsPocPartner,
  sxIsUncontactedPocPartner,
} from "../src/lib/sx-poc-candidates.ts";
import {
  sxCompactBallSideLabel,
  sxCompactPartnerRowText,
  sxComparePartnersForPoc,
  sxPartnerAttention,
  sxPartnerHasDataGap,
  sxPartnerHasContactRecord,
  sxPartnerHasDueSoon,
  sxPartnerHasOverdue,
  sxIsVcPartner,
  sxPartnerIsOnHold,
  sxPartnerNeedsRefresh,
  sxPartnerOwnerLoads,
  sxPartnerPrimaryIntervention,
  sxPartnerConfidenceLabel,
  sxPartnerConfidenceRank,
} from "../src/lib/sx-partner-progress.ts";
import { assertSafeRelationshipOrigin } from "../src/lib/sx-relationship-origin.ts";

for (const allowed of [
  "伊予銀行",
  "PoC相談の初回メール",
  "学会で石原先生から紹介",
  "7.14経営会議で紹介",
  "資料ver.2を見て連絡",
]) {
  assert.doesNotThrow(() => assertSafeRelationshipOrigin(allowed, "接点の経緯"));
}
for (const rejected of [
  "contact@example.com",
  "https://example.com/path",
  "www.example.com",
  "example.com/path",
  "090-1234-5678",
  "+81-90-1234-5678",
  "初回メール\n本文の続き",
]) {
  assert.throws(
    () => assertSafeRelationshipOrigin(rejected, "接点の経緯"),
    /1行の短い要約|メールアドレス・電話番号・URL/,
  );
}

const base = {
  agreedScope: "",
  introducerLabel: null,
  connectionContext: null,
  nextCommitment: "",
  ownerLabel: "輕部",
  currentBallSide: "unknown",
  currentBallOwner: null,
  dueDate: null,
  dueDatePrecision: "unknown",
  lastContactDate: null,
  roles: [],
  workItems: [],
  commitments: [],
  interactions: [],
  relatedMilestoneSlugs: [],
  deferredLowPriority: false,
  lastVerifiedAt: "2026-07-29",
  confidence: "high",
};
const untouched = {
  ...base,
  id: "1",
  name: "候補A",
  roleLabel: "PoC候補先（排液提供）",
  relationshipStage: "candidate",
};
const talking = {
  ...base,
  id: "2",
  name: "接触B",
  roleLabel: "PoC接触先（排液提供）",
  relationshipStage: "information_exchange",
};
const secured = {
  ...base,
  id: "4",
  name: "調達D",
  roleLabel: "PoC接触先（排液提供）",
  relationshipStage: "executing",
};
const other = {
  ...base,
  id: "5",
  name: "愛媛大学",
  roleLabel: "研究実証・大学側接続",
  relationshipStage: "validation_preparation",
};
// EWIR候補機関Aは stage=candidate だがPoC候補ではない。役割ラベルで判定すること。
const ewirCandidate = {
  ...base,
  id: "6",
  name: "EWIR候補機関A",
  roleLabel: "地域連携・候補企業訪問",
  relationshipStage: "candidate",
};

// 判定はroleLabelの接頭辞。stageだけで判定すると他の候補まで巻き込む。
assert.equal(sxIsPocPartner(untouched), true);
assert.equal(sxIsPocPartner(talking), true);
// 調達済みも「候補」ではないが、PoCという横断属性の対象には残る。
assert.equal(sxIsPocPartner(secured), true);
assert.equal(sxIsPocPartner(other), false);
assert.equal(sxIsPocPartner(ewirCandidate), false);

// VCは保存済みroleだけを使い、会社名やroleLabelから推測しない。
assert.equal(
  sxIsVcPartner({ roles: [{ roleKind: "shareholder_investor" }] }),
  true,
);
assert.equal(
  sxIsVcPartner({
    roles: [],
    name: "VCらしい会社名",
    roleLabel: "VC候補らしい自由記述",
  }),
  false,
);

// 未接触はPoC比較レンズの接触状況集計にだけ使い、進捗段階やgroupを捏造しない。
assert.equal(sxIsUncontactedPocPartner(untouched), true);
assert.equal(sxIsUncontactedPocPartner(talking), false);
assert.equal(sxIsUncontactedPocPartner(secured), false);
assert.equal(sxIsUncontactedPocPartner(ewirCandidate), false);

// このmoduleにPoC専用のstage/group/orderを再導入しない。
const source = readFileSync(
  new URL("../src/lib/sx-poc-candidates.ts", import.meta.url),
  "utf8",
);
for (const forbidden of [
  "deriveSxPocList",
  "sxPocStageOf",
  "SX_POC_STAGE_ORDER",
  "sxPocStageLabel",
]) {
  assert.equal(
    source.includes(forbidden),
    false,
    `${forbidden} must not return`,
  );
}

// 関係先UIは固定段階へ正規化せず、実在する接点・作業・現在地・ゴールから可変stepsを作る。
const pipelineSource = readFileSync(
  new URL(
    "../src/components/project-workspace/SxPartnerPipeline.tsx",
    import.meta.url,
  ),
  "utf8",
);
for (const required of [
  "interaction-${interaction.id}",
  "work-${item.id}",
  'key: "now"',
  'key: "next"',
  'key: "goal"',
  "sx-partner-stage-rail-",
  "sx-partner-progress-",
  "data-step-count={steps.length}",
  'data-testid="sx-partner-filter-vc"',
  "sxIsVcPartner",
  "現在の状況",
  "ゴール",
  "PartnerInlineRow",
  "PartnerProgressHistoryModal",
  "primaryInterventionTarget",
  "data-inline-edit-trigger",
  "aria-controls={`sx-partner-history-${partnerId}`}",
  "aria-label={`${steps.length}件の進捗と履歴を開く`}",
]) {
  assert.ok(
    pipelineSource.includes(required),
    `${required} must remain in the partner ledger`,
  );
}

const comparisonRowSource = pipelineSource.slice(
  pipelineSource.indexOf("function PartnerInlineRow"),
  pipelineSource.indexOf("export function SxPartnerPipeline"),
);
assert.equal(
  comparisonRowSource.includes("<PartnerProgressFlow"),
  false,
  "full progress flow must live in the detail modal, not the comparison row",
);
assert.ok(
  pipelineSource.indexOf("<PartnerProgressFlow") <
    pipelineSource.indexOf("function PartnerInlineRow"),
  "the history surface must render the full progress flow",
);

const bottleneckCellSource = comparisonRowSource.slice(
  comparisonRowSource.indexOf("詰まり・PJ影響"),
  comparisonRowSource.indexOf('editorKey={keyFor("next-action")}'),
);
for (const required of ["保有事項未接続", "whitespace-nowrap"]) {
  assert.ok(
    bottleneckCellSource.includes(required),
    `${required} must keep the unstructured bottleneck fallback inside the 96px desktop row`,
  );
}
assert.equal(
  bottleneckCellSource.includes("具体的な保有事項との紐づけなし"),
  false,
  "the verbose unstructured fallback must not make normal partner rows exceed 96px",
);

// 現在の状況は、表示時から見える「保有側 / 担当」の2slotだけを同じ寸法で編集する。
// 期限は担当・期限cellの責務で、ここへ縦積みformを戻さない。
const currentCellSource = comparisonRowSource.slice(
  comparisonRowSource.indexOf("data-current-situation-cell"),
  comparisonRowSource.indexOf('editorKey={keyFor("goal")}'),
);
for (const required of [
  "InlineCurrentBallEditor",
  "data-current-situation-cell",
  "current_ball_side",
  "current_ball_owner",
]) {
  assert.ok(
    currentCellSource.includes(required),
    `${required} must remain in the current situation cell`,
  );
}
for (const forbidden of ["due_date", "due_date_precision", "InlineDueFields"]) {
  assert.equal(
    currentCellSource.includes(forbidden),
    false,
    `${forbidden} must stay out of the current situation cell`,
  );
}

// desktopの1社1行は9列の実必要幅に合わせたcontainer breakpointで成立させる。
// 旧1280pxは1440px画面の実一覧幅1261pxでも発火せず、1行約500pxまで膨張した。
// 1248px未満では無理に9列化せず、右端clipを避ける。
for (const required of [
  'data-partner-row-density="compact"',
  "@container",
  "@min-[1248px]:grid-cols-[236px_196px_104px_96px_132px_72px_104px_148px]",
  "@min-[1248px]:grid-cols-[236px_196px_104px_96px_132px_72px_104px_148px_72px]",
  "sm:grid-cols-[minmax(0,1fr)_72px]",
  "grid-cols-[minmax(0,1fr)_68px]",
  "@min-[1248px]:col-span-1",
  "@min-[1248px]:grid",
]) {
  assert.ok(
    pipelineSource.includes(required),
    `${required} must keep the partner ledger dense at desktop width`,
  );
}
assert.equal(
  pipelineSource.includes("@min-[1280px]"),
  false,
  "the partner ledger must not restore the too-wide 1280px inner-container breakpoint",
);

// 関係先名は識別主キー。全文を表示し、編集時も同じ文字面だけをinputへ置換する。
const partnerNameViewSource = pipelineSource.slice(
  pipelineSource.indexOf("const relationNameView"),
  pipelineSource.indexOf("const connectionOriginView"),
);
for (const required of ["whitespace-normal", "break-words"]) {
  assert.ok(
    partnerNameViewSource.includes(required),
    `${required} must keep the complete partner name visible`,
  );
}
assert.equal(
  partnerNameViewSource.includes("truncate"),
  false,
  "partner names and their verification dates must never be ellipsized",
);
const partnerNameEditorSource = pipelineSource.slice(
  pipelineSource.indexOf("function InlinePartnerNameEditor"),
  pipelineSource.indexOf("function InlineConnectionOriginEditor"),
);
for (const required of [
  'data-inline-cell-mode="edit-seamless"',
  "void commit(false)",
  'event.key === "Enter"',
  'event.key === "Escape"',
  "event.nativeEvent.isComposing",
  "[field-sizing:content]",
  "useInlinePointerReplayTarget(active)",
  "replayInlinePointerTarget(pointerReplayTargetRef)",
  "pointerReplayTargetRef.current = null",
  "finish(true)",
]) {
  assert.ok(
    partnerNameEditorSource.includes(required),
    `${required} must keep partner-name editing seamless and keyboard safe`,
  );
}
assert.ok(
  pipelineSource.includes("[data-partner-filter-trigger]"),
  "pointer replay must include partner filters so a successful blur-save can resume the requested filter",
);
assert.equal(
  partnerNameEditorSource.includes("event.relatedTarget.closest"),
  false,
  "Tab focus movement must not be replayed as a click after partner-name blur save",
);
for (const forbidden of [
  "border-l-2",
  "bg-[#f8f5ec]",
  "INLINE_ACTION_CLASS",
  "LoaderCircle",
]) {
  assert.equal(
    partnerNameEditorSource.includes(forbidden),
    false,
    `${forbidden} must not transform the partner-name cell while editing`,
  );
}
for (const required of [
  "absolute left-0 top-full",
  'role="alert"',
  "text-[#8c3329]",
]) {
  assert.ok(
    partnerNameEditorSource.includes(required),
    `${required} must show save errors without changing row geometry`,
  );
}
const partnerNameCellSource = comparisonRowSource.slice(
  comparisonRowSource.indexOf("grid-cols-[minmax(0,1fr)_68px]"),
  comparisonRowSource.indexOf("<PartnerStageRail"),
);
for (const required of [
  "<InlinePartnerNameEditor",
  "border-b border-dashed border-[#857b69]",
  "最終確認",
]) {
  assert.ok(
    partnerNameCellSource.includes(required),
    `${required} must remain in the same partner-name geometry before and during editing`,
  );
}
for (const forbidden of ["renderFields=", ">関係先名</span>"]) {
  assert.equal(
    partnerNameCellSource.includes(forbidden),
    false,
    `${forbidden} must not appear only after partner-name editing starts`,
  );
}
const genericInlineEditorSource = pipelineSource.slice(
  pipelineSource.indexOf("function InlineCellEditor"),
  pipelineSource.indexOf("function InlinePartnerNameEditor"),
);
assert.equal(
  genericInlineEditorSource.includes(
    'className="min-w-0 border-l-2 border-[#38745d] bg-[#f8f5ec] p-1.5"',
  ),
  false,
  "generic relation-cell editing must not add the old green frame and inset card",
);
const stableCurrentEditorSource = pipelineSource.slice(
  pipelineSource.indexOf("function InlineCurrentBallEditor"),
  pipelineSource.indexOf("function InlineDueFields"),
);
for (const required of [
  'data-inline-cell-mode="view"',
  'data-inline-cell-mode="edit-seamless"',
  "min-h-11",
  "grid-cols-[60px_minmax(0,1fr)]",
  "保有側",
  "担当",
  "void save(false)",
  "event.nativeEvent.isComposing",
  "replayInlinePointerTarget(pointerReplayTargetRef)",
  "pointerReplayTargetRef.current = null",
]) {
  assert.ok(
    stableCurrentEditorSource.includes(required),
    `${required} must keep the current editor geometry stable`,
  );
}
for (const forbidden of [
  "grid-cols-[60px_minmax(0,1fr)_44px_44px]",
  "finishAndReturnFocus",
  "aria-label={`${label}の保有側と担当を保存`}",
]) {
  assert.equal(
    stableCurrentEditorSource.includes(forbidden),
    false,
    `${forbidden} must not make the current-situation cell expand while editing`,
  );
}

// 接点の経緯は「経緯 / 紹介者」を専用2段cellで比較・直接編集し、
// 出典source_refや個別接点actorを紹介者へ流用しない。
const originEditorSource = pipelineSource.slice(
  pipelineSource.indexOf("function InlineConnectionOriginEditor"),
  pipelineSource.indexOf("function InlineCurrentBallEditor"),
);
for (const required of [
  "InlineConnectionOriginEditor",
  'data-inline-cell-mode="edit-seamless"',
  "経緯 未登録",
  "紹介者",
  "event.nativeEvent.isComposing",
  "replayInlinePointerTarget(pointerReplayTargetRef)",
  "pointerReplayTargetRef.current = null",
]) {
  assert.ok(
    originEditorSource.includes(required),
    `${required} must keep connection origin directly editable in two stable rows`,
  );
}

for (const required of [
  "data-partner-filter-trigger=\"all\"",
  "data-partner-filter-trigger=\"poc\"",
  "data-partner-filter-trigger=\"vc\"",
  "data-partner-filter-trigger={`role-${kind}`}",
  "data-partner-filter-trigger={`owner-${load.ownerKey}`}",
  "data-partner-filter-trigger={`quick-${filter}`}",
  "onClear={() => {\n          if (activeInlineEditorKey) return",
  "onSelect={(kind) => {\n          if (activeInlineEditorKey) return",
  "onSelectPoc={() => {\n          if (activeInlineEditorKey) return",
  "onSelectVc={() => {\n          if (activeInlineEditorKey) return",
  "onSelectOwner={(ownerKey) => {\n            if (activeInlineEditorKey) return",
  "onSelectQuickFilter={(filter) => {\n            if (activeInlineEditorKey) return",
]) {
  assert.ok(
    pipelineSource.includes(required),
    `${required} must defer filter changes until the active inline save succeeds`,
  );
}
// 接点の経緯cellは9列の右端 (現在地の根拠のあと) に置く。
// 日次で読む列ではないため左から2番目には戻さない (まさ 2026-08-06)。
const originCellSource = comparisonRowSource.slice(
  comparisonRowSource.indexOf("<InlineConnectionOriginEditor"),
);
assert.ok(
  comparisonRowSource.indexOf("<InlineConnectionOriginEditor") >
    comparisonRowSource.indexOf('editorKey={keyFor("current")}'),
  "接点の経緯cellは現在の状況cellより後ろ (行の右端側) に置く",
);
for (const required of [
  "connection_context",
  "introducer_label",
  "partner.connectionContext",
  "partner.introducerLabel",
]) {
  assert.ok(
    originCellSource.includes(required),
    `${required} must remain in the connection-origin cell contract`,
  );
}
for (const required of [
  "<span>関係先</span>",
  "<span>接点の経緯</span>",
  "<span>現在の状況</span>",
]) {
  assert.ok(
    pipelineSource.includes(required),
    `${required} must remain in the nine-column partner header`,
  );
}

const managementSource = readFileSync(
  new URL("../src/lib/sx-management.ts", import.meta.url),
  "utf8",
);
const managementRouteSource = readFileSync(
  new URL(
    "../src/app/api/project-workspace/[projectId]/management/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const originMigration = readFileSync(
  new URL("./migrations/224_sx_partner_connection_origin.sql", import.meta.url),
  "utf8",
);
for (const required of [
  "introducerLabel: string | null",
  "connectionContext: string | null",
  "introducer_label,connection_context",
  'nullableString(row, "introducer_label")',
  'nullableString(row, "connection_context")',
]) {
  assert.ok(
    managementSource.includes(required),
    `${required} must remain in the management read model`,
  );
}
for (const required of [
  'takeOptionalText("introducer_label", "introducer_label", 120)',
  'takeOptionalText("connection_context", "connection_context", 500)',
  'optionalTextValue("introducer_label", 120)',
  'optionalTextValue("connection_context", 500)',
  'from "@/lib/sx-relationship-origin"',
  "assertSafeRelationshipOrigin(patch.introducer_label",
  "assertSafeRelationshipOrigin(patch.connection_context",
  "assertSafeRelationshipOrigin(introducerLabel",
  "assertSafeRelationshipOrigin(connectionContext",
]) {
  assert.ok(
    managementRouteSource.includes(required),
    `${required} must remain in the management write contract`,
  );
}
for (const required of [
  "ADD COLUMN IF NOT EXISTS introducer_label text",
  "ADD COLUMN IF NOT EXISTS connection_context text",
  "pm_partners_introducer_len_224",
  "pm_partners_connection_context_len_224",
  "pm_partners_introducer_contact_safe_224",
  "pm_partners_connection_context_contact_safe_224",
  "position(E'\\n' in introducer_label) = 0",
  "position(E'\\n' in connection_context) = 0",
  "https?://",
  "@[[:alnum:].-]+\\.[[:alpha:]]{2,}",
  "'poc-contact-marutomo'",
  "'poc-contact-okabe'",
  "'poc-contact-yamaki'",
  "'伊予銀行'",
  "AND agreed_scope = '伊予銀行紹介でPoC相談の初回メール送付を確認'",
  "AND agreed_scope = '伊予銀行紹介でPoC相談と訪問日程の調整を確認'",
  "AND deleted_at IS NULL",
]) {
  assert.ok(
    originMigration.includes(required),
    `${required} must remain in migration 224`,
  );
}

// partner fallback時も「担当・期限」はowner_label/dueだけを更新し、
// 現在ボールの保存先と重複させない。
const ownershipCellSource = comparisonRowSource.slice(
  comparisonRowSource.indexOf('editorKey={keyFor("ownership")}'),
  comparisonRowSource.indexOf('editorKey={keyFor("latest-interaction")}'),
);
const partnerOwnershipPatch = ownershipCellSource.slice(
  ownershipCellSource.lastIndexOf(
    'patchIfChanged(\n                    "partner"',
  ),
  ownershipCellSource.indexOf("renderFields="),
);
for (const required of ["owner_label", "due_date", "due_date_precision"]) {
  assert.ok(
    partnerOwnershipPatch.includes(required),
    `${required} must remain in the partner ownership fallback patch`,
  );
}
assert.ok(
  partnerOwnershipPatch.includes(
    'owner_label: values.owner.trim() || "担当未確認"',
  ),
  "blank partner owner must normalize to 担当未確認",
);
for (const forbidden of ["current_ball_side", "current_ball_owner"]) {
  assert.equal(
    partnerOwnershipPatch.includes(forbidden),
    false,
    `${forbidden} must not overlap the ownership fallback patch`,
  );
}

const vcMigration = readFileSync(
  new URL("./migrations/211_sx_vc_partner_ledger.sql", import.meta.url),
  "utf8",
);
for (const required of [
  "'davp'",
  "'bnv'",
  "'iyogin-capital'",
  "ダイキアクシスベンチャーパートナーズ（DAVP）",
  "Beyond Next Ventures（BNV）",
  "いよぎんキャピタル",
  "'partners-fund'",
  "'shareholder_investor'",
  "'unconfirmed'",
  "user:2026-08-01#vc-list",
  "partner_count <> 4",
  "vc_role_count <> 4",
  "partner.deleted_at IS NULL",
  "role.deleted_at IS NULL",
]) {
  assert.ok(
    vcMigration.includes(required),
    `${required} must remain in migration 211`,
  );
}
for (const forbidden of [
  "PartnerProgressScale",
  "PARTNER_STAGE_SHORT_LABELS",
  "sx-partner-stage-reference",
  "data-stage-index",
  "SX_PARTNER_STAGE_ORDER.map",
]) {
  assert.equal(
    pipelineSource.includes(forbidden),
    false,
    `${forbidden} must not return to the partner ledger`,
  );
}

// 進捗と要対応は別軸。期限超過は深い段階より先に並ぶが、浅い段階だけでは「遅れ」にしない。
const overdue = {
  ...talking,
  id: "7",
  name: "期限超過先",
  dueDate: "2026-07-20",
  dueDatePrecision: "day",
};
const sxBall = {
  ...secured,
  id: "8",
  name: "当方対応先",
  currentBallSide: "sx",
  currentBallOwner: "石原先生",
  dueDate: "2026-08-20",
  dueDatePrecision: "day",
};
const dueSoonSxBall = { ...sxBall, dueDate: "2026-08-03" };
const unknownBall = {
  ...secured,
  id: "9",
  name: "担当未確認先",
  currentBallSide: "unknown",
  dueDate: "2026-08-20",
  dueDatePrecision: "day",
};
const dueUnset = {
  ...talking,
  id: "10",
  name: "期限未設定先",
  currentBallSide: "none",
};
assert.equal(sxPartnerAttention(overdue, "2026-07-30").key, "overdue");
assert.equal(sxPartnerAttention(sxBall, "2026-07-30").key, "clear");
assert.equal(sxPartnerAttention(dueSoonSxBall, "2026-07-30").key, "due_soon");
assert.equal(sxPartnerAttention(unknownBall, "2026-07-30").key, "unknown");
assert.equal(sxPartnerAttention(dueUnset, "2026-07-30").key, "due_unset");
assert.ok(
  sxComparePartnersForPoc(overdue, sxBall, "2026-07-30", "attention") < 0,
);
assert.ok(
  sxComparePartnersForPoc(dueUnset, sxBall, "2026-07-30", "attention") < 0,
);
const sameAttentionShallow = {
  ...talking,
  id: "same-attention-shallow",
  name: "同順位先",
  relationshipStage: "candidate",
};
const sameAttentionDeep = {
  ...talking,
  id: "same-attention-deep",
  name: "同順位先",
  relationshipStage: "executing",
};
assert.equal(
  sxComparePartnersForPoc(
    sameAttentionShallow,
    sameAttentionDeep,
    "2026-07-30",
    "attention",
  ),
  0,
  "attention sort must not use the retired fixed stage as a tie-break",
);
const heldOverdue = { ...overdue, id: "11", deferredLowPriority: true };
assert.equal(sxPartnerIsOnHold(heldOverdue), true);
assert.equal(sxPartnerAttention(heldOverdue, "2026-07-30").key, "overdue");
const heldWithoutDue = {
  ...dueUnset,
  id: "12",
  relationshipStage: "on_hold",
  deferredLowPriority: true,
};
assert.equal(sxPartnerAttention(heldWithoutDue, "2026-07-30").key, "on_hold");
const stale = { ...sxBall, id: "13", lastVerifiedAt: "2026-07-01" };
const unknownConfidence = { ...sxBall, id: "14", confidence: "unknown" };
assert.equal(sxPartnerNeedsRefresh(stale, "2026-07-30"), true);
assert.equal(sxPartnerAttention(stale, "2026-07-30").key, "stale");
assert.equal(sxPartnerNeedsRefresh(unknownConfidence, "2026-07-30"), true);
const overlappingSignals = {
  ...overdue,
  id: "15",
  confidence: "unknown",
  currentBallSide: "unknown",
  currentBallOwner: null,
};
assert.equal(sxPartnerHasOverdue(overlappingSignals, "2026-07-30"), true);
assert.equal(sxPartnerNeedsRefresh(overlappingSignals, "2026-07-30"), true);
assert.equal(sxPartnerHasDataGap(overlappingSignals), true);
assert.equal(sxPartnerHasDueSoon(dueSoonSxBall, "2026-07-30"), true);

// 接点記録は表示ラベルではなく、実際の接点日またはinteractionから判定する。
assert.equal(
  sxPartnerHasContactRecord({ interactions: [], lastContactDate: null }),
  false,
);
assert.equal(
  sxPartnerHasContactRecord({
    interactions: [],
    lastContactDate: "2026-07-29",
  }),
  true,
);
assert.equal(
  sxPartnerHasContactRecord({
    interactions: [{ id: "mail-1" }],
    lastContactDate: null,
  }),
  true,
);

// 一覧では現在行の会社名だけを「先方」へ短縮し、第三者名・保存値・詳細履歴は変えない。
assert.equal(
  sxCompactPartnerRowText(
    "ユナイテッドシルク（担当者）からマルトモへ相談",
    "ユナイテッドシルク",
  ),
  "先方担当からマルトモへ相談",
);
assert.equal(
  sxCompactPartnerRowText(
    "ユナイテッドシルクから返答待ち",
    "ユナイテッドシルク",
  ),
  "先方から返答待ち",
);
assert.equal(
  sxCompactPartnerRowText(
    "ユナイテッドシルク研究所から返答待ち",
    "ユナイテッドシルク",
  ),
  "ユナイテッドシルク研究所から返答待ち",
);
assert.equal(sxCompactBallSideLabel("partner"), "先方");
assert.equal(sxCompactBallSideLabel("sx"), "当方");

function interventionWorkItem(overrides = {}) {
  return {
    id: "wi",
    partnerId: "1",
    side: "sx",
    itemKind: "task",
    title: "具体対応",
    detail: null,
    ownerLabel: "担当A",
    status: "open",
    dueDate: null,
    dueDatePrecision: "unknown",
    completionCriteria: null,
    completedOn: null,
    completionEvidence: null,
    acceptedBy: null,
    acceptedOn: null,
    handoffTo: null,
    relatedMilestoneId: null,
    lastVerifiedAt: "2026-07-29",
    confidence: "high",
    sourceKind: "manual",
    sourceRef: null,
    sortOrder: 0,
    ...overrides,
  };
}

// 主要対応事項は停止 > 期限超過を守り、同じtier内だけ現在ボール側を優先する。
{
  const partner = {
    ...talking,
    currentBallSide: "partner",
    currentBallOwner: "先方担当",
    workItems: [
      interventionWorkItem({
        id: "open-sx",
        side: "sx",
        title: "当方通常",
        ownerLabel: "当方担当",
        dueDate: "2026-07-31",
        dueDatePrecision: "day",
      }),
      interventionWorkItem({
        id: "blocked-sx",
        side: "sx",
        title: "停止対応",
        ownerLabel: "停止担当",
        status: "blocked",
        dueDate: null,
      }),
      interventionWorkItem({
        id: "overdue-partner",
        side: "partner",
        title: "先方超過",
        ownerLabel: "先方担当",
        dueDate: "2026-07-01",
        dueDatePrecision: "day",
      }),
    ],
  };
  const selected = sxPartnerPrimaryIntervention(partner, "2026-07-30");
  assert.equal(
    selected.recordId,
    "blocked-sx",
    "blocked must outrank overdue even when current ball is on the overdue side",
  );
  assert.equal(selected.title, "停止対応");
  assert.equal(selected.ownerLabel, "停止担当");
  assert.equal(selected.side, "sx");
  assert.equal(
    selected.dueDate,
    null,
    "action/owner/side/due must all come from the selected record",
  );
}

{
  const partner = {
    ...talking,
    currentBallSide: "partner",
    workItems: [
      interventionWorkItem({
        id: "blocked-sx",
        side: "sx",
        title: "当方停止",
        status: "blocked",
        ownerLabel: "当方担当",
      }),
      interventionWorkItem({
        id: "blocked-partner",
        side: "partner",
        title: "先方停止",
        status: "blocked",
        ownerLabel: "先方担当",
      }),
    ],
  };
  assert.equal(
    sxPartnerPrimaryIntervention(partner, "2026-07-30").recordId,
    "blocked-partner",
    "same-tier selection must prefer the current ball side",
  );
}

{
  const partner = {
    ...talking,
    currentBallSide: "sx",
    currentBallOwner: "石原先生",
    nextCommitment: "候補日を3案提示",
    dueDate: "2026-08-05",
    dueDatePrecision: "day",
    relatedMilestoneSlugs: ["onsite-poc"],
  };
  const fallback = sxPartnerPrimaryIntervention(partner, "2026-07-30");
  assert.equal(fallback.source, "partner_fallback");
  assert.equal(fallback.hasStructuredHolding, false);
  assert.equal(fallback.title, "候補日を3案提示");
  assert.equal(fallback.ownerLabel, "石原先生");
  assert.equal(
    fallback.relatedMilestoneSlug,
    null,
    "unstructured fallback must not fabricate a gate connection from partner links",
  );
}

// 担当者別集計は全holdingを数え、holding無しは管制情報不足として消さない。
{
  const structured = {
    ...talking,
    id: "owner-1",
    workItems: [
      interventionWorkItem({
        id: "risk",
        partnerId: "owner-1",
        ownerLabel: "石原先生",
        status: "blocked",
      }),
      interventionWorkItem({
        id: "soon",
        partnerId: "owner-1",
        ownerLabel: "石原先生",
        dueDate: "2026-08-03",
        dueDatePrecision: "day",
      }),
    ],
  };
  const missing = {
    ...talking,
    id: "owner-2",
    ownerLabel: "",
    currentBallOwner: null,
  };
  const loads = sxPartnerOwnerLoads([structured, missing], "2026-07-30");
  const ishihara = loads.find((load) => load.ownerLabel === "石原先生");
  const unconfirmed = loads.find((load) => load.ownerLabel === "担当未確認");
  assert.equal(ishihara.openCount, 2);
  assert.equal(ishihara.dangerCount, 1);
  assert.equal(ishihara.dueSoonCount, 1);
  assert.equal(unconfirmed.dataGapCount, 1);
  assert.deepEqual(unconfirmed.partnerIds, ["owner-2"]);
}


// 確度はPoC候補先スプシの語彙 (確認済み / 推定 / 要確認) をそのまま出し、
// 推定を確認済みへ丸めない。未保存・未知値だけ「未確認」へ落とす (まさ 2026-08-06)。
assert.equal(sxPartnerConfidenceLabel("high"), "確認済み");
assert.equal(sxPartnerConfidenceLabel("medium"), "推定");
assert.equal(sxPartnerConfidenceLabel("low"), "要確認");
assert.equal(sxPartnerConfidenceLabel(null), "未確認");
assert.equal(sxPartnerConfidenceLabel("bogus"), "未確認");
assert.ok(sxPartnerConfidenceRank("high") < sxPartnerConfidenceRank("medium"));
assert.ok(sxPartnerConfidenceRank("medium") < sxPartnerConfidenceRank("low"));
assert.ok(sxPartnerConfidenceRank("low") < sxPartnerConfidenceRank(null));

const confidenceHigh = { ...sxBall, id: "c-high", confidence: "high" };
const confidenceLow = { ...sxBall, id: "c-low", confidence: "low" };
assert.ok(
  sxComparePartnersForPoc(confidenceHigh, confidenceLow, "2026-07-30", "confidence") < 0,
  "確度順では確認済みが要確認より上にくる",
);
assert.equal(
  sxComparePartnersForPoc(confidenceHigh, confidenceLow, "2026-07-30", "confidence") ===
    sxComparePartnersForPoc(confidenceHigh, confidenceLow, "2026-07-30", "attention"),
  false,
  "確度順は既定の要対応順とは別の並びであること",
);

// 3チップは軸名 (段階 / 状態 / 確度) を必ずchip内に持ち、値だけを並べない。
for (const required of [
  '"段階",\n        sxPartnerStageLabel',
  '"状態",\n        sxPartnerActivityStateLabel',
  '"確度",\n        sxPartnerConfidenceLabel',
  "SX_PARTNER_CONFIDENCE_ORDER",
  'data-poc-confidence={confidence}',
  'data-partner-sort-trigger={sort}',
  '要対応順',
  '確度順',
]) {
  assert.ok(
    pipelineSource.includes(required),
    `${required} must keep the PoC facet chips self-labeling and sortable`,
  );
}

console.log("sx-poc comparison lens tests passed");
