# 次セッション引き継ぎプロンプト — Atlas 継続判断（2026-11-21 クローズ）

cwd: `/Users/masa/projects/AMD/amd-os`

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`（えいみ共通ルール正本）
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`（AMD 横断 memory）
3. `HANDOFF_ATLAS_CONTINUATION_20261121.md`（このタスクの現在地・選択肢・費用見積り）
4. `pwa/design/atlas_routine.md`（収集〜受け口〜enrichment の設計正本。2026-11-21 に事実訂正を追記）
5. `pwa/design/AUTOMATIONS.md`（自動処理の稼働状態一覧）
6. `bzm/SEED_Q_RUBRIC_2026-08-15.md` §4・§5（判定要因 10「マイクロトレンド適合」= Atlas の唯一の実依存）
7. `BUGS.md` の 2026-07-01 項（受け口が 200 を返して保存しなかった事故）

開発に踏み込む場合だけ追加で `pwa/manual/4-2-atlas-macrotrend-signal-spec.md`、
`pwa/src/lib/triple-helix-observations.ts`、`pwa/src/app/api/atlas/signals-ingest/route.ts`。

## 状態スナップショット（2026-11-21 確認）

- `main`、`origin/main` と同期（behind 0 / 未 push 0）。デプロイ操作はしていない。
- Codex automation `毎朝8:10 外の世界のニュースを集める（Atlas外部シグナル・D-8）` = `status = "PAUSED"`。
- 退避: `~/.codex/automations/amd-atlas/paused-20260904/` 55 件、`amd-atlas-2/paused-20260904/` 7 件、`outbox/` は両方 0 件。
- DB: `atlas_signals` 1,192 件、最終 `submitted_at` = 2026-07-01 08:21 JST。inbox 未処理 725 件、accepted 461 件。
  `atlas_stories` 308 件（6/30 止まり）、`atlas_themes` 54 件 active（6 月末止まり）、
  `atlas_divergences` 54 件（5/17 生成）、`atlas_reports` 36 件（5/21 止まり）。
- 復旧対象は **72 file / raw signal 804 件**（`paused-20260904/` 62 file 694 件 + `applied/` の 7/2〜7/8 分 10 file 110 件）。
  空白は 7/2〜9/3 の 64 日。元ファイルは全部残っている。
- 未追跡 `S01_富士山_日本語.md`（2026-11-19 09:21）は別セッションの執筆物。触らない。

## 次タスク

**まさに Atlas をどうするか確認する。(a)(b)(c) は HANDOFF の表に出してある。まさは未回答。**

まさへ提示した結論の要旨（そのまま使える）:

> 論点は費用ではない（最大でも月約 1,100 円）。まさが受信箱を毎日さばくかどうかに尽きる。
> 2026-05 に仕分けが止まった時点で、この仕組みは「集めても誰も見ない」状態になっている。
> えいみの推しは (b) 収集だけ続ける ＋ テーマ 54 件だけ四半期に 1 回更新。
> 収集は 0 円で保険になり、BZM が実際に必要としているのはテーマ 54 件だけなので、
> 日次仕分けを再開しなくても穴は塞がる。テーマ更新 1 回約 50 円。

回答別の着手点:

- **(b) を選んだ場合**: automation を再開（投入はしない）。`/atlas/admin/themes` のクラスタ提案 → 確認 → apply を
  四半期 1 回の手順として `pwa/design/atlas_routine.md` に書く。Sonnet 4.6 で 1 回約 50 円なので、
  実行前にまさへ金額を伝えて承認を取る（無承認の従量課金は厳禁）。
- **(a) を選んだ場合**: 72 file の重複・古さを投入前に確認する。`atlas_signal_review_tool.mjs recent --hours 48` では
  2 か月半前のデータに対して足りないので、`title` / `source_url` の全期間 exact match で事前に突き合わせる。
  `ALLOW_PWA_LLM_CRONS=1` は PWA 背景 LLM 全体を開けるスイッチなので、Atlas だけ開けたいなら
  enrichment を Codex automation 側へ移す（+2〜3 日）。どちらにするかもまさ判断。
- **(c) を選んだ場合**: `SEED_Q_RUBRIC_2026-08-15.md` の判定要因 10 を政策文書・公募情報ベースへ書き換える提案が必要。
  ルーブリックは凍結文書なので、改訂は v1.2 として履歴を残す形にし、`bzm/9-5-appendix-changelog.md` に 1 行足す。
- いずれの場合も、判断が決まったら `pwa/design/AUTOMATIONS.md` の Atlas 行を
  「7/9〜9/3 の 62 件」→「7/2〜9/3 の 72 file / 804 件」に直す（判断前に直すと復旧前提が固まるので今は保留）。

あわせて未解決: `amd-os-l2-vc-news-funding-signals`（`outbox/` 5 件 + `review-outbox/` 6 件）は受け皿が無い。
Atlas の判断とは独立に「受け皿を作るか捨てるか」を決める。`amd-os-strategy-signals` は `outbox/` 52 件滞留だが受け皿あり。

## このPJで守る運用ルール

- 従量課金 AI を新たに走らせる設計は、**必ず月額見積りを添えてまさの承認を取ってから**。まさは無承認の従量課金を強く警戒している。
  PWA からの Anthropic 直叩きは `getBackgroundAnthropic()` 経由で既定封鎖（`ALLOW_PWA_LLM_CRONS !== "1"` で throw）。背景抽出は Codex automation 一本が方針。
- 本番反映は `git push` ではなく `./deploy.sh` を通す（検査をすり抜けるため）。`BUILD_VERSION` も毎回 bump。
- commit は 1 機能 1 commit、編集したら即 commit。`git add .` は使わない（共有 checkout に他セッションの stage が残る）。
  push 直前にもう一度 `git fetch` して `HEAD..origin/main` を見る。
- repo ルートの `HANDOFF*.md` と `pwa/design_log/` は配信対象外。`pwa/` 配下に記録 md を置くと `[skip ci]` でも push を拒否される。
- DB は読み取りだけなら `pwa/.env.local` の `SUPABASE_SERVICE_ROLE_KEY` でスクリプトから引ける
  （Supabase MCP の `execute_sql` は権限エラーになる）。書き込みは正規の migration / outbox / applier 経路のみ。
- 報告は開発を知らない人向けの日本語で、結論・根拠・選択肢・判断条件の順。ファイル名・関数名・commit 番号は本文に並べず、必要なら末尾に 1 行。
