# HANDOFF - AMD OS PWA

- 更新: 2026-09-01 JST
- セッション: PJコックピットのタブ整理・高密度化・KUTEシーズ導入部の撤去
- 作業種別: development

## 最新セッションの到達点

PJコックピットの親グループと子タブを整理し、本番へ反映した。

- 通常PJは `進捗管理 / 事業計画 / PJ管理` の3グループ。
- 研究機関PJは `進捗管理 / シーズリスト / 規程・内規 / PJ管理` の4グループ。事業計画グループは出さない。
- 親グループのhover/focusで子タブ一覧をフロート表示し、クリックを1回減らした。
- `目的構造` を `ガント` から独立タブへ分離した。
- `活動・実績` はPJ概要、`資本政策` は事業計画へ所属させた。
- ZMPの仮 `テーマ` タブはコックピットから削除した。ワークスペース側のテーマ機能は変更していない。
- desktopは親36px、常設子タブ32px、フロート行28pxへ圧縮。mobileは44px以上を維持。
- KUTEコックピットのシーズ一覧は、見出し・説明・注意・件数サマリを外し、評価フィルタと比較表から始める。全体 `/seeds` は従来の見出しと集計を維持。

恒久仕様は `pwa/spec/3-8-cockpit-current-spec.md`、利用者向け説明は `pwa/manual/2-3-pj-cockpit.md`、履歴は各附則へ同期済み。

## 反映・検証

- canonical commit: `3ac19c23f55f19c1169a0ea3d41d3090a6dd59fc`
- production: `v3.100.17`
- コックピット採用commitは `3ac19c23`。handoff作成後に別作業のcommitを含むmainが進み、最終監査時点の `origin/main` とlocal `main` は `97ad6988` で一致（ahead 0 / behind 0）。
- 本番desktop: 親35.994px、子31.996px、フロート209.794px、7行×27.997px。フロートは747px高の28.1%。
- 本番mobile相当: 子タブ44px、document横overflowなし。
- KUTE内では不要な導入文なし、全体 `/seeds` では見出し・集計を維持。
- console errorなし。
- 回帰、型検査、production build、公式deploy guardは通過。

## Repo状態

- branch: `main`
- コックピット採用commit: `3ac19c23`
- handoff文書commit: `03432c90`（後続mainに包含）
- 今回作成したbranch / worktree: なし
- 今回の対象変更: commit・push・production反映済み
- 別作業の既存dirty: BZM原稿・監査資料と `pwa/design_log/sessions_2026-08.md`。今回のcommitには含めず、内容にも触れていない。
- handoff作成中に `pwa/src/components/cockpit/CockpitKuteSeeds.tsx` と `pwa/scripts/_seed_table_shot.mjs` へ別作業の新規dirtyを検知。評価フィルタを列見出しへ移す途中差分と検証用スクリプトで、現行productionには未反映。所有元が確定するまでstage・revert・整形しない。
- 一時clean cloneは `/Users/masa/.Trash/amd-os-cockpit-density.DqQkIY` へ移動済み（復旧可能）。

## 未解決

- このコックピット変更に残作業なし。
- iOS / macOS / Androidへの同じグループナビ移植は未実施。まさが横展開を指示した場合だけ着手する。
- リポ全体のarchiveは、別作業の既存dirtyと `CockpitKuteSeeds.tsx` の所有・処理が確定するまで不可。

## 次の最初の行動

まさの次の指示を待つ。コックピットを続ける場合は、先に本番 `v3.100.17` と `pwa/spec/3-8-cockpit-current-spec.md` を読み、タブ正本 `pwa/src/lib/cockpit-tabs.ts` を起点にする。PJごとの画面内コピーを増やさない。

## 参照先

- 現行仕様: `pwa/spec/3-8-cockpit-current-spec.md`
- OSマニュアル: `pwa/manual/2-3-pj-cockpit.md`
- 仕様履歴: `pwa/spec/6-1-appendix-changelog.md`
- マニュアル履歴: `pwa/manual/9-3-appendix-changelog.md`
- バグ・教訓: `pwa/BUGS.md`
- タブ正本: `pwa/src/lib/cockpit-tabs.ts`
- 回帰: `pwa/scripts/check_cockpit_navigation.mts`、`pwa/scripts/check_kute_seeds_scope.mts`
