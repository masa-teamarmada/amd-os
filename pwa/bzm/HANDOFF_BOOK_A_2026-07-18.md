# Book A Publication Handoff

Last updated: 2026-07-21 JST

Topic: 司令塔07事故復旧 → 司令塔08起動準備

Working root: `/Users/masa/projects/AMD/amd-os`

BZM root: `/Users/masa/projects/AMD/amd-os/pwa/bzm`

## Current Truth

- 司令塔07が作った未commit事故稿17ファイルは、`/Users/masa/.codex/cleanup_archives/book-a-commander07-20260721-094425-JST/`へ証拠保全済み。正本は事故前へ復旧した。事故稿は入力・素材として読まない、再利用しない。
- Book Aの理論、数式、定義、例、引用、演習、Scenario、Character Bible、理論正本はcommit `236ca1b5e668df4925e3147debb290ecfbd2080f`を内容baselineとして固定する。
- operational HEADは別レーンのcommitで進むことがある。最新git HEADとBook A内容baselineを混同しない。
- 初期改稿対象は章頭ナラティブと、依頼で明示した接続文だけ。理論変更はまさの別承認後に限る。
- 本文執筆・リライト・代筆はFableだけ。Codex/Solは批評、監査、差分、数式検算、機械統合に限定する。

## Commander Boundary

- 司令塔は実務を一切担わない。
- 司令塔は独立したユーザー可視の別セッションを起票、停止し、その成果を受領してよい。Codexでは`create_thread`、Claude側では独立`spawn_task`等を使う。起票先は実務workerであり、Fable本人を称してはならない。
- 司令塔セッション内のAgent、subagent、collaboration `spawn_agent`等へ実務を委譲し、進捗ログや生成本文を司令塔ログへ流す方式は禁止する。実務は必ず司令塔と独立した別セッションが担う。
- 司令塔へ戻すのは、まさの判断点、検証済み成果物、最終closeoutだけ。進捗ログと生成本文を流さない。
- 司令塔08の唯一のcanonical startup promptはrepo rootの`/Users/masa/projects/AMD/amd-os/SESSION_MIGRATION_PROMPT.md`。BZM側の`SESSION_MIGRATION_PROMPT.md`はポインタだけを持つ。

## Fable Launcher Gate

launcher: `/Users/masa/projects/AMD/amd-os/pwa/scripts/book_a_fable_launcher.mjs`

検査script: `/Users/masa/projects/AMD/amd-os/pwa/scripts/check_book_a_fable_launcher.mjs`

launcherは次を固定する。

- 現行15章allowlistのうち1章だけ
- `model=fable`、`effort=max`、`max-budget-usd=5.00`
- fallbackなし、自動再試行なし、1 job=1 chapter
- `--safe-mode --permission-mode dontAsk --tools Read --no-chrome`
- repo内はRead-only、events/draft/manifest/verificationはrepo外job dir
- schemaの`chapter_id` / `artifact_kind` / `theory_touch=false`をconst化
- `236ca1b5`に対する対象章と上位正本のblob一致

採用gateは、synthetic event除外後のunique modelが`claude-fable-5`だけ、費用が上限以内、session単一、result単一success、schema一致、`theory_touch=false`、実行前後repo fingerprint一致。どれか一つでも違えば不採用で、再実行しない。

## First Next Action

司令塔08は最初にrootの`SESSION_MIGRATION_PROMPT.md`を読む。

その後、司令塔08自身が次の1件だけを起票する。

> 独立したユーザー可視のCh1 Fable launcher workerセッションを1件だけ作る。Codexなら`create_thread`、Claude側なら独立`spawn_task`等を使う。起票したworkerがFable CLIを実行し、Fableはrepo外draftだけを生成してrepo正本へ書かない。まさがCh1を確認するまでCh2を起動しない。

司令塔08はその独立セッションの起票、必要時の停止、判断点・成果物・最終closeoutの受領だけを行う。launcherを操作せず、Fableを実行せず、Fable本人を称しない。

## Repo / Deploy Boundary

- branchは`main`だけ。branch/worktreeを作らない。
- target file only stage。`git add .` / `git add -A`は禁止。
- PWA production反映はofficial deploy scriptだけ。`npx vercel`は禁止。
- liveなHEAD、origin/main、production build-info、dirtyはcloseout時に再取得する。固定値としてhandoffへ写さない。

## Pointers

- canonical startup prompt: `/Users/masa/projects/AMD/amd-os/SESSION_MIGRATION_PROMPT.md`
- master status board: `COMMANDER_TASKS.md`
- Fable launcher: `../scripts/book_a_fable_launcher.mjs`
- launcher tests: `../scripts/check_book_a_fable_launcher.mjs`
- change history: `9-5-appendix-changelog.md`
- session record: `../design_log/sessions_2026-07.md`
- incident record: `../BUGS.md`

## Design Sync Inventory

| 変更 | 正本 | 検査 / 履歴 | manual/spec同期 |
|---|---|---|---|
| 司令塔08の役割・起動手順 | root `SESSION_MIGRATION_PROMPT.md` | `COMMANDER_TASKS.md` / 本HANDOFF | 対象外 |
| Fable 1章launcher gate | `pwa/scripts/book_a_fable_launcher.mjs` | `check_book_a_fable_launcher.mjs` / `9-5-appendix-changelog.md` | 対象外 |
| 司令塔07事故 | `pwa/BUGS.md` | `sessions_2026-07.md` | 対象外 |

対象外理由: 今回はBook Aの出版運用とローカルlauncherの安全境界だけを変更し、AMD OSのランタイム、画面、API、DB、利用者導線、操作仕様を変更しないため。manual/specの二重記載は行わない。
