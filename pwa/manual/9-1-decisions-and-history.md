# 過去判断と経緯

「なぜそうなっているか」を、運用者・新メンバーが短時間で掴むための章。

実装者が OS を再構築するための詳細 contract は、設計書へ移行済み。

- LLM cron 廃止、automation 責務分担: [/spec/5-3-automation-responsibility-current-spec](/spec/5-3-automation-responsibility-current-spec)
- 開発 / deploy / DDL / GAS deploy: [/spec/5-2-development-operations-current-spec](/spec/5-2-development-operations-current-spec)
- 判断履歴 / 事故ログの実装制約: [/spec/5-4-decision-history-current-spec](/spec/5-4-decision-history-current-spec)
- ドキュメント統制と附則ルール: [/spec/5-1-document-governance-current-spec](/spec/5-1-document-governance-current-spec)

## まず覚えること

1. **LLM 課金が発生する PWA / GAS / Vercel cron は止める。** L2 抽出は Codex automation / MMO マシン側へ寄せる。
2. **経営ハイライトは「進んだこと・起きたこと」だけ。** 未了 TODO やアイデアは別の場所で扱う。
3. **まさえいMTGは正式な会社決定会議ではなく、チームへ提案する前の論点整理。**
4. **過去事故から生まれた禁止事項は spec の再発防止 contract として扱う。**

## 代表的な判断

| 日付 | 判断 | 今見る正本 |
|---|---|---|
| 2026-05-22 | LLM 課金 cron 廃止。Codex automation / subscription 枠へ移管 | `/spec/5-3` |
| 2026-05-24 | 「経営・事業シグナル」を「経営ハイライト」へ再設計 | `/spec/3-6`, `/spec/5-4` |
| 2026-05-24 | まさえいMTG / dialogue の位置づけ確定 | `/spec/3-6`, `/spec/5-4` |
| 2026-05-25 | `project_category='new_business'` 追加 | `/spec/5-4` |
| 2026-05-25 | L2 ②④⑤⑥ ghost 化から、writer移管時の 1対1 対応表を必須化 | `/spec/5-3`, `/spec/5-4` |

## 事故を防ぐ読み方

開発者はこの章だけで作業を始めない。必ず `/spec/1-3` のカバレッジ監査を見て、該当領域の spec が `rebuildable` か `partial` かを確認する。

過去ログの詳細は `pwa/BUGS.md` と `pwa/design_log/sessions_YYYY-MM.md` に残る。ただし、現行仕様として実装者が守るべき制約は `/spec` に昇格させる。

## 再構築可能性チェック

この manual 章だけでは OS は再構築できない。目的は「過去判断の入口」。再構築は `/spec/5-3` と `/spec/5-4` を読む。
