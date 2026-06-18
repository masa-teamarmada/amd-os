# HANDOFF - AMD OS PWA

- Last updated: 2026-06-18 (MTG詳細MarkdownのAMDメンバーリンク修正 / docs sync)
- Topic: p21 MTG詳細モーダルの議事録本文で、active AMDメンバー名が `/mypage?memberId=...` にリンクされなかった件を原因特定し、v0.27.6 で修正済み。
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `main`
- Current repo HEAD at handoff write: `62ce1366 fix: use planned monthly rewards for agreements` (`origin/main` 同期済み, build-info source は v0.27.7)。
- Live production observed by `curl /api/build-info`: `v0.27.6` / `895a1bda427ae755298c7d5c01d188f4012abcde` / `dirty=false`。`62ce1366` の Vercel 反映は、必要なら次セッションで再確認する。

## 直近セッション (2026-06-18 — MTG詳細Markdown member link, v0.27.6)

対象 URL: `/project/p21/cockpit?meeting=7ui75q9llsbfaidd4631kcoagu`

- 読んだ正本: root/pwa `CLAUDE.md`・`AGENTS.md`、`pwa/design/meeting_summaries.md`、`pwa/design/cockpit.md`、`pwa/design/db_schema.md`、`pwa/manual/2-3-pj-cockpit.md`、関連 runtime route / Markdown renderer。
- DB確認: `members.code_name='まさ'` は `member_id='ID001'` / active。対象 meeting は `p21`、title `SX 産連訪問＋メール設定＋石原先生と1on1`、date `2026-06-10`。`narrative_md` にも該当表記あり。
- 原因: データ欠損ではなく表示経路の抜け。`LinkedMemberText` は経営ハイライト等で使われていたが、MTG詳細は `MarkdownView` で Markdown を描画しており、renderer 内に member link 経路が無かった。
- 実装: `pwa/src/components/cockpit/MarkdownView.tsx` に `memberLinks` option を追加。通常テキスト child だけを `LinkedMemberText` に通し、既存 Markdown link / code / pre は触らない。`CockpitMeetingDetailModal.tsx` の narrative / summary / raw / prep / dialogue 表示で有効化。`BUILD_VERSION` は v0.27.6。
- deploy: commit `895a1bda fix(pwa): link member names in meeting markdown` を `main` に push。`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で production Ready。

## Docs / 正本同期

今回の handoff で、以下を docs commit 対象として更新済み。

- `pwa/design/meeting_summaries.md`: MTG詳細Markdownの member link 契約を追加。
- `pwa/manual/2-3-pj-cockpit.md`: PJコックピット manual の MTGサマリ節へ追記。
- `pwa/design/FEATURE_REGISTRY.md`: 重要UI登録簿に `MarkdownView memberLinks` 経路を登録。
- `pwa/BUGS.md`: 原因・解決・再発防止をクローズ済みバグとして追記。
- `pwa/design_log/sessions_2026-06.md`: v0.27.6 セッションログを追記。
- `pwa/HANDOFF_pwa_rebuild.md`: この handoff。

## Repo State

- `git log --branches --not --remotes --oneline`: handoff docs commit 後は `docs(handoff): sync MTG member link docs` が 1 件出る想定。push はまだしない。
- Working tree after handoff docs commit: `pwa/design/su_knowledge_promotion_loop.md` に別ワークストリーム由来の大きな差分あり (旧設計を deprecated 化する内容)。今回の MTG link handoff と混ぜて commit しない。`pwa/proposals/` は既存 untracked、今回触らない。
- Code for member-link bug itself is already pushed/deployed at `895a1bda`。この handoff docs commit は local only のまま閉じる。
- `62ce1366` (monthly rewards agreement) は別ワークストリーム由来。origin/main には到達済みだが、live `/api/build-info` は確認時点でまだ v0.27.6 を返した。production v0.27.7 が必要な作業では再確認する。

## Unresolved / 次アクション

1. **MTG member link bug**: 未解決タスクなし。必要ならログイン済みブラウザで対象 URL を開き、本文内の「まさ」が `/mypage?memberId=ID001` へ遷移することを目視確認する。
2. **handoff docs**: local docs commit が未 push なら、`pwa/design/su_knowledge_promotion_loop.md` の owner と production drift を確認してから push 方針を決める。別差分は同じ commit に混ぜない。
3. **production drift**: origin/main が v0.27.7 まで進んでいるため、次セッション冒頭に `curl https://amd-os-pwa.vercel.app/api/build-info` で live stamp を再確認する。

## First Next Action

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git log --branches --not --remotes --oneline
git status -sb
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

MTGリンク周辺を続けるなら、先に `pwa/design/meeting_summaries.md` と `pwa/manual/2-3-pj-cockpit.md` の MTGサマリ節を読む。コード入口は `pwa/src/components/cockpit/MarkdownView.tsx` と `pwa/src/components/cockpit/CockpitMeetingDetailModal.tsx`。

## Verification Already Run

```bash
npm exec tsc -- --noEmit
npm run build
npm run test:critical-ui
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

Result for v0.27.6: typecheck/build/critical-ui green, production build-info `895a1bda427ae755298c7d5c01d188f4012abcde`, `dirty=false`。
