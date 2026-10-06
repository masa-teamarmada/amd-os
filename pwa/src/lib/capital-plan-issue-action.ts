import type { CapitalPlan, ValidationIssue } from './capital-plan';

export type CapitalPlanIssueSection = 'event' | 'holders' | 'allocations' | 'financing';

/** Select a repair surface without inventing an allocation or financing premise. */
export function capitalPlanIssueAction(issue: ValidationIssue, plan: CapitalPlan) {
  let section: CapitalPlanIssueSection = 'event';
  let label = 'イベントを編集';
  if (issue.code === 'no_holders' || issue.code === 'submission_no_named_holder') {
    section = 'holders';
    label = '株主を編集';
  } else if (issue.code === 'submission_financing_incomplete' || issue.code === 'calculation_error' || /price|post_money|post_below|primary_raise|new_shares|split_ratio|pool_size|non_manual_basis/.test(issue.code)) {
    section = 'financing';
    label = '調達条件を入力';
    if (issue.code === 'invalid_split_ratio') label = '分割比率を入力';
    if (issue.code === 'option_pool_size_mismatch') label = 'プール株数を編集';
    if (issue.code === 'convertible_conversion_non_manual_basis') section = 'event';
  } else if (issue.holderId || /allocation|empty_equity|secondary|convertible|shares_sum|percentage_sum/.test(issue.code)) {
    section = 'allocations';
    label = '割当を編集';
  }
  if (plan.holders.length === 0 && section === 'allocations') {
    section = 'holders';
    label = '株主を追加';
  }
  const eventId = plan.events.find((event) => event.id === issue.eventId)?.id
    ?? [...plan.events].sort((a, b) => a.order - b.order)[0]?.id;
  return { section, label, eventId, holderId: issue.holderId };
}
