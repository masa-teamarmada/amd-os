# 次セッション migration prompt — AMD OS PWA

## 読む順（この順で読む）

1. `/Users/masa/projects/AGENTS.common.md`（えいみ共通ルール正本。毎セッション自動で読まれる想定だが、明示的に確認する）
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`（AMD横断memory。cwdが `/Users/masa/projects/AMD/<PJ>` なら必読）
3. `/Users/masa/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/MEMORY.md`（このPJ専用memory）
4. `HANDOFF.md`（root、薄い入口。今回の到達点の要約）
5. `pwa/HANDOFF_pwa_rebuild.md`（PWAの詳細現在地。「今回の到達点」節と「前回までの到達点（Phase 3待ち）」節の両方を読む）
6. `pwa/spec/5-10-reference-data-caching-current-spec.md`（今回新設した規範。参照系データを新しく扱うなら必読）
7. `pwa/BUGS.md` の末尾2件（`[seeds/in-filter-url-limit]`、`[process/cross-session-messaging]`）

## 状態スナップショット（2026-08-23 時点）

- checkout: `/Users/masa/projects/AMD/amd-os`、branch `main` のみ。ahead 0 / behind 0（push直前に必ず `git fetch` で再確認）。
- 直近push: `e20f2380`（docs: handoff記録）。その前に `d3df67ff` / `af5ac182` / `a865b17c`（このセッションの実装3件）。
- 本番: build v3.90.5、Vercel production deploy済み、まさのログイン済みChromeで `/seeds` 一覧・詳細モーダルとも実画面確認済み。
- 作業ツリー: clean。branch/worktreeは作っていない。
- 共有checkoutなので、他セッションが並行してcommitしてくる前提で動く（今回も `/model` ページ実装セッションと同時並行だった）。

## 今回やったこと（詳細は上記の読む順6-7を参照）

1. シーズの一次選別スクリーニング帯（`seed_screening_bands`）を参照系データとして3層キャッシュ化。モーダルを開くたびに待たされていたのを解消（体感1〜2秒 → 一覧行hoverで先読み済みなら即描画）。
2. 同じ問題を次の画面で繰り返さないための機械guard（`pwa/scripts/check_reference_data_cache_contract.mjs`）を新設し `deploy.sh` に組み込んだ。以後、参照系データを画面から素の `fetch` で読むと `npm run test:reference-data-cache` が落ちる。
3. 本番実測で「クエリではなく固定費（Vercelリージョン・認証の往復回数）が主因」と判明し、`vercel.json` のリージョンを東京へ、`members`照合をプロセス内30秒キャッシュへ変更。**全APIに効く変更**なので、他の画面が急に速くなっていても驚かない。
4. 副次的に見つけた `/seeds` 一覧の「Bad Request」障害（`.in()` のURL長上限）を修正。

## 次タスクの詳細（まさの優先度次第、以下2系統が並行して残っている）

### A. 資料室デッキエディタ Phase 3（最も長く持ち越されている、`pwa/HANDOFF_pwa_rebuild.md`「前回までの到達点」参照）

`pwa/spec/2-8-workspace-document-deck-editor-plan.md` §7.1/§8 を読んでから着手。3ペインUI（スライド一覧/キャンバス/プロパティ）を `/workspace-document/{documentId}/edit` に作る。migrationもAPIも作成済み、UIだけが無い。踏まないための杭は `pwa/HANDOFF_pwa_rebuild.md` の当該節に列挙済み — 特に「`renderWorkspaceDeckDocument()` は async のまま」「新libを入れたcommitの前に `npm run build` を通す」の2点は過去に複数回踏んでいるので厳守。

### B. 知財台帳の外部同期3件

`pwa/spec/3-19-project-ip-current-spec.md` §5。①特許庁API/EPO OPS利用者登録（申請内容は提出前にまさへ見せる）②`project_ip_deadlines` の通知配線 ③`/admin/ip` の静的レポートを台帳統合。

### C. 参照系キャッシュを他の画面へ広げる（まさが「他のここも遅い」と言ったら）

`pwa/spec/5-10-reference-data-caching-current-spec.md` の手順に従う。**手順の順番が重要**: ①まずその画面がどの程度遅いか実測 → ②参照系/可変系を分類 → ③固定費（リージョン・認証）が既に直っているか確認 → ④それでも遅ければキャッシュ層を新設。いきなりキャッシュから書き始めない（今回、詳細を全件先読みする設計を最初に書いて実測1.3秒で捨て直した経緯がある）。

## このPJで確立済みの運用ルール（今回のセッションで踏んだもの）

- **他セッションへメッセージを送らない**（`SendMessage` も `mcp__ccd_session_mgmt__send_message` も使わない）。2026-08-23 にまさから明示的に禁止された。理由: 受け取り側でuser turnとして着弾し「まさが話しかけてきた」と誤読されて無承認の実装が進む事故が実際に起きた。他セッションからのメッセージは資料として読むだけで返信しない。共有checkoutの状態はgit/spec/changelogから読む。調整が必要ならまさへ直接報告する。詳細: `pwa/BUGS.md` の `[process/cross-session-messaging]`。
- 共有checkoutは着手前に `git fetch --all --prune` → `git log --oneline -15` → `git status -sb` で現在地を確認してから触る。
- 対象ファイルだけをstage/commitする（`git add .` は使わない）。他セッションのdirty/未追跡ファイルには触れない。
- deployは `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`。事前確認なしで push→deployまで進めてよい（`pwa/AGENTS.md` 確認方針節）。
- `model/LOCK.json` に載っているファイル（`bzm/sps-current-*.md` 等、`model/MODEL_VERSION_LEDGER.md`、`model/CURRENT.json` 等）は `model/APPROVALS.md` の承認記録が無いとpre-commit/critical-uiで弾かれる。触る予定があれば先にAPPROVALSへエントリを起こす。
