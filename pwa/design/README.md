# pwa/design/ — 設計正本フォルダ (/spec へ移行中)

> **新セッションのえいみが `/spec` と合わせて読むフォルダ。**
> AMD OS は manual / spec / bzm の3層へ移行中。未移行の確定実装仕様は、引き続きこの `pwa/design/` が正本。移行済み章だけ `pwa/spec/*.md` を正本にする。

---

## 📌 まず読む順序

| 順 | ファイル | 内容 |
|---|---|---|
| **-1** | [../spec/1-1-overview.md](../spec/1-1-overview.md) / [../spec/1-2-document-layer-migration-map.md](../spec/1-2-document-layer-migration-map.md) | manual / spec / bzm 3層分割と、`design/` から `/spec` への移行マップ |
| **0** | [**L2_DATA.md**](L2_DATA.md) ⭐⭐⭐ | **AMD OS 中核データ正本** — M/W/D/H L2 (monthly report / AMDプロトコル / MS進捗 / PJナレッジ / メンバーナレッジ / MTGサマリ / OS台帳差分 / XRL根拠 / 経営・事業シグナル / Textbook Insights) + レポート + 全 cron。`/spec` 未移行のため、データに触る前に必ず読む |
| 1 | [SPEC_pwa.md](SPEC_pwa.md) ⭐ | **PWA 全体の正本仕様** — 画面・ルート・データモデル・cron・運用コマンド・実装規約 |
| 2 | [FEATURE_REGISTRY.md](FEATURE_REGISTRY.md) ⭐ | **重要UIの回帰防止登録簿** — 画面ごとの「消してはいけない業務導線」と `test:critical-ui` anchor |
| 2.5 | [SPEC_GOVERNANCE.md](SPEC_GOVERNANCE.md) ⭐ | **仕様ドリフト防止運用** — Capability Catalog / functional spec / ADR / traceability / executable spec の使い分け |
| 3 | [cockpit.md](cockpit.md) ⭐ | コックピット (`/project/[projectId]/cockpit`) — PJ Status / MS / カンバン / 月次カード / MTGサマリ |
| 4 | [routine.md](routine.md) ⭐ | OS上のPM月次ルーティン廃止の正本。dashboard / mypage / cockpit / legacy GAS の回帰防止 |
| 4 | [mypage.md](mypage.md) | `/mypage` 仕様 — 自分の参加 PJ・今月の活動・月次報酬 |
| 5 | [amd_score.md](amd_score.md) | AMD Score (SPS primary / legacy M-X-F comparison)、cron / L2 抽出 |
| 5.2 | [management_score.md](management_score.md) ⭐ | **AMD Management Score** — AMD会社全体の経営状況スコア。先手力 / 財務耐久 / 既存PJ継続 / 新規案件獲得 / 戦略接近度 |
| 5.5 | [aspi_lanes.md](aspi_lanes.md) ⭐ | **ASPI Critical Technology Tracker 8 domain** (= 新 lane 体系、旧 5 lane 廃止)。PJ.lanes JSONB weighted / 10 PJ mapping / 新 cron (lane-suggest / kaken / grant / vc-investment) の正本 |

---

## テーマ別

