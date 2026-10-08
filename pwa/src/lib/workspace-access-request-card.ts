import type { KnownBlock, ActionsBlockElement } from "@slack/types";
import { ACCESS_REQUEST_SCOPE_ACTION, ACCESS_REQUEST_SCOPE_BLOCK, type AccessRequestScopeChoice } from "./workspace-access-request-scopes";

export function workspaceAccessRequestCard(input: {
  requestId: string; email: string; scopeLabel: string; requestedAt: string; count: number;
  adminUrl: string; choices?: AccessRequestScopeChoice[];
}): { text: string; blocks: KnownBlock[] } {
  const needsChoice = !!input.choices;
  const value = JSON.stringify({ requestId: input.requestId });
  const actions: ActionsBlockElement[] = [
    { type: "button", action_id: "workspace_access_approve", text: { type: "plain_text", text: "許可する", emoji: true }, style: "primary", value,
      confirm: { title: { type: "plain_text", text: "閲覧を許可する？" }, text: { type: "mrkdwn", text: `*${input.email}* に ${needsChoice ? "選んだ場所" : input.scopeLabel} の閲覧権限を付けるよ。` }, confirm: { type: "plain_text", text: "許可する" }, deny: { type: "plain_text", text: "戻る" } } },
    { type: "button", action_id: "workspace_access_reject", text: { type: "plain_text", text: "許可しない", emoji: true }, style: "danger", value },
    { type: "button", action_id: "workspace_access_open_admin", text: { type: "plain_text", text: "管理画面で確認", emoji: true }, url: input.adminUrl, value },
  ];
  const blocks: KnownBlock[] = [
    { type: "section", text: { type: "mrkdwn", text: "*外部ワークスペースへのアクセス要求*" }, fields: [
      { type: "mrkdwn", text: `*アカウント*\n${input.email}` }, { type: "mrkdwn", text: `*希望先*\n${input.scopeLabel}` },
      { type: "mrkdwn", text: `*要求日時*\n${input.requestedAt}` }, { type: "mrkdwn", text: `*試行回数*\n${input.count}回` },
    ] },
    { type: "context", elements: [{ type: "mrkdwn", text: needsChoice
      ? "申請に行き先が残っていないため、下で閲覧させる場所を選んで「許可する」を押してください。メールアドレスの登録も一度で完了します。"
      : "許可するとアカウント登録と、このワークスペースの閲覧権限付与が一度で完了。本人がもう一度ログイン操作するとログインリンクが届く。" }] },
  ];
  if (input.choices?.length) blocks.push({ type: "actions", block_id: ACCESS_REQUEST_SCOPE_BLOCK, elements: [{ type: "static_select", action_id: ACCESS_REQUEST_SCOPE_ACTION,
    placeholder: { type: "plain_text", text: "閲覧させる場所を選ぶ" }, options: input.choices.map(c => ({ text: { type: "plain_text", text: c.label.slice(0,75) }, value: c.value })),
  }] });
  blocks.push({ type: "actions", elements: actions });
  return { text: `外部ワークスペースへのアクセス要求: ${input.email} / ${input.scopeLabel}`, blocks };
}
