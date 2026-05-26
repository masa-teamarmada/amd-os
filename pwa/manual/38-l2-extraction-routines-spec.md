# L2 Extraction Routines — claude.ai Cloud routines 統一仕様 (L2 ②〜⑨)

この章は、2026-05-26 に **L2 ②〜⑨ 全 8 種を claude.ai/code/routines (= Remote routine) に統一** した仕様をまとめる。

**起点**: 2026-05-22 の LLM cron 全廃止で ghost 化した L2 ②④⑤⑥ の復旧をきっかけに、2026-05-25 #71 で「L2 ②〜⑨ 全 8 個を Claude routine 統一」確定。当初 Mac の `~/.claude/scheduled-tasks/` (= Local routine) で実装したが、Mac スリープ依存問題が判明したため、2026-05-26 に claude.ai Cloud routine (= Remote routine、Anthropic-managed cloud infrastructure 上で実行) に一本化。

## 対象 L2

| L2 | テーブル | 役割 | 旧 writer | 新 writer |
|---|---|---|---|---|
| ② AMD Protocol | `protocols` / `protocol_examples` | 経営判断を普遍パターンとして残す | GAS 155 (5/22 停止) | Cloud routine `AMD OS L2 ② AMD プロトコル抽出` |
| ③ MS 進捗 | `milestone_monthly_progress` / `project_monthly_notes` | マイルストーン月次進捗 % | PWA `/api/cron/hourly-estimate` + GAS 154 ping | Cloud routine `AMD OS L2 ③ MS 進捗抽出` |
| ④ PJ ナレッジ | `project_knowledge` | PJ に関する人物 / 技術 / 組織 / 市場 | GAS 155 (5/22 停止) | Cloud routine `AMD OS L2 ④ PJ ナレッジ抽出` |
| ⑤ メンバーナレッジ | `member_knowledge` | メンバーごとの強み / スタイル / 関心 | GAS 155 (5/22 停止) | Cloud routine `AMD OS L2 ⑤ メンバーナレッジ抽出` |
| ⑥ MTG サマリ | `project_meeting_summaries` / `meeting_notifications` | Calendar event 単位の議事録要約 | GAS 153 + GAS 074 (5/22 停止) | Cloud routine `AMD OS L2 ⑥ MTG サマリ抽出` |
| ⑦ OS 台帳差分 | `project_registry_diffs` | 5 生データ vs OS 台帳の差分候補 | Codex automation `amd-os-ms` (outbox.registryDiffs) | Cloud routine `AMD OS L2 ⑦ OS 台帳差分抽出` |
| ⑧ XRL 根拠 | `project_xrl_evidence` | TRL/BRL/GRL/SRL/HRL の算定根拠 | Codex automation `amd-os-ms` (outbox.xrlEvidence) | Cloud routine `AMD OS L2 ⑧ XRL 根拠抽出` |
| ⑨ 経営ハイライト | `project_strategy_signals` | 経営判断 / 事業進捗 / 戦略転換 等 | Codex automation `amd-os` (5/25 applier 修復済) | Cloud routine `AMD OS L2 ⑨ 経営ハイライト抽出` |

