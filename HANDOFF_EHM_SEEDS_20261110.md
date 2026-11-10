# HANDOFF - EHMシーズ記録

- 更新: 2026-11-10 JST
- 作業種別: development
- 対象: 愛媛大学の研究機関PJ `p30 EHM`、澤崎シーズ、劉シーズ
- 設計正本: `pwa/design/seeds.md`、`pwa/design/institution_seed_project_model.md`、`pwa/design/FEATURE_REGISTRY.md`
- 利用手順: `pwa/manual/2-5-research-assets-quick-start.md`

## 現在地

- 2026-08-18に、愛媛大学の澤崎シーズと劉シーズをシーズ台帳へ追加し、MTG・Slack・Teamsのやり取りを接触履歴へ登録した。
- 研究機関コックピットのシーズ一覧と大元のシーズ一覧は、同じ内部向け詳細モーダルを使う。
- 澤崎シーズにはNotion議事録を根拠とする「NEDO NEP 開拓コース」の採択履歴が1件ある。採択年度・金額・実施期間は未確認のため空欄。
- `p30 EHM` は正式PJとして `active`。左メニュー「ホーム」のPJ候補に表示する。
- 議事録・Slack・Teamsを取り込むときは、要約だけで終えず、助成金、接触、ニュース・論文・特許、PJ関係を各専用項目へ保存する。
- 実装は `9ecf9a835`、`5f88fa8c0`、`0d37e11e5`、`b51921ff9` でmainへ反映済み。`b51921ff9` は2026-08-18に本番反映とPC画面確認まで完了した。

## 2026-11-10の閉鎖確認

- 上記4件のcommitは現在のmain `69a3f5bff` の履歴に含まれる。
- 設計正本、利用手順、変更履歴に今回の仕様が残っている。
- ローカルHEADと手元の `origin/main` は一致。ただしGitHubへの再取得は名前解決失敗のため未確認。
- 現在の本番DB読戻しと現在のPC画面再確認は未実施。Supabase接続はこの管理環境の承認制約で実行できなかった。

## 未解決

- 今回の依頼に起因する未実装はない。
- 次にEHMの台帳を触るときだけ、本番DBで `p30=active` とNEP採択1件を読み戻し、PCのChromeで「ホーム」候補と澤崎シーズ詳細を確認する。

## 次の最初の作業

EHMの追加更新が発生したら、先に本番DBとPC画面を読み戻す。migration 286〜288は適用済みなので再適用しない。

## 参照先

- シーズ台帳: `pwa/design/seeds.md`
- 研究機関・シーズ・PJ関係: `pwa/design/institution_seed_project_model.md`
- 左メニューと詳細モーダル: `pwa/design/FEATURE_REGISTRY.md`
- 利用手順: `pwa/manual/2-5-research-assets-quick-start.md`
- 変更履歴: `pwa/manual/9-3-appendix-changelog.md`
- 開発履歴: `pwa/design_log/sessions_2026-08.md`
- 再発防止: `pwa/BUGS.md`
