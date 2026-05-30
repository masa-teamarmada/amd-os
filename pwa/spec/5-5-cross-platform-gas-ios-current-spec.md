# GAS / iOS 役割境界仕様

> **この章は何か**: PWA だけでなく、GAS と iOS が current AMD OS のどこを担当するかを再構築時に迷わないための境界仕様。詳細正本は GAS source と `ios/DESIGN.md`。

## iOS の役割

| 領域 | iOS current role | source |
|---|---|---|
| top-level app | SwiftUI iOS 17+ native client | `ios/AMDOS/AMDOSApp.swift`, `ios/AMDOS/ContentView.swift` |
| tabs | MyPage / 月次ルーティン / 立替 / PJ進捗 / Admin / 設定 | `ios/DESIGN.md` |
| auth | Google Sign-In + Supabase Auth | `ios/AMDOS/Features/Auth/` |
| notification inbox | `l2_notifications` / `meeting_notifications` を確認し、はい/いいえ/コメントを返す | `ios/DESIGN.md`, `ios/HANDOFF_l2_notifications.md`, `ios/HANDOFF_meeting_notifications.md` |
| routine | ProjectListView → RoutineFlowView で月次 step を進める | `ios/DESIGN.md` |
| reimburse | native 立替申請 / 承認 | `ios/DESIGN.md` |
| cockpit | native PJ進捗 / MS revision UI | `ios/DESIGN.md` |

iOS は Supabase backend を PWA と共有する。PWA にしかない管理・探索・高度分析画面もあるため、iOS は「全機能の完全 mirror」ではなく、日常運用と通知確認を native で担う client と扱う。

## GAS の役割

GAS は旧 OS の多くを持つが、current PWA では主に外部サービス連携・PDF生成・一部 legacy UI/bridge を担う。

| GAS file / function group | current role |
|---|---|
| `001_Router.js` | WebApp `doGet` / mode routing。payment confirm / invoice PDF upload / cancel など legacy pages |
| `014_PaymentConfirm.js` | 旧 Gmail 入金確認 token flow。cron は deprecated、入金確認通知は Slack / PWA 側へ移行 |
| `064_PayoutFreeeNotice.js` | 支払通知書 PDF 生成・Drive保存。PWA `/admin/payouts` から改善版 PDF payload を渡す |
| `007_FreeeInvoiceFlow.js` / `008_FreeeInvoicePdf.js` | freee 請求書・PDF 関連 |
| `153_MeetingHourlyTrigger.js` / `155_L2KnowledgeExtractor.js` | LLM cron として停止済み。L2 writer として復活しない |

GAS deploy は `/spec/5-2-development-operations-current-spec` の手順に従う。

## 再構築時の境界

| 変更対象 | まず見る正本 |
|---|---|
| PWA route / API / UI | `/spec/2-2`, `pwa/src/app`, `pwa/src/components` |
| Supabase schema | `/spec/2-3`, `pwa/design/db_schema.md` |
| L2 extraction | `/spec/3-1`〜`3-7`, `pwa/scheduled-tasks/*/SKILL.md` |
| iOS native screen | `ios/DESIGN.md`, `ios/CLAUDE.md` |
| GAS PDF / freee / legacy WebApp | GAS source, `/spec/5-2` |

## Current Truth Confirmed

- `ios/DESIGN.md` states the native tab layout and goal that the doc alone should describe all native screens.
- `gas/001_Router.js` still owns WebApp routing modes.
- `gas/014_PaymentConfirm.js` marks old daily payment confirmation cron deprecated.
- `gas/064_PayoutFreeeNotice.js` owns PWA payout notice PDF generation.

## 未確認

- iOS current code is only shallow-inspected here. Screen-by-screen Swift file mapping is still `ios/DESIGN.md` dependent.
- GAS function inventory is incomplete. A function-level current/deprecated matrix should be generated from `gas/*.js`.

## 再構築可能性チェック

この章で PWA / GAS / iOS の責務境界は再構築できる。ただし iOS 全画面と GAS 全 function を再実装するには、`ios/DESIGN.md` と GAS source の専用 spec 化が必要。
