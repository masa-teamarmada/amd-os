# はじめに — AMD OS とは

## OS の意義 — なぜ AMD OS があるか

AMD は多数のディープテック PJ を、少人数で並行して経営している。現状は **まさ（代表パートナー）の判断がないと回らない、極端に属人的な組織**で、各 PJ の重要事項も、まさの頭の中・個人のメモ・Slack・メール・ローカルファイルにバラバラに溜まりがち。

**AMD OS の存在意義は、この属人性から脱することにある。** 判断材料をすべて OS に集約し、まさ個人の判断への依存を減らしていく。理想の着地点は「**まさが個別に判断しなくても組織が回る**」状態。OS はそのための土台であって、**まさを特別扱いしたり、まさの判断を中心に据えるための道具ではない**。

この章でいう **正本** は「あとから誰が見ても、これを基準に判断・実装・運用できる正式な情報源」のこと。**生データ** は、Slack / Notion / Calendar / Drive / Gmail など、OS に取り込まれる前の一次情報を指す。

**根幹原則（この 2 つが OS のすべての土台）:**

1. **OS が唯一の正本 (single source of truth)** — 全 PJ のすべての情報を OS に集約する。**OS を見れば、全 PJ の全状況が分かる**ように設計・運用する。md ファイル・スプレッドシート・Notion・Slack・メールは、生データ・素材・閲覧ビューであって、正本ではない。
2. **OS に無い情報は「無い」のと同じ** — どれだけ重要な打合せ・判断・学びでも、OS に入って初めてチームの資産になる。「記録を残す」＝「OS に入れる」を徹底する。ローカルや手元に置いただけ・画面に表示されるだけでは完了ではなく、**中身が正確に・漏れなく OS に乗って初めて意味を持つ**。

> 読み手も「知りたいことは OS のどこを見れば分かるか」で考える。OS の外を探さないと分からない状態は、OS 側の不足として埋める対象。

## AMD OS が何か

AMD OS は、**株式会社チームアルマダ (= AMD)** が手がけるディープテック PJ (= スタートアップ準備中の研究シーズ含む) を経営する **専属の経営 OS**。日々使うのは **まさ (= 代表パートナー)、AMD メンバー、admin** で、**社内専用**。SU 側メンバー (= PI / 創業候補) は OS を使わない。

**やってること**:
- 5 生データソース (Slack / Notion / Calendar / Drive / Gmail) を継続的に取り込み
- LLM (= Codex / Claude / Gemini) で「意味のある知識」(= M/W/D/H L2) に抽出
- 各 PJ コックピット画面で経営判断・MS 進捗・経営ハイライト・MTG サマリを表示
- AMD 全体コックピット (= p00) で会社全体の Management Score・まさえいMTG (= 経営判断 dialogue) を回す

**やらないこと**:
- 公開ダッシュボード (= 機密データを含む、社外には見せない)
- 不可逆な意思決定の全自動化 (= 現時点では LLM は候補抽出までで、確認はチームが行う)。ただし狙いは「**まさ個人の判断に依存しない**」方向であって、まさの判断を温存することではない (上記「OS の意義」参照)

## 先に知っておく共通用語

マニュアル全体でよく出る言葉。各章で迷ったら、まずこの表に戻る。

