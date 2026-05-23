# HANDOFF — AMD OS PWA

最終更新: 2026-05-23
トピック: 月次ルーティン / payouts / 入金確認nudge+freee同期 / LLMなしcron復旧 / member weekly activity / メンバーコードネームリンク / マイページTODO担当role化 / L2通知承認ゲート / 関連メンバー (HRL根拠) SU+AMD限定 / admin members hardening

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
- 完了報告は番号ごとに、「番号 / まさが何をお願いしていたか / それをどう解決したか / 何が修正された・できるようになったか」を1タスクずつでもよいので分けて書く。
- deploy待ちの時間でも、実装・検証が終わっているタスクは番号ごとに先に報告する。
- `npx tsc --noEmit` / `npm run build` / deploy に進む前に、ここまで完了したタスクを「番号 / タスク内容 / 変更した点 / 仕様がどう変わったか」で先に報告する。
- まさが「おけ」「おｋ」と返したタスクは、その後の完了報告や補足ではもう触れない。
- Codex右側の「進捗」チェックリストにも、各項目の先頭へ `#9` / `#10` のようにタスク番号を必ず付ける。

---

## Latest Summary

- `/admin/payouts` を、支払月単位でPJ予算チェック・後追い委託料確定・支払通知額保存まで扱える画面/APIへ整理。
- `/admin/payouts` の後追い予算に、契約未確定中の保留表示・予算不足・失注/破談リスクを明示。
- PJごとの支払条件はコックピットconfigではなく `/admin/projects` を正本にした。`projects.payment_due_rule` は稼働月基準 (`翌月末` = 5月稼働分を6月末支払) で、請求書支払期日・payouts支払月・入金確認nudgeを同じルールで計算する。
- MS進捗抽出はDTSU PJとエコシステム構築PJだけ。advisorなど非MS管理PJはMSを抽出せず、月次モーダルの月次ノートに毎月の進捗を残す。MS管理対象PJでMS計画/項目が無い場合は `project_config_gap` 通知で設定を促す。
- 入金確認nudgeを追加。active adminへSlack DMし、「予定通り入金済み」ボタンで即時反映、「金額を入力」で実額を保存。LLM非使用の支払運用cronとして `freee-payment-sync` (09:10 JST) と `payment-confirm-nudges` (09:30 JST) はVercel cronで稼働させる。freee会計の収入取引同期でも自動で入金確認済みにできるが、freee token refresh が `invalid_client` などで失敗した場合はactive adminへSlackで失敗通知する。
- LLMを使わないcronは停止しない。`member-weekly-activities` (18:00 JST) / `papers-quarterly-ingest` (火03:20 JST) / `sync-pj-facts` (04:00 JST) / `macro-aggregate-indicators` (月次04:00 JST) / 支払運用2本を `pwa/vercel.json` に残す。LLM系cronだけを `pwa/vercel.disabled-crons.json` に退避する。
- 月次モーダルはMS別Gantt表示、MS期間2行表示、進捗イベント編集、PJ予算/残額、報酬cap/stock表示を復活・追加。
- SX MS#1を「事業計画」「資本政策」「知財戦略」に分割し、SX `202601` 報告書FIX判定を `monthly_reports` からも同期。
- ZMP固定月額300,000円の報酬previewを復活し、過去月 `member_activities` backfillで `202601-202603` の進捗イベントを表示可能にした。
- Slack/Gmail source refs取り込み完了通知を停止。通知はOS表示データ・台帳・L2正本に差分が出たときだけ作る。
- protocol抽出は `分岐点 / 判断材料 / アクション` の3要素に限定し、`結果` は観測ledgerへ後追い記録する設計に変更。
- member weekly activity cronを毎日18:00 JSTにし、前日18:00〜当日18:00の24hをGmail/Calendar/source_cache/`project_meeting_summaries`から `member_activities` に保存。
- PJ別名の正本は外部スプシ `CFG_PJAlias`。PWA runtimeはSupabaseだけで動くため、暫定ミラーとして `project_knowledge(category='alias', status='active')` を読むが、ここを正本として扱わない。OkuDoor / Okudoor / ZeMA は ZMP (`p19`) のaliasとして扱い、`奥ドア` はactive aliasにしない。週次活動はCalendar/Gmail/source_cache/`project_meeting_summaries` を同一活動単位に束ね、議事録だけ・カレンダーだけを優先せず、複数生データのつながりから実務成果文を作る。登録PJに一致しない一般の社内共同作業だけ、社内メンバー2名以上かつ共同作業語がある場合に AMD共通活動 (`p00`) として保存する。週次活動では「読むカレンダー」はCalendar接続済みメンバーに限るが、「保存対象メンバー」はactiveな人間メンバー全員。参加者emailにうめ/あびが出ていれば、本人カレンダー未接続でもそのメンバーのマイページ行を作る。
- OS内の文章中に出るAMDメンバーのコードネームは、共通UI `LinkedMemberText` で `/mypage?memberId=<member_id>` へリンクする。adminは `/mypage?memberId=...` で他メンバーのマイページを閲覧できる。
- `/mypage` の「いまやること」は参加PJ全件ではなく担当roleで生成する。`is_pm=true` は月次ルーティン全体、`is_pl=true` かつPMでない場合は請求額確定だけ、ただの参加メンバーには月次ルーティンTODOを出さない。
- admin membersにCalendar共有状態と最終ログインを表示し、最終ログインが新しい順にsort。
- ecosystem PJはAMD Score/XRL対象外、advisor PJはendedでもsource/backfill対象にできるようPJ分類を追加。
- 関連メンバー (`project_founding_members`) を HRL 評価のベースとして再定義。「該当SU社員 + AMD伴走メンバー」だけを HRL に算入し、大学・研究機関 / VC / 顧客 / 行政 / 産業パートナーは invalid 化。AMDメンバーは `members.code_name` で記録 (フルネーム / 姓のみは重複扱いで invalid)。category に `'startup'` を追加。UI ラベルは「関連メンバー」に統一。

