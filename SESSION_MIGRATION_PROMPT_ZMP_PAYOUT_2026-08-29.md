# 次セッションへの引っ越しプロンプト（ZMP あびの報酬 / 支払通知書の備考）

cwd: `/Users/masa/projects/AMD/amd-os`

---

AMD OS の作業を続けて。**あびの報酬要望への対応は完了・送付済み**で、残っているのは後始末が3つ。

## 読む順（この順で全部読む）

1. `/Users/masa/projects/AGENTS.common.md` — えいみ共通ルールの正本
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD level memory
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md` と `CLAUDE.md`
4. `BUGS.md` の末尾2件（2026-08-29 の「要望に応えても本人に届かない」「待ちループで9時間止まった」）
5. `pwa/design_log/sessions_2026-08.md` の末尾「2026-08-28〜29 あびの報酬要望に応える」
6. `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`（支払通知書）と `pwa/manual/7-1-reward-calc-spec.md`（報酬計算）
7. `/Users/masa/projects/knowledge/ZMP.md` の「契約・報酬の現在地（2026-08-29）」

## 状態スナップショット

- **git**: `main` 一本。最新 `9a287a14 docs: あびの報酬要望への対応と、そこで見つけた穴を正本へ`。push 済み。
  別セッションが月初合意まわり（`monthly-work-agreement*.ts` / `MonthlyAgreementExperience.tsx`）を触っていることがある。
  **共有 checkout なので、同じファイルを触るときはハンク単位で stage する**。
- **本番**: Vercel `amd-os-pwa` に反映済み（備考削除 + テンプレート更新時刻の引き上げ）。
- **DB**: ZMP (p19) に MS `MS-p19-2026-10-okudoor-preopen`「OkuDoor開業前の現地対応（7〜8月先行分）」を追加済み。
  `points=1 / 202607〜202608 / あび share=0.34`。これで あびの 202607・202608 が **各 40,170円**。
  他メンバーは不変、202612 の未払い残は全員 0。
- **支払**: 202608 支払月（7月稼働分）は **きよが 2026-08-28 に4人へ送付済み**。
  あびは 40,170円 + 立替990円 = 税込 45,177円、支払予定日 8/31。
  202609 支払月（8月稼働分）は6人とも通知書を作成済み・**未送付**（あび 40,170円）。

## 残タスク3つ

### 1. GAS を本番へ反映する（未着手）

`gas/064_PayoutFreeeNotice.js` を「`noteText` が空なら備考欄ごと描かない、印刷範囲も支払方法までで閉じる」に
直してコミット済みだが、**GAS 本体へ push していない**。いまの PDF は備考の見出しと空欄の枠が残る。

- `clasp` はこの Mac に未インストール。`~/.clasprc.json` は存在する。
- `cd gas && npx --yes @google/clasp@2.4.2 push -f` で入る見込み（**未確認**）。
- 懸念: `clasp status` が 454 ファイルを列挙し、うち 223 が `.bak*`。
  拡張子的に push 対象外のはずだが**未確認**。push は全ファイル一括上書きになる。
- 前例: `3a945172` の変更は GAS にも反映されている（＝この経路は過去に機能している）。
- **`clasp push` だけでは `/exec` が古いコードを serve する。`clasp deploy --deploymentId` まで実行する**
  （design_log 2026-08-28 の記録）。
- **支払通知書の送付中は踏み切らない**。9月末の発行前に済ませる。

### 2. あびへの連絡（まさ判断待ち）

要望に応えたこと自体が、いまの OS では本人に届かない（`BUGS.md` 参照）。Slack でまさから伝える。
文面はチャットに出したものがあるが、**8月末の振込は済んでいる前提に直す**こと。
伝える中身: 7〜8月の開業準備を先行分として計上したこと / 7月・8月とも 40,170円 / 9月稼働分からは 63,960円 の予定。

### 3. ZMP の契約交渉の結果を反映（まさが交渉中）

**本契約は 2026年7月31日で満了し、内容を交渉中**（まさ 2026-08-29）。
報酬設計（`PC-p19-202601-202612`）は 12月まで組んであるので、月額や期間が変わるなら
シーズン原資・`billing_cycles.budget_yen`・MS を組み直す。結果が出るまで着手しない。

## このPJで守るルール（今回のセッションで効いたもの）

- **支払額を手で入れる経路は無い。** 金額を動かすのは MS・pt・share を直して再計算する経路だけ。
  `monthly_reward_payout` / `payout_notices.total_yen` を直接 UPDATE しても、発行時の同期で計算値へ戻る。
  旧制度の事前合意額 event は `source_ym <= 202606` の上限が DB とコードの両方にある。
- **支払額は `0.01pt × pt単価` 刻み**（ZMP なら 195円）。金額指定の依頼はちょうどに合わない。
- 再計算は `scripts/backfill_reward_summaries.ts` を **`.mts` へコピーして** `npx tsx` で実行する
  （`.ts` のままだと top-level await が cjs 判定で落ちる）。実行後は一時ファイルを消す。
- 通知書の再生成は `GET /api/cron/payout-notice-prebuild?ym=YYYYMM`（`Authorization: Bearer $CRON_SECRET`）。
  **同期と PDF 生成までで、メールは送らない**。送付はまさ／きよが押す。
- PDF の実物確認は Drive の `download_file_content` → base64 デコード → `pypdf` で本文抽出（`pdftotext` は無い）。
- 本番での確認は外部へ出る手前で止める。PDF 発行や DB 保存は事後報告で可、**メール送信は押さない**。
