# AMD OS Handoff

Last updated: 2026-07-19 JST

Target: `/Users/masa/projects/AMD/amd-os`
Topic: SX (`p21`) PJ共有ダッシュボードとPJ限定アクセス

## Latest Session Summary

- AMD OSを全PJ横断ユーザーとPJ限定ユーザーの両方で使えるように拡張した。
- AMD / 産連の横断ユーザーは従来どおり `/dashboard` がトップ。PJ限定ユーザーは参加1件なら `/project/{projectId}/workspace`、複数なら `/my-projects` がトップ。
- SXカードは `/project/p21/workspace` を開く。共有面は研究→応用→開発→SU→調整の週次エフォート、メンバー別配分、MS、抽出済み活動集計を表示する。
- PJ限定Google OAuthは本人確認後に通常のSupabase sessionを破棄し、7日間のHTTP-only署名付きPJ sessionへ交換する。既存社内RLS/APIを外部ユーザーへ継承させない。
- migration 182を本番DBへ適用。`members.os_access_scope`、`project_weekly_effort_entries`、scope helperを追加し、`amd_os_is_member()` はportfolio/adminだけをtrueにした。
- build targetは `v3.45.0`。

## SX COO統合経営ダッシュボード実装追記

- build targetは `v3.46.3`。`/project/p21/workspace` はヘッダー直後に経営判定・理由・今週決めること・次期限・鮮度を置き、長い運用準備チェックを後段へ移した。運用準備5項目が未確認ならトップ判定も未評価に閉じる。stickyナビは`overflow-x-clip`で実スクロールに追従し、選択詳細と協力機関カードの関連ゲートはID/slugを名称へ変換する。可視文の資金残存月数表記と3幅の内部語DOM監査を追加した。
- migration 183 は旧 `project_sx_*` を作らず、`project_management_*` の正規化台帳だけを追加する。KPI閾値 (`gte` / `lte` / `between`)、完了条件・証跡、依存DAG、論点→仮説→証拠→検証→意思決定→action、協力機関の約束履歴、技術試験、資金スナップショット、組織役割、RACI、容量、field auditを含む。
- overall / 4本柱の状態は進捗手入力ではなく、必須KPI・期限・担当・鮮度・依存・完了条件・action・役割・閾値を用いたderived判定が正本。充足率は表示値に留める。FC北陸は低確度の候補/情報交換、PFは未合意、100L PoCは復活させない。
- migration 184で未決論点 (`decision_needed`)、相手の約束/SX側の次アクション、相手の約束のDB必須条件、親情報の同一PJ triggerを補正した。`/api/project-workspace/[projectId]/management` はresource別status列、同一PJ、PJ所属、decisionの状態、soft-delete、boolean、KPI範囲を検証し、GET/PATCH/POSTの履歴とfield auditを残す。POSTの履歴失敗は追加行を補償的にsoft-deleteする。PJ共有面にraw本文、source URL、契約原文、報酬、メール本文、内部交渉メモを返さない。
- migration 185で決定済みの決定内容・決定者・決定日、SX側の次アクションのSX担当・期限・次回確認をDB CHECKで強制する。管理者UIに非表示化（soft delete）と非表示情報のPJ内確認・復元を追加し、GET `include_deleted=true` はportfolio/adminだけに限定、履歴失敗時のPATCHも更新前へ補償復元する。
- RLSのmember_selectはsoft-delete済み行を除外する。`scripts/test_project_management_rls.mjs` は実在active memberをauthenticated roleで検査し、削除済み行非表示・有効p21可視・未所属ユーザー拒否を確認する。
- desktop/tablet/mobileはそれぞれ、lg以上の表/ガント、768pxのカード、390pxの期限順カード/縦ロードマップを使い分ける。workspace直リンクは月初合意モーダルと左デスクトップナビを出さず、選択行は選択文脈へ移動する。モバイルで表・ガントを横スクロールさせない。

## Current Truth

- SX (`p21`) にはactive member 4人、既存の `member_activities` 139件がある。
- PJ限定アカウントと週次エフォート入力はまだ0件。実在メンバーのGoogleメールを推測せず、確認後に `/admin/members` で登録する。
- `/admin/members` のPJ限定アカウント作成は `os_access_scope='project'`、支払通知対象外に固定する。作成後、`/admin/projects` で `p21` のactive memberへ紐付ける。
- 共有DTOへraw本文、source URL、email、報酬、契約、内部戦略、他PJ情報を含めない。
- 愛大OSのMVP方針は、SXをAMD OSで先行実証し、独立EHM OSを大量シーズ、産連業務、M365、大学側権限へ一般化する次段階へ置いた。

## Verification

- target-file ESLint: pass (error 0 / warning 0)
- `npx tsc --noEmit`: pass
- `npm run test:deploy-version-guard`: pass
- `npm run test:sx-management-rls`: pass (184/185 CHECK、補正履歴、20 soft-delete member_select、PJ境界)
- `npm run test:critical-ui`: pass
- `npm run build`: pass
- full `npm run lint`: existing unrelated baseline 83 errors / 55 warningsでfail。今回対象ファイルにはerrorなし。
- UIは1440x1000、768x900、390x844で確認し、mobile/tabletをbottom nav、入力controlを44px、5分類帯を全表示に修正済み。

## First Next Action

1. SX研究開発メンバーのGoogleメール、表示名、役割を確認する。
2. `/admin/members` でPJ限定アカウントを作り、`/admin/projects` で `p21` へ紐付ける。
3. 本人アカウントで、SXがトップになること、他PJ・dashboard・社内cockpitへ入れないことを確認する。
4. 4週間、5分類の予定 / 実績時間を週次運用し、次にタスク、割り込み、停滞、オーナー / 実作業者へ広げる。

## Guardrails

- PJ限定ユーザーへ通常のSupabase authenticated sessionを残さない。
- 共有面へ社内cockpitのdata bundleをそのまま渡さない。
- 実アカウントのメール、役割、週の基準時間を推測でseedしない。
- 個人別時間を勤怠、人事評価、個人ランキングへ使わない。
- `git add .` を使わず、対象bundleだけをstageする。
- PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。
