import assert from "node:assert/strict";
import {
  appNotificationPriority,
  hasCompleteActionContract,
  parseActionContract,
} from "../src/lib/notification-priority.ts";

const fullActionContract = {
  action_owner: "まさ",
  action_required: "対象カードを確認する。",
  action_label: "対象を開く",
  action_url: "/project/p01/cockpit",
  completion_condition: "確認結果を保存したら完了。",
  why_now: "処理が止まったため。",
};

assert.equal(
  appNotificationPriority({
    kind: "h1_report",
    title: "会議確認: 処理が止まった",
    meta: { notification_channel: "critical" },
  }),
  "normal",
  "直接対応できないH-1通知は緊急にしない",
);

assert.equal(
  appNotificationPriority({
    kind: "h1_report",
    title: "会議確認: 処理が止まった",
    meta: { notification_channel: "critical", action_contract: fullActionContract },
  }),
  "critical",
  "やること・直行先・完了条件が揃ったH-1通知だけ緊急にする",
);

assert.equal(
  appNotificationPriority({ kind: "connector_auth", meta: { reauth_url: "https://example.com/reauth" } }),
  "critical",
  "旧形式でも直接の再認証先があれば緊急を維持する",
);
assert.equal(
  appNotificationPriority({ kind: "connector_auth", meta: { reason: "reauth_required" } }),
  "normal",
  "直接の再認証先がない通知は緊急にしない",
);

assert.equal(hasCompleteActionContract({ action_contract: fullActionContract }), true);
assert.equal(hasCompleteActionContract({ action_contract: { ...fullActionContract, action_owner: "none" } }), false);

const compatibilityContract = parseActionContract({ notification_contract: fullActionContract });
assert.equal(compatibilityContract?.actionUrl, "/project/p01/cockpit");
assert.equal(
  parseActionContract({
    notification_contract: {
      destination_label: "対象PJの会議記録",
      changes: ["会議記録"],
      effect: "確認結果を報告する",
    },
  }),
  null,
  "旧来の反映先contractを、まさのaction contractと誤認しない",
);

process.stdout.write("Notification action contract checks passed.\n");
