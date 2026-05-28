# HANDOFF - AMD OS

- Last updated: 2026-05-27
- Topic: L2 ⑥ 予定MTGカード生成 / Drive関連資料同期 / CLG取締役会カード反映
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- HEAD at handoff: `a28e8ff` (`polish(pwa): clarify same-day meeting prep copy`)

## Latest Summary

- KUTE / CLG の予定MTGカード生成ロジックを確認し、前回議事録由来だけでなく、Calendar確定予定から `source_kinds='upcoming'` カードを作るルートへ修正した。
- `POST /api/meeting-prep/calendar-sync` が `drive_files` を受け取り、予定カードの `関連Drive資料` に出せるようにした。
- L2⑥ SKILL は `today 00:00 JST` から60日先の確定Calendar予定を同期し、同日開始済みMTGもDrive資料補強対象にする設計へ更新した。
- Drive探索はPJ folder rootだけでなく、会議日/title tokenに合う1階層サブフォルダ、Docs/Slides/Sheets/PDF/Office filesまで見る。
- CLG `CLG 取締役会` (2026-05-27 17:30 JST) の予定カードへ、Drive `260527_取締役会` 内の招集通知PDF・予算xlsx・予実xlsx 3件を本番反映済み。
- 詳細ログ: `pwa/design_log/sessions_2026-05-27_mtg_prep_drive_sync.md`

## Verification

Run and observed:

- `npm --prefix pwa run lint -- src/app/api/meeting-prep/calendar-sync/route.ts` pass。
- Vercel production deployment `dpl_2Ff3Ytd14AtGxao3u3nAXUKqDYEU` READY。
- `POST https://amd-os-pwa.vercel.app/api/meeting-prep/calendar-sync` で CLG カード更新 `updated=1`。
- Supabase REST readbackで `summary_short` / `progress` / `next_actions` / `risks` / `narrative_md` に Drive資料3件が反映されていることを確認。

Not verified:

- MMO PC 側 repo の最新pull。`ssh msi` はこのMacから `msi.local` が解決できず失敗。MMOのauto-pull taskで最大30分遅延反映される設計だが、即時反映は未確認。

## Repo State

- Branch: `main`
- Pushed commits this session:
  - `35b71d4 feat(pwa): include drive materials in meeting prep sync`
  - `a320ce5 fix(pwa): pass finance simulation inputs`
  - `f39a9f6 fix(pwa): allow strategy signal metadata fields`
  - `fff185e fix(pwa): sync same-day meeting prep cards`
  - `a28e8ff polish(pwa): clarify same-day meeting prep copy`
- Unpushed commits before handoff docs: none observed.
- Worktree is broadly dirty from other sessions. Do not revert or bulk-stage unrelated files.
- Handoff/doc updates made locally in this handoff flow:
  - `HANDOFF.md`
  - `pwa/design/meeting_summaries.md`
  - `pwa/design/L2_DATA.md`
  - `pwa/manual/3-2-data-and-extraction.md`
  - `pwa/manual/8-3-l2-extraction-routines-spec.md`
  - `pwa/scheduled-tasks/README.md`
  - `pwa/BUGS.md`
  - `pwa/design_log/sessions_2026-05-27_mtg_prep_drive_sync.md`
- Several of the above files already had pre-existing dirty changes/manual-reorg state. If committing, stage hunks carefully and avoid pulling unrelated manual/GAS/PWA changes into the same commit.

## Open Tasks

- [ ] MMO PCで `C:\Users\masa\projects\AMD\amd-os` が `a28e8ff` 以降までpull済みか確認。急ぐ場合はMMO上で `git pull origin main`。
- [ ] 次の L2⑥ scheduled runで、KUTE/CLG以外の確定予定MTGにも `drive_files` が自然に入るか観察。
- [ ] `pwa/design/meeting_summaries.md` / `pwa/design/L2_DATA.md` / `pwa/manual/*.md` の既存dirty差分を、別セッション差分と混ぜずに整理する。
- [ ] Vercel buildで直した `GasMonthlySimulationPanel` / `CockpitStrategySignals` の型補強が、既存の広範囲dirty `supabase-data.ts` と重複していないか後続で確認。

## Pointers

- L2 ⑥ SKILL: `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`
- MTGサマリ仕様: `pwa/design/meeting_summaries.md`
- L2中核仕様: `pwa/design/L2_DATA.md`
- OSマニュアル: `pwa/manual/3-2-data-and-extraction.md`, `pwa/manual/8-3-l2-extraction-routines-spec.md`
- Bug log: `pwa/BUGS.md`
- Session log: `pwa/design_log/sessions_2026-05-27_mtg_prep_drive_sync.md`

## First Read Next Session

1. `HANDOFF.md`
2. `pwa/design/meeting_summaries.md`
3. `pwa/design/L2_DATA.md`
4. `pwa/manual/3-2-data-and-extraction.md`
5. `pwa/manual/8-3-l2-extraction-routines-spec.md`
6. `pwa/BUGS.md`
7. `pwa/design_log/sessions_2026-05-27_mtg_prep_drive_sync.md`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git status -s
git log --branches --not --remotes --oneline
```

Then:

1. MMO PCが最新commitをpullできているか確認。
2. L2⑥ automation の次回runで予定MTGカード + Drive資料同期が自然発火するか確認。
3. 広範囲dirtyを見ながら、今回handoff/doc更新だけを安全にcommitするか判断。
