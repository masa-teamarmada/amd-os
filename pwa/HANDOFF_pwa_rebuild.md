# HANDOFF - AMD OS PWA

- 更新: 2026-08-21 JST
- セッション: PJ知財タブの新設 → ワークスペース展開 → 特許マップ縮小 → タブの押下アフォーダンス
- 作業種別: development

## 現在地

- このセッションの実装はすべて `main` に載り、本番反映まで完了している。
  1. `823f145e` / `18188551` / `229edcfc` — PJコックピットの**知財タブ**を新設。4テーブル台帳（`project_ip_assets` / `_deadlines` / `_rights` / `_events`）、`/api/project-ip`、立場別の28列テーブル（先頭列・先頭行固定の横スクロール）、特許マップ3種。migration `311` でライフサイクル列を追加。初期データはSE（p10）。
  2. `50f88448` — `check_pwa_critical_ui.cjs` の古いanchorを修復。origin/main時点で全セッションのdeployを止めていた（BUGS.md参照）。
  3. `de33ef6f` / v3.87.4 — 知財タブをPJワークスペースにも展開し、ワークスペースのタブ列をコックピットと同じ見た目へ統一。
  4. `da23c76d` / v3.87.5 — 特許マップの拡大を止めて縮小。
  5. `32c09720` / v3.88.2 — コックピット／ワークスペースのタブに押下アフォーダンス（pointerカーソル＋2px浮き上がり）。カーソルはOS全体のボタンに効く。
- 本番確認: `/api/build-info` の `git_sha` がそれぞれ `50f88448…` / `da23c76d…` / `32c09720…` と一致することを deploy ごとに確認済み。
- 正規checkoutは deploy 後の `git fetch` で behind 0 / ahead 0。
- BUILD_VERSION は複数セッションが並行して bump する。採る前に必ず `src/lib/build-info.ts` の HEAD 値を読む（今回も v3.87.x → v3.88.1 が別セッションに先取りされていた）。

## 検証

- `npx tsc --noEmit` → 自分の変更ぶんエラー0。別セッション未コミットの `src/components/venture-map/AmdScoreFormulaPanel.tsx` の既存エラーのみ除外して確認した。
- `npm run -s test:critical-ui` → ok。
- deployは全件 `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash scripts/deploy.sh` 経由。`npx vercel` は使っていない。
- ブラウザでの実操作確認は未実施（`未確認`）。まさの画面での体感が最終確認になる。

## 未解決

- 知財台帳の外部同期は未接続（`pwa/spec/3-19-project-ip-current-spec.md` §5）。次の3つが残っている。
  1. 特許庁 特許情報取得API と EPO OPS の**利用者登録**。申請内容は提出前にまさへ見せる。
  2. `project_ip_deadlines` を `app_notifications` / `proactive_todos` へ配線（年金納付期限・PCT移行期限の通知）。
  3. `/admin/ip` の静的 `IP_REPORT_MD` をp00資産として台帳へ統合。
- 自分の作業由来のブロッカーは無し。このセッションで作ったbranch / worktree: **none**。

## 作業ツリーの状態（2026-08-21 handoff 時点、他セッション所有）

- tracked dirty: `pwa/src/components/workspace-documents/WorkspaceDocumentRoom.tsx` / `workspace-document-room.module.css`
- 未追跡のmigrationが2本とも `312_` 番号で衝突している（`312_seed_screening_bands_p_ind_rationale.sql` と `312_workspace_folder_visibility_cascade.sql`）。**どちらも他セッション所有**。先に適用する側が `313_` へ採番し直す必要がある。こちらは触っていない。
- 上記はcommit・revert・削除しない。

## 次の最初の行動

知財台帳を次に触るときは、`CockpitIpPortfolio.tsx` を読む前に `pwa/spec/3-19-project-ip-current-spec.md` を読む。守る契約は3つ。

1. `/api/project-ip` のGETは `requireAuth`（メンバー）、書き込みは `requireAdmin`。ワークスペース側の知財タブが外部へ漏れないのは `SxWeeklyControlDashboard` が `principal: "member"` でしか描画されないため。この前提を崩さない。
2. ワークスペースskinの44px強制に対する例外は `.sx-management-workspace .sx-ip-portfolio button` の**サブツリー限定**で入れてある。広域上書きへ広げない。
3. 図やチャートのSVGに `w-full` を単独で当てない（拡大する）。`width`/`height` 属性＋ `h-auto max-w-full` が既定形。

列を足すときは `pwa/design/db_schema.md` を先にgrepし、DDL適用後に `python3 -X utf8 scripts/dump_schema.py` を同じcommitへ含める。

## 参照先

- 知財UI: `pwa/src/components/cockpit/CockpitIpPortfolio.tsx` / `pwa/src/components/cockpit/PatentMap.tsx`
- API: `pwa/src/app/api/project-ip/route.ts`
- ワークスペース: `pwa/src/components/project-workspace/SxWeeklyControlDashboard.tsx` / `weekly-control.module.css`
- タブUI: `pwa/src/components/cockpit/CockpitView.tsx` / `pwa/src/app/globals.css`（`@layer base` のcursor既定）
- migration: `pwa/scripts/migrations/311_project_ip_lifecycle_columns.sql`
- 設計書: `pwa/spec/3-19-project-ip-current-spec.md` / `pwa/spec/3-16-project-weekly-control-current-spec.md` / 変更履歴 `pwa/spec/6-1-appendix-changelog.md`
- 利用者マニュアル: `pwa/manual/2-3-pj-cockpit.md` / 変更履歴 `pwa/manual/9-3-appendix-changelog.md`
- 開発履歴: `pwa/design_log/sessions_2026-08.md`
- バグ・教訓: `pwa/BUGS.md`
