# HANDOFF — AMD OS PWA

最終更新: 2026-05-22
トピック: 月次ルーティン / payouts / L2通知承認ゲート / member weekly activity / 関連メンバー (HRL根拠) SU+AMD限定 / admin members hardening

詳細ログ: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md)
関連仕様: [`design/README.md`](design/README.md), [`design/SPEC_pwa.md`](design/SPEC_pwa.md), [`design/L2_DATA.md`](design/L2_DATA.md), [`design/cockpit.md`](design/cockpit.md), [`design/notifications.md`](design/notifications.md), [`design/xrl_evidence.md`](design/xrl_evidence.md)
関連BUG/教訓: [`BUGS.md`](BUGS.md)

---

## Current Rules

- canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- ユーザー向け確認URL: `https://amd-os-pwa.vercel.app/hud/dashboard`
- hash付きVercel URL (`amd-os-<hash>-armada0130.vercel.app`) はinspect-only。確認URLとして案内しない。
- PWA変更後deployは必ず `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`。`--cwd .../pwa` は禁止。
- 未確認dirty filesはrevertしない。

---

## Latest Summary

- `/admin/payouts` を、支払月単位でPJ予算チェック・後追い委託料確定・支払通知額保存まで扱える画面/APIへ整理。
- `/admin/payouts` の後追い予算に、契約未確定中の保留表示・予算不足・失注/破談リスクを明示。
- 月次モーダルはMS別Gantt表示、MS期間2行表示、進捗イベント編集、PJ予算/残額、報酬cap/stock表示を復活・追加。
- SX MS#1を「事業計画」「資本政策」「知財戦略」に分割し、SX `202601` 報告書FIX判定を `monthly_reports` からも同期。
- ZMP固定月額300,000円の報酬previewを復活し、過去月 `member_activities` backfillで `202601-202603` の進捗イベントを表示可能にした。
- Slack/Gmail source refs取り込み完了通知を停止。通知はOS表示データ・台帳・L2正本に差分が出たときだけ作る。
- protocol抽出は `分岐点 / 判断材料 / アクション` の3要素に限定し、`結果` は観測ledgerへ後追い記録する設計に変更。
- member weekly activity cronを毎日18:00 JSTにし、前日18:00〜当日18:00の24hをGmail/Calendar/source_cacheから `member_activities` に保存。
- admin membersにCalendar共有状態と最終ログインを表示し、最終ログインが新しい順にsort。
- ecosystem PJはAMD Score/XRL対象外、advisor PJはendedでもsource/backfill対象にできるようPJ分類を追加。
- 関連メンバー (`project_founding_members`) を HRL 評価のベースとして再定義。「該当SU社員 + AMD伴走メンバー」だけを HRL に算入し、大学・研究機関 / VC / 顧客 / 行政 / 産業パートナーは invalid 化。AMDメンバーは `members.code_name` で記録 (フルネーム / 姓のみは重複扱いで invalid)。category に `'startup'` を追加。UI ラベルは「関連メンバー」に統一。

---

## Repo State

- branch: `main`
- handoff作成時HEAD: `cb837d2 feat(pwa): harden monthly ops and notification gating` 以降に 075 cleanup 系 commit が追加される予定。
- このhandoff後に全変更をまとめてcommit/pushする予定。最終commit hashは今回のチャット末尾を参照。
- GASは `npx --yes @google/clasp push` 済み。
- migration `074_members_last_login_at.sql` / `075_related_members_cleanup.sql` はproduction Supabaseへ適用済み。
- DB cleanup済み:
  - SE (`p10`) のCryoX/Kiutra/NIMS混入 source_cache / member_activities / XRL候補は0件確認。
  - ecosystem (`p12`, `p25`, `p23`) の未reject XRL候補と未読score通知は0件確認。
  - 非コア創業メンバー58件を `status='invalid'` に変更。

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
- production HEAD check: `/hud/dashboard` は未ログイン時 `307 -> /auth/login?next=%2Fhud%2Fdashboard`
- GAS: `cd gas && npx --yes @google/clasp push` 成功 (`Pushed 221 files`)

---

## Open Tasks

1. ~~ログイン済みで `/admin/payouts?ym=202605` のSX `202601-202603` PJ予算確定 -> 支払データ保存~~ 実施済 (2026-05-22)。SX 委託料 ¥2,720,000 (Q-0000000062 税抜) で PJ予算 ¥1,768,000 を 3 月へ配分、支払 12 明細 / 通知額 4 件を保存。
2. ログイン済みで `/admin/members` を確認。Calendar状態、最終ログイン、新しい順sortが期待通りか見る。
3. ログイン済みで `/project/p09/cockpit` (JOYCLE) の関連メンバーモーダルを確認し、cron `founding-members-extract?project_id=p09` の v3 prompt 出力を見る。他 active SU (CTB/SE/ZMP/CX/SX) も再走対象。
4. `/notifications` で candidate/tentative候補が「はい」までactive化されないこと、「いいえ」でrejected/invalidになることを実画面で確認。
5. `/mypage` の「今週やったこと」を、ログインユーザーのmember mappingと `member_activities` で確認。
6. `/settings` のRaw/L2/Cron Control、`/reimburse` の領収書添付つき申請、通知admin-onlyはまだ実画面再確認が残っている。
7. #6の「OS全体の仕様が勝手に消えない防御策」は、設計方針だけ話した段階。実装は未着手。次にやるなら spec registry / approved removal ledger / critical flow E2E / DB+cron contract tests を設計してから入れる。
8. 既にactive化済みだった古いL2候補の全体巻き戻しは未実施。今回以降の新規抽出は承認ゲートに寄せた。

---

## First Next Action

まず production にログインした状態で `/admin/payouts?ym=202605` を開き、SX `202601-202603` の「確定待ちのPJ予算」から委託料を入力し、PJ予算確定と支払データ保存を通す。

---

## First Read Order

1. `pwa/HANDOFF_pwa_rebuild.md`
2. `pwa/design/README.md`
3. `pwa/design/SPEC_pwa.md`
4. `pwa/design/L2_DATA.md`
5. `pwa/design/cockpit.md`
6. `pwa/design/notifications.md`
7. `pwa/design/xrl_evidence.md`
8. `pwa/BUGS.md`
9. `pwa/design_log/sessions_2026-05.md` の末尾
