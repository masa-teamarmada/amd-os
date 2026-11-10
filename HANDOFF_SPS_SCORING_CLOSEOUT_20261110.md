# シーズSPS初回評価・一覧アイコン 引き継ぎ

- 更新: 2026-11-10 JST
- 作業種別: development / data assessment
- 状態: この会話はいったん終了。再開可能な未評価データあり

## この会話で完了したこと

- SPS初回評価は、prepared snapshot、prompt/model/source freshness、情報締切、privacy、pending改ざん、冪等性を検査する候補経路へ整理した。
- シーズ一覧は、外部faviconではなく `domain_lane` に対応する技術領域アイコンをシーズ名の左へ表示する。
- アイコンの現行仕様は `pwa/manual/5-1-research-assets-vc-seeds-scholar-spec.md` に残っている。
- 当時の実装・migration・検査・本番反映はmainへ取り込み済み。このcloseoutでは製品コード、DB、Vercel、Supabaseを変更していない。

## 2026-11-10のDB読取

`node scripts/sps_initial_assessment_tool.mjs status` の実測:

- seeds: 816
- assessed: 736
- remaining: 80
- defective: 170

これは旧SPS初回評価台帳の現況。未評価80件と意味づけ欠落170件を、完了済みとは扱わない。

一方、現行のシーズ画面は2026-08-27以降、旧SPS金額を主表示せず、BZM 3.0の「産業創出価値」と「現在地・型」を表示する。旧SPS台帳の補完を再開する場合は、現行モデルの意思決定にまだ必要かを先に確認する。

## Nano Frontierの評価記録

- 2026-08-25に、東北大学発のNano Frontierをシーズ台帳へ登録した。同日に旧初回評価の経路で金額帯を登録したが、これは `sps-ind-tier0-v1` の凍結行であり、BZM 3.0の案件スコア `V` ではない。
- 正本上、SPSはBZM 3.0の出力である。旧式を一次選別だけに使い続ける決定は確認できない。この帯をNano Frontierの現行評価やBZM 3.0の試算結果として説明しない。
- 2026-09以降はBZM 3.0の案件スコアを保存する経路が追加されている。2026-11-10のcloseoutではNano Frontierに最新BZM 3.0行があるかをDBで再確認していないため、次回はまず現行のBZM 3.0スコアと表示を読み戻す。
- 旧初回評価の凍結行は追記型の履歴なので、このcloseoutでは直接更新・削除していない。修正が必要なら、現行のBZM 3.0評価を正規経路で追加し、画面の現行表示を確認する。

## 再開時の最初の判断

1. `model/CURRENT.json`、`model/LOCK.json`、現行シーズ仕様を読み、旧SPS初回評価の補完目的が現在も有効か確認する。
2. 有効なら、`bzm/SPS_INITIAL_ASSESSMENT_PLAYBOOK.md` と `pwa/scripts/sps_batch/README.md` の現行手順を監査する。
3. DBを再読取し、`remaining` と `defective` を別作業として扱う。prepared snapshotを加工せず、根拠のない値を補完しない。
4. 旧SPS補完を続けない判断なら、台帳を削除せず監査履歴として保持し、旧migrationや凍結行を更新しない。
5. Nano Frontierを扱う場合は、先にBZM 3.0の最新行を確認する。自動化導入の引き合いは、有償契約、月額、拘束工数、本業との近さ、検証への寄与を分けて入力し、単純な加点にしない。

## 参照先

- シーズ利用手順: `pwa/manual/5-1-research-assets-vc-seeds-scholar-spec.md`
- 現行PWA仕様: `pwa/design/SPEC_pwa.md`
- 現行モデル: `model/CURRENT.json`、`model/LOCK.json`
- 初回評価手順: `bzm/SPS_INITIAL_ASSESSMENT_PLAYBOOK.md`
- バッチ手順: `pwa/scripts/sps_batch/README.md`
- 既知の事故: `pwa/BUGS.md`
- 旧是正ラウンドの詳細: `SESSION_MIGRATION_PROMPT_SPS_INITIAL_ASSESSMENT.md`

## Git状態

- closeout着手時は `main`、`origin/main` と一致、追加worktree 0、ローカル非main branch 0。
- 共有checkoutでは複数の別会話が同時にcloseoutしていたため、それらの成果物へ手を加えず、この引き継ぎと汎用移行プロンプトだけを対象にする。