| 領域 | ファイル |
|---|---|
| 認証 | [google_signin.md](google_signin.md) |
| 仕様ドリフト防止 | [SPEC_GOVERNANCE.md](SPEC_GOVERNANCE.md) / [FEATURE_REGISTRY.md](FEATURE_REGISTRY.md) |
| Notion コンテンツ移植 | [notion_content_migration.md](notion_content_migration.md) — member list / history / photo を AMD OS に移すための UIUX・権限・データ設計案 |
| H-1 source auth fallback | [h1_source_auth_fallback.md](h1_source_auth_fallback.md) — Notion connector 再認証待ち禁止、Chrome/local と5生データへの即時fallback、connector_auth再認証アクション |
| Atlas (判断の地図) | [atlas.md](atlas.md) |
| Atlas 政策シグナル | [policy_signals.md](policy_signals.md) |
| 進捗推定 (Tsukuyomi MS 推定) | [progress_estimation.md](progress_estimation.md) |
| MTG サマリ (各回 decided/progress/nextActions/risks) ⭐ | [meeting_summaries.md](meeting_summaries.md) |
| 経営・事業シグナル (重要方針/事業進捗/リスク) ⭐ | [project_strategy_signals.md](project_strategy_signals.md) |
| 先手 TODO / 旧先手力維持ループ ⭐ | [../spec/2-4-proactive-todo-current-spec.md](../spec/2-4-proactive-todo-current-spec.md) / [proactive_operating_loop.md](proactive_operating_loop.md) — 現行は `proactive_todos` + `/proactive` + PWA non-LLM cron。旧 commander outbox / heartbeat は廃止済み |
| 外部機関 tenant / 権限設計 (NIMS Pilot gate) ⭐ | [institution_tenant_access.md](institution_tenant_access.md) |
| OS台帳差分 (PJメンバー/関係先/契約/期間/担当の差分候補) ⭐ | [project_registry_diffs.md](project_registry_diffs.md) |
| 🛰 Coverage Scanner (不在検知 = OS化されてない重要情報の自動検知) ⭐ | [coverage_gap_scanner.md](coverage_gap_scanner.md) |
| 要対応 + 株主・ガバナンス・保有株式 ⭐ | [governance_action_items.md](governance_action_items.md) |
| XRL根拠 (TRL/BRL/GRL/SRL/HRL 算定根拠) ⭐ | [xrl_evidence.md](xrl_evidence.md) |
| Venture Map | [venture_map_model.md](venture_map_model.md) / [venture_map_demo.md](venture_map_demo.md) / [venture_map_v01_critique.md](venture_map_v01_critique.md) |
| Seeds (研究シーズリスト) ⭐ | [seeds.md](seeds.md) |
| PoC Matching ⭐ | [poc_matching.md](poc_matching.md) — シーズ x PoC先のヒアリング / PoC設計 / 契約 / 収益分配台帳 |
| 名刺管理 / PJ人物ナレッジ ⭐ | [../spec/2-5-business-cards-current-spec.md](../spec/2-5-business-cards-current-spec.md) / [project_knowledge.md](project_knowledge.md) — 撮影・OCR・人確認・private連絡先台帳・D-3人物同期 |
| BZM 論文化 (教科書×IMRaD対応・論文骨子・図版方針) | [bzm_paper.md](bzm_paper.md) — JASVE 向け論文設計。教科書正本は `pwa/bzm/*.md`、引き継ぎは `pwa/HANDOFF_bzm_textbook.md` |
| VC List | [vc_list.md](vc_list.md) |
| AMD Management Score (会社全体の経営スコア) ⭐ | [management_score.md](management_score.md) |
| 月次試算表 (project_pl_monthly) | [project_pl_monthly.md](project_pl_monthly.md) — 生データから未来予測抽出方針、優先度低 |
| Admin Finance Ops | [project_pl_monthly.md](project_pl_monthly.md) / [management_score.md](management_score.md) — サブスク・固定継続費・自動振替・Gmail領収書イベント |
| AMD運営カレンダー | [../spec/5-9-admin-operating-calendar-current-spec.md](../spec/5-9-admin-operating-calendar-current-spec.md) / [adr/001-admin-operating-calendar-derived-read-model.md](adr/001-admin-operating-calendar-derived-read-model.md) — 税務、労務、契約、報告、請求、支払期限を正本から自動生成するadmin年間カレンダー。migration 178 / `/admin/schedule` 実装 |
| Cyber Dashboard / HUD | [hud_visual_language.md](hud_visual_language.md) / [cyber_hud_design_code.md](cyber_hud_design_code.md) / [cyber_dashboard_content_design.md](cyber_dashboard_content_design.md) — HUD Client全体の視覚言語、3D HUD dashboard の実装方針、CSS禁止ライン、X/F/M空間配置 |
| 請求書 URL / Payout 認証 | [invoice_url_payout_auth.md](invoice_url_payout_auth.md) |
| Supabase migration 履歴 | [supabase_migration.md](supabase_migration.md) |

---

## 📖 設計 md と他の md の役割分担

| 場所 | 役割 |
|---|---|
| `pwa/spec/` ⭐ | **移行後の確定実装仕様正本** — OS画面 `/spec` に出る。移行済み章だけここが正本 |
| `pwa/design/` ⭐ | **未移行の設計正本** (このフォルダ) — `/spec` へ移すまでは仕様変更したらここを同じ commit で更新 |
| [FEATURE_REGISTRY.md](FEATURE_REGISTRY.md) ⭐ | 重要業務UIの登録簿。消す・置き換える前に同じ commit で更新する |
| [pwa/HANDOFF_pwa_rebuild.md](../HANDOFF_pwa_rebuild.md) | 直近セッションの引き継ぎ・次の一手 (~200 行以下) |
| [pwa/BUGS.md](../BUGS.md) | バグ・教訓・回帰防止メモ |
| [pwa/CLAUDE.md](../CLAUDE.md) | PWA 固有の運用ルール (デプロイコマンド等) |
| [pwa/AGENTS.md](../AGENTS.md) | 入口メモ (このフォルダへの案内) |
| `pwa/design_log/sessions_*.md` | 過去セッションの作業ログ (時系列の append-only) |

**重要**: 設計判断・仕様変更は、移行済みなら `pwa/spec/`、未移行ならこの `pwa/design/` 配下に置く。
`design_log/` は時系列ログ用。新規設計 md を `design_log/` に作らない。
