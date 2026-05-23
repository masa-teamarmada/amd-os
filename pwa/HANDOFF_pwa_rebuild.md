# HANDOFF — AMD OS PWA

最終更新: 2026-05-23
トピック: `/admin/payouts` 高速化・支払通知書PDF改善版復旧・PDFフォーマット退行防止 (golden PNG + image-diff) / L2 ⑨ 経営・事業シグナル実装+backfill+本番採否検証 / cockpit 案C レイアウト (3 カラム + Hero) 実装

詳細ログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾
関連仕様: [`design/README.md`](design/README.md), [`design/FEATURE_REGISTRY.md`](design/FEATURE_REGISTRY.md), [`design/SPEC_GOVERNANCE.md`](design/SPEC_GOVERNANCE.md), [`design/SPEC_pwa.md`](design/SPEC_pwa.md), [`design/L2_DATA.md`](design/L2_DATA.md), [`design/project_strategy_signals.md`](design/project_strategy_signals.md), [`design/cockpit.md`](design/cockpit.md), [`design/notifications.md`](design/notifications.md)
関連BUG/教訓: [`BUGS.md`](BUGS.md)

---

## Current Rules

- canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- ユーザー向け確認URL: `https://amd-os-pwa.vercel.app/hud/dashboard`
- hash付きVercel URL (`amd-os-<hash>-armada0130.vercel.app`) はinspect-only。確認URLとして案内しない。
- PWA変更後deployは必ず `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`。`--cwd .../pwa` は禁止。
- 未確認dirty filesはrevertしない。
- 完了報告は番号だけでなく、「まさが何を依頼したか / えいみが何をしたか / 何ができるようになったか」で書く。
- deploy待ちの間も、実装・検証済みのタスクはタスク単位で先に報告する。
- `pwa/design/` がPWA設計の正本。`design_log/` は時系列ログで、設計正本にしない。

---

## Latest Summary

- #23 `/admin/payouts` の初期表示を重い再計算から切り離し、`billing_cycles.reward_summary_json` キャッシュ参照へ変更。再計算は手動ボタン・保存系処理・日次 `payout-reward-cache-refresh` cron (03:05 JST) に分離。
- #24 `clasp login` をブラウザ認可まで進め、`cd gas && npx --yes @google/clasp push` は成功済み。`invalid_grant / invalid_rapt` は解消。
- #25 `/admin/payouts` の「メンバー別支払」行に `支払通知書発行` / `PDF確認` / `送付` を統合。`PDF確認` は支払データ保存前でも確認用PDFを生成して開くが、`payout_notices` には保存しない。
- #25 支払通知書PDFは2026-04改善版フォーマットへ復旧済み。正本は `gas/064_PayoutFreeeNotice.js` の `payoutBuildNoticePdfBlob_`。白地・青アクセント・公式ロゴ画像・`お支払金額` box・青ヘッダ明細表・税内訳・支払予定/方法/振込先/備考を出す。
- #26 `pwa/design/FEATURE_REGISTRY.md` に重要UI登録簿を追加し、支払通知書PDFフォーマットも正本化。`npm run test:critical-ui` はPWA UIだけでなくGAS側PDF renderer anchorも検査する。
- #26 `pwa/design/SPEC_GOVERNANCE.md` を追加し、Capability Catalog / Functional Spec / Data Contract / ADR / Executable Spec / Traceability の運用を定義。新セッション読書順は `pwa/CLAUDE.md` と `pwa/design/README.md` に反映済み。
- #27 コックピットMSリスト直下に `経営・事業シグナル` セクションを追加。`project_strategy_signals` テーブル、通知承認、`/api/strategy-signals`、Codex automation outbox/applier、`/api/dialogue-meeting` を実装済み。
- #27 既存 `member_activities` から `202601-202605` の経営・事業シグナル40件をbackfill済み (`p06:8`, `p07:4`, `p19:10`, `p20:8`, `p21:10`)。one-shot scriptは `pwa/scripts/backfill_strategy_signals_from_activities.mjs`。
- #27 follow-up: p19 / p20 / p21 cockpit本番で `経営・事業シグナル` セクション表示と `5/22 戦略転換 high 提案 候補` などのbackfill候補表示をログイン済みChromeで実機確認済み。
- #27 follow-up: `/notifications` で `l2_kind='project_strategy_signal'` の「はい・反映」「いいえ・不採用」を本番上のテスト用通知 (p00) に対して実操作し、`project_strategy_signals.status` が `confirmed` / `rejected` に遷移、`confirmed_by='まさ'` で記録されることを確認。テスト signal / 通知は cleanup 済み。
- #28 改善版支払通知書PDFの 1 ページ目を `pwa/scripts/__fixtures__/payout_notice_golden.png` に固定し、SHA256 を `.sha256` で記録。`npm run test:critical-ui` が golden 存在 + hash 一致を検査する。`npm run test:payout-notice-pdf -- --diff <input.png>` で外部 PNG との突合も可能。改善版PDFを更新するときは、まさが目視確認したうえで fixture と SHA256 を再生成する。
- #29 cockpit を案C レイアウトに組み替え。`max-w-[1600px]` の幅広 container で、上 Header → Hero (AMD Score + XRL を `xl:flex-row` で横並び) → 3 カラム grid (今期MS / 経営・事業シグナル / 月次ルーティン sticky) → 下段 2 カラム (月次カード / 休止期間+MTGサマリ) → 最下カンバン全幅、の構成。旧 `max-w-[1060px]` 2 カラム (左 720 / 右 220) には戻さない。`check_pwa_critical_ui.cjs` で `max-w-[1600px]` / `lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_300px]` / `lg:sticky lg:top-12` / `xl:flex-row` を anchor 検査。

