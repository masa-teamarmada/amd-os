# AMD OS 次セッション移行プロンプト — PWAのタブ表示と作業フォルダの自動追従の続き（2026-10-04）

cwd: `/Users/masa/projects/AMD/amd-os` で起動して、以下をそのまま実行して。

## 読む順
1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`（AMD横断memory）
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/HANDOFF_ROOT_SYNC_PWA_TABS_2026-10-04.md`
5. `pwa/spec/5-2-development-operations-current-spec.md` の「作業フォルダの追従 (root-checkout-sync)」節
6. `pwa/spec/2-1-pwa-runtime-routes.md` の「実行環境」表、`pwa/manual/2-1-member-quick-start.md` の「アプリ版でタブを並べる」
7. `pwa/BUGS.md` 先頭の 2026-10-03 の項

## 状態スナップショット
- 本番: タブ表示は v3.148.2、追いつき係の仕様は v3.149.1、セッション開始時の自動実行の仕様は v3.154.4、handoff 文書は v3.155.2 で反映済み。
- タブ表示: `pwa/public/manifest.json` の `display_override: ["tabbed", "standalone"]`。Mac の Chrome（まさは 154）では実験機能で標準 off。`chrome://flags/#enable-desktop-pwas-tab-strip` を Enabled → Relaunch → AMD OS アプリを開き直す、で出る。まさの端末での実画面は未確認。
- 追いつき係: `scripts/root-checkout-sync.py`。`.claude/hooks/git_dirty_guard.sh`（git 管理外）の session_start で `--quarantine on`。記録 `~/Library/Logs/amd-os-root-sync.log`、最後の結果 `/Users/masa/projects/AMD/amd-os-root-dirty/last_status.json`、控えは同フォルダの日時別。2026-10-03 の手作業分の控えは `/Users/masa/projects/AMD/amd-os-root-dirty-20261003/`（README.md に仕分け結果）。
- 作業フォルダ: 2026-10-04 時点、別セッションの DDパッケージ・PJ概要の書きかけがぶつかって2件遅れ（作業中なので追従待ち）。

## 次タスク
- まさから「タブが出ない」等の返事があれば調べる。Chrome の版、flag の状態、アプリを開き直したかを確かめる。manifest の再読込は、アプリのページを読み込むたびに Chrome が確認する（アイコン更新だけが1日1回に間引かれる）。
- セッション開始時の `[root-sync]` 行を確認し、隔離が起きていたら控えの README.md を見て、残す価値のある記録を最新版へ移す。

## 確立済みの運用ルール
- 作業フォルダで別セッションが作業中だと、pre-commit の点検がその書きかけで落ちる。自分の変更は scratchpad の clean clone へ patch で移し、そこで commit と `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を行う。
- `pwa/spec` `pwa/manual` `pwa/BUGS.md` の変更は画面に出るため `[skip ci]` を付けると push 前点検が止める。BUILD_VERSION を patch で上げて deploy.sh を通す。
- auto mode の安全装置は、書きかけの破棄・フック編集を会話内の承認では通さない。必要なときは、まさに権限モードを「毎回確認」へ切り替えてもらう。権限モードはえいみから変えない。
- 最新版とぶつからない古い書きかけの自動隔離、30分ごとの定期実行は、まさが採用していない。勝手に入れない。
- まさへの報告は、開発を知らない人に話すつもりで、画面で何が変わったかから書く。