| 用語 | 意味 |
|---|---|
| **正本** | 判断・実装・運用の基準にする正式な情報。AMD OS では基本的に Supabase と `pwa/manual/*.md` が正本。 |
| **生データ / 5 生データ** | OS に入る前の一次情報。Gmail / Drive / Calendar / Slack / Notion の 5 種類。 |
| **L2** | 5 生データから、OS が使える形に抽出した構造化データ。例: MTG サマリ、MS 進捗、AMD Protocol。 |
| **candidate / pending** | LLM や automation が作った未確認候補。人間が「はい」するまで正本扱いしない。 |
| **confirmed / active** | 人間確認済み、または運用上そのまま使う状態になったデータ。 |
| **source refs / snippet / hash** | 元メールや議事録の全文ではなく、根拠を辿るための短い参照・抜粋・照合用 fingerprint。 |
| **source_cache** | L2 抽出に使う短い根拠キャッシュ。メール全文・議事録全文を保存する場所ではない。 |
| **writer** | そのデータを実際に書き込む処理。GAS / Codex automation / Claude routine / PWA route など。 |
| **cron / routine / automation** | 定期実行ジョブの総称。どの実行基盤かで呼び名が違う。 |
| **outbox / LaunchAgent** | LLM が JSON 候補を出し、別のローカル helper が Supabase に反映する仕組み。LLM に直接 DB を大量更新させないための中継。 |
| **つくよみ** | AMD OS 内の LLM 抽出・修正依頼担当。通常の会話相手ではなく、候補抽出と学習ループの担当名。 |
| **MS / XRL / FRL** | MS はマイルストーン。XRL は TRL/BRL/GRL/SRL/HRL の会社側 readiness。FRL は founder / CEO 側 readiness。 |

## 想定ユーザー

| ロール | 主な使い方 | よく見る画面 |
|---|---|---|
| **まさ** (= 代表パートナー) | 全 PJ 経営判断、まさえいMTG、Management Score | `p00 cockpit` / `各 PJ cockpit` / `/notifications` |
| **AMD メンバー** | PJ 推進、議事録共有、営業・連携、月次運用 | `各 PJ cockpit` / Slack / `マイページ` |
| **admin** | 月次オペ (= 支払 / 請求 / 立替) | `/admin/payouts` 等 |
| **投資家** (= 将来) | 各 SU の進捗・ピッチ素材 | (= 公開予定なし、まさが説明会で使う想定) |

## 生データの俯瞰

すべての L2 知識は、5 つの一次データソースから抽出される。

| ソース | 取り込み元 | 主な内容 |
|---|---|---|
| **Slack** | `team-armada` ワークスペース | 議事録投稿 / メンバー間チャット / 添付資料 / 鉱山調査等の長文報告 |
| **Notion** | チームアルマダ Workspace | 議事録 / PJ 設計ドキュメント / メモ |
| **Calendar** | Google Workspace | MTG イベント / 参加者 / 日時 |
| **Drive** | チームアルマダ Drive | 議事録 docs / 試算表 / 提案資料 PDF |
| **Gmail** | まさ + AMD メンバー受信箱 | 外部関係者 (= VC / 顧客候補 / 大学) との連絡 |

→ 詳細は **[3-2 章 データと抽出](3-2-data-and-extraction.md)** へ。

## M/W/D/H L2の俯瞰

5 生データ、または Supabase 内の既存 L2 / OS データから LLM が抽出した「意味のある知識」を L2 と呼ぶ。10 種類ある。

| L2 種 | 名前 | 内容 | 例 |
|---|---|---|---|
| **M-1** | `monthly_reports` | PJ 月次レポート | 「2026年4月の SX 進捗」 |
| **D-1** | `protocols` | AMD Protocol (= 経営判断の構造化記録) | 「分岐点 → 判断材料 → アクション → 結果観測」 |
| **D-2** | `milestone_monthly_progress` + 進捗系 | MS 達成度 | 「事業計画策定 = 30% (まさ) + 70% (AMD メンバー)」 |
| **D-3** | `project_knowledge` | PJ 知識ナレッジ | 「シアノバクテリア排水処理の競合は X 社」 |
| **D-4** | `member_knowledge` | メンバー個人のナレッジ | 「特定メンバーは VC アプローチに強い」 |
| **H-1** | `project_meeting_summaries` | MTG サマリ | 「5/22 ファインケム八重洲MTG narrative_md」 |
| **D-5** | `project_registry_diffs` | OS 台帳差分 | 「新規メンバー追加候補」 |
| **M-2** | `project_xrl_evidence` | XRL 根拠 | 「BRL 5 の根拠: ファインケム MoU 締結」 |
| **D-6** | `project_strategy_signals` | **経営ハイライト** | 「JAFCO DD 開始」「中国レアアース規制 → SX 追い風」 |
| **D-7** | `textbook_insight_candidates` | Textbook Insights | 「BZM 教科書へ追記すべき Before Zero 実務知見」 |

