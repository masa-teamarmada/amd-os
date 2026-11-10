# VC投資履歴 引き継ぎ

最終更新: 2026-11-10
対象: VC投資履歴の分離表示と、AMDのPJと接点があるVCからの候補収集

## 現在地

- `/vcs/investments` は本番稼働中。`/vcs`、`/vcs/investments`、`/vcs/inbox`を上部タブで切り替える。
- SU、資金調達ラウンド、VC参加を別データとして持ち、VC個別出資額とラウンド総額、出資・完了日と公表日、成立状態と確認状態を分けて表示する。
- 収集対象はAMDのPJと接点があるVC。人が呼ぶ処理だけで1回最大5社を調べ、軽量モデル`gemini-3.5-flash-lite`以外では停止する。
- 自動収集の保存先は必ず`candidate`。人が根拠を確認するまで`confirmed`へ上げない。
- 2026-11-10の本番DB読戻しは、参加記録162件、内訳は候補10件、旧台帳124件、却下28件、確認済み0件。候補は5VC・10SUで、VC個別額あり0件、ラウンド総額あり3件。
- 最終収集は2026-09-09。以後は追加収集されていない。
- 実装commit `793acfb7` は`origin/main`と本番版の両方に含まれる。2026-11-10の本番は`v3.165.23`、版情報SHAは`8f14d083...`。現行`origin/main`は`923fb71ba`で、差は画面へ出ない文書commit 1件。

## 未解決

1. 候補10件の根拠を人が確認し、`confirmed`または`dismissed`へ確定する操作導線は未整備。現状はDB状態を画面で読むところまで。
2. AMDのPJと接点がある残りのVCを、次の5社単位で追加収集するかは未決定。
3. `/spec`の再構築監査ではAtlas / Seeds / VC / Scholarが`not yet`。現行仕様は`pwa/design/vc_list.md`が正本。

## 次に最初にやること

PCのChromeで`/vcs/investments`を開き、確認状態を「収集候補」に絞る。10件の根拠リンクを上から確認し、SU、VC、ラウンド、日付、個別額、総額のうち資料に明記された項目だけを確定する。候補10件の採否が終わってから、次の5VCを収集する。

## 参照先

- 現行設計: `pwa/design/vc_list.md`
- 利用手順: `pwa/manual/2-5-research-assets-quick-start.md`
- 必須導線: `pwa/design/FEATURE_REGISTRY.md`
- DB: `pwa/design/db_schema.md`
- 開発履歴: `pwa/design_log/sessions_2026-09.md`「VC投資履歴の分離と根拠付き候補収集」
- 不具合と再発防止: `pwa/BUGS.md`「VC投資履歴の初回収集で誤った根拠URLを候補化」
- 実装検査: `pwa/scripts/check_vc_investment_ledger_contract.mjs`

## Git・本番

- 正規作業場所: `/Users/masa/projects/AMD/amd-os`
- branch: `main`
- handoff作成前のHEAD / origin: `923fb71ba` / `923fb71ba`
- 未送信commit: なし
- 未コミット変更: なし
- 本番再配布: このcloseoutでは製品仕様を変えていないため不要

ルートの`SESSION_MIGRATION_PROMPT.md`はAMD OS全体最適化の現行引き継ぎが使っている。上書きを避け、この件の再開文は`SESSION_MIGRATION_PROMPT_VC_INVESTMENT_HISTORY.md`へ分離した。
