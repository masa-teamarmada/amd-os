# AMD OS Handoff

Last updated: 2026-07-18 JST

Target: `/Users/masa/projects/AMD/amd-os`
Topic: SX (`p21`) PJ共有ダッシュボードとPJ限定アクセス

## Latest Session Summary

- AMD OSを全PJ横断ユーザーとPJ限定ユーザーの両方で使えるように拡張した。
- AMD / 産連の横断ユーザーは従来どおり `/dashboard` がトップ。PJ限定ユーザーは参加1件なら `/project/{projectId}/workspace`、複数なら `/my-projects` がトップ。
- SXカードは `/project/p21/workspace` を開く。共有面は研究→応用→開発→SU→調整の週次エフォート、メンバー別配分、MS、抽出済み活動集計を表示する。
- PJ限定Google OAuthは本人確認後に通常のSupabase sessionを破棄し、7日間のHTTP-only署名付きPJ sessionへ交換する。既存社内RLS/APIを外部ユーザーへ継承させない。
- migration 182を本番DBへ適用。`members.os_access_scope`、`project_weekly_effort_entries`、scope helperを追加し、`amd_os_is_member()` はportfolio/adminだけをtrueにした。
- build targetは `v3.45.0`。

## Current Truth

- SX (`p21`) にはactive member 4人、既存の `member_activities` 139件がある。
- PJ限定アカウントと週次エフォート入力はまだ0件。実在メンバーのGoogleメールを推測せず、確認後に `/admin/members` で登録する。
- `/admin/members` のPJ限定アカウント作成は `os_access_scope='project'`、支払通知対象外に固定する。作成後、`/admin/projects` で `p21` のactive memberへ紐付ける。
- 共有DTOへraw本文、source URL、email、報酬、契約、内部戦略、他PJ情報を含めない。
- 愛大OSのMVP方針は、SXをAMD OSで先行実証し、独立EHM OSを大量シーズ、産連業務、M365、大学側権限へ一般化する次段階へ置いた。

## Verification

- target-file ESLint: pass
- `npx tsc --noEmit`: pass
- `npm run test:deploy-version-guard`: pass
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
