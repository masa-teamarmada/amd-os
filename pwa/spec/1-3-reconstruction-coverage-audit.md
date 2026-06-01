# 再構築カバレッジ監査

> **この章は何か**: `/spec` が「読めば current AMD OS を再構築できる」状態に近づいているかを章単位で監査する表。`current truth confirmed` / `inferred` / `TODO` / `deprecated` を分けて、ごまかさない。

## 判定基準

| 判定 | 意味 |
|---|---|
| `rebuildable` | この章と参照ファイルだけで、実装者が同等機能を再構築できる |
| `partial` | 主要 contract はあるが、DB列・API・failure mode・検証の一部が不足 |
| `not yet` | 旧 manual / design への依存が大きく、再構築にはまだ足りない |
| `deprecated` | 現行で止めた旧経路。復活禁止または明示承認が必要 |

## カバレッジ表

| 領域 | 現行 spec | 判定 | まだ足りないもの |
|---|---|---|---|
| ドキュメント統制 | `1-1`, `1-2`, `1-3`, `5-1`, `6-1` | `partial` | spec lint / 附則追記漏れを機械検知する test |
| PWA route / API surface | `2-1`, `2-2` | `partial` | route ごとの props / component state / edge cases は未移行 |
| Supabase data model | `2-3` | `partial` | 全 table の column-level contract は `db_schema.md` 依存 |
| PJ logo assets | `2-4` | `partial` | UI componentと保存方針は追加済み。`project_assets` DDL / import helper / Storage bucket は未適用 |
| L2② AMD Protocol | `3-9` | `rebuildable` | MMO PC 側 automation 登録状態は repo 外。登録確認は別途必要 |
| L2③ MS Progress | `3-10` | `rebuildable` | MMO PC 側 automation 登録状態は repo 外。run log は別途必要 |
| L2④ Project Knowledge | `3-11` | `rebuildable` | MMO PC 側 automation 登録状態は repo 外。5生データ直結ではなく現行二次集約 |
| L2⑤ Member Knowledge | `3-12` | `rebuildable` | MMO PC 側 automation 登録状態は repo 外。alias map は code_name/email 中心 |
| L2⑩ Textbook Insights | `3-13` | `partial` | DB/API/outbox/local applier contract は追加。実 automation schedule と BZM 追記レビュー運用は repo 外で登録確認が必要 |
| L2 extraction overall | `3-1`〜`3-6`, `3-9`〜`3-13`, `5-3` | `partial` | L2⑥ のmeeting flow深掘り、L2⑦⑧⑨の個別schema、L2⑩の実 schedule / BZM commit loop をさらに column-level 化 |
| notifications / 採否 | `3-7` | `partial` | `applyApprovedNotification()` の kind 別分岐を全件 table 化 |
| cockpit | `3-8` | `partial` | routine stepId / monthly-reward modal / Edge Function bridge は補完済み。kanban、meeting detail attachments、score tabs は未完 |
| AMD Score / FRL | `4-1`, `4-2` | `partial` | alpha retrofit UI、XRL revision API、Triple Helix recompute の詳細 |
| ERS | `4-3` | `partial` | 制度比較seedと投入手順は反映済み。rubric は `/bzm/9-4` 依存で、ERS 8軸rubricのPWA seed同期手順は追加余地あり |
| Admin / Finance / Reward | 未移行 | `not yet` | manual 6章・7章、`reward-summary.ts`、GAS payout PDF の spec 化 |
| Atlas / Seeds / VC / Scholar | 未移行 | `not yet` | manual 4-1/4-2/5章、design `atlas.md` / `seeds.md` / `vc_list.md` の spec 化 |
| GAS | `5-2`, `5-3`, `5-5` | `partial` | GAS file/function 別の current / deprecated 表 |
| iOS | `5-5` | `partial` | `ios/DESIGN.md` の全画面を spec へ移す作業 |

## Current Truth Confirmed

この監査で直接確認した実装:

- PWA page route files: `pwa/src/app/(app)/**/page.tsx`
- API route files: `pwa/src/app/api/**/route.ts`
- `/spec` metadata: `pwa/src/app/(app)/spec/spec-chapters.ts`
- `/bzm` metadata: `pwa/src/app/(app)/bzm/bzm-chapters.ts`
- PJ logo UI: `pwa/src/components/projects/ProjectLogo.tsx`, `pwa/src/components/projects/ProjectMention.tsx`, `pwa/src/lib/project-logo-assets.ts`
- notifications: `pwa/src/app/(app)/notifications/page.tsx`, `pwa/src/components/notifications/NotificationsClient.tsx`, `pwa/src/app/api/notifications/feedback/route.ts`
- L2②〜⑤: `pwa/scheduled-tasks/amd-os-l2-protocol-extract/SKILL.md`, `pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md`, `pwa/scheduled-tasks/amd-os-l4-project-knowledge-extract/SKILL.md`, `pwa/scheduled-tasks/amd-os-l5-member-knowledge-extract/SKILL.md`
- cockpit: `pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx`, `pwa/src/components/cockpit/CockpitView.tsx`, `pwa/src/components/cockpit/CockpitRoutineGas.tsx`, `pwa/src/components/cockpit/CockpitMonthlyModal.tsx`
- ERS: `pwa/src/lib/ers-data.ts`, `pwa/src/app/api/institutions/assess/route.ts`
- iOS role boundary: `ios/DESIGN.md`
- GAS role boundary: `gas/001_Router.js`, `gas/014_PaymentConfirm.js`, `gas/064_PayoutFreeeNotice.js`
- schema: `pwa/design/db_schema.md`

## Inferred

- `design/SPEC_pwa.md` の route/API/cron 表は現行コードと概ね一致するが、全 route の component detail はまだ `src` から完全逆引きしていない。
- `pwa/design/L2_DATA.md` と `pwa/scheduled-tasks/*/SKILL.md` は L2 の current writer を示すが、実際の automation 登録状態は Codex Desktop / LaunchAgent 側の外部状態も含む。

## TODO

1. L2⑥ Meeting Flow の個別 spec を、予定MTGカード / assets / Calendar sync まで深掘りする。
2. Admin / Finance / Reward を `/spec` へ移す。
3. GAS file/function current/deprecated matrix を作る。
4. Atlas / Seeds / VC / Scholar を `/spec` へ移す。
5. iOS screen migration を `/spec` へ移す。
