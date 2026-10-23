import type { MonthlyWorkAgreementProject } from "@/lib/monthly-work-agreement-types";

export type AgreementRevisionAmountChoice = "unchanged" | "recalculate" | "specific";

export interface AgreementRevisionProposal {
  milestoneId: string | null;
  requestedSharePct: number | null;
  additionalWork: string;
  amountChoice: AgreementRevisionAmountChoice;
  requestedAmountYen: number | null;
  detail: string;
}

function percent(value: number): string {
  return `${Math.round(value * 100) / 100}%`;
}

function yen(value: number): string {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

/** 保存する本文も人が読める形にする。既存の自由文やmacOSクライアントとの互換を保つ。 */
export function formatAgreementRevisionProposal(
  proposal: AgreementRevisionProposal,
  project: MonthlyWorkAgreementProject,
): string {
  const lines = [`対象PJ：${project.projectName}`];
  const milestoneId = proposal.milestoneId?.trim() || null;
  const additionalWork = proposal.additionalWork.trim().replace(/\s*\r?\n\s*/g, " / ");
  const detail = proposal.detail.trim().replace(/\s*\r?\n\s*/g, " / ");
  if (milestoneId) {
    const milestone = project.milestones.find((item) => item.milestoneId === milestoneId);
    if (!milestone || milestone.plannedShare == null) throw new Error("対象MSの現在の担当割合を確認できません");
    const requested = proposal.requestedSharePct;
    if (requested == null || !Number.isFinite(requested) || requested < 0 || requested > 100) {
      throw new Error("変更後の担当割合を0〜100％で入力してください");
    }
    const current = milestone.plannedShare * 100;
    if (Math.abs(current - requested) < 0.001) throw new Error("変更前と変更後の担当割合が同じです");
    lines.push(`対象MS：${milestone.title}`);
    lines.push(`担当割合：${percent(current)} → ${percent(requested)}`);
  } else if (proposal.requestedSharePct != null) {
    throw new Error("担当割合を変えるMSを選んでください");
  }
  if (additionalWork) {
    if (additionalWork.length < 8 || additionalWork.length > 500) {
      throw new Error("追加する仕事は8〜500文字で入力してください");
    }
    lines.push(`MSにない追加業務：${additionalWork}`);
  }
  if (detail) {
    if (detail.length < 8 || detail.length > 1000) {
      throw new Error("補足は8〜1000文字で入力してください");
    }
    lines.push(`その他の修正・根拠：${detail}`);
  }
  if (!milestoneId && !additionalWork && !detail && proposal.amountChoice !== "specific") {
    throw new Error("変更するMS、追加する仕事、または修正内容を入力してください");
  }
  const currentAmount = project.expectedRewardYen;
  lines.push(`現在の合意予定額：${currentAmount == null ? "算定待ち" : yen(currentAmount)}`);
  if (proposal.amountChoice === "specific") {
    const amount = proposal.requestedAmountYen;
    if (amount == null || !Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000) {
      throw new Error("希望する合意予定額を円単位で入力してください");
    }
    lines.push(`希望する合意予定額：${yen(amount)}`);
  } else if (proposal.amountChoice === "unchanged") {
    lines.push("金額についての希望：現行額のままでよい");
  } else if (proposal.amountChoice === "recalculate") {
    lines.push("金額についての希望：変更内容を反映した計算結果を確認したい");
  } else {
    throw new Error("金額についての希望を選んでください");
  }
  const body = lines.join("\n");
  if (body.length > 4000) throw new Error("修正要望は4000文字以内で入力してください");
  return body;
}
