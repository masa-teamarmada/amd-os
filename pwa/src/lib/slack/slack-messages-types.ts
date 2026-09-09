/** コックピット「Slack」タブが扱う型。API route とクライアント層で共有する。 */

export type SlackMessageReply = {
  ts: string;
  user: string | null;
  userName: string | null;
  isBot: boolean;
  text: string;
};

export type SlackMessageItem = {
  itemId: string;
  channelId: string;
  channelName: string;
  workspaceLabel: string;
  ts: string;
  /** スレッド親のts。自分が親、または単発の発言なら null */
  threadTs: string | null;
  /** ISO8601 (UTC) */
  at: string;
  user: string | null;
  userName: string | null;
  isBot: boolean;
  text: string;
  permalink: string | null;
  replyCount: number;
  replies: SlackMessageReply[];
  files: Array<{ name: string | null; permalink: string | null; mimetype: string | null }>;
};

export type SlackMessagesResult = {
  projectId: string;
  ym: string;
  /** 取り込み済みの月 (新しい順)。月セレクタに使う */
  months: string[];
  channels: Array<{ channelId: string; channelName: string; workspaceLabel: string; count: number }>;
  messages: SlackMessageItem[];
  /** その月の最終取り込み時刻 (ISO)。取り込みが止まっていないかの確認に使う */
  lastCollectedAt: string | null;
  truncated: boolean;
};
