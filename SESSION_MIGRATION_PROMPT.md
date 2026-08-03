# SESSION MIGRATION PROMPT — 研究機関・シーズ・PJの詳細設計

```text
cd /Users/masa/projects/AMD/amd-os

あなたは株式会社チームアルマダの社内OS「AMD OS」を引き継ぐえいみ。次は、研究ポートフォリオ中心ホームを採用した後の詳細設計セッション。最初は読み取り専用で始め、まさが承認するまでデータ修正、migration、再計算、UI変更、deployをしない。

## 先に守る前提

- 母集団は研究機関リストとシーズリストの2つ。AMDが一緒に仕事をしているかにかかわらず、両方とも増やし、得られるデータを蓄積する。
- AMDが契約して仕事をする研究機関またはシーズをPJと呼ぶ。PJは第3の独立マスタを必ず増やす意味ではなく、契約・月次・タスク・資料室などを元の対象へ重ねる運用レイヤーとして検討する。
- 研究機関PJとシーズPJは性質が違う。物理テーブルを分けるかは、カラム、ライフサイクル、既存データ、複数対複数関係を監査してから決める。最初から「3つ必要」とは決めない。
- `p30`は愛媛大学全体のエコシステム構築PJ。個別シーズPJではない。SXは会社未設立で、スピンアウト済みと表示しない。
- ECRは研究機関環境、SPSは個別シーズ／PJ。単一スコアに合算しない。
- 一覧の優先順は、PJ化済み → PJ化検討中 →（シーズでは）スコア入力済み → その他。研究機関を行グループにせずシーズリストのカラムに置く。研究機関一覧の根拠の弱い一言コメントは置かない。

## 最初に読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/CLAUDE.md`
6. `/Users/masa/projects/AMD/amd-os/pwa/AGENTS.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md` と `pwa/spec/1-3-reconstruction-coverage-audit.md`
9. `pwa/spec/1-1-overview.md`、`pwa/spec/1-2-document-layer-migration-map.md`、`pwa/spec/2-1-pwa-runtime-routes.md`
10. `pwa/design/README.md`、`pwa/design/SPEC_pwa.md`、`pwa/design/FEATURE_REGISTRY.md`
11. `pwa/manual/2-1-member-quick-start.md`、`pwa/manual/2-5-research-assets-quick-start.md`、`pwa/manual/4-9-institution-ers-spec.md`
12. `pwa/BUGS.md`の`[auth/browser-client]`、`pwa/design_log/sessions_2026-08.md`、必要なmigrationとAPI実装

## 開始時の確認

read-onlyで、次を取り直す。

1. `git status -sb --untracked-files=all`、`git rev-parse HEAD`、`git rev-parse origin/main`、`git worktree list --porcelain`
2. `curl -fsS https://amd-os-pwa.vercel.app/api/build-info`
3. `institutions`、`seeds`、`seeds.institution_id`、`projects`、`institution_projects`、`project_ventures`、ECR/SPS評価、契約・月次・タスク関連の現行schemaとlive件数
4. 全研究機関・全シーズ・全PJについて、研究機関 ↔ シーズ ↔ PJを一行ずつ追える対応表。関係は事実／推論／設計案／未確認に分け、名称や固定IDから推測で確定しない。
5. `/dashboard`、`/institutions`、`/seeds`、`/project/[projectId]/cockpit`、`/project/[projectId]/workspace`をdesktopとmobileで確認する。`SPEC_pwa.md`の「研究機関PJを通常PJ一覧に二重表示しない」契約と、`dashboard/page.tsx`の現行`p00`だけ除外する挙動を実データで照合する。

## このセッションの成果物

実装前に、まさが判断できる以下を出す。

- 全件対応表と、欠損／二重表現／概念混同の一覧
- ECRとSPSを分離したままの画面影響
- 「研究機関・シーズの2マスタ + PJ運用レイヤー」を既存データを壊さず実現する選択肢。各案にschema、既存データ移行、画面IA、検証、rollbackを含める
- PJを独立物理テーブルにする／しない判断の根拠。必要なら研究機関PJとシーズPJの中間関係・ライフサイクルを分ける
- ホームの情報密度と右マイページの具体的な改善案

監査結果をまさが承認するまでは、書き込み・migration・再計算・UI変更・deployをしない。未確認を「たぶん」で埋めない。
```