---

## Repo State

- branch: `main`
- handoff commit: `feat(pwa): harden monthly ops and member activity flows` (exact hashは最終回答と `git log -1 --oneline` を参照)
- このcommitはこのhandoff後に `origin/main` へpush済みか、最終回答のgit状態を確認する。
- GAS code-level kill switch差分はlocalにあるが、handoff時点の `cd gas && npx --yes @google/clasp push` は `invalid_grant / invalid_rapt` で失敗。まさ側Google再認証後に再pushが必要。
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
- production `/api/cron/member-weekly-activities?windowEnd=2026-05-22&projectId=p19&save=1&maxMessages=30`: 成功。p19/OkuDoor活動を `ID001` まさ / `ID008` うめ / `ID009` あび の3行に保存確認。
- GAS: `cd gas && npx --yes @google/clasp push` は `invalid_grant / invalid_rapt` で失敗。BUGS.md既知事象。

---

## Open Tasks

1. GAS反映: localにはLLM系GAS cron kill switch (`056`/`060`/`152`/`153`/`154`/`155`) が入っているが、`clasp push` は `invalid_rapt` で未反映。まさが `clasp login` し直した後に `cd gas && npx --yes @google/clasp push` を再実行する。
2. 実画面確認残り: `/admin/projects`, `/admin/payouts?ym=202605`, `/admin/settings`, `/admin/members`, `/notifications`, `/mypage?memberId=ID008`, `/mypage?memberId=ID009`, `/payment-confirm`。PWA build/deployは通っているが、ログイン済みブラウザでの見た目確認は未完。
3. 関連メンバー: `/project/p09/cockpit` (JOYCLE) の関連メンバーモーダルと `founding-members-extract?project_id=p09` の v3 prompt 出力確認。他 active SU (CTB/SE/ZMP/CX/SX) も再走対象。
4. 既にactive化済みだった古いL2候補の全体巻き戻しは未実施。今回以降の新規抽出は承認ゲートに寄せた。
5. #6「OS全体の仕様が勝手に消えない防御策」は設計方針だけで未実装。入れるなら spec registry / approved removal ledger / critical flow E2E / DB+cron contract tests から。

---

## First Next Action

まず `git pull` 後に `pwa/HANDOFF_pwa_rebuild.md` と `pwa/design_log/sessions_2026-05.md` の末尾を読む。その後、GAS `invalid_rapt` を解消して `clasp push` を再実行し、ログイン済みブラウザで `/mypage?memberId=ID008` / `/mypage?memberId=ID009` のOkuDoor週次活動と、`/admin/payouts?ym=202605` の縦型PJ収支表を確認する。

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
