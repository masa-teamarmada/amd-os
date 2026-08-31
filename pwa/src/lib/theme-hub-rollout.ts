// 新しいテーマ画面からのMTG書込みは、既存の匿名読取りポリシーを解決するまで停止する。
// UIとAPIが同じ定数を使い、API側でも独立して拒否する。クライアントからは解除できない。
// まさが対象と影響を明示的に承認し、読取り権限の修正・検証が済んだ後だけtrueに変更する。
// 既存MTGの閲覧とテーマへのひも付けは、この停止の対象ではない。
export const THEME_HUB_MEETING_WRITE_ENABLED = false;

export const THEME_HUB_MEETING_WRITE_BLOCKED_MESSAGE =
  "MTG記録の作成・編集は公開範囲の確認待ち";
