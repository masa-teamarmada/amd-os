# 次セッション移行プロンプト（2026-08-21 handoff、AMD OS PWA）

## 0. 読む順（この順で、読み終わるまで実装しない）

1. `/Users/masa/projects/AGENTS.common.md` — えいみ共通ルール正本
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD階層の記憶
3. `/Users/masa/projects/AMD/amd-os/CLAUDE.md` — モノレポ大原則（main一本 / commit即push / セッション開始時のfetch4ステップ）
4. `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md` — PWA固有（deploy.sh経由のみ / BUILD_VERSION bump / DDL手順 / db_schema.md先読み）
5. `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md` — 現在地と次の一手
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-19-project-ip-current-spec.md` — 知財台帳の現行仕様（今回の主対象）
7. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md` — 直近2件（critical-ui anchor / Tailwind v4 preflight）を最低限読む

作業ディレクトリ: `/Users/masa/projects/AMD/amd-os/pwa`

## 1. 状態スナップショット（2026-08-21 handoff 時点）

- HEAD = `32c09720`（main）。本番 BUILD_VERSION = **v3.88.2**。`/api/build-info` の `git_sha` が `32c09720…` であることを確認済み。
- 正規checkout: ahead 0 / behind 0。**このセッションで作ったbranch・worktree: none。**
- このセッションの成果（すべて本番反映済み）
  - PJコックピットに**知財タブ**を新設。4テーブル台帳（`project_ip_assets` / `_deadlines` / `_rights` / `_events`）、`/api/project-ip`、28列テーブル（先頭列・先頭行固定の横スクロール）、特許マップ3種、資料室の独立タブ化。migration `311`。初期データはSE（p10）。
  - 知財タブをPJワークスペースにも展開し、ワークスペースのタブ列をコックピットと同じ見た目へ統一。
  - 特許マップの拡大を修正して縮小。
  - タブに押下アフォーダンス（pointerカーソル＋2px浮き上がり）。カーソル既定は `globals.css` の `@layer base` でOS全体のボタンに効く。
- **他セッション所有の未コミット差分（触らない）**
  - `pwa/src/components/workspace-documents/WorkspaceDocumentRoom.tsx`
  - `pwa/src/components/workspace-documents/workspace-document-room.module.css`
  - 未追跡migrationが2本とも `312_` で番号衝突（`312_seed_screening_bands_p_ind_rationale.sql` / `312_workspace_folder_visibility_cascade.sql`）。**先に適用する側が `313_` へ採番し直す。** 自分の作業でないなら報告だけ。
- 素材の所在: 知財UIは `src/components/cockpit/CockpitIpPortfolio.tsx` と `PatentMap.tsx`、APIは `src/app/api/project-ip/route.ts`、ワークスペース側は `src/components/project-workspace/SxWeeklyControlDashboard.tsx` と `weekly-control.module.css`。

## 2. 次のタスク（優先順）

**A. 知財台帳の外部同期（`spec/3-19` §5 の未接続3点）**

1. 特許庁「特許情報取得API」と EPO OPS の**利用者登録**。まさの指示は「外部サービス登録は申請内容をまさへ見せてから出す」。フォーム項目を埋めた状態でチャットに提示し、まさのOKを取ってから送信する。勝手に登録しない。
2. `project_ip_deadlines` を `app_notifications` / `proactive_todos` へ配線する。年金納付期限とPCT移行期限が近づいたらOSの通知に出る状態がゴール。`l2_kind` は PWA feedback route の `allowedKinds` が正本なので、野良の種別を作らない。
3. `/admin/ip` の静的 `IP_REPORT_MD` をp00資産として台帳へ統合し、静的mdの二重管理をやめる。

**B. まさから来る可能性が高い追随依頼**

- 知財タブは今SEにしか実データが無い。他PJへ広げるなら「どの生データから抽出するか」を先に決める（手動入力前提の機能を作らない、はAMD OSの原則）。
- タブUIは2箇所（Tailwind版とCSS module版）で同じ数値を手書きしている。片方だけ直すとズレるので必ず両方直す。

## 3. このPJで確立済みの運用ルール（守る）

- **branch・worktreeを作らない。main直commit。`spawn_task` で次セッションを起票しない。**
- `git add .` 禁止。**commitは必ずパス指定形式**（`git commit -m … -- <paths>`）。他セッションのdirtyはstash・revert・commitしない。
- 編集したら即commit・即push。push直前に `git fetch origin main`。
- 本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` のみ。`npx vercel deploy` / `--prod` は禁止。deployは原則ノンストップ・事後報告。事前承認が要るのは既存業務導線(FEATURE_REGISTRY)の削除・置き換えと、まさが「確認してから」と言った作業だけ。**DDL・本番データ書き込みは事前承認不要。**
- deploy前に `src/lib/build-info.ts` の `BUILD_VERSION` をbump。**採る前に必ずHEADの値を読む**（複数セッションが並行でbumpする）。新機能=minor、修正/UI/データ=patch、迷ったらpatch。
- DDLは `python3 -X utf8 scripts/apply_ddl.py scripts/migrations/NNN_name.sql`。migrationファイルは残す。列名は想像で書かず `design/db_schema.md` をgrepしてから書く。適用後は `python3 -X utf8 scripts/dump_schema.py` を同じcommitに含める。
- 検証は `npx tsc --noEmit` と `npm run -s test:critical-ui`。deploy.shがcritical-ui anchorで落ちたら、まず `git show origin/main:<path> | grep -c` で「自分の変更のせいか、origin/mainで既に壊れていたか」を切り分ける（2026-08-21に後者で全セッションのdeployが止まった実例あり）。
- SVGに `w-full` を単独で当てない。`width`/`height` 属性＋ `h-auto max-w-full` が既定形。横スクロールさせたい表だけ `min-w-[N] w-full`。
- 秘密値は表示・復唱・保存しない。`***` で伏せる。
- 日本語のヒアドキュメントをpythonの `<<'PY'` で流すとUTF-8エラーになる。スクリプトはscratchpadへ書いて `python3 -X utf8 <file>` で実行する。
