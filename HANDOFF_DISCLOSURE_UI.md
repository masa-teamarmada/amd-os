# HANDOFF — 取締役会と開閉カードの視認性

- 更新: 2026-11-05 JST
- 作業種別: development（PWA UI）
- 正本: `pwa/spec/3-23-project-format-current-spec.md`、`pwa/spec/2-7-ui-design-code-current-spec.md`

## 現在地

- まさの指摘に沿い、取締役会の重複見出し・常設の機関設計説明を外し、一覧を比較しやすくした。行内詳細では青い「決議事項」を冒頭に置き、白地の主領域で議案と結果を読み、資料は補助欄に置く。元記録の種別や署名未確認は維持。
- 取締役会・株主総会の一覧行は日付・結果・余白も含めて開閉できる。通常PWA業務画面の開閉カードは見出し行と周囲の余白で開閉でき、PCではクリック可能範囲全体が淡青に変わる。本文、リンク、入力、編集、文字選択とキーボード操作は保護。
- 本依頼の実装commitは `a5636bc95`、`49707a2ca`、`d7a562341`、`0eeb9b1c4`、`9c3d84c96`。最後のUI版は `v3.165.17`。当時、本番build-infoのSHA一致とPC Chromeで取締役会・別の開閉カード画面を確認した。
- 2026-11-05の引き継ぎ着手時、`main=origin/main=21a53d2c5`、dirtyなし、本体worktree1、ローカルbranchはmainのみ。公開 `/api/build-info` は `v3.165.18` / `a1adb5c13` で、UI版を含む後続の本番版。`21a53d2c5` は別作業の文書commitで、画面には出ない。
- 対象の直リンク: https://amd-os-pwa.vercel.app/project/p00/cockpit?tab=board-meeting

## 未解決と最初の次アクション

- この依頼分の残作業はない。まさから新しい表示指摘が出たら、対象URLとPC Chromeの実画面で再現し、`pwa/spec/2-7-ui-design-code-current-spec.md` の開閉範囲・ホバー・操作保護の契約を基準に修正する。株主総会と他の開閉カードにも回帰がないか確認する。
- PWA UIだけを変更した。Swift、DB、DD、印刷画面への移植・変更は依頼されていない。

## 参照先

- 機関決定の仕様: `pwa/spec/3-23-project-format-current-spec.md`
- 共通開閉UIの仕様: `pwa/spec/2-7-ui-design-code-current-spec.md`
- 操作: `pwa/manual/2-3-pj-cockpit.md`「株主総会・取締役会」、`pwa/manual/2-1-member-quick-start.md`「カードの開閉」
- 全画面正本: `ios/DESIGN.md`
- 開発履歴: `pwa/design_log/sessions_2026-11.md`
- ネイティブ境界: `pwa/HANDOFF_pwa_to_native_viewing.md`
- 回帰の教訓: `pwa/BUGS.md`
