# 判断履歴 / 事故ログ仕様

> **この章は何か**: OS の current spec に影響する過去判断と事故ログ。manual では読み物として要約し、再構築に必要な制約はここを正本にする。

## 2026-05-22 LLM cron 廃止

確定方針:

- LLM 課金が発生する PWA / GAS background cron は停止する。
- Codex automation / MMOマシン Codex Desktop automation を L2 抽出の primary writer にする。
- LLM 非依存の Vercel cron は許可する。

再構築時の含意:

- `pwa/vercel.json` に LLM-backed route を cron 登録しない。
- GAS source に kill switch がある処理は、live trigger を復活させない。
- L2 M-1〜D-7 の writer は `/spec/5-3-automation-responsibility-current-spec` を見る。

## 2026-05-24 経営ハイライト再設計

旧「経営・事業シグナル」は「経営ハイライト」に改名。中身は「進んだこと / 起きたこと」だけに限定する。

| 入れる | 入れない |
|---|---|
| 経営方針が決まった | 未了 TODO |
| 事業進捗が起きた | 日程調整 |
| 提携・資金・規制・知財で進路が変わった | アイデア |
| 重要リスクが顕在化した | source refs が弱い推測 |

実装 contract は `/spec/3-6-strategy-signals-current-spec`。

## 2026-05-24 dialogue / まさえいMTG

dialogue は正式な会社決定会議ではなく、チームへ提案する前の論点整理セッション。

- UI / manual では「まさえいMTG」または `dialogue` と呼ぶ。
- `project_meeting_summaries.source_kinds='dialogue'` に保存する。
- `decided[]` は「チームへ出す提案として固まったこと」の意味で書く。
- 「正式決定済み」と誤読される表現を避ける。

## 2026-05-25 project_category `new_business`

`projects.project_category` に `new_business` を追加した。

| category | 意味 |
|---|---|
| `dtsu` | 大学 / 研究所発 SU 伴走 |
| `ecosystem` | 研究機関 SU エコシステム |
| `advisor` | 社外役員 / 顧問 |
| `new_business` | レガシー企業の研究シーズ取込 + DX による新規事業創出 |

当面は DTSU と同じ扱い。`project_category in ('dtsu','ecosystem')` のようなリテラルを見つけたら、`new_business` を含めるべきか必ず判断する。

## 主要事故ログ

| 日付 | 事故 | 再発防止 contract |
|---|---|---|
| 2026-04-28 | 9 commit 未pushのまま origin/main 起点で再ビルドし機能消失 | commit したら push。final gate で未push log を確認 |
| 2026-05-06 | `--cwd .../pwa` 二重指定で Vercel deploy 失敗 | deploy は `pwa/scripts/deploy.sh` だけ |
| 2026-05-13 | `member_knowledge` で列名を想像して誤抽出 | `db_schema.md` を grep してから列名を書く |
| 2026-05-24 | Atlas 取り込み不足を Slack ingest 停止と誤判定し cron 復活案を出した | cron 廃止経緯と automation 責務分担を読んでから提案する |
| 2026-05-25 | `amd-os` strategy-signals outbox と applier 監視 dir が不一致 | outbox path と applier 監視対象を同じ spec に書く |
| 2026-05-25 | L2 D-1D-3D-4H-1 が ghost 化 | 停止対象と後継担当を 1 対 1 で検証してから writer を止める |

詳細な症状・原因・解決策は `pwa/BUGS.md` と `pwa/design_log/sessions_YYYY-MM.md` に残す。ただし current spec に効く再発防止ルールはこの章へ昇格する。
