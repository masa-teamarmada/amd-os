# HANDOFF - AMD OS PWA

> Current handoff note (2026-07-09): this file still contains older PWA rebuild history. For the current repo/session state, read `/Users/masa/projects/AMD/amd-os/HANDOFF.md` first, then return here only for historical `/proactive` context. The current active carry-forward at closeout is the `/admin/invoices` freee取引先選択 WIP listed in root `HANDOFF.md`.

- Last updated: 2026-06-27 (後始末セッション: 前セッション残骸の design_log merge 分を commit、untracked 8件は別 worker 帰属を明記して保留)
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `main`

## 直近セッション要約

詳細は [`design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md) の「2026-06-27 (v0.35.0 → v0.35.4) 旧 /loop 5段ループを廃止し /proactive 先手TODOへ白紙やり直し」セクション、仕様正本 [`spec/2-4-proactive-todo-current-spec.md`](spec/2-4-proactive-todo-current-spec.md)、マニュアル [`manual/2-6-admin-ops.md`](manual/2-6-admin-ops.md)、教訓 [`BUGS.md`](BUGS.md) の `2026-06-27` 3 件。

- まさ指摘「先手力維持に旧 /loop は機能してない、白紙やり直してもいい」を受けて、旧 5 段盤面 (観測→評価→判断→実行→学習) を全廃。
- 代わりに `/proactive` (admin) の 1 画面・期限順・3 ボタン完了UI (✅完了 / ⏸ブロック / 🗑関係ない) を実装。
- 検知は `/api/cron/proactive-todo-extract` が daily 09:15 JST で MTG 議事録 next_actions + 7日以内の予定MTGを sweep し、文字列ヒューリスティック (LLM 不使用、`members` 実名動的 fetch) で AMD ボール判定して `proactive_todos` に upsert。
- 初回 backfill: 86 件 (amd 28 / ambiguous 58)、PJ別 SX 32 / ZMP 17 / KUTE 15 / SE 9 / VSX・CLG 4 / CryoX 3 / LiSTie 1 / p00 1。Production `v0.35.4` / `72a0a919` で本番反映済み (deploy 後 docs(bzm) commit が別 worker から続いて `ccc5eb68`が現行 git_sha)。
- まさはこれから触ってフィードバック予定。次セッションで誤検知パターン整理 + ヒューリスティック調整に入る想定。

## Repo State

- Production: `v0.35.4` / `git_sha=6279bba1` / `dirty=false` (PWA build 自体は v0.35.4 で stable、その後 docs(bzm) + design_log merge commit が積まれて build-info が更新された)
- Local main HEAD: `origin/main` と完全同期、最新 `245a1ea6 docs(pwa): sessions_2026-06.md に 3 worker 分のセッション追記を merge コミット`
- /proactive やり直しセッションの commit (origin/main 上):
  - `72a0a919 chore(pwa): regenerate db_schema.md after migration 158`
  - `294d6c3c fix(pwa): 先手TODO upsert の onConflict が COALESCE INDEX で機能しなかった問題を修正 (v0.35.4)`
  - `68012810 feat(pwa): 先手TODO ball_owner判定にAMDメンバー実名取り込み + 予定MTG窓を7日へ拡大 (v0.35.3)`
  - `09fd8d04 fix(pwa): dashboard から未存在 @/lib/project-labels への import を除去 (v0.35.2)`
  - `11dc27eb fix(pwa): 先手TODO cron を daily へ (Vercel Hobby plan制限対応 / v0.35.1)`
  - `da9f52b2 feat(pwa): 旧 /loop 5段ループを廃止し /proactive 先手TODOへ白紙やり直し (v0.35.0)`
- 後始末セッションの commit (origin/main 上):
  - `245a1ea6 docs(pwa): sessions_2026-06.md に 3 worker 分のセッション追記を merge コミット` — 前セッション merge 済みだった design_log 末尾追記を正式 commit
- **Uncommitted (= 別 worker の WIP / artifact、本セッションは触らず保留)**:
  - 前セッション開始時の 84件残骸は別セッションで処理されたらしく、現時点は 8 件まで縮小:
  - `?? gas-slack/.clasp.json` — GAS Slack 連携の clasp 設定 (= 別 GAS worker 担当、本リポにコミットすべきかは別 worker 判断)
  - `?? pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/outbox/*.md` (5件) — L6 meeting-prep-worker の artifact (上書きされる prep_draft / status snapshot)。outbox は `.gitignore` 対象にすべき性質だが、未追加。**L6 worker セッションが .gitignore 整備 or 削除判断**
  - `?? pwa/scripts/migrations/153_project_venture_legacy_name_hygiene.sql` — project_ventures display_name 正規化 (LisTie → LiSTie)。**migration 153 担当 worker 側で apply + commit**
  - `?? pwa/scripts/migrations/155_skip_non_actionable_app_notifications.sql` — app_notifications の task_created / meeting_action を trigger でドロップ。**migration 155 担当 worker 側で apply + commit**
  - `?? pwa/scripts/migrations/156_skip_meeting_summary_notifications.sql` — meeting_notifications の重複 insert/update を trigger でドロップ。**migration 156 担当 worker 側で apply + commit**
  - `?? pwa/scripts/update_drive_file.mjs` — Google Drive へファイル更新する 1-off スクリプト (OAuth refresh token 使用)。**1-off スクリプト or commit 対象判断は作成者 worker 側**
  - `?? pwa/src/app/api/meeting-assets/replace/[assetId]/route.ts` — meeting assets を Drive 経由で再差し替えする新 API route。**meeting-assets 担当 worker 側で test + spec/manual 同期 + commit**
  - `?? pwa/src/lib/project-labels.ts` — `projectShortName` / `projectDisplayName` ヘルパー。**前セッションが v0.35.2 で「未存在 @/lib/project-labels への import を除去」した経緯あり (commit `09fd8d04`)。この untracked がそれと別 worker の実装中ファイルなのか、再 import するなら HANDOFF に明記が必要**。本セッションは触らず保留
  - → **すべて別 worker / セッションで処理する想定**。本セッションは触らないことで安全側に倒した

## 本番動作確認 (実施済み)

- `curl https://amd-os-pwa.vercel.app/api/build-info` → v0.35.4 確認 (deploy 完了)
- `curl -H "Bearer ${CRON_SECRET}" .../api/cron/proactive-todo-extract` → `{"ok":true, ..., "upserted":{"meeting_next_action":77, "next_meeting_prep":10}}` 確認
- supabase 直 query で `proactive_todos` 86 件確認 (上記 PJ 別内訳)
- **未確認**: ブラウザでまさのログイン状態での `/proactive` 画面表示 / dashboard 上段バッジ表示 / 3 ボタン挙動。**まさが次セッション以降に手で触る予定**。

## Unresolved / Next Actions

1. **まさのフィードバックを次セッションで聞き取る** (= 86 件中どれが誤検知 / どれが期待通り / ヒューリスティック追加調整)
2. **誤検知パターンの整理**: 初回 backfill で「CLG側」が AMD ボール判定で抽出された (実態は CLG ベンチャー側 = counterpart)。社外取締役 / advisor 系 PJ では PJ コード+側 を AMD ボール扱いしない調整候補
3. **cockpit 側の旧 `ProactiveQueuePanel` 処遇**: 今回 dashboard 側だけ刷新、cockpit `CockpitView.tsx` の旧 panel は `proactive_outbox` を見続けてる。データが古いまま放置されると混乱の元。完全に消すか、`proactive_todos` ベースの新 cockpit panel に置き換えるかは別 Phase
4. **完了 → 学習段 (Protocol / Textbook insight) への流し込み**: resolved_note を learning レイヤーへ流す Step 3 は未着手
5. **Gmail / Slack の催促文言検知** (= 残り 20% カバー): Phase 2 以降
6. **`sent` 状態 (相手にボールを渡した) の追加**: まさ判断「最初はなしでもいい、必要だと感じたら追加」
7. **前セッション残骸の処理**: 8 件の untracked が別 worker 由来で保留中 (= migration 153/155/156、meeting-assets/replace、project-labels.ts、L6 outbox artifact、gas-slack/.clasp.json、update_drive_file.mjs)。当該 worker / セッション側で commit or 削除判断を期待。Repo State セクションに帰属を明記済み

## First Next Action

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch origin main
git status -sb --untracked-files=all
curl -fsS https://amd-os-pwa.vercel.app/api/build-info  # v0.35.4 系のはず
```

その後まさから「触ってみたフィードバック」を聞き取り、誤検知 / 抜け / 期待外れのパターンを整理する。優先順位の高そうな調整:
- ヒューリスティックの追加 (社外取締役系 PJ の扱い、AMD メンバー名で誤マッチする一般単語があるか)
- 表示順 / chip 配色 / 行内 UX の調整
- daily 09:15 JST 自動 run が翌朝動いた結果の確認 (= cron が production で問題なく回るか)

## Pointers

- 先手 TODO 仕様 (current): [`spec/2-4-proactive-todo-current-spec.md`](spec/2-4-proactive-todo-current-spec.md)
- 旧 /loop 設計 (廃止マーク + 履歴温存): [`design/proactive_operating_loop.md`](design/proactive_operating_loop.md)
- マニュアル (使い方): [`manual/2-6-admin-ops.md`](manual/2-6-admin-ops.md) の「/proactive 先手 TODO リスト」節
- DB schema: [`design/db_schema.md`](design/db_schema.md) の `proactive_todos` セクション
- Registry: [`design/FEATURE_REGISTRY.md`](design/FEATURE_REGISTRY.md)
- Bugs (今回 3 件追記): [`BUGS.md`](BUGS.md) の `2026-06-27` 3 件
- Session log: [`design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md) 末尾
- Scheduled tasks 索引: [`scheduled-tasks/README.md`](scheduled-tasks/README.md)

## Guardrails

- `/loop` ルート、`LoopKernelBoard.tsx`、`proactive-heartbeat` SKILL、`spec/2-4-loop-kernel-role-lenses-plan.md` は 2026-06-27 廃止済み。**復活させない**。
- `proactive_outbox` / `proactive_loops` / `proactive_loop_events` / `project_commander_threads` の旧テーブルは migration 117 で存在するが、本セッションで写し換え対象から外した。**新規 write しない**。`design/proactive_operating_loop.md` 末尾の「廃止マーク」を必ず読んでから触る。
- `proactive_todos` の UNIQUE INDEX に COALESCE / lower 等の expression を入れない (supabase-js onConflict と紐付かず silent fail する。教訓は BUGS.md 2026-06-27 参照)。
- Vercel cron を新規追加するときは、**既存 vercel.json crons[] がすべて daily か確認**。Hobby plan の毎時 cron は deploy 自体が block される。
- 別 worker が修正中の tracked ファイル (`git status` で M) を触るときは、**差分全体を `git diff <file>` で確認してから commit**。自分の編集箇所だけ見ると、別 worker の中途半端な import で本番が落ちる。
- ball_owner 判定で AMD メンバー実名を使う場合、`members` テーブルの `member_name` は半角スペース込み (例: 「輕部 琢真」)。fetch 時にスペース除去版 (「輕部琢真」) と姓のみ (「輕部」) を両方 set に入れる。
- HANDOFF はスリム維持。設計詳細は `spec/`、使い方は `manual/`、判断ログは `design_log/`、教訓は `BUGS.md`。
