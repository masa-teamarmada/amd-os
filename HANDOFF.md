# HANDOFF - AMD OS

- Last updated: 2026-05-29 (codex handoff)
- Topic: OSマニュアル検索 + つくよみ Manual Q&A + production rollback 復旧
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Feature commit: `c06cdd6 Add searchable manual and manual Tsukuyomi Q&A`
- Current branch at handoff: `feat/bzm-textbook`
- Important: `c06cdd6` is on `main` and `origin/main` too. The branch name is not the source of truth for this feature.
- Production alias note: parallel deploys moved the alias during handoff. Last inspected at 2026-05-29 16:47 JST: `dpl_EcWatpieftJpQJSBAGjzxFF5Zirh` (`https://amd-os-qsfx93eva-armada0130.vercel.app`), Ready, aliased to `https://amd-os-pwa.vercel.app`. Re-run `vercel inspect` before using a deploy ID as current truth.

## Latest Summary

- `/manual` と `/manual/[slug]` に全文検索を追加。検索欄は「検索ワード」と明示し、章タイトル / summary / 見出し / 本文 / 画面パス / table 名を対象にした。
- `/manual` 限定で `ManualTsukuyomiFloat` を復活。global visible mascot は戻していない。
- `POST /api/manual/tsukuyomi/ask` を追加。`GEMINI_API_KEY` + `gemini-2.5-flash` でマニュアル本文だけを根拠に回答する read-only route。
- 回答は `ここ見たらOK` の参照章リンクつき、敬語なしのつくよみ口調、高校生にも分かる説明へ調整。「この抜粋」表現は出さない。
- 一度フロートが消えた原因は、dirty direct deploy 後に GitHub `main` clean deploy が production alias を上書きしたこと。`c06cdd6` を `origin/main` に push して復旧済み。
- 詳細ログ: `pwa/design_log/sessions_2026-05.md` の「2026-05-29 (#95)」。

## Verification / Deploy

- `npx tsc --noEmit` pass。
- `npm run build` pass。
- Chrome authenticated verification:
  - `/manual` に `検索ワード` が 2 箇所表示。
  - `つくよみに聞く` float が表示。
  - `L2データにはどのような種類がある？` / `L2データってなに？` で、9種類説明、`ここ見たらOK` リンク、underscore 保護、敬語除去、「この抜粋」なしを確認。
- `c06cdd6` を `origin/main` に push 済み。
- `npx vercel inspect https://amd-os-pwa.vercel.app --scope armada0130` で production alias `dpl_EcWatpieftJpQJSBAGjzxFF5Zirh` Ready を確認。
- 未確認: `dpl_EcWat...` へ alias が更新された後の authenticated DOM 再チェック。ただし feature commit は `origin/main` と current branch に入り、まさが直前の本番で「復活した！」と確認済み。

## Repo State

- Current branch: `feat/bzm-textbook`
- Feature commit: `c06cdd6` (`main` / `origin/main` / `feat/bzm-textbook` に存在)
- `git log --branches --not --remotes --oneline`: handoff開始時点では空。
- Worktree is dirty with broad parallel work. Do not revert or stage blindly.
- Known unrelated or parallel dirty areas:
  - BZM/IP/ERS: `pwa/bzm/`, `pwa/src/app/(app)/institutions/`, `pwa/src/lib/ers*.ts`, IP docs/code
  - L2/manual route docs and scheduled-task docs
  - cockpit / meeting-summary / operations catalog / payment cron files
  - `pwa/src/lib/build-info.ts`
- This handoff intentionally updates only handoff/docs/Manual Q&A documentation and bug log files. Stage file-by-file.

## Open Tasks

- Manual search / Manual Q&A feature itself: no known blocker.
- If `/manual` loses the float again, inspect production alias first, then compare the alias deploy source against `origin/main` containing `c06cdd6`.
- If touching Manual Q&A next, run one authenticated browser check on `/manual` and ask `L2データってなに？` to verify links, tone, and search context.
- Keep unrelated dirty work separated; do not clean or revert broad worktree changes during a Manual Q&A follow-up.

## Pointers

- PWA handoff: `pwa/HANDOFF_pwa_rebuild.md`
- Manual design: `pwa/design/os_manual.md`
- PWA route registry: `pwa/design/SPEC_pwa.md`
- Feature registry: `pwa/design/FEATURE_REGISTRY.md`
- Manual chapters: `pwa/manual/1-1-intro.md`, `pwa/manual/3-3-notifications-and-tsukuyomi.md`, `pwa/manual/9-2-developer.md`, `pwa/manual/9-3-appendix-changelog.md`
- Bug / operations log: `pwa/BUGS.md`
- Session log: `pwa/design_log/sessions_2026-05.md`

## First Read Next Session

1. `HANDOFF.md`
2. `pwa/design/os_manual.md`
3. `pwa/design/SPEC_pwa.md`
4. `pwa/design/FEATURE_REGISTRY.md`
5. `pwa/BUGS.md`
6. `pwa/design_log/sessions_2026-05.md`
7. `pwa/src/app/(app)/manual/ManualTsukuyomiFloat.tsx`
8. `pwa/src/app/api/manual/tsukuyomi/ask/route.ts`
9. `pwa/src/app/(app)/manual/manual-search.ts`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git status -sb
git log --oneline --decorate -5
npx vercel inspect https://amd-os-pwa.vercel.app --scope armada0130
```

Then open `/manual` in an authenticated browser only if the next task touches Manual search or Manual Q&A.
