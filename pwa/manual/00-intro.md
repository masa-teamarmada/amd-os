# 00. はじめに — AMD OS とは

## 0.1 AMD OS が何か

AMD OS は、**株式会社チームアルマダ (= AMD)** が手がけるディープテック PJ (= スタートアップ準備中の研究シーズ含む) を経営する **専属の経営 OS**。まさ (= 代表)、AMD メンバー、SU 側メンバー (= PI / 創業候補) が日々使う。

**やってること**:
- 5 生データソース (Slack / Notion / Calendar / Drive / Gmail) を継続的に取り込み
- LLM (= Codex / Claude / Gemini) で「意味のある知識」(= L2 9 種) に抽出
- 各 PJ コックピット画面で経営判断・MS 進捗・経営ハイライト・MTG サマリを表示
- AMD 全体コックピット (= p00) で会社全体の Management Score・まさえいMTG (= 経営判断 dialogue) を回す

**やらないこと**:
- 公開ダッシュボード (= 機密データを含む、社外には見せない)
- 自動意思決定 (= まさの判断を奪わない、LLM はあくまで候補抽出)

## 0.2 想定ユーザー

| ロール | 主な使い方 | よく見る画面 |
|---|---|---|
| **まさ** (= CEO) | 全 PJ 経営判断、まさえいMTG、Management Score | `p00 cockpit` / `各 PJ cockpit` / `/notifications` |
| **AMD メンバー** | PJ 推進、議事録共有、営業・連携、月次運用 | `各 PJ cockpit` / Slack / `マイページ` |
| **SU 側メンバー** (= PI / 創業候補) | 自分の PJ 状況確認、進捗報告 | `自分の PJ cockpit` / `マイページ` |
| **admin** | 月次オペ (= 支払 / 請求 / 立替) | `/admin/payouts` 等 |
| **投資家** (= 将来) | 各 SU の進捗・ピッチ素材 | (= 公開予定なし、まさが説明会で使う想定) |

## 0.3 5 生データの俯瞰

すべての L2 知識は、5 つの一次データソースから抽出される。

| ソース | 取り込み元 | 主な内容 |
|---|---|---|
| **Slack** | `team-armada` ワークスペース | 議事録投稿 / メンバー間チャット / 添付資料 / 鉱山調査等の長文報告 |
| **Notion** | チームアルマダ Workspace | 議事録 / PJ 設計ドキュメント / メモ |
| **Calendar** | Google Workspace | MTG イベント / 参加者 / 日時 |
| **Drive** | チームアルマダ Drive | 議事録 docs / 試算表 / 提案資料 PDF |
| **Gmail** | まさ + AMD メンバー受信箱 | 外部関係者 (= VC / 顧客候補 / 大学) との連絡 |

→ 詳細は **[03 章 データと抽出](03-data-and-extraction.md)** へ。

## 0.4 L2 9 種の俯瞰

5 生データから LLM が抽出した「意味のある知識」を L2 と呼ぶ。9 種類ある。

| L2 種 | 名前 | 内容 | 例 |
|---|---|---|---|
| **L2 ①** | `monthly_reports` | PJ 月次レポート | 「2026年4月の SX 進捗」 |
| **L2 ②** | `member_activities` | メンバー活動ログ | 「AMD メンバーが 5/15 に Finechem MTG 参加」 |
| **L2 ③** | `project_milestones` + 進捗 | MS 達成度 | 「事業計画策定 = 30% (まさ) + 70% (AMD メンバー)」 |
| **L2 ④** | `project_knowledge` | PJ 知識ナレッジ | 「シアノバクテリア排水処理の競合は X 社」 |
| **L2 ⑤** | `member_knowledge` | メンバー個人のナレッジ | 「特定メンバーは VC アプローチに強い」 |
| **L2 ⑥** | `project_meeting_summaries` | MTG サマリ | 「5/22 ファインケム八重洲MTG narrative_md」 |
| **L2 ⑦** | `os_ledger_diffs` | OS 台帳差分 | 「新規メンバー追加候補」 |
| **L2 ⑧** | `project_xrl_evidence` | XRL 根拠 | 「BRL 5 の根拠: ファインケム MoU 締結」 |
| **L2 ⑨** | `project_strategy_signals` | **経営ハイライト** | 「JAFCO DD 開始」「中国レアアース規制 → SX 追い風」 |

→ 詳細は **[03 章 データと抽出](03-data-and-extraction.md)** へ。

## 0.5 章の読み方ガイド

このマニュアルは大きく 2 つに分ける。

- **まず使う人向け**: AMD メンバーがざっくり使い方を知るための章
- **全体設計・細かい仕様**: OS の構造、データ、スコア、通知、自動処理まで追う章

| あなたが何をしたいか | まずどの章 |
|---|---|
| OS を初めて触る / ざっくり使い方を知りたい | **[08 章 はじめて使う人向け](08-member-quick-start.md)** |
| PJ の状況を見たい・経営判断したい | **[01 章 PJ コックピット](01-pj-cockpit.md)** |
| 会社全体の経営状況を見たい・まさえいMTG したい | **[02 章 AMD 会社全体](02-amd-cockpit.md)** |
| OS 全体の画面・データ・自動処理の地図を見たい | **[20 章 全体設計](20-system-architecture.md)** |
| AMD Score の数式や軸の意味まで知りたい | **[21 章 AMD Score 詳細仕様](21-amd-score-spec.md)** |
| 通知・つくよみ修正依頼・正本反映ゲートを知りたい | **[22 章 通知・つくよみ](22-notifications-and-tsukuyomi.md)** |
| Atlas / Seeds / VC / Scholar をどう使うか知りたい | **[09 章 探索系アセット](09-research-assets-quick-start.md)** |
| HUD / Venture Map の設計や実験ビューを知りたい | **[23 章 HUD / Venture Map](23-hud-and-venture-map-spec.md)** |
| `/admin/settings` の Raw / L2 / Cron 台帳を知りたい | **[24 章 Operations Settings](24-operations-settings-spec.md)** |
| 「なぜこのデータがあるんだっけ?」「どう抽出されてるんだっけ?」 | **[03 章 データと抽出](03-data-and-extraction.md)** |
| 月次支払・請求・立替申請 | **[04 章 admin オペ](04-admin-ops.md)** |
| 「なぜ cron 止まってるんだっけ?」「過去の重要判断ログ」 | **[05 章 過去判断と経緯](05-decisions-and-history.md)** |
| 開発者として機能追加したい | **[06 章 開発者向け](06-developer.md)** |
| Atlas / Macrotrend / AMD Score / AMD Protocol の関係を知りたい | **[07 章 判断エンジン](07-atlas-protocol-score-macrotrend.md)** |

---

> **このマニュアルの位置付け**: AMD OS の **正本** (= 最新仕様・経営判断ログ・開発手順) はこのマニュアル。`design/` 配下の md は設計議論ログ、`design_log/` はセッション記録 (= 履歴)。判断のソース・オブ・トゥルースは常にここ。
