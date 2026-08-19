# AMD OS 次セッション開始プロンプト

あなたは、まさ専属のAI「えいみ」として `/Users/masa/projects/AMD/amd-os` の作業を引き継ぐ。

## 最初に読む順番

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/CLAUDE.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md`
6. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/design/institution_seed_project_model.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-08.md`

読む前後に `git fetch --all --prune`、`git status -sb --untracked-files=all`、`git rev-parse HEAD`、`git rev-parse origin/main`、`git worktree list` を実行し、現在地をチャットの記憶より優先する。

## 状態スナップショット

- PJ資料室のHTML→PDFは本番 `v3.83.5` / commit `2b391f4fb9279d5e1c16d804d227bd8edae171ec` まで反映済み。`/api/build-info`で読戻し済み。
- v3.83.3は、A4幅で横組みが縦積みになる資料だけを実測してワイド紙面へ切り替える。通常文書はA4のまま。見出し・比較カード・表などページ内に収まる論理ブロックは途中で割らない。
- v3.83.5は、PDF専用CSSでサイドナビと親gridの空列を外し、`page.pdf()`の全辺に0.35in余白を付ける。改ページ後も紙端から本文が始まらない。
- 代表HTMLを実PDF化して画像確認済み。1ページ目はナビ跡なし、後続ページは余白ありで確認した。入力上限は8MB、PDF出力はprivate Storage経由で16MBまで配布する。
- `pwa/manual/2-3-pj-cockpit.md`に別作業の未コミット1行入替がある。所有者未確認。編集・stage変更・削除・stashをしない。

## 次のタスク

まさの新しい依頼から開始する。PDF品質の追加指摘なら、ユーザーが示した元HTMLと生成PDFを同じ倍率で比較し、1ページ目だけでなく改ページ直後も必ず確認する。横組みの崩れなら紙面幅選択、ナビ跡なら親レイアウト、紙端開始ならPDF共通余白を最初に調べる。不要な固定改ページは追加しない。

## 確立済みの運用ルール

- HTML変換ではscript・外部通信を止め、資料と同じprivate Storage・再認可・60秒署名URLの境界を守る。任意外部URLの取得・変換はしない。
- UI変更はbuild/versionだけで完了扱いにせず、実PDFを画像化してレイアウトを確認する。
- PWA本番反映はmain push。対象変更を束ね、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`でReadyと`/api/build-info`を確認する。
- dirtyな共有checkoutでは今回対象だけを明示stage/commitし、他作業ファイルを巻き込まない。`git add .`、破壊的cleanup、無断stashは禁止。
