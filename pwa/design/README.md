# pwa/design/ — 設計の正本フォルダ

> **新セッションのえいみが最初に読むフォルダ。**
> ここの md がすべて PWA の設計の正本。`AGENTS.md` / `CLAUDE.md` から
> このフォルダに案内される構造になっている。

---

## 📌 まず読む順序

| 順 | ファイル | 内容 |
|---|---|---|
| 1 | [SPEC_pwa.md](SPEC_pwa.md) ⭐ | **PWA 全体の正本仕様** — 画面・ルート・データモデル・cron・運用コマンド・実装規約 |
| 2 | [cockpit.md](cockpit.md) ⭐ | コックピット (`/project/[projectId]/cockpit`) — PJ Status / MS / カンバン / 月次ルーティン (stepId × クリック挙動表) |
| 3 | [routine.md](routine.md) ⭐ | 月次ルーティン (請求・報告・立替・予算) のステップ別仕様。Cockpit 右カラム + iOS RoutineFlowView の正本 |
| 4 | [mypage.md](mypage.md) | `/mypage` 仕様 — 自分の参加 PJ・今月の活動・月次報酬 |
| 5 | [amd_score.md](amd_score.md) | AMD Score (Before Zero Theory v3.2 — 7 軸 Cobb-Douglas)、cron / L2 抽出 |

---

## テーマ別

| 領域 | ファイル |
|---|---|
| 認証 | [google_signin.md](google_signin.md) |
| Atlas (判断の地図) | [atlas.md](atlas.md) |
| Atlas 政策シグナル | [policy_signals.md](policy_signals.md) |
| 進捗推定 (Tsukuyomi MS 推定) | [progress_estimation.md](progress_estimation.md) |
| Venture Map | [venture_map_model.md](venture_map_model.md) / [venture_map_demo.md](venture_map_demo.md) / [venture_map_v01_critique.md](venture_map_v01_critique.md) |
| Seeds (研究シーズリスト) ⭐ | [seeds.md](seeds.md) |
| VC List | [vc_list.md](vc_list.md) |
| 請求書 URL / Payout 認証 | [invoice_url_payout_auth.md](invoice_url_payout_auth.md) |
| Supabase migration 履歴 | [supabase_migration.md](supabase_migration.md) |

---

## 📖 設計 md と他の md の役割分担

| 場所 | 役割 |
|---|---|
| `pwa/design/` ⭐ | **設計の正本** (このフォルダ) — 仕様変更したらここを同じ commit で更新 |
| [pwa/HANDOFF_pwa_rebuild.md](../HANDOFF_pwa_rebuild.md) | 直近セッションの引き継ぎ・次の一手 (~200 行以下) |
| [pwa/BUGS.md](../BUGS.md) | バグ・教訓・回帰防止メモ |
| [pwa/CLAUDE.md](../CLAUDE.md) | PWA 固有の運用ルール (デプロイコマンド等) |
| [pwa/AGENTS.md](../AGENTS.md) | 入口メモ (このフォルダへの案内) |
| `pwa/design_log/sessions_*.md` | 過去セッションの作業ログ (時系列の append-only) |

**重要**: 設計判断・仕様変更を入れる md は必ずこの `pwa/design/` 配下に置く。
`design_log/` は時系列ログ用。新規設計 md を `design_log/` に作らない。
