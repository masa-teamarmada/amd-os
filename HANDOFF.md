# HANDOFF

最終更新: 2026-08-23 JST
対象: シーズリストの一次選別帯を参照系キャッシュへ載せる + Vercelリージョン最適化 + シーズリスト障害修正（PWA / v3.90.5）

## 今回の到達点

まさの依頼「シーズリストのモーダルを開いたとき、一次選別スクリーニング帯以下が出るまで遅い。頻繁に変更される内容じゃないから最初から設計上そうすべき。全アプリで繰り返し言ってるので、同じことを繰り返さない仕組みも作って」への対応。

- 帯データ（`seed_screening_bands`）をサーバのプロセス内スナップショット＋`Cache-Control`＋クライアントのモジュールキャッシュの3層で既定化。一覧行のhoverで詳細を先読みし、モーダルを開いた瞬間に描画するようにした。
- 同じ遅さを次の画面で繰り返さないための guard（`scripts/check_reference_data_cache_contract.mjs`）を新設し `deploy.sh` の本番反映前に組み込んだ。規範は `pwa/spec/5-10-reference-data-caching-current-spec.md` + 全PJ共通の `AGENTS.common.md`/`AGENTS.common.reference.md`。
- キャッシュ導入後に本番で実測したら、DB往復ゼロでもまだ1〜2秒かかっていた。原因はクエリではなく **Vercel関数のリージョン未指定**（既定の米国東海岸で稼働）と**認証の2往復**。`vercel.json` に `"regions": ["hnd1"]`、`members`照合をプロセス内30秒キャッシュにして解決（帯詳細1件 1081〜2126ms → 305〜543ms）。全APIに効く変更。
- 本番画面を実際に開いて確認する過程で、`/seeds` 全体が「Bad Request」で表示できない障害（シーズが735件に増え `.in()` のURL長上限に当たっていた）を発見・修正。
- まさのログイン済みChromeで実画面確認済み。

## 正本

- 今回の規範: `pwa/spec/5-10-reference-data-caching-current-spec.md`
- PWAの詳細な現在地: `pwa/HANDOFF_pwa_rebuild.md`
- 変更履歴: `pwa/spec/6-1-appendix-changelog.md`
- バグ記録: `pwa/BUGS.md` の `[seeds/in-filter-url-limit]`、`[process/cross-session-messaging]`
- 開発履歴: `pwa/design_log/sessions_2026-08.md`（2026-08-23節）

## Repo状態

- canonical checkout: `/Users/masa/projects/AMD/amd-os`、branchは `main` のみ。今セッションで作ったbranch・worktreeは無い。
- push直前の確認で behind 0 / ahead 0。別セッション（`/model` ページの式・記号一覧の実装）の複数commitが並行して積まれ、今回のpushと混在している。
- 作業ツリーはclean。今セッションが対象外のファイルには触れていない。
- **注意**: このリポは常時複数セッションが並行稼働する共有checkout。着手前に必ず `git fetch --all --prune` → `git log --oneline -15` → `git status -sb` で現在地を再確認すること。
- **他セッションへメッセージを送らない**（2026-08-23 まさ明示禁止）。共有checkoutの状態はrepoの記録（git log / git status / spec / changelog）から読む。詳細は `pwa/BUGS.md` の `[process/cross-session-messaging]`。

## 未解決

- なし（このセッションの対象範囲では）。
- 別テーマとして `pwa/HANDOFF_pwa_rebuild.md` に「Phase 3（資料室デッキエディタ本体）」と「知財台帳の外部同期3件」が持ち越しで残っている。今回は触っていない。

## 次の最初の行動

まさの新しい依頼を起点にする。参照系データのキャッシュを新しい画面へ広げるなら `pwa/spec/5-10-reference-data-caching-current-spec.md` を先に読み、`npm run test:reference-data-cache` が通ることを確認してから deploy する。