→ 詳細は **[3-2 章 データと抽出](3-2-data-and-extraction.md)** へ。

## 章の読み方ガイド

このマニュアルは大きく 2 つに分ける。

- **まず使う人向け**: AMD メンバーがざっくり使い方を知るための章
- **全体設計・細かい仕様**: OS の構造、データ、スコア、通知、自動処理まで追う章

## 検索とつくよみ Q&A

`/manual` と各章の上部、左カラムには検索欄がある。章タイトルだけでなく、本文・見出し・画面パス・テーブル名まで横断検索するので、画面名や運用語をそのまま入れる。

例:
- `支払通知書`
- `MS 期間設定`
- `project_strategy_signals`
- `つくよみ 修正依頼`

右下の **つくよみ Manual Q&A** は、このマニュアルだけを根拠に Gemini で回答する実験版。回答には **「ここ見たらOK」** の参照章リンクが付く。つくよみは敬語ではなく、専門語を高校生にも分かるくらい噛み砕いて案内する。これはマニュアル案内専用で、DB 書き込み・PJ 修正・通知反映はしない。

| あなたが何をしたいか | まずどの章 |
|---|---|
| OS を初めて触る / ざっくり使い方を知りたい | **[2-1 章 はじめて使う人向け](2-1-member-quick-start.md)** |
| PJ の状況を見たい・経営判断したい | **[2-3 章 PJ コックピット](2-3-pj-cockpit.md)** |
| 会社全体の経営状況を見たい・まさえいMTG したい | **[2-4 章 AMD 会社全体](2-4-amd-cockpit.md)** |
| OS 全体の画面・データ・自動処理の地図を見たい | **[3-1 章 全体設計](3-1-system-architecture.md)** |
| AMD Score の数式や軸の意味まで知りたい | **[4-3 章 AMD Score 詳細仕様](4-3-amd-score-spec.md)** |
| 通知・つくよみ修正依頼・正本反映ゲートを知りたい | **[3-3 章 通知・つくよみ](3-3-notifications-and-tsukuyomi.md)** |
| Atlas / Seeds / VC / Scholar をどう使うか知りたい | **[2-5 章 探索系アセット](2-5-research-assets-quick-start.md)** |
| HUD / Venture Map の設計や実験ビューを知りたい | **[5-2 章 HUD / Venture Map](5-2-hud-and-venture-map-spec.md)** |
| `/admin/settings` の Raw / L2 / Cron 台帳を知りたい | **[6-1 章 Operations Settings](6-1-operations-settings-spec.md)** |
| 「なぜこのデータがあるんだっけ?」「どう抽出されてるんだっけ?」 | **[3-2 章 データと抽出](3-2-data-and-extraction.md)** |
| 月次支払・請求・立替申請 | **[2-6 章 admin オペ](2-6-admin-ops.md)** |
| 「なぜ cron 止まってるんだっけ?」「過去の重要判断ログ」 | **[9-1 章 過去判断と経緯](9-1-decisions-and-history.md)** |
| 開発者として機能追加したい | **[9-2 章 開発者向け](9-2-developer.md)** |
| Atlas / Macrotrend / AMD Score / AMD Protocol の関係を知りたい | **[4-1 章 判断エンジン](4-1-atlas-protocol-score-macrotrend.md)** |

---

> **このマニュアルの位置付け**: AMD OS の **正本** (= 最新仕様・経営判断ログ・開発手順) はこのマニュアル。`design/` 配下の md は設計議論ログ、`design_log/` はセッション記録 (= 履歴)。判断のソース・オブ・トゥルースは常にここ。
