AMD OS の「現金と融資」（月ごとの推移・見込み）の続き。cwd は /Users/masa/projects/AMD/amd-os。

## 読む順
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md（AMD横断memory）
3. /Users/masa/projects/AMD/amd-os/AGENTS.md
4. /Users/masa/projects/AMD/amd-os/HANDOFF_CASH_TREND_20261114.md
5. /Users/masa/projects/AMD/amd-os/pwa/manual/6-13-cash-and-loans-spec.md（正本。全文）
6. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md の「[現金と融資]」2件

## 状態（2026-11-14 時点）
- 本番は v3.162.35 で「現金と融資 → 03 月ごとの推移」が動いている（2026-10-15 に PC Chrome で確認。以降は未確認）。
- 関連コード: pwa/src/lib/finance/cash-monthly-trend.ts（区分・月末残高・見込み）、ledger-running-balance.ts（明細の積み上げ）、cash-and-loans.ts（集計）、freee-cash-balances.ts（月末残高の取り込みで商工中金を明細の値に差し替え）、pwa/src/components/admin/cash/CashTrendPanel.tsx（画面）。検査は npm run test:cash-monthly-trend / test:ledger-running-balance。
- 本番DB: migration 503 適用済み（商工中金 freee_sync_from=NULL、9/30 の振替40万円、PayPay銀行初回返済3万円）。
- 共有checkoutに別セッションの未コミット変更（pwa/src/components/question-tree/QuestionTreeView.tsx）がある。触らない。

## 次のタスク
まさの希望（原文の趣旨）: 「月末にひと通り支払を済ませた段階で余ってるお金があれば、それを一旦 PayPay に返済して、また月末に足りなくなったら借りる、というのを繰り返して、なるべく利子を減らしたい」。
えいみは「月ごとの推移」の下に「PayPay銀行の返し借りの目安」表（何日にいくら返し・何日に借り直すか、月の最低残高の日と額、減らせる利子。口座に残す最低額の推しは30万円、画面で変更可）を提案し、まさの回答待ち。まず回答を確認し、作る場合はきよの予定の日付で日ごとの残高を出す（予定の無い月は日付が無いので、その扱いを正本に書く）。PayPay銀行のビジネスローンを手数料なしで随時返済・再借入できるかは未確認なので、まさの確認結果を待つ。

## 運用ルール
- まさへの報告は画面で見えるものから、専門語を使わずに。
- 本番DBへの書き込みは Supabase の接続ツールだと許可確認で止まる。まさの指示で、まさの Chrome の Supabase SQL 画面から実行する。migration は pwa/scripts/migrations/ に番号付きで残す。
- 反映は main へ push（Vercel 自動）。push 前に git fetch、自分の対象ファイルだけを add、build-info の版を上げる。反映は /api/build-info の git_sha を祖先判定で待ち、Chrome で強制再読込して画面左上の版番号と画面を確認する。
- 仕様を変えたら 6-13 の正本と変更履歴、検査を同じ commit で更新する。
