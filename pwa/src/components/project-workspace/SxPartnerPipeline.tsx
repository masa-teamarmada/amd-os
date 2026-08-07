"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  Check,
  CircleCheck,
  CircleDot,
  Flag,
  GripVertical,
  LoaderCircle,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useModalContainment } from "@/components/project-workspace/useModalContainment";
import type {
  SxManagementBundle,
  SxManagementPartner,
  SxPartnerActivityState,
  SxPartnerCommitment,
  SxPartnerInteraction,
  SxPartnerRoleKind,
  SxPartnerSample,
  SxPartnerStage,
  SxPartnerWorkItem,
  SxPocCategory,
  SxPocJudgment,
  SxSampleStatus,
} from "@/lib/sx-management";
import { sxApplyOptimisticManagementPatch } from "@/lib/sx-management-optimistic";
import {
  SX_PROOF_DEFINITIONS,
  SX_PROOF_THEME_SLUGS,
  SX_THEME_PROOF_MAP,
  type SxProofThemeSlug,
} from "@/lib/sx-proof-mapping";
import {
  nominalizeSxActionLabel,
  nominalizeSxNextActionLabel,
} from "@/lib/sx-action-label";
import { sxNormalizePublicName } from "@/lib/sx-name-normalize";
import { sxIsPocPartner } from "@/lib/sx-poc-candidates";
import {
  SX_PARTNER_ACTIVITY_STATE_ORDER,
  SX_PARTNER_CONFIDENCE_ORDER,
  SX_PARTNER_STAGE_ORDER,
  SX_POC_CATEGORY_ORDER,
  SX_POC_JUDGMENT_ORDER,
  SX_SAMPLE_STATUS_ORDER,
  sxCompactPartnerRowText,
  sxComparePartnersForPoc,
  sxNormalizePartnerConfidence,
  sxPartnerConfidenceLabel,
  sxPartnerActivityStateLabel,
  sxPartnerStageLabel,
  sxPocCategoryLabel,
  sxPocLikelihoodLabel,
  sxCustomerValueLabel,
  sxPocPriorityTier,
  sxPocPriorityTierLabel,
  sxPocPriorityTierDescription,
  SX_POC_GRADE_CHOICES,
  SX_MEETING_MODES,
  SX_MEETING_MODE_LABEL,
  sxSampleStatusLabel,
  sxPartnerHasDataGap,
  sxPartnerHasContactRecord,
  sxPartnerHasDueSoon,
  sxPartnerHasOverdue,
  sxIsVcPartner,
  sxPartnerIsOnHold,
  sxPartnerNeedsRefresh,
  sxPartnerOwnerLoads,
  sxPartnerPrimaryIntervention,
  type SxPartnerPrimaryIntervention,
  type SxPocComparisonSort,
} from "@/lib/sx-partner-progress";
import {
  SxBadge,
  sxAllHoldingsForPartnerAudit,
  sxBallSideLabel,
  sxComputeControlBandCounts,
  sxConfidenceLabel,
  sxFormatDate,
  sxFormatDueDateWithPrecision,
  sxFormatEventDateWithPrecision,
  sxGroupPartnersByPrimaryClassification,
  sxHoldingsForPartner,
  sxInteractionKindLabel,
  sxIsHoldingMonthPrecision,
  sxIsHoldingOverdue,
  sxIsMissingOwner,
  sxIsPartnerEnded,
  sxLatestInteraction,
  sxPartnerDisplay,
  sxPartnerHasBlockedHolding,
  sxPartnerRoleKindLabel,
  sxPrimaryRoleKindCounts,
  sxRelationshipStateLabel,
  sxSortHoldingsByPriority,
  sxSortInteractionsByRecency,
  sxSourceKindLabel,
  sxSourceRefDisplayLabel,
  type SxControlBandCounts,
  type SxHoldingItem,
} from "./sx-visual-shared";

type PartnerProgressStep = {
  key: string;
  phase: "done" | "now" | "next" | "goal";
  title: string;
  sub: string | null;
};

/**
 * 会社名下のrailと進行状況列が、同じ件数・同じ順序を使うための唯一のstep builder。
 * 固定段階へ正規化せず、その関係先に実在する接点・作業・現在地・ゴールを並べる。
 */
function buildPartnerProgressSteps(
  partner: SxManagementPartner,
): PartnerProgressStep[] {
  const past = [...partner.interactions].sort((left, right) => {
    const leftKey = left.occurredOn ?? left.createdAt.slice(0, 10);
    const rightKey = right.occurredOn ?? right.createdAt.slice(0, 10);
    return (
      leftKey.localeCompare(rightKey) ||
      left.createdAt.localeCompare(right.createdAt)
    );
  });
  const pending = [...partner.workItems]
    .filter(
      (item) => item.status !== "completed" && item.status !== "cancelled",
    )
    .sort((left, right) =>
      (left.dueDate ?? "9999").localeCompare(right.dueDate ?? "9999"),
    );
  const workSideLabel = (side: string) =>
    side === "sx"
      ? "当方"
      : side === "partner"
        ? "先方"
        : side === "shared"
          ? "双方"
          : "担当未確認";
  const ballOwner = partner.currentBallOwner
    ? sxNormalizePublicName(partner.currentBallOwner)
    : "担当未確認";
  const nowDue = sxFormatDueDateWithPrecision(
    partner.dueDate,
    partner.dueDatePrecision,
  );

  return [
    ...past.map((interaction) => ({
      key: `interaction-${interaction.id}`,
      phase: "done" as const,
      title: sxNormalizePublicName(interaction.summary),
      sub: `${sxInteractionKindLabel(interaction.interactionKind)}${interaction.occurredOn ? ` ・ ${sxFormatEventDateWithPrecision(interaction.occurredOn, interaction.occurredOnPrecision)}` : ""}`,
    })),
    {
      key: "now",
      phase: "now" as const,
      title: `${sxBallSideLabel(partner.currentBallSide)}ボール: ${ballOwner}`,
      sub: `現在地 ・ ${nowDue === "期限未設定" ? nowDue : `期限 ${nowDue}`}`,
    },
    ...pending.map((item) => ({
      key: `work-${item.id}`,
      phase: "next" as const,
      title: nominalizeSxNextActionLabel(sxNormalizePublicName(item.title)),
      sub: `これから ・ ${workSideLabel(item.side)}${item.ownerLabel ? ` ${sxNormalizePublicName(item.ownerLabel)}` : ""}`,
    })),
    {
      key: "next",
      phase: "next" as const,
      title: partner.nextCommitment
        ? nominalizeSxNextActionLabel(
            sxNormalizePublicName(partner.nextCommitment),
          )
        : "次の一手 未登録",
      sub: "これから",
    },
    {
      key: "goal",
      phase: "goal" as const,
      title: partner.targetState
        ? sxNormalizePublicName(partner.targetState)
        : "目標状態 未登録",
      sub: "ゴール",
    },
  ];
}

/** 進行状況列と同じ可変stepsを、会社名下へ縮約して表示する。 */
function PartnerStageRail({
  partnerId,
  onHold,
  currentBallSide,
  steps,
  onOpen,
  expanded,
}: {
  partnerId: string;
  onHold: boolean;
  currentBallSide: SxManagementPartner["currentBallSide"];
  steps: readonly PartnerProgressStep[];
  onOpen?: () => void;
  expanded?: boolean;
}) {
  const content = (
    <>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {steps.map((step) => (
          <span
            key={step.key}
            data-progress-segment={step.phase}
            className={`h-1.5 flex-1 rounded-full ${
              onHold
                ? "bg-[#d6cebf]"
                : step.phase === "now"
                  ? currentBallSide === "sx"
                    ? "bg-[#b5533f]"
                    : currentBallSide === "partner"
                      ? "bg-[#d5bc82]"
                      : "bg-[#b8b5c8]"
                  : step.phase === "done"
                    ? "bg-[#8fb5a2]"
                    : step.phase === "goal"
                      ? "bg-[#c9bfd0]"
                      : "bg-[#e8e2d6]"
            }`}
          />
        ))}
      </span>
      {/* 「進行項目◯件」の常時表示は 2026-08-07 に削除 (まさ)。件数はレールの節で
          見えるので、注意が要る「保留」だけ文字で残す。 */}
      {onHold ? (
        <span className="mt-0.5 block text-[10px] font-semibold text-[#5a574c]">
          保留
        </span>
      ) : null}
    </>
  );
  const className = `block w-full min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] ${onOpen ? "cursor-pointer rounded-sm hover:bg-[#e2ecf1]" : ""}`;
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className={className}
      aria-label={`${steps.length}件の進捗と履歴を開く`}
      aria-expanded={expanded}
      aria-controls={`sx-partner-history-${partnerId}`}
      data-testid={`sx-partner-stage-rail-${partnerId}`}
      data-step-count={steps.length}
    >
      {content}
    </button>
  ) : (
    <div
      role="img"
      aria-label={`進行状況 ${steps.length}件${onHold ? "・保留" : ""}`}
      data-testid={`sx-partner-stage-rail-${partnerId}`}
      data-step-count={steps.length}
      className={className}
    >
      {content}
    </div>
  );
}

const BALL_SIDE_TONE: Record<string, string> = {
  sx: "border-[#86a2b3] bg-[#e2ecf1] text-[#315f7d]",
  partner: "border-[#bd9a52] bg-[#f7e8c8] text-[#765022]",
  shared: "border-[#9d8daa] bg-[#e9e2ee] text-[#5f4a66]",
  none: "border-[#ada18a] bg-[#f2eee0] text-[#5a574c]",
  unknown: "border-[#8e88a5] bg-[#e4e2ef] text-[#55506d]",
};

/** 最左の評価カラムの配色。S だけ塗りつぶして、上から潰す順番が一目で分かるようにする。 */
const GRADE_TONE: Record<string, string> = {
  s: "border-[#2f6650] bg-[#2f6650] text-[#f5f1e8]",
  a: "border-[#38745d] bg-[#dcebe1] text-[#1d5341]",
  b: "border-[#3f6b8c] bg-[#dee8f0] text-[#2a5473]",
  x: "border-[#a4988a] bg-[#eae5da] text-[#5a574c]",
  unrated: "border-dashed border-[#a69b84] bg-[#f6f1e6] text-[#6a665b]",
};

const HOLDING_STATUS_TONE: Record<string, string> = {
  open: "border-[#ada18a] bg-[#f2eee0] text-[#5a574c]",
  in_progress: "border-[#86a2b3] bg-[#e2ecf1] text-[#315f7d]",
  waiting: "border-[#bd9a52] bg-[#f7e8c8] text-[#765022]",
  blocked: "border-[#b5533f] bg-[#f6dad5] text-[#8c3329]",
  on_hold: "border-[#9d8daa] bg-[#e9e2ee] text-[#5f4a66]",
  completed: "border-[#74a690] bg-[#dcecdf] text-[#205f49]",
  cancelled: "border-[#ada18a] bg-[#f2eee0] text-[#5a574c]",
};

/** Left status-line color per holding status — replaces the old rounded-card look with a dense,
 * shared-ruled row + left status line (spec C: 保有事項は角丸カードをやめ、共有罫線/左ステータス線の高密度行にする). */
const HOLDING_STATUS_LINE: Record<string, string> = {
  open: "#cbbfa0",
  in_progress: "#7ea0b7",
  waiting: "#dcb45a",
  blocked: "#b5533f",
  on_hold: "#a08bb0",
  completed: "#57a884",
  cancelled: "#c9c2b3",
};

const HOLDING_STATUS_LABEL: Record<string, string> = {
  open: "未着手",
  in_progress: "進行中",
  waiting: "待ち",
  blocked: "停止",
  on_hold: "保留",
  completed: "完了",
  cancelled: "取消",
  // commitment statuses reused verbatim by sxHoldingsForPartner() on the same field
};

const INTERACTION_KIND_TONE: Record<string, string> = {
  meeting: "border-[#86a2b3] bg-[#e2ecf1] text-[#315f7d]",
  email: "border-[#ada18a] bg-[#f2eee0] text-[#5a574c]",
  agreement: "border-[#74a690] bg-[#dcecdf] text-[#205f49]",
  deliverable: "border-[#74a690] bg-[#dcecdf] text-[#205f49]",
  handoff: "border-[#bd9a52] bg-[#f7e8c8] text-[#765022]",
  status_update: "border-[#9d8daa] bg-[#e9e2ee] text-[#5f4a66]",
  note: "border-[#ada18a] bg-[#f2eee0] text-[#5a574c]",
};

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]";

type PartnerInlineResource =
  | "partner"
  | "partner_work_item"
  | "commitment"
  | "interaction"
  | "partner_sample";

type PartnerInlinePatch = {
  resource: PartnerInlineResource;
  id: string;
  patch: Record<string, unknown>;
};

type PrimaryInterventionTarget =
  | {
      resource: "partner_work_item";
      id: string;
      record: SxPartnerWorkItem;
    }
  | {
      resource: "commitment";
      id: string;
      record: SxPartnerCommitment;
    }
  | { resource: "partner"; id: string; record: SxManagementPartner };

function primaryInterventionTarget(
  partner: SxManagementPartner,
  intervention: SxPartnerPrimaryIntervention,
): PrimaryInterventionTarget | null {
  if (intervention.source === "partner_fallback") {
    return { resource: "partner", id: partner.id, record: partner };
  }
  const workItem = partner.workItems.find(
    (item) => item.id === intervention.recordId,
  );
  if (workItem) {
    return {
      resource: "partner_work_item",
      id: workItem.id,
      record: workItem,
    };
  }
  const commitment = partner.commitments.find(
    (item) => item.id === intervention.recordId,
  );
  if (commitment) {
    return {
      resource: "commitment",
      id: commitment.id,
      record: commitment,
    };
  }
  // A normalized holding without its backing row is unsafe to edit. Never fall
  // through to partner-level fields: that would save derived control data into
  // the wrong source of truth.
  return null;
}

const INLINE_CONTROL_CLASS = `min-h-9 w-full min-w-0 border border-[#857b69] bg-[#f3f0e8] px-2 text-[11px] text-[#24231f] ${FOCUS_RING}`;
const INLINE_ACTION_CLASS = `grid h-9 min-w-9 place-items-center border text-[10px] font-semibold ${FOCUS_RING}`;
const INLINE_BALL_SIDE_OPTIONS = [
  { value: "sx", label: "当方" },
  { value: "partner", label: "先方" },
  { value: "shared", label: "双方" },
  { value: "none", label: "該当なし" },
  { value: "unknown", label: "未確認" },
] as const;
const INLINE_HOLDING_SIDE_OPTIONS = INLINE_BALL_SIDE_OPTIONS.filter(
  (option) => option.value !== "none",
);
const INLINE_DATE_PRECISION_OPTIONS = [
  { value: "day", label: "日付確定" },
  { value: "month", label: "月のみ確定" },
  { value: "unknown", label: "期限未確認" },
] as const;
const INLINE_WORK_STATUS_OPTIONS = [
  { value: "open", label: "未着手" },
  { value: "in_progress", label: "進行中" },
  { value: "waiting", label: "待ち" },
  { value: "blocked", label: "停止" },
  { value: "on_hold", label: "保留" },
  { value: "completed", label: "完了" },
  { value: "cancelled", label: "取消" },
] as const;
const INLINE_COMMITMENT_STATUS_OPTIONS = INLINE_WORK_STATUS_OPTIONS.filter(
  (option) => option.value !== "waiting" && option.value !== "on_hold",
);

const INLINE_REPLAY_TARGET_SELECTOR =
  '[data-testid^="sx-partner-stage-rail-"], [data-inline-edit-trigger], [data-partner-filter-trigger]';

/**
 * blur自動保存中にpointer起点の次操作が旧editor lockで捨てられた場合だけ、
 * 保存成功後に1回再実行する。Tab移動はpointerdownを伴わないため対象外。
 */
function useInlinePointerReplayTarget(active: boolean) {
  const targetRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    targetRef.current = null;
    if (!active) return;
    const capture = (event: PointerEvent) => {
      targetRef.current =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(INLINE_REPLAY_TARGET_SELECTOR)
          : null;
    };
    document.addEventListener("pointerdown", capture, true);
    return () => document.removeEventListener("pointerdown", capture, true);
  }, [active]);
  return targetRef;
}

function replayInlinePointerTarget(
  targetRef: MutableRefObject<HTMLElement | null>,
) {
  const target = targetRef.current;
  targetRef.current = null;
  if (!target) return;
  requestAnimationFrame(() => {
    if (document.contains(target)) target.click();
  });
}

function changedPatch(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => previous[key] !== value),
  );
}