---

## Repo State

- branch: `main`
- HEAD at handoff write: this handoff commit itself. Run `git log -1 --oneline` for the exact hash.
- unpushed commits after handoff push: none expected. If `git log --branches --not --remotes --oneline` is non-empty, inspect before continuing.
- tracked changes expected in final commit:
  - `pwa/BUGS.md`
  - `pwa/HANDOFF_pwa_rebuild.md`
  - `pwa/design/FEATURE_REGISTRY.md`
  - `pwa/design/SPEC_pwa.md`
  - `pwa/design/cockpit.md`
  - `pwa/design_log/sessions_2026-05.md`
  - `pwa/scripts/__fixtures__/payout_notice_golden.png`
  - `pwa/scripts/__fixtures__/payout_notice_golden.png.sha256`
  - `pwa/scripts/check_payout_notice_pdf_golden.cjs`
  - `pwa/scripts/check_pwa_critical_ui.cjs`
  - `pwa/package.json`
  - `pwa/src/components/cockpit/CockpitView.tsx`
  - `pwa/src/components/cockpit/CockpitVentureStatus.tsx`
- untracked local artifacts: `tmp/` (PDF/PNG等の確認用生成物。未確認なので勝手に削除しない)

---

## Verified This Session

```sh
cd /Users/masa/projects/AMD/amd-os/pwa
npm run test:critical-ui
npx tsc --noEmit
npm run build
bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh
```

- `npm run test:critical-ui`: 成功
- `npx tsc --noEmit`: 成功
- `npm run build`: 成功
- production deploy: 成功、aliasは `https://amd-os-pwa.vercel.app`
- `cd /Users/masa/projects/AMD/amd-os/gas && npx --yes @google/clasp push`: 成功 (`Pushed 221 files`)
- ログイン済みChrome:
  - `/admin/payouts?ym=202605`: キャッシュ表示、縦型PJ収支表、メンバー別支払の3操作、`PDF確認` を確認。
  - `かる ID003` の確認用PDFを発行し、Drive PDFで改善版フォーマットを目視確認。
  - `/mypage?memberId=ID008` と `/mypage?memberId=ID009`: OkuDoor週次活動表示を確認。
  - `/admin/projects`, `/admin/settings`, `/notifications`, `/payment-confirm`: 実画面確認済み。

---

## Open Tasks

1. `/admin/members` のログイン済み実画面確認は、このセッションでは未確認。
2. 関連メンバー: `/project/p09/cockpit` (JOYCLE) の関連メンバーモーダルと `founding-members-extract?project_id=p09` の v3/v5 prompt 出力確認。他 active SU (CTB/SE/ZMP/CX/SX) も再走対象。
3. 経営・事業シグナル backfill 候補の実 PJ への採否運用は、まさが `/notifications` または `/project/<pid>/cockpit` の `経営・事業シグナル` セクションを順に開いて confirmed/rejected していく (= [pwa/CLAUDE.md](CLAUDE.md) 末尾の「まさ × えいみ 経営会議」運用)。Codex automation 側の daily routine が candidate を補充する。
4. 支払通知書PDFの golden 更新方法: GAS preview API で新規 PDF を生成 → Drive からダウンロード → PNG 化 → `npm run test:payout-notice-pdf -- --diff <input.png>` で違いを確認 → まさが目視 OK なら fixture と SHA256 を上書きして commit。GAS preview を直接叩く CI ステップは未整備で、再生成は手動。

---

## First Next Action

まず `git fetch --all --prune`、`git status -s`、`git log --branches --not --remotes --oneline` を確認する。未commit/pushがあれば内容を見て、今回の `/admin/payouts` / 支払通知書PDF (golden PNG含む) / L2 ⑨ 差分を消さない。`pwa/scripts/__fixtures__/payout_notice_golden.png` と `.sha256` は支払通知書PDFの正本fixtureなので絶対に消さない。次セッションは Open Tasks 1〜2 (`/admin/members` の実画面確認 / JOYCLE 関連メンバー再走) を進めるか、まさが経営会議モードを呼ぶならcandidate signal の採否を進める。

---

## First Read Order

1. `pwa/HANDOFF_pwa_rebuild.md`
2. `pwa/design/README.md`
3. `pwa/design/L2_DATA.md`
4. `pwa/design/FEATURE_REGISTRY.md`
5. `pwa/design/SPEC_GOVERNANCE.md`
6. `pwa/design/SPEC_pwa.md`
7. `pwa/design/project_strategy_signals.md`
8. `pwa/design/cockpit.md`
9. `pwa/design/notifications.md`
10. `pwa/design/xrl_evidence.md`
11. `pwa/BUGS.md`
12. `pwa/design_log/sessions_2026-05.md` の末尾
