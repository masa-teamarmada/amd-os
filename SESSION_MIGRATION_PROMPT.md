# SESSION MIGRATION PROMPT - AMD OS Monthly Report Contract Metadata / Calendar Blocks

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に仕様正本として `pwa/spec/5-6-contracts-management-current-spec.md`、`pwa/spec/3-8-cockpit-current-spec.md`、`pwa/manual/6-2-admin-projects-members-ledger-spec.md`、`pwa/manual/2-3-pj-cockpit.md` を読み、そのあと `pwa/BUGS.md`、`CLAUDE.md`、`AGENTS.md`、`pwa/CLAUDE.md` を読んで。

今回の current truth:
- `/admin/projects` には `月次報告` 列があり、`projects.contract_terms_json.monthlyReportSubmission*` を表示する。
- PJ cockpit header も同じ JSON から、月次報告書の状態・時期・提出期限・フォーマット・必要記載事項・根拠を表示する。
- 表示文言は `月次報告` カラム内なので、主値は `要提出` / `不要` / `指定なし` / `要確認` / `不明` など短く出す。`月次報告書を提出` のような冗長文は避ける。
- 指定が無い情報は空欄にせず `指定なし` と書く。これも重要な契約情報。
- KUTE は契約書に月次報告書義務が書かれていないが、運用上の指示として `契約上の義務はないが要提出：フォーマットは自由` を `monthlyReportSubmissionNote` に残す。
- accepted product commits are `6d3b95b7` and `f75ca7ff`; production verified as `v0.36.35 / main / dirty=false`. Check live `/api/build-info` for the exact latest SHA because docs-only closeout commits may sit on top.

DB current values:
- CX `p20`: rule `要確認`; timing `月次`; deadline `指定なし`; format `指定なし`; required items `業務実施計画書、月次進捗報告（詳細項目は未確認）`
- SX `p21`: rule `要提出`; timing `月次請求時`; deadline `請求書提出時`; format `指定なし`; required items `指定なし`
- KUTE `p25`: rule `要提出`; timing `月次`; deadline `指定なし`; format `自由`; required items `指定なし`; note `契約上の義務はないが要提出：フォーマットは自由`

Calendar current truth:
- CX event master `0qsea368as49a2h1ihfdhs21ok`, color `9`, title `＋CX 月次報告書作成`, 10:00-12:00 on first Wed/Thu in the 23-28 window, count 3. Sep 2026 instance moved to Thu 2026-09-24 because Wed 2026-09-23 is all-day `不在`.
- SX event master `tsotvrhp2b8cea8u9kkq8sdo1c`, color `4`, title `＋SX 月次報告書作成`, 08:00-10:00 on first Mon/Tue in the 23-28 window, count 9 through Mar 2027.
- KUTE event master `5fi9qjkvjnm27t2dblmb0nd4v4`, color `11`, title `＋KUTE 月次報告書作成`, 16:00-18:00 on first Mon/Tue in the 23-28 window, count 9 through Mar 2027.
- Current connector can list/search/create/update events, but Google Calendar freebusy returned `ACCESS_TOKEN_SCOPE_INSUFFICIENT`; use bounded event-list search as the practical availability source unless connector scopes change.

作業開始前に必ず:
1. `git fetch origin main --prune`
2. `git status -sb --untracked-files=all`
3. `git log --left-right --oneline main...origin/main`
4. `curl -fsSL https://amd-os-pwa.vercel.app/api/build-info`
5. `git diff --name-status`

最初の一手:
1. production が `v0.36.35` 以上、main branch、dirty=false であることを確認する。
2. ログイン済みブラウザで `/admin/projects` を開き、CX/SX/KUTE の `月次報告` 列が状態だけでなく期限・フォーマット・記載事項まで読めることを確認する。
3. `/project/p20/cockpit`、`/project/p21/cockpit`、`/project/p25/cockpit` の header に同じ月次報告書情報が出ることを確認する。
4. Calendar を触る場合は、23-28日の月次報告書作成枠だけに絞って検索してから更新する。

残っている別bundle dirty:
- notification / L2 / meeting-flow docs and TS files
- contract / monthly agreement docs + docx/proposal
- Admin Kiyo / meeting-assets replace / project-labels / migration 153
- H-1 prep worker outbox markdowns
- `gas-slack/.clasp.json` local artifact
- `ios/supabase/.temp/project-ref` local Supabase artifact

守ること:
- AMD OS は main 一本。BUILD_VERSIONを巻き戻さない。
- PWA deploy が必要なら `.vercel/project.json` が `amd-os-pwa / prj_raZW3HSKIszzPUwNTHfy7xDGzLHm` であることを確認し、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。
- `git add .` は絶対に使わない。選んだ bundle のファイルだけ個別 stage。
- `月次報告` カラムの本文は冗長にしない。主値は短く、詳細は下段/tooltip/補足で出す。
```
