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
| ドキュメント統制 | `1-1`, `1-2`, `1-3`, `1-4`, `1-5`, `5-1`, `6-1` | `partial` | spec lint / 附則追記漏れを機械検知する test |
| AMD OS全体収束 | `1-4`, `1-5` | `partial` | 共通カーネルmigration、三者PJ面のproduction resolver / DTO / DB integration、旧画面のprojection化、本番権限readback |
| PWA route / API surface | `2-1`, `2-2` | `partial` | route ごとの props / component state / edge cases は未移行 |
| PWA UIデザインコード | `2-7` | `rebuildable` | 画面固有の比較軸と集計式は各機能specへ置く |
| 名刺管理 / PJ人物ナレッジ | `2-5`, `3-11` | `rebuildable` | Gemini / Supabase production env と private Storage bucket は環境設定が必要 |
| Supabase data model | `2-3` | `partial` | 全 table の column-level contract は `db_schema.md` 依存 |
| D-1 AMD Protocol | `3-9` | `rebuildable` | MMO PC 側 automation 登録状態は repo 外。登録確認は別途必要 |
| D-2 MS Progress | `3-10` | `rebuildable` | MMO PC 側 automation 登録状態は repo 外。run log は別途必要 |
| D-3 Project Knowledge | `3-11` | `rebuildable` | MMO PC 側 automation 登録状態は repo 外。5生データ直結ではなく現行二次集約 |
| D-4 Member Knowledge | `3-12` | `rebuildable` | MMO PC 側 automation 登録状態は repo 外。alias map は code_name/email 中心 |
| D-7 Textbook Insights | `3-13` | `partial` | DB/API/outbox/local applier contract は追加。実 automation schedule と BZM 追記レビュー運用は repo 外で登録確認が必要 |
| L2 extraction overall | `3-1`〜`3-6`, `3-9`〜`3-13`, `5-3` | `partial` | H-1 のmeeting flow深掘り、D-5M-2D-6の個別schema、D-7の実 schedule / BZM commit loop をさらに column-level 化 |
| notifications / 採否 | `3-7` | `partial` | `applyApprovedNotification()` の kind 別分岐を全件 table 化 |
| cockpit | `3-8` | `partial` | PM routine stepId は廃止済み。monthly/reward modal / Edge Function bridge 境界は補完済み。kanban、meeting detail attachments、score tabs は未完 |
| AMD Score / FRL | `4-1`, `4-2` | `partial` | alpha retrofit UI、XRL revision API、Triple Helix recompute の詳細。現行SPS、BZM 2.0観測台帳、BZM 2.1動的方針台帳のDB/API/UI境界は4-2へ記録済みだが、BZM 2.1の実PJ入力・前向き検証、独立複数評価者、重み・符号化・集約方式の感度分析は未実施 |
| ECR | `4-3` | `partial` | 制度比較seedと投入手順、2026-07-29の主張境界は反映済み。rubric は `/bzm/9-4` 依存で、ECR 8軸rubricのPWA seed同期、自前ストック・実効サービス・流量成果の三層化、独立複数評価者、成果妥当性検証は未実装 |
| 外部workspace / 研究機関 / SU | `1-4`, `1-5`, `2-1`, `2-2`, `2-3`, `4-3` | `partial` | organization tenant、capability、共同作業・判断、大学向けPJ面、外部公開版、資料revision、旧Project Share退役readback |
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
- notifications: `pwa/src/app/(app)/notifications/page.tsx`, `pwa/src/components/notifications/NotificationsClient.tsx`, `pwa/src/app/api/notifications/feedback/route.ts`
- D-1〜D-4: `pwa/scheduled-tasks/amd-os-l2-protocol-extract/SKILL.md`, `pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md`, `pwa/scheduled-tasks/amd-os-l4-project-knowledge-extract/SKILL.md`, `pwa/scheduled-tasks/amd-os-l5-member-knowledge-extract/SKILL.md`
- cockpit: `pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx`, `pwa/src/components/cockpit/CockpitView.tsx`, `pwa/src/components/cockpit/CockpitMonthlyList.tsx`, `pwa/src/components/cockpit/CockpitMonthlyModal.tsx`
- ECR: `pwa/src/lib/ers-data.ts`, `pwa/src/app/api/institutions/assess/route.ts`
- iOS role boundary: `ios/DESIGN.md`
- GAS role boundary: `gas/001_Router.js`, `gas/014_PaymentConfirm.js`, `gas/064_PayoutFreeeNotice.js`
- schema: `pwa/design/db_schema.md`

## Inferred

- `design/SPEC_pwa.md` の route/API/cron 表は現行コードと概ね一致するが、全 route の component detail はまだ `src` から完全逆引きしていない。
- `pwa/design/L2_DATA.md` と `pwa/scheduled-tasks/*/SKILL.md` は L2 の current writer を示すが、実際の automation 登録状態は Codex Desktop / LaunchAgent 側の外部状態も含む。

## TODO

1. H-1 Meeting Flow の個別 spec を、予定MTGカード / assets / Calendar sync まで深掘りする。
2. Admin / Finance / Reward を `/spec` へ移す。
3. GAS file/function current/deprecated matrix を作る。
4. Atlas / Seeds / VC / Scholar を `/spec` へ移す。
5. iOS screen migration を `/spec` へ移す。
6. `1-4` の共通カーネルと`1-5`の三者受入を、migration・API・UI・本番readbackへ段階適用する。
