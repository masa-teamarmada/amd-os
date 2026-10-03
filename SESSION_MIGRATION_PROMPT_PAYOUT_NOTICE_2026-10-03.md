# 次セッション移行プロンプト（支払通知書の摘要表記）

```
cwd: /Users/masa/projects/AMD/amd-os

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md
4. HANDOFF_PAYOUT_NOTICE_2026-10-03.md
5. pwa/manual/6-5-admin-payouts-reward-notice-spec.md（「明細の摘要」行、「送付済み/支払済み通知書と相殺」節）
6. pwa/src/lib/payout-source-span.ts と pwa/scripts/check_payout_source_span.mts
7. BUGS.md の 2026-10-02・2026-10-03

状態:
- 支払通知書の摘要は3行: 「SOL 業務委託料（10月お支払分）」/「対象：2026年4〜5月の稼働」/「未払い残高 258,933円（税抜、翌月以降にお支払いします）」。
  3行目は本契約の未払いが残る行だけ。稼働月は古い稼働月から順に今回の支払を当てて決める（内訳モーダルと同じ仮定）。
- 本番: PWA v3.148.4（258d453e 以降）、GAS 本番配信版 @1505。どちらも反映確認済み。
- 10月支払分の未送付通知書（ID003・ID007・ID009）は作り直し済み、メール未送信。ZMP の3人は月初合意 gate で未作成。
- ちこ9月分（PN202609-003、送付・支払済み）は差し替え版PDFだけ作成: Drive 1PIeIaTGkTkjBIEKs-wIOyeQ5p3yc9D-t。DBの送付記録は元のまま。
  途中の版 1iC7jhFexfhm7Yzvac-ZpapGNlfDhic_3・1NveHsrt7tCUAzvCMfY_c0MVhhKRYVK4F は不要（削除はまさ）。
- 共有 checkout は別セッションの dirty と未push commit 3件があり behind。触らず、作業は origin/main を clone した使い捨ての clean clone で行う。

次タスク（まさの指示があった場合だけ）:
- 送付済みで旧表記の通知書（例: かるの8月支払 145,575円「4〜6月発生分の一部」）の差し替え版を作る。
  まず payout_notices の sent_at ありの行で、繰越がある明細を持つものを一覧にしてまさへ見せる。
- 税理士・きょうこさんの確認で「稼働月の行は不要」となったら、payoutTargetText の行を外し、テスト・manual 6-5・changelog を同時に直す。

運用ルール:
- 送付済み通知書は sent_protected。DBの pdf_url / sent_at を上書きしない。差し替えは GAS payoutCreatePwaNoticePdf を runFunc で直接呼び、別ファイルとして作る。
- メールは絶対に送らない。送付ボタンはまさが押す。
- GAS は clasp push と deploy --deploymentId の2段で初めて反映。push 前に clasp pull で本番と本流を比べ、本番にしか無い変更があれば止める。
- PWA は deploy.sh 経由、BUILD_VERSION を毎回上げる。未送付PDFを作り直すときは PAYOUT_NOTICE_PDF_TEMPLATE_UPDATED_AT を上げてから prebuild cron を ym 指定で叩く。
- 備考欄（noteText）は 2026-08-28 のまさ判断で空のまま。
- まさへの報告は画面で見えるものから書き、技術語を並べない。
```