function InlineCellEditor({
  editorKey,
  activeEditorKey,
  label,
  initialValues,
  view,
  viewClassName = "",
  align = "center",
  onRequestEdit,
  onFinish,
  onSave,
  renderFields,
}: {
  editorKey: string;
  activeEditorKey: string | null;
  label: string;
  initialValues: Record<string, string>;
  view: ReactNode;
  viewClassName?: string;
  /**
   * popoverの寄せ方。既定はcellの中央。左端の狭いcell (評価カラムなど) は中央寄せだと
   * 画面外へはみ出すので "start" を渡してcellの左端から右へ開かせる (2026-08-06 まさ指示)。
   */
  align?: "center" | "start";
  onRequestEdit: (editorKey: string) => boolean;
  onFinish: () => void;
  onSave: (values: Record<string, string>) => Promise<void>;
  renderFields: (
    values: Record<string, string>,
    setValue: (key: string, value: string) => void,
  ) => ReactNode;
}) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = activeEditorKey === editorKey;

  const begin = () => {
    if (!onRequestEdit(editorKey)) return;
    setValues(initialValues);
    setError(null);
  };
  const cancel = () => {
    if (saving) return;
    setValues(initialValues);
    setError(null);
    onFinish();
  };
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(values);
      onFinish();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存できなかったよ");
    } finally {
      setSaving(false);
    }
  };
  const setValue = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  // 外側クリックで閉じる (2026-08-07 まさ「モーダル外をクリックしたら閉じる」)。
  // 台帳内の他エディタ (関係先名・現在地・接点の経緯) は blur で保存して閉じるので、
  // ここも「変更があれば保存して閉じる」に揃える。捨てたいときは Esc か ✗ を使う。
  const popoverRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const savingRef = useRef(false);
  savingRef.current = saving;
  const dirtyRef = useRef(false);
  dirtyRef.current = Object.entries(values).some(
    ([key, value]) => (initialValues[key] ?? "") !== value,
  );
  useEffect(() => {
    if (!active) return;
    const handler = (event: PointerEvent) => {
      const node = popoverRef.current;
      if (!node) return;
      if (event.target instanceof Node && node.contains(event.target)) return;
      if (savingRef.current) return;
      if (dirtyRef.current) void saveRef.current();
      else onFinish();
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
    // onFinish は毎描画で作り直される親コールバックなので依存に入れない
    // (入れると毎描画で listener が張り直され、開いた瞬間の pointerup を拾ってしまう)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) {
    return (
      <button
        type="button"
        className={`w-full min-w-0 border-b border-dashed border-[#857b69] text-left hover:border-[#38745d] hover:bg-[#e2ecf1] ${FOCUS_RING} ${viewClassName}`}
        onClick={begin}
        aria-label={`${label}を直接修正`}
        data-inline-edit-trigger={editorKey}
      >
        {view}
      </button>
    );
  }

  return (
    <div
      ref={popoverRef}
      className="relative min-w-0"
      data-inline-editor={editorKey}
      data-inline-cell-mode="edit-popover"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
    >
      <div className="pointer-events-none min-w-0" aria-hidden="true">
        {view}
      </div>
      <div
        className={`absolute top-full z-40 mt-1 w-[min(320px,calc(100vw-32px))] border border-[#a1957e] bg-[#fffdf7] p-2 shadow-[0_12px_32px_rgba(36,35,31,0.18)] ${
          align === "start" ? "left-0" : "left-1/2 -translate-x-1/2"
        }`}
      >
        <div className="grid min-w-0 gap-1.5">
          {renderFields(values, setValue)}
        </div>
        {error && (
          <p className="mt-1 text-[10px] leading-4 text-[#8c3329]" role="alert">
            {error}
          </p>
        )}
        <div className="mt-1.5 flex justify-end gap-1">
          <button
            type="button"
            className={`${INLINE_ACTION_CLASS} border-[#a69b84] bg-white text-[#5a574c]`}
            onClick={cancel}
            disabled={saving}
            aria-label={`${label}の編集を取り消す`}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${INLINE_ACTION_CLASS} border-[#38745d] bg-[#38745d] text-white disabled:opacity-60`}
            onClick={save}
            disabled={saving}
            aria-label={`${label}を保存`}
          >
            {saving ? (
              <LoaderCircle
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 関係先名は一覧の識別主キーなので、編集開始で別フォームへ変形させない。
 * 表示中の文字だけを同じ文字面のinputへ置き換え、Enter/blurで保存、Escで取消する。
 */
function InlinePartnerNameEditor({
  editorKey,
  activeEditorKey,
  inputId,
  label,
  value,
  view,
  onRequestEdit,
  onFinish,
  onSave,
}: {
  editorKey: string;
  activeEditorKey: string | null;
  inputId: string;
  label: string;
  value: string;
  view: ReactNode;
  onRequestEdit: (editorKey: string) => boolean;
  onFinish: () => void;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = activeEditorKey === editorKey;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const finishingRef = useRef(false);
  const cancelingRef = useRef(false);
  const pointerReplayTargetRef = useInlinePointerReplayTarget(active);

  useEffect(() => {
    if (!active) return;
    setDraft(value);
    setError(null);
    finishingRef.current = false;
    cancelingRef.current = false;
  }, [active, value]);

  const begin = () => {
    if (!onRequestEdit(editorKey)) return;
    setDraft(value);
    setError(null);
    finishingRef.current = false;
    cancelingRef.current = false;
  };
  const finish = (returnFocus: boolean) => {
    onFinish();
    if (returnFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };
  const cancel = () => {
    if (saving) return;
    cancelingRef.current = true;
    setDraft(value);
    setError(null);
    finish(true);
  };
  const commit = async (returnFocus: boolean): Promise<boolean> => {
    if (saving || finishingRef.current) return false;
    const next = draft.trim();
    if (!next) {
      setError("関係先名を入力してね");
      requestAnimationFrame(() => inputRef.current?.focus());
      return false;
    }
    finishingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      if (next !== value) await onSave(next);
      finish(returnFocus);
      return true;
    } catch (caught) {
      finishingRef.current = false;
      setError(caught instanceof Error ? caught.message : "保存できなかったよ");
      requestAnimationFrame(() => inputRef.current?.focus());
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (!active) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className={`w-full min-w-0 text-left hover:bg-[#e2ecf1] ${FOCUS_RING}`}
        onClick={begin}
        aria-label={`${label}を直接修正`}
        data-inline-edit-trigger={editorKey}
        data-inline-cell-mode="view"
      >
        {view}
      </button>
    );
  }

  return (
    <div
      className="relative min-w-0"
      data-inline-editor={editorKey}
      data-inline-cell-mode="edit-seamless"
      aria-busy={saving}
    >
      <textarea
        ref={inputRef}
        id={inputId}
        autoFocus
        rows={1}
        className="block min-h-4 w-full min-w-0 resize-none overflow-hidden border-0 bg-transparent p-0 text-[12px] font-semibold leading-4 text-[#24231f] outline-none [field-sizing:content]"
        aria-label={label}
        aria-invalid={Boolean(error)}
        title="Enterまたはフォーカス移動で保存、Escで取り消し"
        value={draft}
        readOnly={saving}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (cancelingRef.current) {
            cancelingRef.current = false;
            return;
          }
          const changed = draft.trim() !== value;
          void commit(false).then((saved) => {
            if (!saved) {
              pointerReplayTargetRef.current = null;
              return;
            }
            if (!changed) return;
            replayInlinePointerTarget(pointerReplayTargetRef);
          });
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") {
            event.preventDefault();
            void commit(true);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
      />
      {error && (
        <span
          className="absolute left-0 top-full z-30 mt-1 whitespace-nowrap border border-[#a1957e] bg-[#fffdf7] px-2 py-1 text-[10px] font-semibold text-[#8c3329] shadow-[0_6px_18px_rgba(36,35,31,0.12)]"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * 接点の経緯は「経緯 / 紹介者」の固定2段。編集時も同じ2段だけを置換する。
 */
/** 名前プルダウンで「新しい名前を追加」を選んだことを表す番兵。名前として保存されることはない。 */
const OWNER_NEW_ENTRY = "__new_owner__";
/** 名簿の手動追加・非表示はこの端末の好みなので localStorage に置く。DBには名簿table がない。 */
const PARTNER_OWNER_ROSTER_STORAGE_KEY = "sx-partner-owner-roster-v1";

type PartnerOwnerRoster = { added: string[]; hidden: string[] };

function readPartnerOwnerRoster(): PartnerOwnerRoster {
  if (typeof window === "undefined") return { added: [], hidden: [] };
  try {
    const raw = window.localStorage.getItem(PARTNER_OWNER_ROSTER_STORAGE_KEY);
    if (!raw) return { added: [], hidden: [] };
    const parsed = JSON.parse(raw) as Partial<PartnerOwnerRoster>;
    const clean = (value: unknown) =>
      Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string")
        : [];
    return { added: clean(parsed.added), hidden: clean(parsed.hidden) };
  } catch {
    return { added: [], hidden: [] };
  }
}

/**
 * 担当・紹介者に入れる名前の候補。管制データに実在する名前を集め、手動追加分を足し、
 * 非表示にした名前を落とす。メンバー台帳ではないので、社外の人もそのまま候補に載る。
 */
function usePartnerOwnerRoster(management: SxManagementBundle) {
  const [roster, setRoster] = useState<PartnerOwnerRoster>({
    added: [],
    hidden: [],
  });

  useEffect(() => {
    setRoster(readPartnerOwnerRoster());
  }, []);

  const persist = (next: PartnerOwnerRoster) => {
    setRoster(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        PARTNER_OWNER_ROSTER_STORAGE_KEY,
        JSON.stringify(next),
      );
    } catch {
      // 保存できなくても、この画面が開いている間は候補として使える
    }
  };

  const fromData = new Set<string>();
  const push = (value: string | null | undefined) => {
    const label = (value || "").trim();
    if (!label || sxIsMissingOwner(label)) return;
    fromData.add(label);
  };
  management.partners.forEach((partner) => {
    push(partner.ownerLabel);
    push(partner.currentBallOwner);
    push(partner.introducerLabel);
  });
  management.partnerWorkItems.forEach((row) => push(row.ownerLabel));
  management.partnerCommitments.forEach((row) => {
    push(row.ownerLabel);
    push(row.sxOwner);
    push(row.counterpartyOwner);
  });
  management.tasks.forEach((row) => push(row.ownerLabel));
  management.milestones.forEach((row) => push(row.ownerLabel));
  management.actions.forEach((row) => push(row.ownerLabel));
  roster.added.forEach((name) => fromData.add(name));
  roster.hidden.forEach((name) => fromData.delete(name));
  const candidates = [...fromData].sort((a, b) => a.localeCompare(b, "ja"));

  const addOwner = (name: string) => {
    const label = name.trim();
    if (!label || candidates.includes(label)) return;
    persist({
      added: [...roster.added.filter((entry) => entry !== label), label],
      hidden: roster.hidden.filter((entry) => entry !== label),
    });
  };
  const hideOwner = (name: string) => {
    const label = name.trim();
    if (!label) return;
    persist({
      added: roster.added.filter((entry) => entry !== label),
      hidden: [...roster.hidden.filter((entry) => entry !== label), label],
    });
  };

  return { candidates, addOwner, hideOwner };
}

export type PartnerOwnerRosterControls = {
  candidates: readonly string[];
  addOwner: (name: string) => void;
  hideOwner: (name: string) => void;
};

/**
 * 名前を選ぶプルダウン。自由入力をやめて選択にすることで表記ゆれを止める。
 * 候補にない人は「＋ 新しい名前」で足せる。要らなくなった名前は右の×で候補から外す。
 */
function OwnerSelectControl({
  value,
  ariaLabel,
  className,
  roster,
  disabled,
  autoFocus,
  onChange,
}: {
  value: string;
  ariaLabel: string;
  className: string;
  roster: PartnerOwnerRosterControls;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}) {
  const [addingName, setAddingName] = useState(false);
  const current = value.trim();
  // 既存値が候補から漏れていても選択状態を失わない。
  const options = current && !roster.candidates.includes(current)
    ? [current, ...roster.candidates]
    : [...roster.candidates];

  if (addingName) {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <input
          autoFocus
          className={className}
          aria-label={`${ariaLabel}に新しい名前を追加`}
          placeholder="新しい名前"
          defaultValue=""
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setAddingName(false);
            }
          }}
          onBlur={(event) => {
            const name = event.target.value.trim();
            setAddingName(false);
            if (!name) return;
            roster.addOwner(name);
            onChange(name);
          }}
        />
      </span>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-0.5">
      <select
        autoFocus={autoFocus}
        className={className}
        aria-label={ariaLabel}
        value={current}
        disabled={disabled}
        data-owner-select={ariaLabel}
        onChange={(event) => {
          if (event.target.value === OWNER_NEW_ENTRY) {
            setAddingName(true);
            return;
          }
          onChange(event.target.value);
        }}
      >
        <option value="">未確認</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={OWNER_NEW_ENTRY}>＋ 新しい名前を追加</option>
      </select>
      {current ? (
        <button
          type="button"
          className="shrink-0 rounded px-0.5 text-[10px] leading-4 text-[#857b69] hover:bg-[#f2eee0] hover:text-[#8c3329]"
          aria-label={`${current}を名前の候補から外す`}
          title={`${current}を候補から外す`}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            roster.hideOwner(current);
            onChange("");
          }}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

function InlineConnectionOriginEditor({
  editorKey,
  activeEditorKey,
  label,
  context,
  introducer,
  roster,
  view,
  onRequestEdit,
  onFinish,
  onSave,
}: {
  editorKey: string;
  activeEditorKey: string | null;
  label: string;
  context: string;
  introducer: string;
  roster: PartnerOwnerRosterControls;
  view: ReactNode;
  onRequestEdit: (editorKey: string) => boolean;
  onFinish: () => void;
  onSave: (values: { context: string; introducer: string }) => Promise<void>;
}) {
  const [draftContext, setDraftContext] = useState(context);
  const [draftIntroducer, setDraftIntroducer] = useState(introducer);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = activeEditorKey === editorKey;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const finishingRef = useRef(false);
  const cancelingRef = useRef(false);
  const pointerReplayTargetRef = useInlinePointerReplayTarget(active);

  useEffect(() => {
    if (!active) return;
    setDraftContext(context);
    setDraftIntroducer(introducer);
    setError(null);
    finishingRef.current = false;
    cancelingRef.current = false;
  }, [active, context, introducer]);

  const finish = (returnFocus: boolean) => {
    onFinish();
    if (returnFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };
  const cancel = () => {
    if (saving) return;
    cancelingRef.current = true;
    setDraftContext(context);
    setDraftIntroducer(introducer);
    setError(null);
    finish(true);
  };
  const save = async (returnFocus: boolean): Promise<boolean> => {
    if (saving || finishingRef.current) return false;
    finishingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        context: draftContext.trim(),
        introducer: draftIntroducer.trim(),
      });
      finish(returnFocus);
      return true;
    } catch (caught) {
      finishingRef.current = false;
      setError(caught instanceof Error ? caught.message : "保存できなかったよ");
      requestAnimationFrame(() =>
        editorRef.current?.querySelector("input")?.focus(),
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (!active) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className={`min-h-11 w-full min-w-0 border-b border-dashed border-[#857b69] text-left hover:bg-[#e2ecf1] ${FOCUS_RING}`}
        onClick={() => {
          if (!onRequestEdit(editorKey)) return;
          setDraftContext(context);
          setDraftIntroducer(introducer);
          setError(null);
          finishingRef.current = false;
          cancelingRef.current = false;
        }}
        aria-label={`${label}を直接修正`}
        data-inline-edit-trigger={editorKey}
        data-inline-cell-mode="view"
      >
        {view}
      </button>
    );
  }

  return (
    <div
      ref={editorRef}
      className="relative grid min-h-11 min-w-0 content-center gap-0.5 border-b border-dashed border-[#857b69]"
      data-inline-editor={editorKey}
      data-inline-cell-mode="edit-seamless"
      aria-busy={saving}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        ) {
          return;
        }
        if (cancelingRef.current) {
          cancelingRef.current = false;
          return;
        }
        const changed =
          draftContext.trim() !== context ||
          draftIntroducer.trim() !== introducer;
        void save(false).then((saved) => {
          if (!saved) {
            pointerReplayTargetRef.current = null;
            return;
          }
          if (!changed) return;
          replayInlinePointerTarget(pointerReplayTargetRef);
        });
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
        if (event.key === "Enter") {
          event.preventDefault();
          void save(true);
        }
      }}
    >
      <textarea
        autoFocus
        rows={1}
        className="block max-h-8 min-h-4 w-full min-w-0 resize-none overflow-y-auto border-0 bg-transparent p-0 text-[10px] font-semibold leading-4 text-[#24231f] outline-none [field-sizing:content]"
        aria-label={`${label}の経緯`}
        placeholder="経緯 未登録"
        value={draftContext}
        readOnly={saving}
        onChange={(event) => setDraftContext(event.target.value)}
      />
      {/* 紹介者は表記ゆれが起きやすいので自由入力をやめて名簿から選ぶ (2026-08-07 まさ)。 */}
      <div className="grid min-w-0 grid-cols-[32px_minmax(0,1fr)] items-center">
        <span className="text-[10px] leading-4 text-[#5a574c]">紹介者</span>
        <OwnerSelectControl
          value={draftIntroducer}
          ariaLabel={`${label}の紹介者`}
          className="h-4 min-w-0 border-0 bg-transparent p-0 text-[10px] leading-4 text-[#5a574c] outline-none"
          roster={roster}
          disabled={saving}
          onChange={setDraftIntroducer}
        />
      </div>
      {error && (
        <span
          className="absolute left-0 top-full z-30 mt-1 whitespace-nowrap border border-[#a1957e] bg-[#fffdf7] px-2 py-1 text-[10px] font-semibold text-[#8c3329] shadow-[0_6px_18px_rgba(36,35,31,0.12)]"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * 「現在の状況」は関係先本体の現在ボールだけを扱う。
 * 表示時から保有側/担当の2slotを明示し、編集時も同じ位置と高さを保つ。
 */
function InlineCurrentBallEditor({
  editorKey,
  activeEditorKey,
  label,
  side,
  owner,
  options,
  roster,
  view,
  onRequestEdit,
  onFinish,
  onSave,
}: {
  editorKey: string;
  activeEditorKey: string | null;
  label: string;
  side: string;
  owner: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  roster: PartnerOwnerRosterControls;
  view: ReactNode;
  onRequestEdit: (editorKey: string) => boolean;
  onFinish: () => void;
  onSave: (values: { side: string; owner: string }) => Promise<void>;
}) {
  const [draftSide, setDraftSide] = useState(side);
  const [draftOwner, setDraftOwner] = useState(owner);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = activeEditorKey === editorKey;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const finishingRef = useRef(false);
  const cancelingRef = useRef(false);
  const pointerReplayTargetRef = useInlinePointerReplayTarget(active);
  const sideLabel =
    options.find((option) => option.value === side)?.label || side;

  useEffect(() => {
    if (!active) return;
    setDraftSide(side);
    setDraftOwner(owner);
    setError(null);
    finishingRef.current = false;
    cancelingRef.current = false;
  }, [active, owner, side]);

  const finish = (returnFocus: boolean) => {
    onFinish();
    if (returnFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const cancel = () => {
    if (saving) return;
    setDraftSide(side);
    setDraftOwner(owner);
    setError(null);
    cancelingRef.current = true;
    finish(true);
  };
  const save = async (returnFocus: boolean): Promise<boolean> => {
    if (saving || finishingRef.current) return false;
    finishingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave({ side: draftSide, owner: draftOwner });
      finish(returnFocus);
      return true;
    } catch (caught) {
      finishingRef.current = false;
      setError(caught instanceof Error ? caught.message : "保存できなかったよ");
      requestAnimationFrame(() =>
        editorRef.current?.querySelector("input")?.focus(),
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (!active) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className={`flex min-h-11 w-full min-w-0 items-center border-b border-dashed border-[#857b69] text-left hover:border-[#38745d] hover:bg-[#e2ecf1] ${FOCUS_RING}`}
        onClick={() => {
          if (!onRequestEdit(editorKey)) return;
          setDraftSide(side);
          setDraftOwner(owner);
          setError(null);
          finishingRef.current = false;
          cancelingRef.current = false;
        }}
        aria-label={`${label}を直接修正。保有側 ${sideLabel}、担当 ${owner || "担当未確認"}`}
        data-inline-edit-trigger={editorKey}
        data-inline-cell-mode="view"
      >
        {view}
      </button>
    );
  }

  return (
    <div
      ref={editorRef}
      className="relative grid min-h-11 w-full min-w-0 grid-cols-[60px_minmax(0,1fr)] items-stretch border-b border-dashed border-[#857b69]"
      data-inline-editor={editorKey}
      data-inline-cell-mode="edit-seamless"
      aria-busy={saving}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        ) {
          return;
        }
        if (cancelingRef.current) {
          cancelingRef.current = false;
          return;
        }
        const changed = draftSide !== side || draftOwner !== owner;
        void save(false).then((saved) => {
          if (!saved) {
            pointerReplayTargetRef.current = null;
            return;
          }
          if (!changed) return;
          replayInlinePointerTarget(pointerReplayTargetRef);
        });
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          void save(true);
        }
      }}
    >
      <label className="grid min-w-0 grid-rows-[14px_30px] border-r border-[#ada18a]">
        <span className="px-1 pt-0.5 text-[10px] font-semibold leading-3 text-[#5a574c]">
          保有側
        </span>
        <select
          autoFocus
          className={`h-[30px] min-w-0 border-0 bg-transparent px-1 text-[11px] font-semibold text-[#24231f] ${FOCUS_RING}`}
          value={draftSide}
          onChange={(event) => setDraftSide(event.target.value)}
          disabled={saving}
          aria-label={`${label}の保有側`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {/* 担当は名簿から選ぶ (2026-08-07 まさ)。同じ人が別表記で増えるのを止める。 */}
      <div className="grid min-w-0 grid-rows-[14px_30px]">
        <span className="px-1 pt-0.5 text-[10px] font-semibold leading-3 text-[#5a574c]">
          担当
        </span>
        <OwnerSelectControl
          value={draftOwner}
          ariaLabel={`${label}の担当`}
          className={`h-[30px] min-w-0 border-0 bg-transparent px-1 text-[11px] font-semibold text-[#24231f] ${FOCUS_RING}`}
          roster={roster}
          disabled={saving}
          onChange={setDraftOwner}
        />
      </div>
      {error && (
        <p
          className="absolute left-0 top-full z-30 mt-1 border border-[#d7a49e] bg-[#fff7f5] px-2 py-1 text-[10px] leading-4 text-[#8c3329] shadow-sm"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

type PocFacetValues = {
  category: string;
  stage: string;
  activity: string;
  confidence: string;
  likelihood: string;
  value: string;
  note: string;
};

/**
 * PoC営業ファセット (段階/活動状態/確度/実現可能性/顧客有望度) のチップ表示。
 * 見出しをチップ内に置き、どの値がどの軸かを読まずに分かるようにする
 * (2026-08-06 まさ指摘「確度のラベリングができてない」)。確度はスプシ語彙のまま4値で出し、
 * 推定 (medium) を確認済みへ丸めない。確度は情報の確からしさであって商談の見込みではないため、
 * 「実現」(PoCさせてもらえる可能性) と「顧客」(顧客としての有望度) を独立した軸として並べる。
 * 未評価はNULLのまま「未評価」と出し、推測で埋めない。
 */
function pocFacetChipsView(partner: SxManagementPartner) {
  if (!partner.pocCategory) return null;
  const confidence = sxNormalizePartnerConfidence(partner.confidence);
  const stalled =
    partner.activityState === "stalled" || partner.activityState === "dropped";
  const chip = (facet: string, value: string, tone: string) => (
    <span
      className={`inline-flex max-w-full items-baseline gap-0.5 border px-1 py-px text-[10px] font-semibold leading-3 ${tone}`}
    >
      <span className="shrink-0 font-normal opacity-70">{facet}</span>
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {value}
      </span>
    </span>
  );
  return (
    <span
      className="flex min-w-0 flex-wrap items-center gap-1 pb-0.5"
      data-poc-facet-chips={partner.id}
      data-poc-confidence={confidence}
    >
      {chip(
        "段階",
        sxPartnerStageLabel(partner.relationshipStage),
        "border-[#38745d] bg-[#dcebe1] text-[#1d5341]",
      )}
      {chip(
        "状態",
        sxPartnerActivityStateLabel(partner.activityState),
        stalled
          ? "border-[#b5533f] bg-[#f6e0da] text-[#7d2b22]"
          : partner.activityState === "waiting_partner" ||
              partner.activityState === "waiting_internal"
            ? "border-[#bf7b2c] bg-[#f6ead2] text-[#69461c]"
            : "border-[#bcb2a0] bg-[#efe9dc] text-[#45423b]",
      )}
      {chip(
        "確度",
        sxPartnerConfidenceLabel(confidence),
        confidence === "high"
          ? "border-[#3f6b8c] bg-[#dee8f0] text-[#2a5473]"
          : confidence === "medium"
            ? "border-[#bcb2a0] bg-[#efe9dc] text-[#45423b]"
            : "border-[#bf7b2c] bg-[#f6ead2] text-[#69461c]",
      )}
      {chip(
        "実現",
        sxPocLikelihoodLabel(partner.pocLikelihood),
        judgmentTone(partner.pocLikelihood),
      )}
      {chip(
        "顧客",
        sxCustomerValueLabel(partner.customerValue),
        judgmentTone(partner.customerValue),
      )}
      {partner.valueNote && (
        <span
          className="w-full [overflow-wrap:anywhere] text-[10px] leading-4 text-[#5a574c]"
          title={partner.valueNote}
          data-poc-value-note={partner.id}
        >
          理由 {partner.valueNote}
        </span>
      )}
    </span>
  );
}

/** 実現可能性・顧客有望度の色。未評価だけは「入っていない」と分かる薄い枠にする。 */
function judgmentTone(value: SxPocJudgment | null) {
  if (value === "high") return "border-[#38745d] bg-[#dcebe1] text-[#1d5341]";
  if (value === "medium") return "border-[#bcb2a0] bg-[#efe9dc] text-[#45423b]";
  if (value === "low") return "border-[#b5533f] bg-[#f6e0da] text-[#7d2b22]";
  return "border-dashed border-[#a69b84] bg-[#f6f1e6] text-[#6a665b]";
}

/**
 * PoC営業ファセットは3チップの表示位置だけを2x2のselect群へ置換して編集する。
 * 段階(relationship_stage)・状態(activity_state)・確度(confidence)・区分(poc_category)を1PATCHで送る。
 */
function InlinePocFacetEditor({
  editorKey,
  activeEditorKey,
  label,
  partner,
  onRequestEdit,
  onFinish,
  onSave,
}: {
  editorKey: string;
  activeEditorKey: string | null;
  label: string;
  partner: SxManagementPartner;
  onRequestEdit: (editorKey: string) => boolean;
  onFinish: () => void;
  onSave: (values: PocFacetValues) => Promise<void>;
}) {
  const initial: PocFacetValues = {
    category: partner.pocCategory || "",
    stage: partner.relationshipStage,
    activity: partner.activityState,
    confidence: sxNormalizePartnerConfidence(partner.confidence),
    likelihood: partner.pocLikelihood || "",
    value: partner.customerValue || "",
    note: partner.valueNote || "",
  };
  const [draft, setDraft] = useState<PocFacetValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = activeEditorKey === editorKey;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const finishingRef = useRef(false);
  const cancelingRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    setDraft(initial);
    setError(null);
    finishingRef.current = false;
    cancelingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    active,
    partner.pocCategory,
    partner.relationshipStage,
    partner.activityState,
    partner.confidence,
    partner.pocLikelihood,
    partner.customerValue,
    partner.valueNote,
  ]);

  const finish = (returnFocus: boolean) => {
    onFinish();
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const cancel = () => {
    if (saving) return;
    cancelingRef.current = true;
    setDraft(initial);
    setError(null);
    finish(true);
  };
  const save = async (returnFocus: boolean) => {
    if (saving || finishingRef.current) return;
    finishingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      finish(returnFocus);
    } catch (caught) {
      finishingRef.current = false;
      setError(caught instanceof Error ? caught.message : "保存できなかったよ");
      requestAnimationFrame(() =>
        editorRef.current?.querySelector("select")?.focus(),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!active) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className={`w-full min-w-0 text-left hover:bg-[#e2ecf1] ${FOCUS_RING}`}
        onClick={() => {
          if (!onRequestEdit(editorKey)) return;
          setDraft(initial);
          setError(null);
          finishingRef.current = false;
          cancelingRef.current = false;
        }}
        aria-label={`${label}を直接修正。段階 ${sxPartnerStageLabel(partner.relationshipStage)}、状態 ${sxPartnerActivityStateLabel(partner.activityState)}、確度 ${sxPartnerConfidenceLabel(partner.confidence)}、PoC実現可能性 ${sxPocLikelihoodLabel(partner.pocLikelihood)}、顧客有望度 ${sxCustomerValueLabel(partner.customerValue)}`}
        data-inline-edit-trigger={editorKey}
        data-inline-cell-mode="view"
      >
        {pocFacetChipsView(partner)}
      </button>
    );
  }

  const facetSelect = (
    key: keyof PocFacetValues,
    facetLabel: string,
    options: ReadonlyArray<{ value: string; label: string }>,
  ) => (
    <label className="grid min-w-0 gap-px">
      <span className="text-[10px] font-semibold leading-3 text-[#5a574c]">
        {facetLabel}
      </span>
      <select
        className={`h-[22px] min-w-0 border border-[#a69b84] bg-[#fffdf7] px-0.5 text-[10px] font-semibold text-[#24231f] ${FOCUS_RING}`}
        value={draft[key]}
        disabled={saving}
        onChange={(event) =>
          setDraft((current) => ({ ...current, [key]: event.target.value }))
        }
        aria-label={`${label}の${facetLabel}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div
      ref={editorRef}
      className="relative grid min-w-0 grid-cols-2 gap-x-1 gap-y-0.5 pb-0.5"
      data-inline-editor={editorKey}
      data-inline-cell-mode="edit-seamless"
      aria-busy={saving}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        )
          return;
        if (cancelingRef.current) {
          cancelingRef.current = false;
          return;
        }
        void save(false);
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
        if (event.key === "Enter") {
          event.preventDefault();
          void save(true);
        }
      }}
    >
      {facetSelect(
        "stage",
        "段階",
        (
          [...SX_PARTNER_STAGE_ORDER, "on_hold", "declined"] as SxPartnerStage[]
        ).map((stage) => ({
          value: stage as string,
          label: sxPartnerStageLabel(stage),
        })),
      )}
      {facetSelect(
        "activity",
        "状態",
        SX_PARTNER_ACTIVITY_STATE_ORDER.map((state) => ({
          value: state,
          label: sxPartnerActivityStateLabel(state),
        })),
      )}
      {facetSelect(
        "confidence",
        "確度",
        SX_PARTNER_CONFIDENCE_ORDER.map((value) => ({
          value,
          label: sxPartnerConfidenceLabel(value),
        })),
      )}
      {facetSelect(
        "category",
        "区分",
        SX_POC_CATEGORY_ORDER.map((category) => ({
          value: category,
          label: sxPocCategoryLabel(category),
        })),
      )}
      {facetSelect("likelihood", "実現", [
        { value: "", label: "未評価" },
        ...SX_POC_JUDGMENT_ORDER.map((value) => ({
          value: value as string,
          label: sxPocLikelihoodLabel(value),
        })),
      ])}
      {facetSelect("value", "顧客", [
        { value: "", label: "未評価" },
        ...SX_POC_JUDGMENT_ORDER.map((value) => ({
          value: value as string,
          label: sxCustomerValueLabel(value),
        })),
      ])}
      <label className="col-span-2 grid min-w-0 gap-px">
        <span className="text-[10px] font-semibold leading-3 text-[#5a574c]">
          理由
        </span>
        <input
          type="text"
          className={`h-[22px] min-w-0 border border-[#a69b84] bg-[#fffdf7] px-1 text-[10px] text-[#24231f] ${FOCUS_RING}`}
          value={draft.note}
          maxLength={240}
          disabled={saving}
          placeholder="例: 排液処理が生産量のボトルネック"
          onChange={(event) =>
            setDraft((current) => ({ ...current, note: event.target.value }))
          }
          aria-label={`${label}の判断理由`}
        />
      </label>
      {error && (
        <p
          className="absolute left-0 top-full z-30 mt-1 border border-[#d7a49e] bg-[#fff7f5] px-2 py-1 text-[10px] leading-4 text-[#8c3329] shadow-sm"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function InlineDueFields({
  values,
  setValue,
  precision = true,
}: {
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  precision?: boolean;
}) {
  const duePrecision = precision
    ? values.due_date_precision || "unknown"
    : "day";
  return (
    <>
      {precision && (
        <label className="grid gap-0.5">
          <span className="text-[10px] font-semibold text-[#5a574c]">
            期限の精度
          </span>
          <select
            className={INLINE_CONTROL_CLASS}
            value={duePrecision}
            onChange={(event) => {
              setValue("due_date_precision", event.target.value);
              if (event.target.value === "unknown") setValue("due_date", "");
            }}
          >
            {INLINE_DATE_PRECISION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {duePrecision !== "unknown" && (
        <label className="grid gap-0.5">
          <span className="text-[10px] font-semibold text-[#5a574c]">期限</span>
          <input
            className={INLINE_CONTROL_CLASS}
            type={duePrecision === "month" ? "month" : "date"}
            value={
              duePrecision === "month"
                ? (values.due_date || "").slice(0, 7)
                : values.due_date || ""
            }
            onChange={(event) =>
              setValue(
                "due_date",
                duePrecision === "month" && event.target.value
                  ? `${event.target.value}-01`
                  : event.target.value,
              )
            }
          />
        </label>
      )}
    </>
  );
}

/** Per-item plan connection via relatedMilestoneId. A holding item without an explicit connection is
 * reported as unconnected; the UI never infers a gate from the partner's aggregate links. */
function gateAndProofForItem(
  item: SxHoldingItem,
  milestoneTitleById: ReadonlyMap<string, string>,
  milestoneSlugById: ReadonlyMap<string, string>,
): { gateTitle: string | null; proofLabels: string[] } {
  if (!item.relatedMilestoneId) return { gateTitle: null, proofLabels: [] };
  const gateTitle = milestoneTitleById.get(item.relatedMilestoneId) || null;
  const slug = milestoneSlugById.get(item.relatedMilestoneId);
  const proofLabels =
    slug && (SX_PROOF_THEME_SLUGS as readonly string[]).includes(slug)
      ? SX_PROOF_DEFINITIONS.filter((definition) =>
          SX_THEME_PROOF_MAP[slug as SxProofThemeSlug].includes(definition.id),
        ).map((definition) => definition.label)
      : [];
  return { gateTitle, proofLabels };
}

function navChipClass(active: boolean) {
  return `inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap border-b-2 border-x-0 border-t-0 px-2.5 py-1.5 text-[10px] font-semibold ${FOCUS_RING} ${
    active
      ? "border-b-[#315f7d] bg-[#e2ecf1] text-[#315f7d]"
      : "border-b-transparent bg-transparent text-[#514e47] hover:border-b-[#aaa294] hover:bg-[#f2eee0]"
  }`;
}

/** Right-edge affordance + keyboard focusability for a horizontally-scrollable row (spec P1: 横scroll
 * 手掛かり＝a11y). A CSS content-fade used to dim the trailing content itself — including whatever
 * metric a user would scroll toward, cutting its contrast right when it matters most — so it never
 * touches content opacity/contrast; scrollability is instead signalled by a small non-fading
 * aria-hidden arrow (see ScrollHintArrow) plus a visible focus ring, and enough right padding (pr-5)
 * that the trailing item never sits flush against the edge (2026-07-24 fix). sm+ drops the padding
 * because ControlBandRow/CategoryNav switch to flex-wrap there and no longer scroll. tabIndex=0 makes
 * the region reachable by keyboard, not just pointer/trackpad. */
const ALWAYS_SCROLL_HINT_CLASS = `pr-5 ${FOCUS_RING}`;
// ControlBandRow/CategoryNav switch to flex-wrap (no scrolling) at sm+, so their padding must cancel
// there too; InteractionTimeline's aggregate strip never wraps at any breakpoint (spec: mobile折返し
// 禁止) and keeps ALWAYS_SCROLL_HINT_CLASS (with its own always-visible ScrollHintArrow) instead.
const SCROLL_HINT_CLASS = `${ALWAYS_SCROLL_HINT_CLASS} sm:pr-0`;

/** Small non-fading affordance marking a row as horizontally scrollable — replaces the old CSS
 * content-fade, which visually dimmed the very content a user would scroll toward instead of just
 * hinting at it (2026-07-24 fix: 末尾情報のcontrastを落とさない). aria-hidden since the scrollable region itself
 * already carries the real role="group"/aria-label; this is a decorative hint only, and never
 * intercepts pointer events (pointer-events-none) so it can sit over the scrollable region's edge.
 * `always` keeps the hint visible past sm+ for rows that never switch to flex-wrap (InteractionTimeline's
 * aggregate strip); the ControlBandRow/CategoryNav hint hides there instead, matching SCROLL_HINT_CLASS. */
function ScrollHintArrow({ always }: { always?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pl-1 text-[11px] font-semibold text-[#5a574c] ${always ? "" : "sm:hidden"}`}
    >
      ▸
    </span>
  );
}

/** One horizontal group of the control band, mobile: single-row overflow-x-auto (spec P1: mobile各1行
 * 横スクロール) — never wraps to a second line on narrow screens. sm+: wraps freely. */
function ControlBandRow({
  heading,
  ariaLabel,
  children,
  className = "",
  nowrap = false,
}: {
  heading: string;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  nowrap?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 border-b border-[#c5bba5] px-3 py-1.5 last:border-b-0 ${className}`}
    >
      <span className="w-9 shrink-0 text-[10px] font-semibold tracking-[0.08em] text-[#5a574c]">
        {heading}
      </span>
      <div className="relative min-w-0 flex-1">
        <div
          tabIndex={0}
          className={`flex gap-1.5 ${nowrap ? `flex-nowrap overflow-x-auto ${ALWAYS_SCROLL_HINT_CLASS}` : `flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible ${SCROLL_HINT_CLASS}`}`}
          role="group"
          aria-label={ariaLabel}
        >
          {children}
        </div>
        <ScrollHintArrow always={nowrap} />
      </div>
    </div>
  );
}

const NEUTRAL_TONE = "border-[#ada18a] bg-white text-[#514e47]";
const FLAG_TONE = "border-[#9d8daa] bg-[#e9e2ee] text-[#5f4a66]";
const ALERT_TONE = "border-[#b5533f] bg-[#f6dad5] text-[#8c3329]";
const WARN_TONE = "border-[#bd9a52] bg-[#f7e8c8] text-[#765022]";
/** Control band — split into 3 groups (spec P1: 緊急→ボール→母数の順、2026-07-24 P0で緊急を先頭へ
 * 並び替え。まず読むべき情報＝緊急度を最初に置く): 緊急 (urgency — blocked/overdue/due-soon/月精度/
 * 期限未設定/担当未確認, active partners only), ボール (who currently holds what, active partners
 * only), 母数 (partner-quality metrics — 全関係先/対応中/保留/終了/未分類/空レーンあり/登録率 — always
 * include deferred/on_hold/ended partners, never silently dropped from "全関係先"). 空レーンあり
 * (unorganizedPartners) はOR条件（当方/先方いずれか一方でも0件なら該当）なので「台帳0件先」という
 * AND寄りの表現は使わない。登録率とあわせて「レーンが空＝未整理と確定」という嘘をつかない表現
 * （reviewed flagが無いデータなので、未整理か確認済み0件かは区別できない、spec P0-10）。 */
function ControlBand({
  counts,
  totalPartners,
}: {
  counts: SxControlBandCounts;
  totalPartners: number;
}) {
  return (
    <div role="group" aria-label="関係先の一本化された管制帯">
      <ControlBandRow heading="緊急" ariaLabel="緊急度の指標">
        <SxBadge tone={counts.blockedHoldings > 0 ? ALERT_TONE : NEUTRAL_TONE}>
          停止 {counts.blockedHoldings}件
        </SxBadge>
        <SxBadge tone={counts.overdue > 0 ? ALERT_TONE : NEUTRAL_TONE}>
          期限超過 {counts.overdue}件
        </SxBadge>
        <SxBadge tone={counts.dueSoon > 0 ? WARN_TONE : NEUTRAL_TONE}>
          7日以内 {counts.dueSoon}件
        </SxBadge>
        <SxBadge tone={NEUTRAL_TONE}>
          月精度期限 {counts.dueMonthPrecision}件
        </SxBadge>
        <SxBadge tone={counts.dueUnset > 0 ? WARN_TONE : NEUTRAL_TONE}>
          期限未設定 {counts.dueUnset}件
        </SxBadge>
        <SxBadge tone={counts.ownerUnconfirmed > 0 ? FLAG_TONE : NEUTRAL_TONE}>
          担当未確認 {counts.ownerUnconfirmed}件
        </SxBadge>
      </ControlBandRow>
      <ControlBandRow heading="ボール" ariaLabel="保有側の指標">
        <SxBadge tone={NEUTRAL_TONE}>
          未完了事項 {counts.totalHoldings}件
        </SxBadge>
        <SxBadge tone={BALL_SIDE_TONE.sx}>当方保有 {counts.sxHeld}件</SxBadge>
        <SxBadge tone={BALL_SIDE_TONE.partner}>
          先方保有 {counts.partnerHeld}件
        </SxBadge>
        <SxBadge tone={BALL_SIDE_TONE.shared}>
          共同 {counts.sharedHeld}件
        </SxBadge>
        <SxBadge tone={FLAG_TONE}>
          双方保有先 {counts.bothSidesHeldPartners}件
        </SxBadge>
        <SxBadge tone={BALL_SIDE_TONE.unknown}>
          保有側未確認 {counts.sideUnknown}件
        </SxBadge>
      </ControlBandRow>
      <ControlBandRow heading="母数" ariaLabel="関係先の母数指標">
        <SxBadge tone={NEUTRAL_TONE}>全関係先 {totalPartners}件</SxBadge>
        <SxBadge tone={NEUTRAL_TONE}>対応中 {counts.activePartners}件</SxBadge>
        <SxBadge tone={FLAG_TONE}>保留 {counts.deferredPartners}件</SxBadge>
        <SxBadge tone={FLAG_TONE}>終了 {counts.endedPartners}件</SxBadge>
        <SxBadge
          tone={counts.unclassifiedPartners > 0 ? FLAG_TONE : NEUTRAL_TONE}
        >
          未分類 {counts.unclassifiedPartners}件
        </SxBadge>
        <SxBadge
          tone={counts.unorganizedPartners > 0 ? FLAG_TONE : NEUTRAL_TONE}
        >
          空レーンあり {counts.unorganizedPartners}件
        </SxBadge>
        <SxBadge tone={NEUTRAL_TONE}>
          登録率 {counts.organizedCoveragePct}%（対応中{counts.activePartners}
          先中）
        </SxBadge>
      </ControlBandRow>
    </div>
  );
}

/** PoC候補先とVCは、同じ関係先台帳を絞る排他的な表示タブ。 */
function CategoryNav({
  counts,
  totalCount,
  pocCount,
  vcCount,
  activeKind,
  pocOnly,
  vcOnly,
  onClear,
  onSelect,
  onSelectPoc,
  onSelectVc,
  showRoleFilter,
}: {
  counts: Partial<Record<SxPartnerRoleKind, number>>;
  totalCount: number;
  pocCount: number;
  vcCount: number;
  activeKind: SxPartnerRoleKind | null;
  pocOnly: boolean;
  vcOnly: boolean;
  onClear: () => void;
  onSelect: (kind: SxPartnerRoleKind | null) => void;
  onSelectPoc: () => void;
  onSelectVc: () => void;
  showRoleFilter: boolean;
}) {
  const entries = (Object.keys(counts) as SxPartnerRoleKind[])
    .filter((kind) => (counts[kind] || 0) > 0)
    .sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  const allActive = activeKind === null && !pocOnly && !vcOnly;
  return (
    <div
      className="border-b border-[#c5bba5] bg-[#fffdf7]"
      role="group"
      aria-label="関係先の絞り込み"
    >
      <ControlBandRow heading="表示" ariaLabel="表示対象の絞り込み">
        <button
          type="button"
          data-partner-filter-trigger="all"
          onClick={onClear}
          aria-pressed={allActive}
          aria-label={`絞り込みを解除して全関係先${totalCount}件を表示`}
          className={navChipClass(allActive)}
        >
          {allActive && <span aria-hidden="true">✓</span>}全関係先 {totalCount}
          件
        </button>
        <button
          type="button"
          data-testid="sx-partner-filter-poc"
          data-partner-filter-trigger="poc"
          onClick={onSelectPoc}
          aria-pressed={pocOnly}
          aria-label={`PoC候補先だけを表示（${pocCount}件）`}
          className={navChipClass(pocOnly)}
        >
          {pocOnly && <span aria-hidden="true">✓</span>}PoC候補先 {pocCount}件
        </button>
        <button
          type="button"
          data-testid="sx-partner-filter-vc"
          data-partner-filter-trigger="vc"
          onClick={onSelectVc}
          aria-pressed={vcOnly}
          aria-label={`VCだけを表示（${vcCount}件）`}
          className={navChipClass(vcOnly)}
        >
          {vcOnly && <span aria-hidden="true">✓</span>}VC {vcCount}件
        </button>
      </ControlBandRow>
      {showRoleFilter && entries.length > 0 && (
        <ControlBandRow heading="役割" ariaLabel="役割による絞り込み">
          {entries.map((kind) => (
            <button
              key={kind}
              type="button"
              data-partner-filter-trigger={`role-${kind}`}
              onClick={() => onSelect(activeKind === kind ? null : kind)}
              aria-pressed={activeKind === kind}
              aria-label={`${sxPartnerRoleKindLabel(kind)}で絞り込み（${counts[kind]}件）`}
              className={navChipClass(activeKind === kind)}
            >
              {activeKind === kind && <span aria-hidden="true">✓</span>}
              {sxPartnerRoleKindLabel(kind)} {counts[kind]}件
            </button>
          ))}
        </ControlBandRow>
      )}
    </div>
  );
}

type SxPocQuickFilter =
  "all" | "blocked" | "overdue" | "due_soon" | "stale" | "data_gap" | "sx_ball";

function pocMatchesQuickFilter(
  partner: SxManagementPartner,
  today: string,
  filter: SxPocQuickFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "sx_ball")
    return sxPartnerPrimaryIntervention(partner, today).side === "sx";
  if (filter === "blocked") return sxPartnerHasBlockedHolding(partner);
  if (filter === "overdue") return sxPartnerHasOverdue(partner, today);
  if (filter === "due_soon") return sxPartnerHasDueSoon(partner, today);
  if (filter === "stale") return sxPartnerNeedsRefresh(partner, today);
  return sxPartnerHasDataGap(partner);
}

function PartnerComparisonControls({
  partners,
  visiblePartners,
  today,
  scopeLabel,
  activeQuickFilter,
  onSelectQuickFilter,
  activeSort,
  onSelectSort,
}: {
  partners: SxManagementPartner[];
  visiblePartners: SxManagementPartner[];
  today: string;
  scopeLabel: string;
  activeQuickFilter: SxPocQuickFilter;
  onSelectQuickFilter: (filter: SxPocQuickFilter) => void;
  activeSort: SxPocComparisonSort;
  onSelectSort: (sort: SxPocComparisonSort) => void;
}) {
  const quickCount = (filter: SxPocQuickFilter) =>
    partners.filter((partner) => pocMatchesQuickFilter(partner, today, filter))
      .length;
  const blockedCount = quickCount("blocked");
  const overdueCount = quickCount("overdue");
  const dueSoonCount = quickCount("due_soon");
  const staleCount = quickCount("stale");
  const sxBallCount = quickCount("sx_ball");
  const dataGapCount = quickCount("data_gap");
  const contactRecordCount = visiblePartners.filter(
    sxPartnerHasContactRecord,
  ).length;
  const quickFilterButton = (
    filter: SxPocQuickFilter,
    label: string,
    count: number,
    tone: string,
  ) => (
    <button
      type="button"
      data-partner-filter-trigger={`quick-${filter}`}
      onClick={() =>
        onSelectQuickFilter(activeQuickFilter === filter ? "all" : filter)
      }
      disabled={count === 0}
      aria-pressed={activeQuickFilter === filter}
      aria-label={`${label}${count}件で絞り込み`}
      className={`min-h-11 shrink-0 border disabled:cursor-not-allowed disabled:opacity-40 ${tone} ${FOCUS_RING}`}
    >
      <span className="block px-2 py-1 text-[10px] font-semibold">
        {activeQuickFilter === filter && <span aria-hidden="true">✓ </span>}
        {label} {count}
      </span>
    </button>
  );
  const sortButton = (sort: SxPocComparisonSort, label: string) => (
    <button
      type="button"
      data-partner-sort-trigger={sort}
      onClick={() => onSelectSort(sort)}
      aria-pressed={activeSort === sort}
      aria-label={`${label}に並び替え`}
      className={`min-h-11 shrink-0 border ${
        activeSort === sort
          ? "border-[#3f6b8c] bg-[#dee8f0] text-[#2a5473]"
          : NEUTRAL_TONE
      } ${FOCUS_RING}`}
    >
      <span className="block px-2 py-1 text-[10px] font-semibold">
        {activeSort === sort && <span aria-hidden="true">✓ </span>}
        {label}
      </span>
    </button>
  );
  return (
    <ControlBandRow
      heading="管制"
      ariaLabel={`${scopeLabel}の件数・並び順・要対応先の絞り込み`}
      nowrap
      className="sticky top-0 z-30 h-14 bg-[#f5f1e8] py-0 shadow-[0_1px_0_#d6cebf]"
    >
      <span
        className={`shrink-0 border px-2 py-1 text-[10px] font-semibold ${NEUTRAL_TONE}`}
      >
        表示 {visiblePartners.length} / {scopeLabel} {partners.length}
      </span>
      <span
        className={`shrink-0 border px-2 py-1 text-[10px] font-semibold ${NEUTRAL_TONE}`}
      >
        接点記録あり {contactRecordCount}
      </span>
      {/* 並び替えはフィルタと別軸なので、同じ管制帯の中でも独立したtoggle群にする
          (2026-08-06 まさ「確度の高い順にソーティングしたい」)。 */}
      {sortButton("priority", "優先度順")}
      {sortButton("attention", "要対応順")}
      {sortButton("confidence", "確度順")}
      {quickFilterButton(
        "blocked",
        "停止",
        blockedCount,
        blockedCount > 0 ? ALERT_TONE : NEUTRAL_TONE,
      )}
      {quickFilterButton(
        "overdue",
        "期限超過",
        overdueCount,
        overdueCount > 0 ? ALERT_TONE : NEUTRAL_TONE,
      )}
      {quickFilterButton(
        "due_soon",
        "7日以内",
        dueSoonCount,
        dueSoonCount > 0 ? WARN_TONE : NEUTRAL_TONE,
      )}
      {quickFilterButton(
        "stale",
        "情報更新要",
        staleCount,
        staleCount > 0 ? WARN_TONE : NEUTRAL_TONE,
      )}
      {quickFilterButton(
        "sx_ball",
        "当方が動く",
        sxBallCount,
        sxBallCount > 0 ? WARN_TONE : NEUTRAL_TONE,
      )}
      {quickFilterButton(
        "data_gap",
        "判定材料不足",
        dataGapCount,
        dataGapCount > 0 ? FLAG_TONE : NEUTRAL_TONE,
      )}
    </ControlBandRow>
  );
}

/**
 * PoC候補先タブ専用の区分・段階ファネル。同じ台帳を絞るチップで、別リストは作らない。
 * 段階チップの件数が営業ファネルKPI (段階別件数) をそのまま示す。
 */
function PocFacetFilterBand({
  partners,
  activeCategory,
  activeStage,
  onSelectCategory,
  onSelectStage,
}: {
  partners: SxManagementPartner[];
  activeCategory: SxPocCategory | null;
  activeStage: SxPartnerStage | null;
  onSelectCategory: (category: SxPocCategory | null) => void;
  onSelectStage: (stage: SxPartnerStage | null) => void;
}) {
  const categoryCount = (category: SxPocCategory) =>
    partners.filter((partner) => partner.pocCategory === category).length;
  const stageCount = (stage: SxPartnerStage) =>
    partners.filter((partner) => partner.relationshipStage === stage).length;
  const stageEntries = (
    [...SX_PARTNER_STAGE_ORDER, "on_hold", "declined"] as SxPartnerStage[]
  )
    .map((stage) => ({ stage, count: stageCount(stage) }))
    .filter((entry) => entry.count > 0);
  return (
    <div data-testid="sx-poc-facet-filter">
      <ControlBandRow heading="区分" ariaLabel="候補区分の絞り込み">
        {SX_POC_CATEGORY_ORDER.map((category) => {
          const count = categoryCount(category);
          const active = activeCategory === category;
          return (
            <button
              key={category}
              type="button"
              data-partner-filter-trigger={`poc-category-${category}`}
              onClick={() => onSelectCategory(active ? null : category)}
              disabled={count === 0}
              aria-pressed={active}
              aria-label={`${sxPocCategoryLabel(category)}で絞り込み（${count}件）`}
              className={`${navChipClass(active)} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {active && <span aria-hidden="true">✓</span>}
              {sxPocCategoryLabel(category)} {count}件
            </button>
          );
        })}
      </ControlBandRow>
      <ControlBandRow heading="段階" ariaLabel="営業段階別の件数と絞り込み">
        {stageEntries.map(({ stage, count }) => {
          const active = activeStage === stage;
          return (
            <button
              key={stage}
              type="button"
              data-partner-filter-trigger={`poc-stage-${stage}`}
              onClick={() => onSelectStage(active ? null : stage)}
              aria-pressed={active}
              aria-label={`${sxPartnerStageLabel(stage)}の${count}件で絞り込み`}
              className={navChipClass(active)}
            >
              {active && <span aria-hidden="true">✓</span>}
              {sxPartnerStageLabel(stage)} {count}
            </button>
          );
        })}
      </ControlBandRow>
    </div>
  );
}

function OwnerLoadBand({
  partners,
  today,
  activeOwner,
  onSelectOwner,
}: {
  partners: SxManagementPartner[];
  today: string;
  activeOwner: string | null;
  onSelectOwner: (ownerKey: string | null) => void;
}) {
  const loads = sxPartnerOwnerLoads(partners, today);
  if (loads.length === 0) return null;
  return (
    <ControlBandRow heading="担当" ariaLabel="担当者別の未完了事項と期限リスク">
      {loads.map((load) => {
        const active = activeOwner === load.ownerKey;
        const riskText =
          load.dangerCount > 0
            ? `危険${load.dangerCount}`
            : load.dueSoonCount > 0
              ? `7日内${load.dueSoonCount}`
              : load.dataGapCount > 0
                ? `不足${load.dataGapCount}`
                : "危険0";
        return (
          <button
            key={load.ownerKey}
            type="button"
            data-partner-filter-trigger={`owner-${load.ownerKey}`}
            aria-pressed={active}
            aria-label={`${load.ownerLabel}の未完了${load.openCount}件、${riskText}で絞り込み`}
            onClick={() => onSelectOwner(active ? null : load.ownerKey)}
            className={navChipClass(active)}
          >
            {active && <span aria-hidden="true">✓</span>}
            {sxNormalizePublicName(load.ownerLabel)} {load.openCount}・
            {riskText}
          </button>
        );
      })}
    </ControlBandRow>
  );
}

const HOLDING_SIDE_BADGE_LABEL: Record<string, string> = {
  sx: "当方",
  partner: "先方",
  shared: "共同",
  unknown: "保有側未確認",
};

/** Renders one holding row. Used both for the open-only lane preview (showSideBadge limited to
 * shared/unknown, matching the lane's own sx/partner column) and the always-visible full audit list
 * (showSideBadge=item.side for every side, canManage+onEdit for the edit affordance) — spec P0/P1:
 * work item detail is readable regardless of role, detail/完了条件/完了日/証拠/受領者/受領日 all show
 * when present, and the edit button (44px) is the only canManage-gated affordance. */
function HoldingRow({
  item,
  partnerName,
  today,
  milestoneTitleById,
  milestoneSlugById,
  showSideBadge,
  canManage,
  onEdit,
}: {
  item: SxHoldingItem;
  partnerName: string;
  today: string;
  milestoneTitleById: ReadonlyMap<string, string>;
  milestoneSlugById: ReadonlyMap<string, string>;
  showSideBadge?: "sx" | "partner" | "shared" | "unknown";
  canManage?: boolean;
  onEdit?: (workItemId: string) => void;
}) {
  const overdue = sxIsHoldingOverdue(item, today);
  const monthPrecision = sxIsHoldingMonthPrecision(item);
  const { gateTitle, proofLabels } = gateAndProofForItem(
    item,
    milestoneTitleById,
    milestoneSlugById,
  );
  return (
    <li
      className={`border-b border-[#d5cdba] py-1.5 pl-2 last:border-0 ${canManage && onEdit ? "cursor-pointer hover:bg-[#e7f0e9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]" : ""}`}
      role={canManage && onEdit ? "button" : undefined}
      tabIndex={canManage && onEdit ? 0 : undefined}
      aria-label={
        canManage && onEdit
          ? `${partnerName} - ${sxNormalizePublicName(item.title)}を直接修正`
          : undefined
      }
      onClick={canManage && onEdit ? () => onEdit(item.id) : undefined}
      onKeyDown={
        canManage && onEdit
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEdit(item.id);
              }
            }
          : undefined
      }
      style={{
        borderLeft: `3px solid ${HOLDING_STATUS_LINE[item.status] || HOLDING_STATUS_LINE.open}`,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <SxBadge tone="border-[#ada18a] bg-[#f2eee0] text-[#5a574c]">
            {item.itemKindLabel}
          </SxBadge>
          <SxBadge
            tone={HOLDING_STATUS_TONE[item.status] || HOLDING_STATUS_TONE.open}
          >
            {HOLDING_STATUS_LABEL[item.status] || "未確認"}
          </SxBadge>
          {showSideBadge && (
            <SxBadge tone={BALL_SIDE_TONE[showSideBadge]}>
              {HOLDING_SIDE_BADGE_LABEL[showSideBadge]}
            </SxBadge>
          )}
          {monthPrecision && (
            <SxBadge tone="border-[#ada18a] bg-white text-[#5a574c]">
              月精度
            </SxBadge>
          )}
        </div>
      </div>
      <p className="mt-1 text-[11px] font-semibold leading-4 text-[#24231f]">
        {nominalizeSxActionLabel(sxNormalizePublicName(item.title))}
      </p>
      {item.detail && (
        <p className="mt-0.5 text-[10px] leading-4 text-[#514e47]">
          {sxNormalizePublicName(item.detail)}
        </p>
      )}
      <p
        className={`mt-0.5 text-[10px] ${overdue ? "font-semibold text-[#8c3329]" : "text-[#5a574c]"}`}
      >
        担当{" "}
        {item.ownerLabel
          ? sxNormalizePublicName(item.ownerLabel)
          : "担当未確認"}{" "}
        ・ {sxFormatDueDateWithPrecision(item.dueDate, item.dueDatePrecision)}
      </p>
      {/* sourceEvidence (一次根拠 — a commitment's primary backing, present regardless of status) and
          completionEvidence (完了の証拠 — proof a work item is actually done) are separate claims and
          must never be merged into one line (2026-07-24 P1 fix: an open commitment's 一次根拠 used to
          render mislabeled as "完了の証拠" even before anything was completed). */}
      {item.sourceEvidence && (
        <p className="mt-0.5 text-[10px] leading-4 text-[#514e47]">
          一次根拠: {sxNormalizePublicName(item.sourceEvidence)}
        </p>
      )}
      {item.completionCriteria && (
        <p className="mt-0.5 text-[10px] leading-4 text-[#514e47]">
          完了条件: {sxNormalizePublicName(item.completionCriteria)}
        </p>
      )}
      {item.completedOn && (
        <p className="mt-0.5 text-[10px] leading-4 text-[#205f49]">
          完了日: {sxFormatDate(item.completedOn)}
        </p>
      )}
      {item.completionEvidence && (
        <p className="mt-0.5 text-[10px] leading-4 text-[#205f49]">
          完了の証拠: {sxNormalizePublicName(item.completionEvidence)}
        </p>
      )}
      {item.acceptedBy && (
        <p className="mt-0.5 text-[10px] leading-4 text-[#205f49]">
          受領者: {sxNormalizePublicName(item.acceptedBy)}
          {item.acceptedOn ? ` ・ 受領日 ${sxFormatDate(item.acceptedOn)}` : ""}
        </p>
      )}
      <p className="mt-0.5 text-[10px] leading-4 text-[#5a574c]">
        関連工程: {gateTitle || "工程未接続"}
        {proofLabels.length > 0 && (
          <span className="text-[#315f7d]">
            {" "}
            ・ 証明: {proofLabels.join(" / ")}
          </span>
        )}
      </p>
      {/* 出典/最終確認/確度 — read-only provenance audit trail for every viewer, not just canManage
          (spec: 全件監査表示で「出典」「最終確認」「確度」を見える化). sourceRef is never rendered
          verbatim — sxSourceRefDisplayLabel masks raw URLs/internal tracking-key shapes first. */}
      <p className="mt-0.5 text-[10px] leading-4 text-[#5a574c]">
        出典: {sxSourceKindLabel(item.sourceKind)}
        {sxSourceRefDisplayLabel(item.sourceRef)
          ? ` (${sxSourceRefDisplayLabel(item.sourceRef)})`
          : ""}
        {" ・ "}最終確認 {sxFormatDate(item.lastVerifiedAt)}
        {" ・ "}確度 {sxConfidenceLabel(item.confidence)}
      </p>
      <span className="sr-only">{partnerName}の保有事項</span>
    </li>
  );
}

// 既定の列順は「評価 → 関係先 → 現在の状況 → ゴール → 次にやること → 次回面談
// → 担当・期限 → 現在地の根拠 → 排液 → 接点の経緯 → 履歴・保有」。
// 評価と履歴・保有は行の外枠側の独立カラムなので INNER 側には含めない。
//
// 「詰まり・PJ影響」列は 2026-08-07 に削除 (まさ「あまり意味がないと思うので」)。
//
// 固定列は評価と関係先の2つ (2026-08-07 まさ「固定列を「評価」「関係先」の２カラムに増やして」)。
// 横へスクロールしても「どの会社の行か」を見失わないようにするため。
//
// 中間の列 (現在の状況〜接点の経緯) は見出しのドラッグで並べ替えできる
// (2026-08-07 まさ「カラムの順番もドラッグアンドドロップで手動で入れ替えられるように」)。
// DOM は書いた順のままで、CSS の order プロパティだけを動かす。
//
// 幅は 1248px に詰め込まず、本文を「…」で切らずに読める既定幅を持つ
// (2026-08-06 まさ「各カラムの情報は「…」で省略せずに表示して。カラムの幅はもっと太くしてもいいよ。
// 基本、横スクロールは許容する前提で」)。合計幅がコンテナを超える分は一覧を横スクロールさせる。
// 幅も順番も localStorage に残る (端末ごとの見え方の好みなので DB へは持たせない)。
type PartnerLedgerColumnKey =
  | "grade"
  | "name"
  | "current"
  | "goal"
  | "action"
  | "meeting"
  | "owner"
  | "basis"
  | "effluent"
  | "origin"
  | "history";

type PartnerLedgerColumn = {
  key: PartnerLedgerColumnKey;
  label: string;
  title?: string;
  defaultWidth: number;
  minWidth: number;
};

const PARTNER_LEDGER_COLUMNS: readonly PartnerLedgerColumn[] = [
  {
    key: "grade",
    label: "評価",
    title: "顧客としての見込み。ペインの高さと単価の高い重金属の有無で付ける",
    defaultWidth: 34,
    minWidth: 30,
  },
  { key: "name", label: "関係先", defaultWidth: 248, minWidth: 150 },
  { key: "current", label: "現在の状況", defaultWidth: 208, minWidth: 120 },
  { key: "goal", label: "ゴール", defaultWidth: 176, minWidth: 90 },
  { key: "action", label: "次にやること", defaultWidth: 200, minWidth: 90 },
  {
    key: "meeting",
    label: "次回面談",
    title: "次回面談の日時・形式・着地点・準備するもの",
    defaultWidth: 200,
    minWidth: 90,
  },
  { key: "owner", label: "担当・期限", defaultWidth: 140, minWidth: 80 },
  { key: "basis", label: "現在地の根拠", defaultWidth: 224, minWidth: 100 },
  { key: "effluent", label: "排液", defaultWidth: 208, minWidth: 100 },
  { key: "origin", label: "接点の経緯", defaultWidth: 208, minWidth: 100 },
  { key: "history", label: "履歴・保有", defaultWidth: 88, minWidth: 72 },
];

const PARTNER_LEDGER_COLUMN_BY_KEY = new Map(
  PARTNER_LEDGER_COLUMNS.map((column) => [column.key, column]),
);

/** 並べ替えできない列。評価と関係先は左固定、履歴・保有は行の右端に据える。 */
const PARTNER_LEDGER_FIXED_KEYS: readonly PartnerLedgerColumnKey[] = [
  "grade",
  "name",
  "history",
];

/** 見出しのドラッグで並べ替えできる中間の列。既定順は宣言順。 */
const PARTNER_LEDGER_MOVABLE_KEYS: readonly PartnerLedgerColumnKey[] =
  PARTNER_LEDGER_COLUMNS.filter(
    (column) => !PARTNER_LEDGER_FIXED_KEYS.includes(column.key),
  ).map((column) => column.key);

/** 行の内側 grid が持つ列 (評価と履歴・保有は行の外枠側)。関係先は必ず先頭。 */
function partnerLedgerInnerKeys(
  order: readonly PartnerLedgerColumnKey[],
): PartnerLedgerColumnKey[] {
  return ["name", ...order];
}

// 幅は列の集合が変わったら作り直す。v1 には削除済みの「詰まり・PJ影響」が入っていて、
// 関係先の既定幅も広げたので v2 へ上げる (2026-08-07)。
const PARTNER_LEDGER_WIDTH_STORAGE_KEY = "sx-partner-ledger-column-widths-v2";
const PARTNER_LEDGER_ORDER_STORAGE_KEY = "sx-partner-ledger-column-order-v1";

type PartnerLedgerWidths = Record<PartnerLedgerColumnKey, number>;

function defaultPartnerLedgerWidths(): PartnerLedgerWidths {
  return PARTNER_LEDGER_COLUMNS.reduce((acc, column) => {
    acc[column.key] = column.defaultWidth;
    return acc;
  }, {} as PartnerLedgerWidths);
}

/**
 * 列幅は端末ごとの見え方の好みなので localStorage に保存する。DB へは持たせない
 * (共有すると他の閲覧者の幅まで動いてしまう)。保存値が壊れていても既定幅へ落として描画は続ける。
 */
function usePartnerLedgerColumnWidths() {
  const [widths, setWidths] = useState<PartnerLedgerWidths>(
    defaultPartnerLedgerWidths,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PARTNER_LEDGER_WIDTH_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<
        Record<PartnerLedgerColumnKey, unknown>
      >;
      const next = defaultPartnerLedgerWidths();
      for (const column of PARTNER_LEDGER_COLUMNS) {
        const value = parsed?.[column.key];
        if (typeof value === "number" && Number.isFinite(value)) {
          next[column.key] = Math.max(column.minWidth, Math.round(value));
        }
      }
      setWidths(next);
    } catch {
      // 壊れた保存値は無視して既定幅のまま使う
    }
  }, []);

  const persist = (next: PartnerLedgerWidths) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        PARTNER_LEDGER_WIDTH_STORAGE_KEY,
        JSON.stringify(next),
      );
    } catch {
      // 保存できなくても表示は続ける
    }
  };

  const setWidth = (key: PartnerLedgerColumnKey, width: number) => {
    setWidths((previous) => ({ ...previous, [key]: width }));
  };

  const commitWidths = () => {
    setWidths((previous) => {
      persist(previous);
      return previous;
    });
  };

  const resetWidths = () => {
    const next = defaultPartnerLedgerWidths();
    setWidths(next);
    persist(next);
  };

  const isCustomized = PARTNER_LEDGER_COLUMNS.some(
    (column) => widths[column.key] !== column.defaultWidth,
  );

  return { widths, setWidth, commitWidths, resetWidths, isCustomized };
}

/**
 * 列の並び順は端末ごとの好みなので localStorage に保存する。保存値に知らないキーや
 * 重複が混ざっていても、既知のキーだけを拾って足りない分を既定順で足し、描画は続ける。
 */
function sanitizePartnerLedgerOrder(value: unknown): PartnerLedgerColumnKey[] {
  const seen = new Set<PartnerLedgerColumnKey>();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const key = entry as PartnerLedgerColumnKey;
      if (!PARTNER_LEDGER_MOVABLE_KEYS.includes(key)) continue;
      seen.add(key);
    }
  }
  for (const key of PARTNER_LEDGER_MOVABLE_KEYS) seen.add(key);
  return [...seen];
}

function usePartnerLedgerColumnOrder() {
  const [order, setOrder] = useState<PartnerLedgerColumnKey[]>(() => [
    ...PARTNER_LEDGER_MOVABLE_KEYS,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PARTNER_LEDGER_ORDER_STORAGE_KEY);
      if (!raw) return;
      setOrder(sanitizePartnerLedgerOrder(JSON.parse(raw)));
    } catch {
      // 壊れた保存値は無視して既定順のまま使う
    }
  }, []);

  const persist = (next: PartnerLedgerColumnKey[]) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        PARTNER_LEDGER_ORDER_STORAGE_KEY,
        JSON.stringify(next),
      );
    } catch {
      // 保存できなくても表示は続ける
    }
  };

  /** dragged を target の位置へ差し込む。target が右側なら target の後ろへ入る。 */
  const moveColumn = (
    dragged: PartnerLedgerColumnKey,
    target: PartnerLedgerColumnKey,
  ) => {
    if (dragged === target) return;
    setOrder((previous) => {
      const from = previous.indexOf(dragged);
      const to = previous.indexOf(target);
      if (from < 0 || to < 0) return previous;
      const next = [...previous];
      next.splice(from, 1);
      next.splice(to, 0, dragged);
      persist(next);
      return next;
    });
  };

  const resetOrder = () => {
    const next = [...PARTNER_LEDGER_MOVABLE_KEYS];
    setOrder(next);
    persist(next);
  };

  const isOrderCustomized = order.some(
    (key, index) => PARTNER_LEDGER_MOVABLE_KEYS[index] !== key,
  );

  return { order, moveColumn, resetOrder, isOrderCustomized };
}

/** 幅と並び順を CSS 変数へ流し込む。行・見出し・横スクロール枠が同じ値を共有する。 */
function partnerLedgerGridStyle(
  widths: PartnerLedgerWidths,
  order: readonly PartnerLedgerColumnKey[],
): CSSProperties {
  const inner = partnerLedgerInnerKeys(order)
    .map((key) => `${widths[key]}px`)
    .join(" ");
  const total =
    PARTNER_LEDGER_COLUMNS.reduce(
      (sum, column) => sum + widths[column.key],
      0,
    ) +
    // 列間の gap-2 + 行の px-2
    8 * (PARTNER_LEDGER_COLUMNS.length - 1) +
    16;
  return {
    "--sx-pl-inner": inner,
    "--sx-pl-header": `${widths.grade}px ${inner} ${widths.history}px`,
    "--sx-pl-row": `${widths.grade}px minmax(0,1fr) ${widths.history}px`,
    "--sx-pl-total": `${total}px`,
    // 評価カラムが左端 0 に貼り付くので、関係先はその右隣で止める。
    "--sx-pl-name-left": `${widths.grade}px`,
  } as CSSProperties;
}

const PARTNER_CONTROL_INNER_GRID =
  "@min-[1248px]:[grid-template-columns:var(--sx-pl-inner)]";
const PARTNER_CONTROL_ROW_GRID =
  "@min-[1248px]:[grid-template-columns:var(--sx-pl-row)]";
/** 横スクロール枠の中身は列幅の合計まで広げる。これで見出しと行の左端が揃う。 */
const PARTNER_LEDGER_MIN_WIDTH = "@min-[1248px]:[min-width:var(--sx-pl-total)]";
/** 先頭列 (評価) を横スクロールに対して固定する。 */
const PARTNER_LEDGER_STICKY_LEFT =
  "@min-[1248px]:sticky @min-[1248px]:left-0 @min-[1248px]:z-20";
/** 2列目 (関係先) は評価の右隣で止める。評価より内側なので z は一段下げる。 */
const PARTNER_LEDGER_STICKY_NAME =
  "@min-[1248px]:sticky @min-[1248px]:left-[var(--sx-pl-name-left)] @min-[1248px]:z-10";

function PartnerLedgerHeaderCell({
  column,
  width,
  onResize,
  onCommit,
  sticky,
  movable,
  dragging,
  onDragColumnStart,
  onDragColumnEnd,
  onDropColumn,
}: {
  column: PartnerLedgerColumn;
  width: number;
  onResize: (key: PartnerLedgerColumnKey, width: number) => void;
  onCommit: () => void;
  sticky?: "grade" | "name";
  movable?: boolean;
  dragging?: boolean;
  onDragColumnStart?: (key: PartnerLedgerColumnKey) => void;
  onDragColumnEnd?: () => void;
  onDropColumn?: (key: PartnerLedgerColumnKey) => void;
}) {
  const handlePointerDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = width;
    const move = (moveEvent: PointerEvent) => {
      onResize(
        column.key,
        Math.max(
          column.minWidth,
          Math.round(startWidth + moveEvent.clientX - startX),
        ),
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      onCommit();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.setProperty("cursor", "col-resize");
    document.body.style.setProperty("user-select", "none");
  };

  const stickyClass =
    sticky === "grade"
      ? `${PARTNER_LEDGER_STICKY_LEFT} bg-[#f2eee0]`
      : sticky === "name"
        ? `${PARTNER_LEDGER_STICKY_NAME} bg-[#f2eee0]`
        : "";

  return (
    <span
      className={`relative flex min-w-0 items-center pr-2 ${stickyClass} ${
        movable ? "cursor-grab active:cursor-grabbing" : ""
      } ${dragging ? "opacity-45" : ""}`}
      title={
        movable
          ? `${column.title ? `${column.title}。` : ""}見出しを左右へドラッグすると列の順番を変えられるよ`
          : column.title
      }
      draggable={movable || undefined}
      data-partner-column-head={column.key}
      onDragStart={
        movable
          ? (event) => {
              event.dataTransfer.effectAllowed = "move";
              // Firefox はデータが空だと drag を開始しない
              event.dataTransfer.setData("text/plain", column.key);
              onDragColumnStart?.(column.key);
            }
          : undefined
      }
      onDragEnd={movable ? () => onDragColumnEnd?.() : undefined}
      onDragOver={
        movable
          ? (event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }
          : undefined
      }
      onDrop={
        movable
          ? (event) => {
              event.preventDefault();
              onDropColumn?.(column.key);
            }
          : undefined
      }
    >
      {movable && (
        <GripVertical
          className="mr-0.5 h-3 w-3 shrink-0 text-[#a1957e]"
          aria-hidden="true"
        />
      )}
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {column.label}
      </span>
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`${column.label}の列幅を変える`}
        data-partner-column-resize={column.key}
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        className="absolute -right-1 top-0 h-full w-2 cursor-col-resize touch-none bg-transparent hover:bg-[#a1957e]"
        title="左右にドラッグで列幅を変えられるよ"
        onPointerDown={handlePointerDown}
      />
    </span>
  );
}

function interventionStatusLabel(
  intervention: SxPartnerPrimaryIntervention,
): string {
  if (!intervention.hasStructuredHolding) return "構造化保有事項 未登録";
  if (intervention.risk === "blocked") return "停止";
  if (intervention.risk === "overdue") return "期限超過";
  if (intervention.risk === "due_soon") return "7日以内";
  if (intervention.risk === "waiting") return "待ち";
  return HOLDING_STATUS_LABEL[intervention.status] || "進行中";
}

function interventionOwnerText(
  intervention: SxPartnerPrimaryIntervention,
  partnerName: string,
): string {
  if (!intervention.ownerLabel) return "担当未確認";
  return sxCompactPartnerRowText(
    sxNormalizePublicName(intervention.ownerLabel),
    partnerName,
  );
}

function interventionSideText(
  intervention: SxPartnerPrimaryIntervention,
): string {
  return intervention.side === "sx"
    ? "当方"
    : intervention.side === "partner"
      ? "先方"
      : intervention.side === "shared"
        ? "双方"
        : "保有側未確認";
}

function PartnerProgressFlow({
  partner,
  displayName,
  steps,
}: {
  partner: SxManagementPartner;
  displayName: string;
  steps: readonly PartnerProgressStep[];
}) {
  const flowRef = useRef<HTMLOListElement>(null);
  const stepSignature = steps.map((step) => step.key).join("|");
  useEffect(() => {
    const flow = flowRef.current;
    const current = flow?.querySelector<HTMLElement>(
      '[data-progress-step="now"]',
    );
    if (!flow || !current || flow.scrollWidth <= flow.clientWidth) return;
    flow.scrollLeft = Math.max(0, current.offsetLeft - flow.offsetLeft - 8);
  }, [stepSignature]);
  const nowTone =
    partner.currentBallSide === "sx"
      ? "border-[#b5533f] bg-[#f6dad5] text-[#8c3329]"
      : partner.currentBallSide === "partner"
        ? "border-[#b1934e] bg-[#f7e8c8] text-[#765022]"
        : "border-[#8e88a5] bg-[#f1f0f6] text-[#55506d]";
  return (
    <div
      className="min-w-0 overflow-hidden"
      data-testid={`sx-partner-progress-${partner.id}`}
      data-step-count={steps.length}
    >
      <p className="text-[10px] font-semibold text-[#5a574c] xl:hidden">
        進行状況
      </p>
      <ol
        ref={flowRef}
        tabIndex={0}
        className={`mt-1 flex items-stretch gap-0 overflow-x-auto pb-1 xl:mt-0 ${FOCUS_RING}`}
        aria-label={`${displayName}の進行状況`}
      >
        {steps.map((step, index) => (
          <li
            key={step.key}
            data-progress-step={step.phase}
            className="flex min-w-0 items-stretch"
          >
            <div
              className={`flex w-[138px] min-w-[124px] flex-col gap-0.5 rounded-md border px-2 py-1 ${
                step.phase === "done"
                  ? "border-[#c9d9cf] bg-[#e7f0e9] text-[#205f49]"
                  : step.phase === "now"
                    ? `border-2 ${nowTone}`
                    : step.phase === "goal"
                      ? "border-[#9d8daa] bg-[#f6f3f8] text-[#5f4a66]"
                      : "border-dashed border-[#a69b84] bg-[#fffdf7] text-[#514e47]"
              }`}
            >
              <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide">
                {step.phase === "done" && (
                  <CircleCheck
                    className="h-3 w-3 shrink-0"
                    aria-hidden="true"
                  />
                )}
                {step.phase === "now" && (
                  <CircleDot className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
                {step.phase === "goal" && (
                  <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
                {step.sub}
              </span>
              <span
                className="line-clamp-2 text-[11px] font-semibold leading-[1.3]"
                title={step.title}
              >
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <span
                className="flex shrink-0 items-center px-0.5 text-[#65604f]"
                aria-hidden="true"
              >
                <ArrowRight className="h-3 w-3" />
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * 試料台帳の1行。表示行そのものを押すと同じ行内が入力群へ変わり、保存/取消で同じ行へ戻る。
 * 第二モーダルは開かない。
 */
function PartnerSampleRow({
  sample,
  canManage,
  onPatch,
}: {
  sample: SxPartnerSample;
  canManage: boolean;
  onPatch: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    label: sample.label,
    status: sample.status as string,
    received_on: sample.receivedOn || "",
    storage_location: sample.storageLocation || "",
    owner_label: sample.ownerLabel || "",
    notes: sample.notes || "",
  });
  const startEdit = () => {
    setDraft({
      label: sample.label,
      status: sample.status,
      received_on: sample.receivedOn || "",
      storage_location: sample.storageLocation || "",
      owner_label: sample.ownerLabel || "",
      notes: sample.notes || "",
    });
    setError(null);
    setEditing(true);
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onPatch({
        label: draft.label.trim() || sample.label,
        status: draft.status,
        received_on: draft.received_on || null,
        storage_location: draft.storage_location.trim() || null,
        owner_label: draft.owner_label.trim() || null,
        notes: draft.notes.trim() || null,
      });
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存できなかったよ");
    } finally {
      setSaving(false);
    }
  };
  const statusTone =
    sample.status === "received" || sample.status === "analyzed"
      ? "border-[#38745d]/50 bg-[#dcecdf] text-[#235f4b]"
      : sample.status === "unknown"
        ? "border-[#bf7b2c]/45 bg-[#f9f2e4] text-[#765022]"
        : "border-[#a69b84] bg-[#f5f1e8] text-[#514e47]";

  const view = (
    <div className="grid min-w-0 gap-0.5 px-3 py-2 text-left">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="[overflow-wrap:anywhere] text-[11px] font-semibold leading-4 text-[#24231f]">
          {sample.label}
        </span>
        <span
          className={`inline-block border px-1 py-px text-[10px] font-semibold leading-3 ${statusTone}`}
        >
          {sxSampleStatusLabel(sample.status)}
        </span>
        {(sample.confidence === "low" || sample.confidence === "unknown") && (
          <span className="inline-block border border-[#bf7b2c]/45 bg-[#f9f2e4] px-1 py-px text-[10px] font-semibold leading-3 text-[#765022]">
            要確認
          </span>
        )}
      </div>
      <p className="text-[10px] leading-4 text-[#5a574c]">
        受領 {sample.receivedOn ? sxFormatDate(sample.receivedOn) : "未確認"} ・
        保管 {sample.storageLocation || "未確認"} ・ 担当{" "}
        {sample.ownerLabel
          ? sxNormalizePublicName(sample.ownerLabel)
          : "未確認"}
      </p>
      {sample.notes && (
        <p className="text-[10px] leading-4 text-[#514e47]">{sample.notes}</p>
      )}
    </div>
  );

  if (!canManage) return <li>{view}</li>;
  if (!editing) {
    return (
      <li>
        <button
          type="button"
          className={`block w-full text-left hover:bg-[#e2ecf1] ${FOCUS_RING}`}
          onClick={startEdit}
          aria-label={`試料「${sample.label}」を直接修正`}
          data-sample-row={sample.id}
        >
          {view}
        </button>
      </li>
    );
  }
  const field = (label: string, node: ReactNode) => (
    <label className="grid min-w-0 gap-0.5">
      <span className="text-[10px] font-semibold leading-3 text-[#5a574c]">
        {label}
      </span>
      {node}
    </label>
  );
  const controlClass = `min-w-0 border border-[#a69b84] bg-[#fffdf7] px-1.5 py-1 text-[11px] text-[#24231f] ${FOCUS_RING}`;
  return (
    <li
      className="grid gap-1.5 bg-[#f2eee0] px-3 py-2"
      data-sample-row-editing={sample.id}
      aria-busy={saving}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          setEditing(false);
        }
      }}
    >
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {field(
          "試料",
          <input
            autoFocus
            className={controlClass}
            value={draft.label}
            readOnly={saving}
            onChange={(event) =>
              setDraft((current) => ({ ...current, label: event.target.value }))
            }
          />,
        )}
        {field(
          "状態",
          <select
            className={controlClass}
            value={draft.status}
            disabled={saving}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                status: event.target.value,
              }))
            }
          >
            {SX_SAMPLE_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {sxSampleStatusLabel(status)}
              </option>
            ))}
          </select>,
        )}
        {field(
          "受領日",
          <input
            type="date"
            className={controlClass}
            value={draft.received_on}
            readOnly={saving}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                received_on: event.target.value,
              }))
            }
          />,
        )}
        {field(
          "保管場所",
          <input
            className={controlClass}
            value={draft.storage_location}
            readOnly={saving}
            placeholder="未確認"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                storage_location: event.target.value,
              }))
            }
          />,
        )}
        {field(
          "担当",
          <input
            className={controlClass}
            value={draft.owner_label}
            readOnly={saving}
            placeholder="未確認"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                owner_label: event.target.value,
              }))
            }
          />,
        )}
      </div>
      {field(
        "要確認・条件",
        <textarea
          rows={2}
          className={controlClass}
          value={draft.notes}
          readOnly={saving}
          onChange={(event) =>
            setDraft((current) => ({ ...current, notes: event.target.value }))
          }
        />,
      )}
      {error && (
        <p className="text-[10px] font-semibold text-[#8c3329]" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={`border border-[#235f4b] bg-[#235f4b] px-2.5 py-1 text-[10px] font-semibold text-[#fffdf7] disabled:opacity-50 ${FOCUS_RING}`}
        >
          保存
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className={`border border-[#a1957e] bg-[#fffdf7] px-2.5 py-1 text-[10px] font-semibold text-[#514e47] disabled:opacity-50 ${FOCUS_RING}`}
        >
          取消
        </button>
      </div>
    </li>
  );
}

/** 試料の新規追加は試料名1項目だけ。詳細は追加直後に同じ行のその場編集で補完する。 */
function PartnerSampleAddForm({
  partnerId,
  onCreate,
}: {
  partnerId: string;
  onCreate: (partnerId: string, label: string) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const trimmed = label.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate(partnerId, trimmed);
      setLabel("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "追加できなかったよ");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mt-2 grid gap-1">
      <div className="flex items-stretch gap-1.5">
        <input
          className={`min-w-0 flex-1 border border-[#a69b84] bg-[#fffdf7] px-2 py-1.5 text-[11px] text-[#24231f] ${FOCUS_RING}`}
          value={label}
          readOnly={saving}
          placeholder="試料名（例: 工場排液 / 触媒 / 井戸水）"
          aria-label="追加する試料名"
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving || !label.trim()}
          className={`border border-[#235f4b] bg-[#235f4b] px-3 py-1.5 text-[10px] font-semibold text-[#fffdf7] disabled:opacity-50 ${FOCUS_RING}`}
          data-testid="sx-partner-sample-add"
        >
          試料を追加
        </button>
      </div>
      {error && (
        <p className="text-[10px] font-semibold text-[#8c3329]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function PartnerProgressHistoryModal({
  partner,
  today,
  milestoneTitleById,
  milestoneSlugById,
  canManage,
  onPatchSample,
  onCreateSample,
  onClose,
}: {
  partner: SxManagementPartner;
  today: string;
  milestoneTitleById: ReadonlyMap<string, string>;
  milestoneSlugById: ReadonlyMap<string, string>;
  canManage: boolean;
  onPatchSample: (request: PartnerInlinePatch) => Promise<void>;
  onCreateSample: (partnerId: string, label: string) => Promise<void>;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const display = sxPartnerDisplay(partner);
  const steps = buildPartnerProgressSteps(partner);
  const interactions = sxSortInteractionsByRecency(partner.interactions);
  const openHoldings = sxSortHoldingsByPriority(
    sxHoldingsForPartner(partner),
    today,
  );
  const closedWorkItems = sxSortHoldingsByPriority(
    sxAllHoldingsForPartnerAudit(partner).filter(
      (item) => item.status === "completed" || item.status === "cancelled",
    ),
    today,
  );
  const closedCommitments = partner.commitments.filter(
    (item) => item.status === "completed" || item.status === "cancelled",
  );
  const titleId = `sx-partner-history-title-${partner.id}`;

  useModalContainment({
    dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-end bg-[#24231f]/45 p-0 backdrop-blur-[4px] sm:place-items-center sm:p-6"
      role="presentation"
      data-modal-layer="sx-partner-history"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        id={`sx-partner-history-${partner.id}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[calc(100dvh-8px)] w-full flex-col overflow-hidden rounded-t-xl border border-[#a1957e] bg-[#fffdf7] shadow-[0_24px_72px_rgba(36,35,31,0.24)] sm:max-h-[min(780px,calc(100dvh-48px))] sm:max-w-[840px] sm:rounded-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex min-h-[68px] items-start justify-between gap-4 border-b border-[#d7d0c3]/70 px-4 py-3.5 sm:px-[22px] sm:pb-3.5 sm:pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold text-[#235f4b]">
              進捗・履歴
            </p>
            <h4
              id={titleId}
              className="mt-0.5 [overflow-wrap:anywhere] text-xl font-semibold leading-[1.35] text-[#24231f]"
            >
              {display.name}
            </h4>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={`${display.name}の進捗と履歴を閉じる`}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#a1957e] bg-[#fffdf7] text-[#514e47] hover:border-[#235f4b] hover:bg-[#dcecdf] hover:text-[#235f4b] ${FOCUS_RING}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 sm:px-[22px]">
          <section aria-labelledby={`${titleId}-flow`}>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p
                  id={`${titleId}-flow`}
                  className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]"
                >
                  進行状況
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[#5a574c]">
                  接点、現在地、未完了事項、次の一手、ゴールを時系列で確認
                </p>
              </div>
              <span className="text-[10px] font-semibold text-[#5a574c]">
                全{steps.length}項目
              </span>
            </div>
            <div className="mt-2">
              <PartnerProgressFlow
                partner={partner}
                displayName={display.name}
                steps={steps}
              />
            </div>
          </section>

          <section
            className="mt-5 border-t border-[#c5bba5] pt-4"
            aria-labelledby={`${titleId}-holdings`}
          >
            <p
              id={`${titleId}-holdings`}
              className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]"
            >
              未完了の保有事項・約束 {openHoldings.length}件
            </p>
            {openHoldings.length > 0 ? (
              <ul className="mt-2 divide-y divide-[#eee9df] border-y border-[#c5bba5] bg-white">
                {openHoldings.map((item) => (
                  <HoldingRow
                    key={item.id}
                    item={item}
                    partnerName={display.name}
                    today={today}
                    milestoneTitleById={milestoneTitleById}
                    milestoneSlugById={milestoneSlugById}
                    showSideBadge={item.side}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-2 border border-dashed border-[#ada18a] p-3 text-[11px] text-[#5a574c]">
                未完了の保有事項・約束はない。
              </p>
            )}
          </section>

          {(partner.samples.length > 0 ||
            (canManage && partner.pocCategory)) && (
            <section
              className="mt-5 border-t border-[#c5bba5] pt-4"
              aria-labelledby={`${titleId}-samples`}
              data-testid="sx-partner-sample-ledger"
            >
              <p
                id={`${titleId}-samples`}
                className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]"
              >
                試料台帳 {partner.samples.length}件
              </p>
              {partner.samples.length > 0 ? (
                <ul className="mt-2 divide-y divide-[#eee9df] border-y border-[#c5bba5] bg-white">
                  {[...partner.samples]
                    .sort(
                      (left, right) =>
                        left.sortOrder - right.sortOrder ||
                        left.label.localeCompare(right.label, "ja"),
                    )
                    .map((sample) => (
                      <PartnerSampleRow
                        key={sample.id}
                        sample={sample}
                        canManage={canManage}
                        onPatch={(patch) =>
                          onPatchSample({
                            resource: "partner_sample",
                            id: sample.id,
                            patch,
                          })
                        }
                      />
                    ))}
                </ul>
              ) : (
                <p className="mt-2 border border-dashed border-[#ada18a] p-3 text-[11px] text-[#5a574c]">
                  保存済みの試料はまだない。
                </p>
              )}
              {canManage && (
                <PartnerSampleAddForm
                  partnerId={partner.id}
                  onCreate={onCreateSample}
                />
              )}
            </section>
          )}

          <section
            className="mt-5 border-t border-[#c5bba5] pt-4"
            aria-labelledby={`${titleId}-interactions`}
          >
            <p
              id={`${titleId}-interactions`}
              className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]"
            >
              やり取り履歴（全{interactions.length}件）
            </p>
            {interactions.length > 0 ? (
              <ul className="mt-2 divide-y divide-[#eee9df] border-y border-[#c5bba5] bg-white">
                {interactions.map((interaction) => (
                  <InteractionFullRow
                    key={interaction.id}
                    interaction={interaction}
                    partnerName={display.name}
                    canManage={false}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-2 border border-dashed border-[#ada18a] p-3 text-[11px] text-[#5a574c]">
                保存済みのやり取り履歴はまだない。
              </p>
            )}
          </section>

          {(closedWorkItems.length > 0 || closedCommitments.length > 0) && (
            <details className="mt-5 border-t border-[#c5bba5] pt-3">
              <summary
                className={`flex min-h-11 cursor-pointer items-center text-[10px] font-semibold text-[#5a574c] ${FOCUS_RING}`}
              >
                完了・取消の保有事項{" "}
                {closedWorkItems.length + closedCommitments.length}件
              </summary>
              {closedWorkItems.length > 0 && (
                <ul className="divide-y divide-[#eee9df] border-y border-[#c5bba5] bg-white">
                  {closedWorkItems.map((item) => (
                    <HoldingRow
                      key={item.id}
                      item={item}
                      partnerName={display.name}
                      today={today}
                      milestoneTitleById={milestoneTitleById}
                      milestoneSlugById={milestoneSlugById}
                      showSideBadge={item.side}
                    />
                  ))}
                </ul>
              )}
              {closedCommitments.map((item) => (
                <div
                  key={item.id}
                  className="border-b border-[#d5cdba] bg-white p-3 text-[11px]"
                >
                  <p className="font-semibold text-[#24231f]">
                    {nominalizeSxActionLabel(sxNormalizePublicName(item.title))}
                  </p>
                  <p className="mt-1 text-[#5a574c]">
                    {item.status === "completed" ? "完了" : "取消"} ・{" "}
                    {sxFormatDate(item.completedOn)}
                  </p>
                </div>
              ))}
            </details>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

/**
 * 一覧の列幅を共有する表示区画。編集可否はセル内の値単位で決める。
 * order は列の並べ替え用。DOM の順序は書いたままで、CSS の order だけを動かす。
 */
function PartnerRowCell({
  className = "",
  order,
  children,
}: {
  className?: string;
  order?: number;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 text-left ${className}`} style={{ order }}>
      {children}
    </div>
  );
}

function PartnerInlineRow({
  partner,
  columnOrder,
  milestoneTitleById,
  milestoneSlugById,
  roster,
  canManage,
  today,
  expanded,
  activeEditorKey,
  onToggleExpand,
  onRequestInlineEdit,
  onFinishInlineEdit,
  onPatch,
  onCreateSample,
}: {
  partner: SxManagementPartner;
  columnOrder: readonly PartnerLedgerColumnKey[];
  milestoneTitleById: ReadonlyMap<string, string>;
  milestoneSlugById: ReadonlyMap<string, string>;
  roster: PartnerOwnerRosterControls;
  canManage: boolean;
  today: string;
  expanded: boolean;
  activeEditorKey: string | null;
  onToggleExpand: (partnerId: string) => void;
  onRequestInlineEdit: (editorKey: string) => boolean;
  onFinishInlineEdit: () => void;
  onPatch: (request: PartnerInlinePatch) => Promise<void>;
  onCreateSample: (partnerId: string, label: string) => Promise<void>;
}) {
  const display = sxPartnerDisplay(partner);
  const steps = buildPartnerProgressSteps(partner);
  const goalStep = steps.find((step) => step.phase === "goal");
  const latest = sxLatestInteraction(partner.interactions);
  const holdings = sxHoldingsForPartner(partner);
  const intervention = sxPartnerPrimaryIntervention(partner, today);
  const target = primaryInterventionTarget(partner, intervention);
  /** セルの並び順。関係先は必ず先頭、以降は見出しドラッグで決めた順に従う。 */
  const cellOrder = (key: PartnerLedgerColumnKey) => {
    if (key === "name") return 0;
    const index = columnOrder.indexOf(key);
    return index < 0 ? columnOrder.length + 1 : index + 1;
  };
  const actionText = sxCompactPartnerRowText(
    nominalizeSxNextActionLabel(sxNormalizePublicName(intervention.title)),
    display.name,
  );
  const latestSummary = latest
    ? sxCompactPartnerRowText(
        sxNormalizePublicName(latest.outcomeSummary || latest.summary),
        display.name,
      )
    : "保存済み履歴なし";
  const nameHeadingId = `sx-partner-name-${partner.id}`;
  const keyFor = (field: string) => `${partner.id}:${field}`;
  const targetOwner =
    target?.resource === "partner_work_item"
      ? target.record.ownerLabel || ""
      : target?.resource === "commitment"
        ? target.record.commitmentKind === "counterparty_promise"
          ? target.record.counterpartyOwner || ""
          : target.record.sxOwner || ""
        : target?.resource === "partner"
          ? target.record.ownerLabel || ""
          : "";
  const targetSide =
    target?.resource === "partner_work_item"
      ? target.record.side
      : target?.resource === "partner"
        ? target.record.currentBallSide
        : intervention.side;
  const targetDueDate =
    target?.resource === "partner_work_item"
      ? target.record.dueDate
      : target?.resource === "commitment"
        ? target.record.dueDate
        : target?.resource === "partner"
          ? target.record.dueDate
          : null;
  const targetDuePrecision =
    target?.resource === "partner_work_item"
      ? target.record.dueDatePrecision
      : target?.resource === "partner"
        ? target.record.dueDatePrecision
        : targetDueDate
          ? "day"
          : "unknown";
  const ownershipOwnerText =
    target?.resource === "partner"
      ? targetOwner.trim()
        ? sxNormalizePublicName(targetOwner)
        : "担当未確認"
      : interventionOwnerText(intervention, display.name);
  const patchIfChanged = async (
    resource: PartnerInlineResource,
    id: string,
    previous: Record<string, unknown>,
    next: Record<string, unknown>,
  ) => {
    const patch = changedPatch(previous, next);
    if (Object.keys(patch).length === 0) return;
    await onPatch({ resource, id, patch });
  };

  // 評価は社名と同じセルに混ぜず、行の一番左に独立カラムとして立てる (2026-08-06 まさ)。
  // 未評価は空欄にせず「未」と出し、判断がまだ入っていない行だと分かるようにする。
  const priorityTier = sxPocPriorityTier(partner);
  const gradeView = (
    <span
      className={`grid min-h-11 w-full place-items-center border text-[15px] font-semibold leading-none ${GRADE_TONE[priorityTier]}`}
      data-poc-priority-tier={priorityTier}
      title={sxPocPriorityTierDescription(priorityTier)}
    >
      {sxPocPriorityTierLabel(priorityTier)}
    </span>
  );
  const relationNameView = (
    <span
      id={nameHeadingId}
      className="whitespace-normal [overflow-wrap:anywhere] text-[12px] font-semibold leading-4 text-[#24231f]"
    >
      {display.name}
    </span>
  );
  const effluentView = (
    <span className="grid min-h-11 min-w-0 content-center gap-0.5">
      <span
        className="[overflow-wrap:anywhere] text-[10px] font-semibold leading-4 text-[#24231f]"
        title={partner.effluentComponents || "成分 未確認"}
      >
        {partner.effluentComponents || "成分 未確認"}
      </span>
      <span className="[overflow-wrap:anywhere] text-[10px] leading-4 text-[#5a574c]">
        年間 {partner.effluentVolumeAnnual || "量未確認"} ・ 処理費{" "}
        {partner.effluentCostAnnual || "未確認"}
      </span>
    </span>
  );
  // 次回面談。日付が入っていない間も「未定」と出して、書き込む場所があることを見せる。
  const nextMeetingDateText = partner.nextMeetingOn
    ? `${sxFormatDate(partner.nextMeetingOn)}${partner.nextMeetingTime ? ` ${partner.nextMeetingTime}` : ""}`
    : "日程 未定";
  const nextMeetingModeText = partner.nextMeetingMode
    ? SX_MEETING_MODE_LABEL[partner.nextMeetingMode]
    : "形式 未定";
  const nextMeetingSubText = [
    nextMeetingModeText,
    partner.nextMeetingPlace,
    partner.nextMeetingPrep ? `準備 ${partner.nextMeetingPrep}` : null,
  ]
    .filter(Boolean)
    .join(" ・ ");
  const nextMeetingView = (
    <span className="grid min-h-11 min-w-0 content-center gap-0.5">
      <span
        className={`[overflow-wrap:anywhere] text-[10px] font-semibold leading-4 ${partner.nextMeetingOn ? "text-[#24231f]" : "text-[#5a574c]"}`}
        title={nextMeetingDateText}
      >
        {nextMeetingDateText}
      </span>
      {/* 着地点はその面談で何を取りに行くかなので、形式や準備物より上へ出す (2026-08-07 まさ)。 */}
      <span
        className={`[overflow-wrap:anywhere] text-[10px] leading-4 ${partner.nextMeetingGoal ? "font-semibold text-[#315f7d]" : "text-[#857b69]"}`}
        title={
          partner.nextMeetingGoal
            ? `着地点 ${partner.nextMeetingGoal}`
            : "着地点 未記入"
        }
      >
        着地点 {partner.nextMeetingGoal || "未記入"}
      </span>
      <span
        className="[overflow-wrap:anywhere] text-[10px] leading-4 text-[#5a574c]"
        title={nextMeetingSubText}
      >
        {nextMeetingSubText}
      </span>
    </span>
  );
  const connectionOriginView = (
    <span className="grid min-h-11 min-w-0 content-center gap-0.5">
      <span
        className="[overflow-wrap:anywhere] text-[10px] font-semibold leading-4 text-[#24231f]"
        title={partner.connectionContext || "経緯 未登録"}
      >
        {partner.connectionContext || "経緯 未登録"}
      </span>
      <span
        className="[overflow-wrap:anywhere] text-[10px] leading-4 text-[#5a574c]"
        title={partner.introducerLabel || "紹介者 未確認"}
      >
        紹介者 {partner.introducerLabel || "未確認"}
      </span>
    </span>
  );
  const currentView = (
    <span className="grid min-h-11 w-full min-w-0 grid-cols-[60px_minmax(0,1fr)] items-stretch">
      <span className="grid min-w-0 grid-rows-[14px_minmax(30px,auto)] border-r border-[#d5cdba]">
        <span className="px-1 pt-0.5 text-[10px] font-semibold leading-3 text-[#5a574c]">
          保有側
        </span>
        <span className="[overflow-wrap:anywhere] px-1 pb-1 text-[11px] font-semibold leading-4 text-[#24231f]">
          {sxBallSideLabel(partner.currentBallSide)}
        </span>
      </span>
      <span className="grid min-w-0 grid-rows-[14px_minmax(30px,auto)]">
        <span className="px-1 pt-0.5 text-[10px] font-semibold leading-3 text-[#5a574c]">
          担当
        </span>
        <span
          className="[overflow-wrap:anywhere] px-1 pb-1 text-[11px] font-semibold leading-4 text-[#24231f]"
          title={
            partner.currentBallOwner
              ? sxNormalizePublicName(partner.currentBallOwner)
              : "担当未確認"
          }
        >
          {partner.currentBallOwner
            ? sxNormalizePublicName(partner.currentBallOwner)
            : "担当未確認"}
        </span>
      </span>
    </span>
  );
  const goalView = (
    <p
      className="[overflow-wrap:anywhere] text-[11px] font-semibold leading-4 text-[#24231f]"
      title={goalStep?.title}
    >
      {goalStep?.title ?? "目標状態 未登録"}
    </p>
  );

  return (
    <article
      id={`sx-partner-${partner.id}`}
      data-sx-anchor={`sx-partner-${partner.id}`}
      data-testid={`sx-partner-comparison-row-${partner.id}`}
      aria-labelledby={nameHeadingId}
      className="scroll-mt-24 border-b border-[#d5cdba] bg-[#fffdf7]"
    >
      <div
        className={`grid w-full grid-cols-[34px_minmax(0,1fr)] items-stretch gap-2 px-2 py-1.5 text-left sm:grid-cols-[34px_minmax(0,1fr)_72px] ${PARTNER_CONTROL_ROW_GRID}`}
        data-partner-row-density="compact"
      >
        <div
          className={`min-w-0 self-stretch bg-[#fffdf7] ${PARTNER_LEDGER_STICKY_LEFT}`}
          data-partner-grade-cell={partner.id}
        >
          {canManage ? (
            <InlineCellEditor
              editorKey={keyFor("poc-grade")}
              activeEditorKey={activeEditorKey}
              label={`${display.name}の評価`}
              initialValues={{ poc_grade: partner.pocGrade || "" }}
              view={gradeView}
              align="start"
              onRequestEdit={onRequestInlineEdit}
              onFinish={onFinishInlineEdit}
              onSave={async (values) =>
                patchIfChanged(
                  "partner",
                  partner.id,
                  { poc_grade: partner.pocGrade },
                  { poc_grade: values.poc_grade || null },
                )
              }
              renderFields={(values, setValue) => (
                <label className="grid gap-0.5">
                  <span className="text-[10px] font-semibold text-[#5a574c]">
                    顧客としての見込み
                  </span>
                  <select
                    autoFocus
                    className={INLINE_CONTROL_CLASS}
                    value={values.poc_grade}
                    onChange={(event) =>
                      setValue("poc_grade", event.target.value)
                    }
                  >
                    {SX_POC_GRADE_CHOICES.map((tier) => (
                      <option key={tier} value={tier === "unrated" ? "" : tier}>
                        {sxPocPriorityTierLabel(tier)} ・{" "}
                        {sxPocPriorityTierDescription(tier)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            />
          ) : (
            gradeView
          )}
        </div>
        <div
          className={`grid min-w-0 grid-cols-1 gap-x-2 gap-y-1.5 md:grid-cols-2 ${PARTNER_CONTROL_INNER_GRID}`}
        >
          {/* 関係先の列。上から 関係先名 → 最終確認 → 進行項目レール の縦積み
              (2026-08-07 まさ)。横に 68px の別列で並べていたレールを名前の下へ入れ、
              1社の識別に必要なものだけがこの固定列に収まるようにした。 */}
          <div
            className={`flex min-w-0 flex-col justify-center gap-1 self-stretch bg-[#fffdf7] md:col-span-2 @min-[1248px]:col-span-1 ${PARTNER_LEDGER_STICKY_NAME}`}
            style={{ order: 0 }}
            data-partner-name-cell={partner.id}
          >
            <div className="flex min-w-0 flex-col justify-center border-b border-dashed border-[#857b69]">
              {canManage ? (
                <InlinePartnerNameEditor
                  editorKey={keyFor("name")}
                  activeEditorKey={activeEditorKey}
                  inputId={nameHeadingId}
                  label={`${display.name}の関係先名`}
                  value={partner.name}
                  view={relationNameView}
                  onRequestEdit={onRequestInlineEdit}
                  onFinish={onFinishInlineEdit}
                  onSave={async (name) => {
                    await patchIfChanged(
                      "partner",
                      partner.id,
                      { name: partner.name },
                      { name },
                    );
                  }}
                />
              ) : (
                relationNameView
              )}
              <span className="text-[10px] font-normal leading-3 text-[#5a574c]">
                最終確認 {sxFormatDate(partner.lastVerifiedAt)}
              </span>
            </div>
            <div className="min-w-0">
              <PartnerStageRail
                partnerId={partner.id}
                onHold={sxPartnerIsOnHold(partner)}
                currentBallSide={partner.currentBallSide}
                steps={steps}
                onOpen={() => onToggleExpand(partner.id)}
                expanded={expanded}
              />
            </div>
          </div>

          <PartnerRowCell
            order={cellOrder("current")}
            className="md:col-span-2 @min-[1248px]:col-span-1"
          >
            <p className="text-[10px] font-semibold text-[#5a574c] @min-[1248px]:hidden">
              現在の状況
            </p>
            <div className="min-h-11" data-current-situation-cell={partner.id}>
              {partner.pocCategory &&
                (canManage ? (
                  <InlinePocFacetEditor
                    editorKey={keyFor("poc-facets")}
                    activeEditorKey={activeEditorKey}
                    label={`${display.name}のPoC営業状態`}
                    partner={partner}
                    onRequestEdit={onRequestInlineEdit}
                    onFinish={onFinishInlineEdit}
                    onSave={async (values) => {
                      await patchIfChanged(
                        "partner",
                        partner.id,
                        {
                          relationship_stage: partner.relationshipStage,
                          activity_state: partner.activityState,
                          confidence: partner.confidence,
                          poc_category: partner.pocCategory,
                          poc_likelihood: partner.pocLikelihood,
                          customer_value: partner.customerValue,
                          value_note: partner.valueNote,
                        },
                        {
                          relationship_stage: values.stage,
                          activity_state: values.activity,
                          confidence: values.confidence,
                          poc_category: values.category || null,
                          poc_likelihood: values.likelihood || null,
                          customer_value: values.value || null,
                          value_note: values.note.trim() || null,
                        },
                      );
                    }}
                  />
                ) : (
                  pocFacetChipsView(partner)
                ))}
              {canManage ? (
                <InlineCurrentBallEditor
                  editorKey={keyFor("current")}
                  activeEditorKey={activeEditorKey}
                  label={`${display.name}の現在の状況`}
                  side={partner.currentBallSide}
                  owner={partner.currentBallOwner || ""}
                  options={INLINE_BALL_SIDE_OPTIONS}
                  roster={roster}
                  view={currentView}
                  onRequestEdit={onRequestInlineEdit}
                  onFinish={onFinishInlineEdit}
                  onSave={async (values) =>
                    patchIfChanged(
                      "partner",
                      partner.id,
                      {
                        current_ball_side: partner.currentBallSide,
                        current_ball_owner: partner.currentBallOwner,
                      },
                      {
                        current_ball_side: values.side,
                        current_ball_owner: values.owner.trim() || null,
                      },
                    )
                  }
                />
              ) : (
                <div className="flex min-h-11 items-center">{currentView}</div>
              )}
            </div>
          </PartnerRowCell>

          <PartnerRowCell
            order={cellOrder("goal")}
            className="md:col-span-2 @min-[1248px]:col-span-1"
          >
            <p className="text-[10px] font-semibold text-[#5a574c] @min-[1248px]:hidden">
              ゴール
            </p>
            {canManage ? (
              <InlineCellEditor
                editorKey={keyFor("goal")}
                activeEditorKey={activeEditorKey}
                label={`${display.name}のゴール`}
                initialValues={{ target_state: partner.targetState || "" }}
                view={goalView}
                onRequestEdit={onRequestInlineEdit}
                onFinish={onFinishInlineEdit}
                onSave={async (values) =>
                  patchIfChanged(
                    "partner",
                    partner.id,
                    { target_state: partner.targetState },
                    { target_state: values.target_state.trim() || null },
                  )
                }
                renderFields={(values, setValue) => (
                  <label className="grid gap-0.5">
                    <span className="text-[10px] font-semibold text-[#5a574c]">
                      ゴール
                    </span>
                    <textarea
                      autoFocus
                      rows={2}
                      className={`${INLINE_CONTROL_CLASS} py-1.5 leading-4`}
                      value={values.target_state}
                      onChange={(event) =>
                        setValue("target_state", event.target.value)
                      }
                    />
                  </label>
                )}
              />
            ) : (
              goalView
            )}
          </PartnerRowCell>

          {/* 「詰まり・PJ影響」列は 2026-08-07 に削除 (まさ「あまり意味がないと思うので」)。
              詰まりの度合いは各行の期限表示と進行項目レールから読めるので、専用列は縦横を
              食うだけだった。工程との接続は保有事項の詳細モーダル側に残っている。 */}

          <PartnerRowCell order={cellOrder("action")}>
            <p className="text-[10px] font-semibold text-[#5a574c] @min-[1248px]:hidden">
              次にやること
            </p>
            {canManage && target ? (
              <InlineCellEditor
                editorKey={keyFor("action")}
                activeEditorKey={activeEditorKey}
                label={`${display.name}の次にやること`}
                initialValues={{
                  title:
                    target.resource === "partner"
                      ? target.record.nextCommitment
                      : target.record.title,
                  status:
                    target.resource === "partner" ? "" : target.record.status,
                }}
                view={
                  <>
                    <p
                      className="[overflow-wrap:anywhere] text-[11px] font-semibold leading-4 text-[#24231f]"
                      title={actionText}
                    >
                      {actionText}
                    </p>
                    <p className="mt-1 text-[10px] text-[#5a574c]">
                      {interventionStatusLabel(intervention)}
                      {holdings.length > 1
                        ? ` ・ ほか${holdings.length - 1}件`
                        : ""}
                    </p>
                  </>
                }
                onRequestEdit={onRequestInlineEdit}
                onFinish={onFinishInlineEdit}
                onSave={async (values) => {
                  const title = values.title.trim();
                  if (!title) throw new Error("次にやることを入力してね");
                  if (target.resource === "partner_work_item") {
                    await patchIfChanged(
                      "partner_work_item",
                      target.id,
                      {
                        title: target.record.title,
                        status: target.record.status,
                      },
                      { title, status: values.status },
                    );
                    return;
                  }
                  if (target.resource === "commitment") {
                    await patchIfChanged(
                      "commitment",
                      target.id,
                      {
                        title: target.record.title,
                        status: target.record.status,
                      },
                      { title, status: values.status },
                    );
                    return;
                  }
                  await patchIfChanged(
                    "partner",
                    target.id,
                    { next_commitment: target.record.nextCommitment },
                    { next_commitment: title },
                  );
                }}
                renderFields={(values, setValue) => (
                  <>
                    <label className="grid gap-0.5">
                      <span className="text-[10px] font-semibold text-[#5a574c]">
                        次にやること
                      </span>
                      <textarea
                        autoFocus
                        rows={2}
                        className={`${INLINE_CONTROL_CLASS} py-1.5 leading-4`}
                        value={values.title}
                        onChange={(event) =>
                          setValue("title", event.target.value)
                        }
                      />
                    </label>
                    {target.resource !== "partner" && (
                      <label className="grid gap-0.5">
                        <span className="text-[10px] font-semibold text-[#5a574c]">
                          状態
                        </span>
                        <select
                          className={INLINE_CONTROL_CLASS}
                          value={values.status}
                          onChange={(event) =>
                            setValue("status", event.target.value)
                          }
                        >
                          {(target.resource === "commitment"
                            ? INLINE_COMMITMENT_STATUS_OPTIONS
                            : INLINE_WORK_STATUS_OPTIONS
                          ).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </>
                )}
              />
            ) : (
              <>
                <p
                  className="[overflow-wrap:anywhere] text-[11px] font-semibold leading-4 text-[#24231f]"
                  title={actionText}
                >
                  {actionText}
                </p>
                <p className="mt-1 text-[10px] text-[#5a574c]">
                  {interventionStatusLabel(intervention)}
                  {holdings.length > 1
                    ? ` ・ ほか${holdings.length - 1}件`
                    : ""}
                </p>
              </>
            )}
          </PartnerRowCell>

          <PartnerRowCell order={cellOrder("meeting")}>
            <p className="text-[10px] font-semibold text-[#5a574c] @min-[1248px]:hidden">
              次回面談
            </p>
            {canManage ? (
              <InlineCellEditor
                editorKey={keyFor("next-meeting")}
                activeEditorKey={activeEditorKey}
                label={`${display.name}の次回面談`}
                initialValues={{
                  next_meeting_on: partner.nextMeetingOn || "",
                  next_meeting_time: partner.nextMeetingTime || "",
                  next_meeting_mode: partner.nextMeetingMode || "",
                  next_meeting_place: partner.nextMeetingPlace || "",
                  next_meeting_goal: partner.nextMeetingGoal || "",
                  next_meeting_prep: partner.nextMeetingPrep || "",
                }}
                view={nextMeetingView}
                onRequestEdit={onRequestInlineEdit}
                onFinish={onFinishInlineEdit}
                onSave={async (values) =>
                  patchIfChanged(
                    "partner",
                    partner.id,
                    {
                      next_meeting_on: partner.nextMeetingOn,
                      next_meeting_time: partner.nextMeetingTime,
                      next_meeting_mode: partner.nextMeetingMode,
                      next_meeting_place: partner.nextMeetingPlace,
                      next_meeting_goal: partner.nextMeetingGoal,
                      next_meeting_prep: partner.nextMeetingPrep,
                    },
                    {
                      next_meeting_on: values.next_meeting_on || null,
                      next_meeting_time:
                        values.next_meeting_time.trim() || null,
                      next_meeting_mode: values.next_meeting_mode || null,
                      next_meeting_place:
                        values.next_meeting_place.trim() || null,
                      next_meeting_goal:
                        values.next_meeting_goal.trim() || null,
                      next_meeting_prep:
                        values.next_meeting_prep.trim() || null,
                    },
                  )
                }
                renderFields={(values, setValue) => (
                  <>
                    <label className="grid gap-0.5">
                      <span className="text-[10px] font-semibold text-[#5a574c]">
                        日付
                      </span>
                      <input
                        autoFocus
                        type="date"
                        className={INLINE_CONTROL_CLASS}
                        value={values.next_meeting_on}
                        onChange={(event) =>
                          setValue("next_meeting_on", event.target.value)
                        }
                      />
                    </label>
                    <label className="grid gap-0.5">
                      <span className="text-[10px] font-semibold text-[#5a574c]">
                        時刻
                      </span>
                      <input
                        className={INLINE_CONTROL_CLASS}
                        placeholder="例: 14:00 / 午後"
                        value={values.next_meeting_time}
                        onChange={(event) =>
                          setValue("next_meeting_time", event.target.value)
                        }
                      />
                    </label>
                    <label className="grid gap-0.5">
                      <span className="text-[10px] font-semibold text-[#5a574c]">
                        形式
                      </span>
                      <select
                        className={INLINE_CONTROL_CLASS}
                        value={values.next_meeting_mode}
                        onChange={(event) =>
                          setValue("next_meeting_mode", event.target.value)
                        }
                      >
                        <option value="">未定</option>
                        {SX_MEETING_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {SX_MEETING_MODE_LABEL[mode]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-0.5">
                      <span className="text-[10px] font-semibold text-[#5a574c]">
                        場所・接続先
                      </span>
                      <input
                        className={INLINE_CONTROL_CLASS}
                        placeholder="例: 新居浜本社工場 / Teams"
                        value={values.next_meeting_place}
                        onChange={(event) =>
                          setValue("next_meeting_place", event.target.value)
                        }
                      />
                    </label>
                    <label className="grid gap-0.5">
                      <span className="text-[10px] font-semibold text-[#5a574c]">
                        着地点 (この面談で何を得るか)
                      </span>
                      <textarea
                        rows={2}
                        className={`${INLINE_CONTROL_CLASS} py-1.5 leading-4`}
                        placeholder="例: 排液の年間量と処理コストの実数を口頭で確認する"
                        value={values.next_meeting_goal}
                        onChange={(event) =>
                          setValue("next_meeting_goal", event.target.value)
                        }
                      />
                    </label>
                    <label className="grid gap-0.5">
                      <span className="text-[10px] font-semibold text-[#5a574c]">
                        準備すべきもの
                      </span>
                      <textarea
                        rows={2}
                        className={`${INLINE_CONTROL_CLASS} py-1.5 leading-4`}
                        placeholder="例: 試料採取容器・実証計画案・NDA案"
                        value={values.next_meeting_prep}
                        onChange={(event) =>
                          setValue("next_meeting_prep", event.target.value)
                        }
                      />
                    </label>
                  </>
                )}
              />
            ) : (
              nextMeetingView
            )}
          </PartnerRowCell>

          <PartnerRowCell order={cellOrder("owner")}>
            <p className="text-[10px] font-semibold text-[#5a574c] @min-[1248px]:hidden">
              担当・期限
            </p>
            {canManage && target ? (
              <InlineCellEditor
                editorKey={keyFor("ownership")}
                activeEditorKey={activeEditorKey}
                label={`${display.name}の担当と期限`}
                initialValues={{
                  owner: targetOwner,
                  side: targetSide,
                  due_date: targetDueDate || "",
                  due_date_precision: targetDuePrecision,
                }}
                view={
                  <>
                    <p
                      className="[overflow-wrap:anywhere] text-[11px] font-semibold text-[#24231f]"
                      title={ownershipOwnerText}
                    >
                      {ownershipOwnerText}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {target.resource === "partner_work_item" && (
                        <span
                          className={`border px-1.5 py-0.5 text-[10px] font-semibold ${BALL_SIDE_TONE[intervention.side]}`}
                        >
                          {interventionSideText(intervention)}
                        </span>
                      )}
                      <span
                        className={`text-[10px] ${intervention.risk === "overdue" ? "font-semibold text-[#8c3329]" : "text-[#5a574c]"}`}
                      >
                        {sxFormatDueDateWithPrecision(
                          intervention.dueDate,
                          intervention.dueDatePrecision,
                        )}
                      </span>
                    </div>
                  </>
                }
                onRequestEdit={onRequestInlineEdit}
                onFinish={onFinishInlineEdit}
                onSave={async (values) => {
                  if (target.resource === "partner_work_item") {
                    const dueDate =
                      values.due_date_precision === "unknown"
                        ? null
                        : values.due_date || null;
                    await patchIfChanged(
                      "partner_work_item",
                      target.id,
                      {
                        owner_label: target.record.ownerLabel,
                        side: target.record.side,
                        due_date: target.record.dueDate,
                        due_date_precision: target.record.dueDatePrecision,
                      },
                      {
                        owner_label: values.owner.trim() || null,
                        side: values.side,
                        due_date: dueDate,
                        due_date_precision: values.due_date_precision,
                      },
                    );
                    return;
                  }
                  if (target.resource === "commitment") {
                    const ownerField =
                      target.record.commitmentKind === "counterparty_promise"
                        ? "counterparty_owner"
                        : "sx_owner";
                    const previousOwner =
                      target.record.commitmentKind === "counterparty_promise"
                        ? target.record.counterpartyOwner
                        : target.record.sxOwner;
                    await patchIfChanged(
                      "commitment",
                      target.id,
                      {
                        [ownerField]: previousOwner,
                        due_date: target.record.dueDate,
                      },
                      {
                        [ownerField]: values.owner.trim() || null,
                        due_date: values.due_date || null,
                      },
                    );
                    return;
                  }
                  const dueDate =
                    values.due_date_precision === "unknown"
                      ? null
                      : values.due_date || null;
                  await patchIfChanged(
                    "partner",
                    target.id,
                    {
                      owner_label: target.record.ownerLabel,
                      due_date: target.record.dueDate,
                      due_date_precision: target.record.dueDatePrecision,
                    },
                    {
                      owner_label: values.owner.trim() || "担当未確認",
                      due_date: dueDate,
                      due_date_precision: values.due_date_precision,
                    },
                  );
                }}
                renderFields={(values, setValue) => (
                  <>
                    {/* 担当は名簿から選ぶ (2026-08-07 まさ)。 */}
                    <div className="grid gap-0.5">
                      <span className="text-[10px] font-semibold text-[#5a574c]">
                        担当
                      </span>
                      <OwnerSelectControl
                        autoFocus
                        value={values.owner}
                        ariaLabel="担当"
                        className={INLINE_CONTROL_CLASS}
                        roster={roster}
                        onChange={(next) => setValue("owner", next)}
                      />
                    </div>
                    {target.resource === "partner_work_item" && (
                      <label className="grid gap-0.5">
                        <span className="text-[10px] font-semibold text-[#5a574c]">
                          保有側
                        </span>
                        <select
                          className={INLINE_CONTROL_CLASS}
                          value={values.side}
                          onChange={(event) =>
                            setValue("side", event.target.value)
                          }
                        >
                          {INLINE_HOLDING_SIDE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <InlineDueFields
                      values={values}
                      setValue={setValue}
                      precision={target.resource !== "commitment"}
                    />
                  </>
                )}
              />
            ) : (
              <>
                <p
                  className="[overflow-wrap:anywhere] text-[11px] font-semibold text-[#24231f]"
                  title={ownershipOwnerText}
                >
                  {ownershipOwnerText}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {target?.resource === "partner_work_item" && (
                    <span
                      className={`border px-1.5 py-0.5 text-[10px] font-semibold ${BALL_SIDE_TONE[intervention.side]}`}
                    >
                      {interventionSideText(intervention)}
                    </span>
                  )}
                  <span
                    className={`text-[10px] ${intervention.risk === "overdue" ? "font-semibold text-[#8c3329]" : "text-[#5a574c]"}`}
                  >
                    {sxFormatDueDateWithPrecision(
                      intervention.dueDate,
                      intervention.dueDatePrecision,
                    )}
                  </span>
                </div>
              </>
            )}
          </PartnerRowCell>

          <PartnerRowCell
            order={cellOrder("basis")}
            className="md:col-span-2 @min-[1248px]:col-span-1"
          >
            <p className="text-[10px] font-semibold text-[#5a574c] @min-[1248px]:hidden">
              現在地の根拠
            </p>
            {latest && canManage ? (
              <InlineCellEditor
                editorKey={keyFor("latest-interaction")}
                activeEditorKey={activeEditorKey}
                label={`${display.name}の現在地の根拠`}
                initialValues={{
                  occurred_on: latest.occurredOn || "",
                  occurred_on_precision: latest.occurredOnPrecision,
                  interaction_kind: latest.interactionKind,
                  summary: latest.summary,
                  outcome_summary: latest.outcomeSummary || "",
                }}
                view={
                  <>
                    <p className="text-[10px] text-[#5a574c]">
                      {sxFormatEventDateWithPrecision(
                        latest.occurredOn,
                        latest.occurredOnPrecision,
                      )}{" "}
                      ・ {sxInteractionKindLabel(latest.interactionKind)}
                    </p>
                    <p
                      className="mt-0.5 [overflow-wrap:anywhere] text-[10px] leading-4 text-[#24231f]"
                      title={latestSummary}
                    >
                      {latestSummary}
                    </p>
                  </>
                }
                onRequestEdit={onRequestInlineEdit}
                onFinish={onFinishInlineEdit}
                onSave={async (values) => {
                  const occurredOn =
                    values.occurred_on_precision === "unknown"
                      ? null
                      : values.occurred_on || null;
                  const summary = values.summary.trim();
                  if (!summary) throw new Error("接点の内容を入力してね");
                  await patchIfChanged(
                    "interaction",
                    latest.id,
                    {
                      occurred_on: latest.occurredOn,
                      occurred_on_precision: latest.occurredOnPrecision,
                      interaction_kind: latest.interactionKind,
                      summary: latest.summary,
                      outcome_summary: latest.outcomeSummary,
                    },
                    {
                      occurred_on: occurredOn,
                      occurred_on_precision: values.occurred_on_precision,
                      interaction_kind: values.interaction_kind,
                      summary,
                      outcome_summary: values.outcome_summary.trim() || null,
                    },
                  );
                }}
                renderFields={(values, setValue) => {
                  const precision = values.occurred_on_precision;
                  return (
                    <>
                      <label className="grid gap-0.5">
                        <span className="text-[10px] font-semibold text-[#5a574c]">
                          接点種別
                        </span>
                        <select
                          autoFocus
                          className={INLINE_CONTROL_CLASS}
                          value={values.interaction_kind}
                          onChange={(event) =>
                            setValue("interaction_kind", event.target.value)
                          }
                        >
                          <option value="meeting">面談</option>
                          <option value="email">メール</option>
                          <option value="agreement">合意</option>
                          <option value="deliverable">成果物</option>
                          <option value="handoff">引き継ぎ</option>
                          <option value="status_update">状況更新</option>
                          <option value="note">メモ</option>
                        </select>
                      </label>
                      <label className="grid gap-0.5">
                        <span className="text-[10px] font-semibold text-[#5a574c]">
                          発生日の精度
                        </span>
                        <select
                          className={INLINE_CONTROL_CLASS}
                          value={precision}
                          onChange={(event) => {
                            setValue(
                              "occurred_on_precision",
                              event.target.value,
                            );
                            if (event.target.value === "unknown")
                              setValue("occurred_on", "");
                          }}
                        >
                          {INLINE_DATE_PRECISION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {precision !== "unknown" && (
                        <label className="grid gap-0.5">
                          <span className="text-[10px] font-semibold text-[#5a574c]">
                            発生日
                          </span>
                          <input
                            className={INLINE_CONTROL_CLASS}
                            type={precision === "month" ? "month" : "date"}
                            value={
                              precision === "month"
                                ? values.occurred_on.slice(0, 7)
                                : values.occurred_on
                            }
                            onChange={(event) =>
                              setValue(
                                "occurred_on",
                                precision === "month" && event.target.value
                                  ? `${event.target.value}-01`
                                  : event.target.value,
                              )
                            }
                          />
                        </label>
                      )}
                      <label className="grid gap-0.5">
                        <span className="text-[10px] font-semibold text-[#5a574c]">
                          内容
                        </span>
                        <textarea
                          rows={2}
                          className={`${INLINE_CONTROL_CLASS} py-1.5 leading-4`}
                          value={values.summary}
                          onChange={(event) =>
                            setValue("summary", event.target.value)
                          }
                        />
                      </label>
                      <label className="grid gap-0.5">
                        <span className="text-[10px] font-semibold text-[#5a574c]">
                          結果・要点
                        </span>
                        <textarea
                          rows={2}
                          className={`${INLINE_CONTROL_CLASS} py-1.5 leading-4`}
                          value={values.outcome_summary}
                          onChange={(event) =>
                            setValue("outcome_summary", event.target.value)
                          }
                        />
                      </label>
                    </>
                  );
                }}
              />
            ) : latest ? (
              <>
                <p className="text-[10px] text-[#5a574c]">
                  {sxFormatEventDateWithPrecision(
                    latest.occurredOn,
                    latest.occurredOnPrecision,
                  )}{" "}
                  ・ {sxInteractionKindLabel(latest.interactionKind)}
                </p>
                <p
                  className="mt-0.5 [overflow-wrap:anywhere] text-[10px] leading-4 text-[#24231f]"
                  title={latestSummary}
                >
                  {latestSummary}
                </p>
              </>
            ) : (
              <p className="text-[10px] leading-4 text-[#5f4a66]">
                保存済み履歴なし
              </p>
            )}
            <p
              className={`mt-0.5 text-[10px] ${sxPartnerNeedsRefresh(partner, today) ? "font-semibold text-[#765022]" : "text-[#5a574c]"}`}
            >
              最終確認 {sxFormatDate(partner.lastVerifiedAt)}
            </p>
          </PartnerRowCell>

          <PartnerRowCell
            order={cellOrder("effluent")}
            className="md:col-span-2 @min-[1248px]:col-span-1"
          >
            <p className="text-[10px] font-semibold text-[#5a574c] @min-[1248px]:hidden">
              排液
            </p>
            {canManage ? (
              <InlineCellEditor
                editorKey={keyFor("effluent")}
                activeEditorKey={activeEditorKey}
                label={`${display.name}の排液`}
                initialValues={{
                  effluent_components: partner.effluentComponents || "",
                  effluent_volume_annual: partner.effluentVolumeAnnual || "",
                  effluent_cost_annual: partner.effluentCostAnnual || "",
                }}
                view={effluentView}
                onRequestEdit={onRequestInlineEdit}
                onFinish={onFinishInlineEdit}
                onSave={async (values) =>
                  patchIfChanged(
                    "partner",
                    partner.id,
                    {
                      effluent_components: partner.effluentComponents,
                      effluent_volume_annual: partner.effluentVolumeAnnual,
                      effluent_cost_annual: partner.effluentCostAnnual,
                    },
                    {
                      effluent_components:
                        values.effluent_components.trim() || null,
                      effluent_volume_annual:
                        values.effluent_volume_annual.trim() || null,
                      effluent_cost_annual:
                        values.effluent_cost_annual.trim() || null,
                    },
                  )
                }
                renderFields={(values, setValue) => (
                  <>
                    <label className="grid gap-0.5">
                      <span className="text-[10px] font-semibold text-[#5a574c]">
                        排液中の成分
                      </span>
                      <textarea
                        autoFocus
                        rows={2}
                        className={`${INLINE_CONTROL_CLASS} py-1.5 leading-4`}
                        value={values.effluent_components}
                        onChange={(event) =>
                          setValue("effluent_components", event.target.value)
                        }
                      />
                    </label>
                    <label className="grid gap-0.5">
                      <span className="text-[10px] font-semibold text-[#5a574c]">
                        年間の排液量
                      </span>
                      <input
                        className={INLINE_CONTROL_CLASS}
                        placeholder="例: 約3,600 t/年"
                        value={values.effluent_volume_annual}
                        onChange={(event) =>
                          setValue("effluent_volume_annual", event.target.value)
                        }
                      />
                    </label>
                    <label className="grid gap-0.5">
                      <span className="text-[10px] font-semibold text-[#5a574c]">
                        年間の排液処理コスト
                      </span>
                      <input
                        className={INLINE_CONTROL_CLASS}
                        placeholder="例: 約276万円/年"
                        value={values.effluent_cost_annual}
                        onChange={(event) =>
                          setValue("effluent_cost_annual", event.target.value)
                        }
                      />
                    </label>
                  </>
                )}
              />
            ) : (
              effluentView
            )}
          </PartnerRowCell>

          <PartnerRowCell
            order={cellOrder("origin")}
            className="md:col-span-2 @min-[1248px]:col-span-1"
          >
            <p className="text-[10px] font-semibold text-[#5a574c] @min-[1248px]:hidden">
              接点の経緯
            </p>
            {canManage ? (
              <InlineConnectionOriginEditor
                editorKey={keyFor("connection-origin")}
                activeEditorKey={activeEditorKey}
                label={`${display.name}の接点の経緯`}
                context={partner.connectionContext || ""}
                introducer={partner.introducerLabel || ""}
                roster={roster}
                view={connectionOriginView}
                onRequestEdit={onRequestInlineEdit}
                onFinish={onFinishInlineEdit}
                onSave={async (values) => {
                  await patchIfChanged(
                    "partner",
                    partner.id,
                    {
                      connection_context: partner.connectionContext,
                      introducer_label: partner.introducerLabel,
                    },
                    {
                      connection_context: values.context || null,
                      introducer_label: values.introducer || null,
                    },
                  );
                }}
              />
            ) : (
              connectionOriginView
            )}
          </PartnerRowCell>
        </div>
        <span className="col-span-2 flex min-h-11 flex-col items-center justify-center self-stretch border border-[#a69b84] px-2 text-center text-[10px] font-semibold leading-4 text-[#315f7d] sm:col-span-1">
          <span>
            履歴 {partner.interactions.length}件 ・ 保有 {holdings.length}件
          </span>
          {partner.samples.length > 0 && (
            <span data-partner-sample-count={partner.id}>
              試料 {partner.samples.length}件
            </span>
          )}
        </span>
      </div>
      {expanded && (
        <PartnerProgressHistoryModal
          partner={partner}
          today={today}
          milestoneTitleById={milestoneTitleById}
          milestoneSlugById={milestoneSlugById}
          canManage={canManage}
          onPatchSample={onPatch}
          onCreateSample={onCreateSample}
          onClose={() => onToggleExpand(partner.id)}
        />
      )}
    </article>
  );
}

/** relationshipStage → nextCommitment(dueDate) pipeline. Initial display groups active partners by
 * primary role_kind x relationship_state (spec B: 共同開発先/共同開発候補先 etc. are always distinct
 * groups); CategoryNav remains an auxiliary chip filter on top. Deferred/low-priority institutions
 * stay in a separate trailing group with the same row UI (spec C: row全体opacityは禁止), never removed
 * from the ledger. */
export function SxPartnerPipeline({
  management,
  projectId,
  onManagementChange,
  onSyncNotice,
}: {
  management: SxManagementBundle;
  projectId: string;
  onManagementChange: (management: SxManagementBundle) => void;
  onSyncNotice?: (message: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeInlineEditorKey, setActiveInlineEditorKey] = useState<
    string | null
  >(null);
  const [activeRoleKind, setActiveRoleKind] =
    useState<SxPartnerRoleKind | null>(null);
  const [pocOnly, setPocOnly] = useState(true);
  const [vcOnly, setVcOnly] = useState(false);
  const [activePocQuickFilter, setActivePocQuickFilter] =
    useState<SxPocQuickFilter>("all");
  const [activePocCategory, setActivePocCategory] =
    useState<SxPocCategory | null>(null);
  const [activePocStage, setActivePocStage] = useState<SxPartnerStage | null>(
    null,
  );
  const [activeOwnerKey, setActiveOwnerKey] = useState<string | null>(null);
  // 既定は優先度順。上から順にアタックすれば良い並びを初期表示にする (2026-08-06 まさ指示)。
  const [comparisonSort, setComparisonSort] =
    useState<SxPocComparisonSort>("priority");
  const { widths, setWidth, commitWidths, resetWidths, isCustomized } =
    usePartnerLedgerColumnWidths();
  const { order, moveColumn, resetOrder, isOrderCustomized } =
    usePartnerLedgerColumnOrder();
  // 担当・紹介者に入れる名前の候補。表記ゆれを止めるため自由入力ではなく名簿から選ばせる。
  const roster = usePartnerOwnerRoster(management);
  // 見出しをつかんでいる列。ドラッグ中の見出しを薄くして、掴んだ対象を見失わないようにする。
  const [draggingColumn, setDraggingColumn] =
    useState<PartnerLedgerColumnKey | null>(null);
  // 見出し行は横スクロール枠の外に置き、body 側のスクロール量を転記して左右を揃える。
  // 枠の中へ入れると高さが固定され、セル編集のポップオーバーが切れてしまう。
  const ledgerHeaderRef = useRef<HTMLDivElement | null>(null);
  const syncLedgerHeaderScroll = (scrollLeft: number) => {
    const header = ledgerHeaderRef.current;
    if (header) header.scrollLeft = scrollLeft;
  };
  const patchInlineCell = (request: PartnerInlinePatch): Promise<void> => {
    // A ledger cell commits to the visible row immediately. It is especially important for
    // blur-save: waiting for the full management bundle made the row feel stuck and blocked the
    // next click even though the user had already finished editing.
    onManagementChange(
      sxApplyOptimisticManagementPatch(
        management,
        request.resource,
        request.id,
        request.patch,
      ),
    );
    void (async () => {
      try {
        const response = await fetch(
          `/api/project-workspace/${encodeURIComponent(projectId)}/management`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
          },
        );
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            typeof body.error === "string" ? body.error : "保存できなかったよ",
          );
        // Keep the local patch after acknowledgement. Replacing the complete bundle here could
        // erase a second cell edit made while this request was in flight; only a failed write
        // reconciles from the DB below.
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "保存できなかったよ";
        try {
          const latest = await fetch(
            `/api/project-workspace/${encodeURIComponent(projectId)}/management`,
            { headers: { "Cache-Control": "no-store" } },
          );
          const latestBody = await latest.json().catch(() => null);
          if (latest.ok && latestBody) {
            onManagementChange(latestBody as SxManagementBundle);
            onSyncNotice?.(`${message}。最新の内容に戻したよ`);
            return;
          }
        } catch {
          // The notice below leaves no ambiguity when reconciliation also failed.
        }
        onSyncNotice?.(
          `${message}。同期状況を確認できないから、画面を再読み込みしてね`,
        );
      }
    })();
    return Promise.resolve();
  };
  const createSample = async (partnerId: string, label: string) => {
    const response = await fetch(
      `/api/project-workspace/${encodeURIComponent(projectId)}/management`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "partner_sample",
          fields: { partner_id: partnerId, label, status: "unknown" },
        }),
      },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        typeof body.error === "string" ? body.error : "追加できなかったよ",
      );
    // 新規行はサーバー採番のidを持つため、楽観挿入せず正本bundleを取り直して反映する。
    const latest = await fetch(
      `/api/project-workspace/${encodeURIComponent(projectId)}/management`,
      { headers: { "Cache-Control": "no-store" } },
    );
    const latestBody = await latest.json().catch(() => null);
    if (latest.ok && latestBody)
      onManagementChange(latestBody as SxManagementBundle);
  };
  const milestoneTitleById = new Map(
    management.milestones.map((milestone) => [
      milestone.id,
      nominalizeSxActionLabel(milestone.title),
    ]),
  );
  const milestoneSlugById = new Map(
    management.milestones.map((milestone) => [milestone.id, milestone.slug]),
  );

  // PoC候補先とVCは、同じ関係先台帳を絞る表示属性。別台帳は作らない。
  const pocPartners = management.partners.filter(sxIsPocPartner);
  const vcPartners = management.partners.filter(sxIsVcPartner);
  const comparisonOnly = pocOnly || vcOnly;
  const matchesRole = (partner: SxManagementPartner) =>
    activeRoleKind === null ||
    (partner.roles.find((role) => role.isPrimary)?.roleKind ||
      "unclassified") === activeRoleKind;
  const comparisonScopePartners = pocOnly
    ? pocPartners
    : vcOnly
      ? vcPartners
      : [];
  const facetScopePartners = pocOnly
    ? comparisonScopePartners.filter(
        (partner) =>
          (activePocCategory === null ||
            partner.pocCategory === activePocCategory) &&
          (activePocStage === null ||
            partner.relationshipStage === activePocStage),
      )
    : comparisonScopePartners;
  const ownerScopePartners = comparisonOnly
    ? facetScopePartners.filter((partner) =>
        pocMatchesQuickFilter(partner, management.asOf, activePocQuickFilter),
      )
    : management.partners.filter(matchesRole);
  const activeOwnerPartnerIds = activeOwnerKey
    ? new Set(
        sxPartnerOwnerLoads(ownerScopePartners, management.asOf).find(
          (load) => load.ownerKey === activeOwnerKey,
        )?.partnerIds || [],
      )
    : null;
  const filterablePartners = activeOwnerPartnerIds
    ? ownerScopePartners.filter((partner) =>
        activeOwnerPartnerIds.has(partner.id),
      )
    : ownerScopePartners;

  const comparisonPartners = [...filterablePartners].sort((left, right) =>
    sxComparePartnersForPoc(left, right, management.asOf, comparisonSort),
  );
  // Both trailing sections read from the role-filtered list too (spec P1: role filter中の保留欄も選択
  // roleに合うものだけ) — selecting a category must narrow 保留/終了 exactly like the main groups.
  const deferredPartners = comparisonOnly
    ? []
    : filterablePartners.filter((partner) => partner.deferredLowPriority);
  const endedPartners = comparisonOnly
    ? []
    : filterablePartners.filter(
        (partner) => !partner.deferredLowPriority && sxIsPartnerEnded(partner),
      );
  const groups = comparisonOnly
    ? []
    : sxGroupPartnersByPrimaryClassification(filterablePartners);

  // 通常台帳の管制帯は全関係先、PoC比較の要対応集計は表示中PoC先を分母にする。
  const countScopePartners = comparisonOnly
    ? ownerScopePartners
    : management.partners;
  const counts = sxComputeControlBandCounts(
    countScopePartners,
    management.asOf,
  );
  const roleCounts = sxPrimaryRoleKindCounts(management.partners);

  const rowProps = {
    columnOrder: order,
    milestoneTitleById,
    milestoneSlugById,
    roster,
    canManage: management.canManage,
    today: management.asOf,
    expandedId,
    activeEditorKey: activeInlineEditorKey,
    onToggleExpand: (partnerId: string) => {
      if (activeInlineEditorKey) return;
      setExpandedId((current) => (current === partnerId ? null : partnerId));
    },
    onRequestInlineEdit: (editorKey: string) => {
      if (activeInlineEditorKey && activeInlineEditorKey !== editorKey)
        return false;
      setActiveInlineEditorKey(editorKey);
      return true;
    },
    onFinishInlineEdit: () => setActiveInlineEditorKey(null),
    onPatch: patchInlineCell,
    onCreateSample: createSample,
  };

  return (
    <div
      className="relative isolate @container rounded-lg border border-[#ada18a] bg-[#fffdf7]"
      data-testid="sx-partner-pipeline"
      style={partnerLedgerGridStyle(widths, order)}
    >
      <div className="hidden rounded-t-[7px] border-b border-[#c5bba5] bg-[#f2eee0] px-3 py-2 md:flex md:items-start md:justify-between md:gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">
            関係先の進捗比較
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-[#24231f]">
            接点・現在地・次の行動・ゴールを、1社1行で確認
          </h3>
        </div>
        <div className="flex shrink-0 flex-wrap items-start justify-end gap-1.5">
          {isOrderCustomized && (
            <button
              type="button"
              onClick={resetOrder}
              data-testid="sx-partner-ledger-reset-order"
              className={`rounded border border-[#ada18a] bg-[#fffdf7] px-2 py-1 text-[10px] font-semibold text-[#5a574c] hover:bg-[#f2eee0] ${FOCUS_RING}`}
            >
              列の並びをリセット
            </button>
          )}
          {isCustomized && (
            <button
              type="button"
              onClick={resetWidths}
              className={`rounded border border-[#ada18a] bg-[#fffdf7] px-2 py-1 text-[10px] font-semibold text-[#5a574c] hover:bg-[#f2eee0] ${FOCUS_RING}`}
            >
              列幅をリセット
            </button>
          )}
        </div>
      </div>
      {!comparisonOnly && (
        <>
          <div className="flex flex-wrap gap-1.5 border-b border-[#c5bba5] bg-[#fffdf7] px-3 py-2 md:hidden">
            <SxBadge tone={NEUTRAL_TONE}>
              関係先 {countScopePartners.length}
            </SxBadge>
            <SxBadge tone={counts.overdue > 0 ? ALERT_TONE : NEUTRAL_TONE}>
              期限超過 {counts.overdue}
            </SxBadge>
            <SxBadge tone={counts.sxHeld > 0 ? WARN_TONE : NEUTRAL_TONE}>
              当方が動く {counts.sxHeld}
            </SxBadge>
            <SxBadge
              tone={counts.ownerUnconfirmed > 0 ? FLAG_TONE : NEUTRAL_TONE}
            >
              担当未確認 {counts.ownerUnconfirmed}
            </SxBadge>
          </div>
          <div className="hidden md:block">
            <ControlBand
              counts={counts}
              totalPartners={countScopePartners.length}
            />
          </div>
        </>
      )}
      <CategoryNav
        counts={roleCounts}
        totalCount={management.partners.length}
        pocCount={pocPartners.length}
        vcCount={vcPartners.length}
        activeKind={activeRoleKind}
        pocOnly={pocOnly}
        vcOnly={vcOnly}
        onClear={() => {
          if (activeInlineEditorKey) return;
          setPocOnly(false);
          setVcOnly(false);
          setActiveRoleKind(null);
          setActivePocQuickFilter("all");
          setActivePocCategory(null);
          setActivePocStage(null);
          setActiveOwnerKey(null);
        }}
        onSelect={(kind) => {
          if (activeInlineEditorKey) return;
          setActiveRoleKind(kind);
          setActiveOwnerKey(null);
        }}
        onSelectPoc={() => {
          if (activeInlineEditorKey) return;
          setPocOnly(true);
          setVcOnly(false);
          setActiveRoleKind(null);
          setActivePocQuickFilter("all");
          setActivePocCategory(null);
          setActivePocStage(null);
          setActiveOwnerKey(null);
        }}
        onSelectVc={() => {
          if (activeInlineEditorKey) return;
          setPocOnly(false);
          setVcOnly(true);
          setActiveRoleKind(null);
          setActivePocQuickFilter("all");
          setActivePocCategory(null);
          setActivePocStage(null);
          setActiveOwnerKey(null);
        }}
        showRoleFilter={!comparisonOnly}
      />
      <div className="hidden md:block">
        <OwnerLoadBand
          partners={ownerScopePartners}
          today={management.asOf}
          activeOwner={activeOwnerKey}
          onSelectOwner={(ownerKey) => {
            if (activeInlineEditorKey) return;
            setActiveOwnerKey(ownerKey);
          }}
        />
      </div>
      {pocOnly && (
        <PocFacetFilterBand
          partners={comparisonScopePartners}
          activeCategory={activePocCategory}
          activeStage={activePocStage}
          onSelectCategory={(category) => {
            if (activeInlineEditorKey) return;
            setActivePocCategory(category);
            setActiveOwnerKey(null);
          }}
          onSelectStage={(stage) => {
            if (activeInlineEditorKey) return;
            setActivePocStage(stage);
            setActiveOwnerKey(null);
          }}
        />
      )}
      {comparisonOnly && (
        <PartnerComparisonControls
          partners={facetScopePartners}
          visiblePartners={comparisonPartners}
          today={management.asOf}
          scopeLabel={pocOnly ? "PoC候補先" : "VC"}
          activeQuickFilter={activePocQuickFilter}
          onSelectQuickFilter={(filter) => {
            if (activeInlineEditorKey) return;
            setActivePocQuickFilter(filter);
            setActiveOwnerKey(null);
          }}
          activeSort={comparisonSort}
          onSelectSort={(sort) => {
            if (activeInlineEditorKey) return;
            setComparisonSort(sort);
          }}
        />
      )}

      {/* 先頭行 (見出し) の固定。横スクロール枠の外に出し、scrollLeft だけ body から転記する。 */}
      <div
        ref={ledgerHeaderRef}
        className={`${comparisonOnly ? "sticky top-14 z-30 shadow-[0_1px_0_#d6cebf]" : ""} hidden overflow-hidden border-b border-[#c5bba5] bg-[#f2eee0] @min-[1248px]:block`}
      >
        <div
          className={`grid gap-2 px-2 py-1 text-[10px] font-semibold text-[#5a574c] @min-[1248px]:[grid-template-columns:var(--sx-pl-header)] ${PARTNER_LEDGER_MIN_WIDTH}`}
        >
          {(
            [
              "grade",
              "name",
              ...order,
              "history",
            ] as PartnerLedgerColumnKey[]
          ).map((key) => {
            const column = PARTNER_LEDGER_COLUMN_BY_KEY.get(key);
            if (!column) return null;
            const movable = !PARTNER_LEDGER_FIXED_KEYS.includes(key);
            return (
              <PartnerLedgerHeaderCell
                key={key}
                column={column}
                width={widths[key]}
                onResize={setWidth}
                onCommit={commitWidths}
                sticky={
                  key === "grade" ? "grade" : key === "name" ? "name" : undefined
                }
                movable={movable}
                dragging={draggingColumn === key}
                onDragColumnStart={() => setDraggingColumn(key)}
                onDragColumnEnd={() => setDraggingColumn(null)}
                onDropColumn={() => {
                  if (draggingColumn && movable) moveColumn(draggingColumn, key);
                  setDraggingColumn(null);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* spec P1: role filter中に「対応中」groupがゼロでも保留/終了に絞り込み結果が残っていることが
          あるため、3つの表示先すべて（active groups + deferred + ended）を合算してから空判定する
          （groups.length === 0 だけを見ると「該当なし」を誤表示してしまう）。 */}
      <div
        className="@min-[1248px]:overflow-x-auto @min-[1248px]:pb-72"
        onScroll={(event) =>
          syncLedgerHeaderScroll(event.currentTarget.scrollLeft)
        }
      >
        <div className={PARTNER_LEDGER_MIN_WIDTH}>
          {(comparisonOnly
            ? comparisonPartners.length === 0
            : groups.length === 0 &&
              deferredPartners.length === 0 &&
              endedPartners.length === 0) && (
            <p className="px-3 py-6 text-center text-xs text-[#5a574c]">
              該当する関係先はまだないよ。
            </p>
          )}
          {comparisonOnly &&
            comparisonPartners.map((partner) => (
              <PartnerRow key={partner.id} partner={partner} {...rowProps} />
            ))}
          {!comparisonOnly &&
            groups.map((group) => (
              <div key={group.key}>
                <div className="border-b border-l-4 border-[#c5bba5] border-l-[#38745d] bg-[#fffdf7] px-3 py-1.5">
                  {/* spec P1: 分類見出しh4は11-12px+左罫線で本文行と視覚的に区切る。in_progress/established
                    は同じ複合ラベル("XX先")になるため、unclassified以外は状態を（）で必ず明示して見出し
                    だけでも区別できるようにする。 */}
                  <h4 className="w-fit text-[11px] font-semibold text-[#38745d] @min-[1248px]:sticky @min-[1248px]:left-3">
                    {group.label}
                    {group.roleKind !== "unclassified" && (
                      <span className="text-[#5a574c]">
                        （{sxRelationshipStateLabel(group.relationshipState)}）
                      </span>
                    )}{" "}
                    <span className="text-[#5a574c]">
                      {group.partners.length}件
                    </span>
                  </h4>
                </div>
                {group.partners.map((partner) => (
                  <PartnerRow
                    key={partner.id}
                    partner={partner}
                    {...rowProps}
                  />
                ))}
              </div>
            ))}

          {!comparisonOnly && deferredPartners.length > 0 && (
            <details className="border-t border-[#c5bba5]">
              <summary
                className={`flex min-h-11 cursor-pointer select-none items-center px-3 py-2 text-[10px] font-semibold text-[#5a574c] ${FOCUS_RING}`}
              >
                <span className="w-fit @min-[1248px]:sticky @min-[1248px]:left-3">
                  保留・低優先（重要経路外・{deferredPartners.length}件）
                </span>
              </summary>
              <div>
                {deferredPartners.map((partner) => (
                  <PartnerRow
                    key={partner.id}
                    partner={partner}
                    {...rowProps}
                  />
                ))}
              </div>
            </details>
          )}

          {/* 終了は保留とは別単位（spec P1: 保留/終了を別単位）。同じ折りたたみ行UIを流用しつつ、
              対応中カウントには入らないことがこのsectionの独立性からも分かるようにする。 */}
          {!comparisonOnly && endedPartners.length > 0 && (
            <details className="border-t border-[#c5bba5]">
              <summary
                className={`flex min-h-11 cursor-pointer select-none items-center px-3 py-2 text-[10px] font-semibold text-[#5a574c] ${FOCUS_RING}`}
              >
                <span className="w-fit @min-[1248px]:sticky @min-[1248px]:left-3">
                  終了（対応中から除外・{endedPartners.length}件）
                </span>
              </summary>
              <div>
                {endedPartners.map((partner) => (
                  <PartnerRow
                    key={partner.id}
                    partner={partner}
                    {...rowProps}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function PartnerRow({
  partner,
  columnOrder,
  milestoneTitleById,
  milestoneSlugById,
  roster,
  canManage,
  today,
  expandedId,
  activeEditorKey,
  onToggleExpand,
  onRequestInlineEdit,
  onFinishInlineEdit,
  onPatch,
  onCreateSample,
}: {
  partner: SxManagementPartner;
  columnOrder: readonly PartnerLedgerColumnKey[];
  milestoneTitleById: ReadonlyMap<string, string>;
  milestoneSlugById: ReadonlyMap<string, string>;
  roster: PartnerOwnerRosterControls;
  canManage: boolean;
  today: string;
  expandedId: string | null;
  activeEditorKey: string | null;
  onToggleExpand: (partnerId: string) => void;
  onRequestInlineEdit: (editorKey: string) => boolean;
  onFinishInlineEdit: () => void;
  onPatch: (request: PartnerInlinePatch) => Promise<void>;
  onCreateSample: (partnerId: string, label: string) => Promise<void>;
}) {
  const expanded = expandedId === partner.id;
  return (
    <PartnerInlineRow
      partner={partner}
      columnOrder={columnOrder}
      milestoneTitleById={milestoneTitleById}
      milestoneSlugById={milestoneSlugById}
      roster={roster}
      canManage={canManage}
      today={today}
      expanded={expanded}
      activeEditorKey={activeEditorKey}
      onToggleExpand={onToggleExpand}
      onRequestInlineEdit={onRequestInlineEdit}
      onFinishInlineEdit={onFinishInlineEdit}
      onPatch={onPatch}
      onCreateSample={onCreateSample}
    />
  );
}

/** モーダル内の保存済み履歴を、要約・結果・主体・接点後ボールまで省略せず表示する。 */
function InteractionFullRow({
  interaction,
  partnerName,
  canManage,
  onEdit,
}: {
  interaction: SxPartnerInteraction;
  partnerName: string;
  canManage: boolean;
  onEdit?: (interactionId: string) => void;
}) {
  const actorText =
    interaction.actorSide === "shared"
      ? interaction.actorLabel
        ? `共同・${sxNormalizePublicName(interaction.actorLabel)}`
        : "共同"
      : interaction.actorSide === "unknown"
        ? "行為主体未確認"
        : interaction.actorLabel
          ? sxNormalizePublicName(interaction.actorLabel)
          : interaction.actorSide === "sx"
            ? "当方"
            : "先方";
  const dateText = sxFormatEventDateWithPrecision(
    interaction.occurredOn,
    interaction.occurredOnPrecision,
  );
  const ballText = `${sxBallSideLabel(interaction.ballSideAfter)}${interaction.ballOwnerAfter ? ` ・ ${sxNormalizePublicName(interaction.ballOwnerAfter)}` : ""}`;
  return (
    <li
      className={`p-2.5 text-[11px] leading-5 ${canManage && onEdit ? "cursor-pointer hover:bg-[#e7f0e9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]" : ""}`}
      role={canManage && onEdit ? "button" : undefined}
      tabIndex={canManage && onEdit ? 0 : undefined}
      aria-label={
        canManage && onEdit
          ? `${partnerName} - ${sxNormalizePublicName(interaction.summary)}を直接修正`
          : undefined
      }
      onClick={canManage && onEdit ? () => onEdit(interaction.id) : undefined}
      onKeyDown={
        canManage && onEdit
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEdit(interaction.id);
              }
            }
          : undefined
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-[#5a574c]">{dateText}</span>
          <SxBadge
            tone={
              INTERACTION_KIND_TONE[interaction.interactionKind] ||
              INTERACTION_KIND_TONE.note
            }
          >
            {sxInteractionKindLabel(interaction.interactionKind)}
          </SxBadge>
        </div>
      </div>
      <p className="mt-1 text-[10px] font-semibold text-[#514e47]">
        主体: {actorText}
      </p>
      <p className="mt-0.5 font-semibold leading-5 text-[#24231f]">
        {sxNormalizePublicName(interaction.summary)}
      </p>
      {interaction.outcomeSummary && (
        <p className="mt-0.5 leading-5 text-[#514e47]">
          {sxNormalizePublicName(interaction.outcomeSummary)}
        </p>
      )}
      <p className="mt-0.5 text-[10px] leading-4 text-[#315f7d]">
        ボール: {ballText}
      </p>
      {/* 議事録の本文。共有リンク（plaud等）は失効するので、全文をここに保存して読めるようにする
          (2026-08-06 まさ「リンク自体はもう少ししたらなくなるので、文章として保存しておいてほしい」)。
          行クリックの直接編集と衝突しないよう、開閉のクリックは親へ伝播させない。 */}
      {interaction.detailMd && (
        <details
          className="mt-1.5 border-t border-dashed border-[#d5cdba] pt-1.5"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <summary
            className={`flex min-h-11 cursor-pointer items-center text-[10px] font-semibold text-[#38745d] ${FOCUS_RING}`}
          >
            議事録の全文を読む
          </summary>
          <div className="mt-1 max-h-80 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere] border border-[#d5cdba] bg-[#fffdf7] p-2 text-[11px] leading-5 text-[#24231f]">
            {interaction.detailMd}
          </div>
        </details>
      )}
    </li>
  );
}
