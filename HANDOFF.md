# HANDOFF

最終更新: 2026-08-19 JST
対象: SE（p10）経営ハイライトの他PJ混入是正と原因診断

## 今回の到達点

- SE cockpit の `project_strategy_signals` を監査し、NIMS由来4件・CryoX由来1件、計5件の誤登録candidateを `archived` へ移した。削除はしていない。
- 本番 `https://amd-os-pwa.vercel.app/project/p10/cockpit` をログイン状態で再読込みし、経営ハイライトが `0件`・`まだシグナルなし。` と表示されることを確認した。
- 表示クエリの横断取得ではなく、2026年5月の上流データ汚染を経営ハイライト候補として保存した過去データが原因だった。
- 既知のp10/202604月報は `invalid` で、現行D-6は入力から除外する。一方、outbox applierは候補の `project_id` と根拠内容の意味的なPJ帰属を照合しないため、同型の新規誤登録を完全には防げていない。

## 正本と教訓

- D-6仕様: `pwa/spec/3-6-strategy-signals-current-spec.md`
- 現行抽出契約: `pwa/scheduled-tasks/amd-os-l9-strategy-signal-extract/SKILL.md`
- 事故記録: `pwa/BUGS.md` の `SE経営ハイライトに他PJ内容が混入` 節

## Repo / production状態

- 本番データ是正そのものは既存API経由で行い、コード・migrationは変更していない。
- この引き継ぎ・事故記録は `c4f57343` で `main` へpush済み。PWAの自動production deployはReadyで、`/api/build-info` は同commitを返した。
- PWA本番の確認時バージョン: `v3.82.4`。

## 今回と無関係なdirty

別作業としてindexに残っているため、触らず保全した。

- `docs/corporate/` の社内資料と生成スクリプト
- `pwa/manual/4-3-amd-score-spec.md`
- `pwa/spec/4-2-amd-score-current-spec.md`
- `pwa/scripts/diagnose-cash-inflow.mts`
- `pwa/scripts/refresh-live-monthly-pl.mts`

## 未解決

- まさ判断: 今は混入防止の実装を保留する。
- 実装する場合は、候補の根拠PJ IDを必須にし、outbox作成時・applier時の両方で対象PJとの一致を検証する。p10にCryoX/NIMSが入るfixtureを回帰テストにする。

## 次の最初の行動

新しい依頼から開始する。SE経営ハイライトの再生成や防止策の実装を求められたときだけ、上記D-6仕様・SKILL・BUGSを先に読み、既存候補を推測で復元しない。