L2 ① monthly reports (= AMD-Report GAS R313、LLM 不使用) はこの章の対象外。全体表は [03 章](03-data-and-extraction.md) と [05 章 5.4](05-decisions-and-history.md#54-codex--claude--vercel--launchagent-責務分担マトリクス) を見る。

## なぜ Cloud routines (= Remote) を選んだか

claude.ai/code/routines の Cloud routine は **Anthropic-managed cloud infrastructure 上の sandbox VM で実行** されるため:

- ✅ ローカル PC のスリープ / 起動状態に依存しない (= MacBook Air が closed でも明日 03:20 に発火する)
- ✅ subscription (Pro/Max/Team/Enterprise) 内で動く、追加 LLM 課金なし
- ✅ claude.ai の Connectors (= Notion/Gmail/Calendar/Drive/Slack/Supabase/GitHub) が routine 内から直接呼べる
- ✅ 複数 PC からの共有管理 (= 個人アカウントに紐づくが、Mac/Windows 両方から claude.ai/code/routines で見える)

vs ローカル Mac scheduled task の問題:
- ❌ Mac の `~/.claude/scheduled-tasks/` の routine は **「app open かつ非スリープ」中のみ発火** ([code.claude.com/docs](https://code.claude.com/docs/en/desktop-scheduled-tasks))
- ❌ 2026-05-25-26 の観察で、Mac スリープ中の cron は完全 skip → L2 取り込みゼロが継続

公式ドキュ引用:
> "Routines execute on Anthropic-managed cloud infrastructure, so they keep working when your laptop is closed." ([code.claude.com/docs/en/routines](https://code.claude.com/docs/en/routines))

## Routine 一覧 (= 2026-05-26 entry 済)

| routine 名 (= UI 表示) | trigger ID | cron | リポジトリ | Connector |
|---|---|---|---|---|
| L2 ② AMD プロトコル抽出 | `trig_01YEcyejLzKF7zYgmAiw3w8P` | daily 08:00 JST | ✅ amd-os | ✅ 7 個全部 |
| L2 ③ MS 進捗抽出 | `trig_01MxR8nyEvJvSHaCwDcHoqmb` | 毎時 0 分 | ✅ amd-os | ✅ 7 個全部 |
| L2 ④ PJ ナレッジ抽出 | `trig_01DtARvCSkz99GsgG8xihceX` | daily 08:15 JST | ✅ amd-os | ✅ 7 個全部 |
| L2 ⑤ メンバーナレッジ抽出 | `trig_011FUoNE2YCLgVoZVa9C4q2m` | daily 08:30 JST | ✅ amd-os | ⚠️ Docusign+Supabase のみ |
| L2 ⑥ MTG サマリ抽出 | `trig_01LHbVwy9KH2RNv1E7TtoaQd` | 毎時 0 分 | ✅ amd-os | ⚠️ 5 個 (Supabase + Calendar 欠) |
| L2 ⑦ OS 台帳差分抽出 | `trig_01211WVhf1pVw7mMdCk2RZxr` | `0 */6 * * *` (6h ごと) | ✅ amd-os | ⚠️ Docusign のみ |
| L2 ⑧ XRL 根拠抽出 | `trig_01QktXVABmg7ohA8NCUSFY9C` | `15 */6 * * *` (L7+15 分) | ✅ amd-os | ⚠️ Docusign のみ |
| L2 ⑨ 経営ハイライト抽出 | `trig_011hJJ17Do1bwb1ESXDMt8rH` | daily 03:20 JST | ✅ amd-os | ⚠️ 5 個 (Supabase + Calendar 欠) |

**🚨 残課題 (= L5-L9 の Connector 不完全)**: L4 作成失敗時に Connector default が破損し、L5 以降の新規 routine 作成画面で Connector 1 個 (Docusign のみ) default に縮退。編集モーダルでも Connector 追加 (Supabase / Calendar 等) の dropdown option click が反映されない claude.ai UI bug を確認。**全 routine が完全に動くには、UI bug 修正待ち、または L5/L7/L8 を再削除 + 新規作成で repo+6 connector を再設定する必要**。

保存先:
- **Routine 本体**: claude.ai のアカウント (= まさの Max plan) に紐づく cloud DB、`claude.ai/code/routines` で管理
- **SKILL 正本**: [`pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md`](../scheduled-tasks/) (= repo 入り、Cloud routine が clone で参照)
- **設計議論**: [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)

## 各 routine の動作フロー (= 共通パターン)

1. **発火**: Anthropic 側 cron scheduler が trigger 時刻に session を起動
2. **sandbox VM 環境セットアップ**: AMD OS repo (= masa-teamarmada/amd-os) を `/home/user/amd-os/` 等に自動 clone
3. **「指示」prompt 実行**: routine 作成時に書いた指示を Claude (= Sonnet 4.6 が default、Opus 4.7 設定でも実行は Sonnet) が読む
4. **SKILL.md Read**: `pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md` を Read tool で読む
5. **Phase 0-E 実行**: SKILL に書かれた手順をそのまま実行 (= active projects 取得 → 入力データ収集 → source_hash 差分検知 → LLM 抽出 → Supabase upsert → 通知 upsert → feedback applied_count++)
6. **完了**: Phase E の 1 行 summary を session に出力、`claude.ai/code/routines/<trig_id>` の「実行」履歴に記録

**重要な環境差分** (= Mac 用 SKILL から Cloud routine 用への適応):
- Phase 0 の `bash $ENV=pwa/.env.local` 読み込み → **不要** (= Cloud routine 環境では .env.local 無い)
- bash `curl $SUPABASE_URL/rest/v1/...` → **Supabase MCP connector の execute_sql 経由** に置換
- Calendar/Notion/Gmail/Drive/Slack の MCP 呼び出し → claude.ai Connector 経由 (= MCP tool 名はそのまま使える)
- 列名は `pwa/design/db_schema.md` で grep してから upsert (= MCP `list_tables` でも可)

## ⑥ MTG サマリ routine の現状

2026-05-26 時点で、全 8 routine は claude.ai/code/routines に entry 済 (= §38.3 trigger ID 一覧)。動作確認できたのは L2 ② のみ。

| L2 | 状態 | 次の発火 |
|---|---|---|
| L2 ② AMD プロトコル | ✅ 動作テスト済 (= 2026-05-26 朝、手動 run で Phase 0-A-C まで進行、Anthropic サーバー側 sandbox VM 上で Sonnet 4.6 が SKILL Phase 通り Supabase MCP `execute_sql` 経由で `protocols` / `l2_extract_state` 列スキーマ確認 + `project_meeting_summaries` 4 targets fetch まで観察) | 明日 08:00 JST scheduled run |
| L2 ③ MS 進捗 | 🚧 未テスト | 次の毎時 0 分 |
| L2 ④ PJ ナレッジ | 🚧 未テスト | 明日 08:15 JST |
| L2 ⑤ メンバーナレッジ | 🚧 未テスト + Connector 不完全 | 明日 08:30 JST |
| L2 ⑥ MTG サマリ | 🚧 未テスト + Connector 5 (Supabase/Calendar 欠) | 次の毎時 0 分 |
| L2 ⑦ OS 台帳差分 | 🚧 未テスト + Connector Docusign のみ | 6h ごと (15:04/21:04/3:04/9:04 JST) |
| L2 ⑧ XRL 根拠 | 🚧 未テスト + Connector Docusign のみ | 6h ごと L7+15 分 |
| L2 ⑨ 経営ハイライト | 🚧 未テスト + Connector 5 (Supabase/Calendar 欠) | 明日 03:20 JST |

L2 ② 動作テスト fact: `progress_estimate_state` / `l2_extract_state` テーブルスキーマを Supabase MCP `execute_sql` で取得 + `project_meeting_summaries` から `p00/202605, p19/202605, p21/202605, p25/202605` の 4 target identify + 各 target の summaries / feedbacks を並列 fetch + Phase C (LLM extraction) 突入を `claude.ai/code/session_01EWKTv1JzaKXKCqAUXUGifr` で確認 (= 8m+ サーバー側継続)。

## 各 L2 の入出力仕様

各 routine の SKILL.md (= `pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md`) に Phase 0-E の詳細手順が書かれている。以下は L2 ごとの入出力サマリ。

### ② AMD Protocol

- 入力: 直近 24 時間から増えた `project_meeting_summaries`、必要に応じて当月/前月単位の再集約
- 抽出: 分岐点 / 判断材料 / アクションを普遍化して `protocols.content` に保存
- 結果: 自動抽出では埋めない。後追いの結果観測は `protocol_result_observations`
- status: `candidate -> confirmed / rejected / archived`
- `protocols` の yes は `confirmed`。`active` ではない

### ④ PJ ナレッジ

- 入力: `monthly_reports` + `project_meeting_summaries`
- 出力: `project_knowledge`
- category: `people`, `tech`, `ip`, `org`, `funding`, `market`, `competitor`, `strategy`, `term`
- status: `candidate -> active / rejected`
- 注意: `project_knowledge` に UNIQUE 制約は無い。既存行を壊さず `(project_id, category, entity_name)` で SELECT してから更新/追加する

### ⑤ メンバーナレッジ

- 入力: `member_activities` + `project_meeting_summaries`
- 出力: `member_knowledge`
- category: `skills`, `personality`, `communication_style`, `growth_areas`, `work_style`, `interests`, `episodes`
- 現スキーマ: `member_knowledge` には `status` / `source_hash` 列が無い
- 現行の採否 UI は通知側の `l2_notifications` を介する。候補/却下を row 自体に保存するには migration が必要

### ⑥ MTG サマリ + フロー (= 2026-05-26 23:59 拡張)

**現在の writer**: Codex Desktop automation `amd-os-l6-meeting-flow` (= Windows MMO PC、毎日 09:00-21:00 毎時 0 分発火 = 13回/日 × 7 = 91回/週、gpt-5.5 high reasoning)。Cloud routine は 2026-05-26 25 時時点で deprecated (= Mac/Cloud 共に問題があり Windows MMO の Codex Desktop に集約)。

**🚨 cron 設計 (= 2026-05-27 00:30 まさ要求で credit 節約)**:
- 元: 毎時 0 分 (= 24回/日 × 7 = 168回/週、深夜も走って無駄)
- 新: **毎日 09:00-21:00 毎時** (= 91回/週、元の 54%) + **Phase A 早期 exit** (= 該当 MTG event 0 件なら Phase B 以降一切実行せず 1 行 summary だけ出して終了)
- 結果: 深夜 (22:00-08:00) は完全不発火、日中も実際に MTG event がある時だけ重い Phase B-J が走る
- 土日 9-21 時も毎時走る (= AMD は柔軟、土日 MTG / 朝晩 MTG も拾う)

**役割**: 議事録抽出を超えて MTG 1 回のライフサイクル全体を自動化 (= Phase A-J、10 機能):

1. (A) 議事録抽出 + 高品質化 narrative_md (= 前後 MTG / PJ 全体 / 関連 MS を踏まえた 8 セクション構成)
2. (C) 次 MTG カード生成 + Calendar event 登録 + 参加者招待 + Notion DB に「📋 準備情報 / 📝 議事録」toggle
3. (D) 次 MTG までのタスクを Slack nudge (= 担当者 mention + thread)
4. (E) タスク完了検出 → MTG 資料 update
5. (F) 前日までに資料未完成ならファシリに Slack DM
6. (G) 当日 MTG 終了 → MTG カード内に議事録 insert + 準備情報 toggle close
7. **(H) MTG TODO → cockpit + Calendar 作業枠 (= まさ 2026-05-26 23:55 要求)**: TODO を `tsukuyomi_nudge_queue` 等 cockpit テーブルに upsert + 実行者 & PL カレンダーに「+<PJコード> <task>」枠を freebusy 見て空き時間に作成 (= estimated_hours は LLM 推定、典型値: 資料作り 2h / 軽い調査 1h / アポ調整 0.5h)
8. **(I) automation 内で資料即生成 (= まさ要求)**: 「議事録 + monthly_reports + 既存 Drive 資料で前提が揃う」「成果物が text/markdown/Google Docs/Slides/Sheets」と判定したものは Phase I で LLM が本文生成 → Drive 保存 → Calendar 作業枠の description に「📎 資料 draft: <drive_url>」追記
9. **(J) ファシリ役名義で follow-up メール下書き (= まさ要求)**: 当該 MTG の facilitator (= projects.facilitator_member_id) 名義で Gmail draft 作成 (本送信禁止、ファシリが本人 Gmail で確認後送信)。本文構成 = 挨拶 / 本日サマリ / 決まったこと / 次回までの宿題 / 次回 MTG 概要 / 添付資料案内 / 結び。当日シェアした Drive 資料は exportLinks で PDF 化して attach
10. (旧) iOS APNs 通知 (= meeting_notifications upsert)

**入力**: Calendar event (= 過去 60-180 分終了) + Notion 議事録 + Gmail (= report_emails スレッド) + Drive Doc + Slack thread + `project_meeting_summaries` 過去 3 件 (= 前回比較) + `monthly_reports` 直近 3 件 (= PJ 全体文脈) + `value_milestones` + `milestone_monthly_progress` (= MS context) + Calendar freebusy (= H 用) + `projects.drive_folder_id` + `projects.facilitator_member_id` + `project_members` (= role=PL 特定)

**出力**:
- `project_meeting_summaries` (PK=`meeting_id`) + `meeting_notifications` (旧)
- `tsukuyomi_nudge_queue` or `project_todos` (= cockpit TODO 反映、H)
- Calendar event (+<PJ> prefix task 枠、H)
- Drive file (= Phase I 生成資料、命名 `<YYYY-MM-DD>_<PJcode>_<task slug>_draft.<ext>`)
- Gmail draft (= Phase J follow-up メール、添付 PDF 含む)
- source_kinds: `notion+gmail+drive+slack` 等 (= 30 chars 閾値)
- 議事録なし event は `source_kinds='none'` のマーカー行を upsert (= 重複判定用)

**禁止事項追加 (= Phase H/I/J 用)**:
- LLM が Calendar / Drive / Gmail に直接書き込み (= 全部 non-LLM helper `apply-outbox` 経由)
- Gmail メール本送信 (= draft 止まり、ファシリ役本人が確認後送信)
- Calendar 既存枠と重複作成 (= freebusy 必ず確認)
- TODO Calendar 枠を「+<PJ>」prefix 無しで作る (= まさルール違反)
- 生成不能タスクを強引に資料生成 (= 前提データ不足なら skip + reason 記録)

### ⑦ OS 台帳差分

- 入力: 5 生データ + OS 台帳 (= `project_members` / `projects.report_emails` / `project_partners` 等)
- 出力: `project_registry_diffs` (= status='pending')
- 判定: 5 生データで言及があるが OS 台帳に無い (or 異なる) 項目を差分候補として抽出
- 通知採否で apply (= 安全な DB 更新) or `status='rejected'`

### ⑧ XRL 根拠

- 入力: 5 生データ + 既存 L2 (= monthly_reports / meeting_summaries / member_knowledge 等)
- 出力: `project_xrl_evidence` (= TRL/BRL/GRL/SRL/HRL の axis × evidence、status='candidate')
- 関連メンバー (HRL ベース) は `project_founding_members` の `category in ('amd','startup','university')` 対象、VC/顧客/行政は invalid

### ⑨ 経営ハイライト

- 入力: 5 生データ + OS snapshot (= `amd_management_score_*` / `billing_cycles` 等)
- 出力: `project_strategy_signals` (= status='candidate')
- ルール: 「進んだこと・起きたこと」(= done のみ、未了は除外、まさ #26)、impact_level / signal_type / polarity 等 4 軸で記録
- 修正依頼は対話型 (= `/api/notifications/feedback/dialog/*` + CockpitStrategySignals UI 拡張) と接続予定

## 冪等性と通知

| テーブル | 使い方 |
|---|---|
| `l2_extract_state` | `(l2_kind, target_id, scope_key)` ごとに `source_hash`, `saved_count`, `total_count`, `last_processed_at` を保存 |
| `l2_feedbacks` | レビュー担当の修正依頼。routine は該当 `l2_kind` / `target_id` / `scope_key` の active feedback を prompt に入れる |
| `l2_notifications` | ②④⑤⑦⑧⑨ の承認カード。`saved_count` が変わったら再通知対象 |
| `meeting_notifications` | ⑥ MTG サマリの承認/通知カード (= iOS APNs 通知用) |
| `progress_estimate_state` | ③ MS 進捗の `source_hash` 差分検知 (= UNIQUE `project_id, ym`) |

## 実装時の禁止事項

- ローカル Mac scheduled task (= `~/.claude/scheduled-tasks/amd-os-l*`) の Live 化 (= Cloud routine と並行は idempotent だが credit 重複、Cloud 動作確認後に disable)
- GAS 153 / 155 の kill switch を外して LLM cron を復活させない
- PWA / GAS / Vercel route から Anthropic・Gemini・OpenAI の従量課金 API を L2 抽出用途で新規に呼ばない。LLM が必要な抽出・要約・議事録品質改善は Cloud routine 側の SKILL に寄せる
- raw Gmail / raw Notion 本文を L2 row に丸ごと保存しない (= source refs + short snippet + hash のみ)
- `member_knowledge` に存在しない `status` や `source_hash` を書かない (= schema gap、migration 必要)
- `protocols` の「はい」を `active` にしない。正本は `confirmed`
- Codex automation と Cloud routine を同じものとして扱わない (= 7/8/9 は Codex `amd-os-ms` / `amd-os` から移行、Codex 側は段階的に停止)
- 列名を想像しない。必ず [`pwa/design/db_schema.md`](../design/db_schema.md) を見る

## 残課題

| 優先 | タスク | 備考 |
|---|---|---|
| P0 | L5/L6/L7/L8/L9 routine に Supabase Connector 追加 | claude.ai UI bug で 2026-05-26 セッションでは反映できず。Supabase なしだと `execute_sql` 不可で routine 動作不可 |
| P0 | L6/L9 routine に Calendar Connector 追加 | 同上 |
| P1 | 2026-05-26 朝の全 routine 発火結果を観察 | scheduled run のログを `claude.ai/code/routines/<trig_id>` で確認、失敗 routine の原因切り分け |
| P1 | Mac 側 `~/.claude/scheduled-tasks/amd-os-l*` 8 個を disable | Cloud 動作確認後 (= 重複稼働中は idempotent だが credit 二重消費) |
| P1 | 旧 `amd-os-meeting-extract` (Mac scheduled task、リネーム済の disabled) を削除 | 整理 |
| P2 | `member_knowledge` の候補 status 設計 | migration するか通知側だけで扱うか決める |
| P2 | `/admin/settings` に Cloud routine の稼働状態を表示 | claude.ai REST API or 手動同期 |
| P2 | Codex automation `amd-os-ms` / `amd-os` の段階的停止 | Cloud routine L7/L8/L9 が安定稼働してから |
| P3 | claude.ai UI bug 報告 (= Connector 追加が反映されない、編集モーダルで repo 設定が消える) | Anthropic に共有、修正待ち |

## 2026-05-26 移行ログ

- claude.ai/code/routines に 8 個全部 entry 完了 (= §38.3 trigger ID 一覧)
- SKILL 8 個を repo `pwa/scheduled-tasks/` に commit (= `41ef14c`)、Cloud routine の sandbox VM が auto-clone する正本
- 詳細経緯: [`pwa/design_log/sessions_2026-05.md`](../design_log/sessions_2026-05.md) の 2026-05-26 セクション
- 動作テスト: L2 ② を手動 run で Phase 0-A-C まで確認、Sonnet 4.6 / Anthropic サーバー側 sandbox VM で動作証明
- Mac 側 9 routine (= dialogue-prep + amd-os-l*) は依然 enabled (= Cloud 動作確認後に disable 予定)
- UI bug で L5-L9 の Connector 不完全 (= Supabase 必須なのに追加不可)、handoff doc 経由で次セッションへ引き継ぎ
