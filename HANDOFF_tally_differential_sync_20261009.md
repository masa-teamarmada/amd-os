# Tally 差分同期 — PG17競合検証済み・本番未反映

対象: `masa-teamarmada/amd-os`。本番のSQL適用・Edge反映は未実施。GitHub公開は専用branch `fix/api-auth-tally-sync` と [Draft PR #5](https://github.com/masa-teamarmada/amd-os/pull/5) まで。merge/auto-mergeは行っていない。
作業元: GitHub main `5c45b29527c314027377a832896d16fc3f338c67`。
GitHub connectorの比較で、このSHAとmainが一致することを確認した。
正規checkout `/Users/masa/projects/AMD/amd-os` は未push 3件・cached origin/mainよりbehind 21件だったため、編集していない。
独立cloneは `/Users/masa/Documents/Codex/2026-10-09/task-2/amd-os-tally`。

## 現在地

- `tally-sync`は専用キー、ID001、入力検証を維持し、保存を一回のRPCへ集約した。
- migration 501の `amie_sync_tally_effort` は全PJを一トランザクションで同期する。週の工数が一致する行はINSERT候補から除外し、新規週だけ追加、工数変更だけUPDATE、送信PJ・ID001・明示期間に限って欠落週をDELETEする。
- 空の週配列は明示期間の消去、省略PJは不変。週配列・期間・PJ配列の欠落は拒否する。全PJ・全週を検証してから書き込む。
- 既存の監査トリガーを変更・停止していない。工数の変更時には既存の履歴が残る。
- `tally_project_syncs.last_synced_at`は成功接続の鮮度を維持するため、送信PJごとに一度更新する。この設定行の書込み・監査は引き続き残る。無変更の週行では `synced_at` を書き換えない。
- 同一所有者の同期をtransaction advisory lockで直列化し、複数PJや空窓の同期が混ざることを防ぐ。
- 現行Tallyクライアントは同期を一つに束ねるが、送信データにsource revisionはない。異なるクライアントから古い集計が後着した場合は、従来と同じく最後に直列化された要求が勝つ。source revisionを推測して拒否する変更は加えていない。
- migrationはSupabase CLIの `migration new tally_differential_sync` で生成後、現行DDL正規経路 `pwa/scripts/migrations/501_tally_differential_sync.sql` に移した。二重適用用コピーは作っていない。

## 検証

- Deno `handler_test.ts`: 11件成功。入力の値域・暦日・境界・重複・件数上限・空/省略、認証と失敗応答、一回のRPCへの委譲を検証。
- Deno lint: 成功。
- index/handler/payloadのTypeScript型確認: 成功。既存インストールのSupabase 2.103.0宣言へimportを対応付け、`skipLibCheck`付きの一時設定で確認した。実際のesm.sh/Deno依存取得・Edge runtime起動は未実施。Denoでの宣言直接対応付けは依存ライブラリの型解決で失敗したため、端末ネットワーク制限を越えずこの方法で呼び出し型を検査した。
- Pythonテスト実行器: 構文確認成功。
- `git diff --check`: 成功。
- 既存のPGlite 0.5.8 / PostgreSQL 18.3 WASMを読み取り再利用し、SQL検証55項目成功。新規ソフトウェア導入と旧検証ディレクトリへの書込みは行っていない。
- 無変更週の物理行/日時保持と書込み・監査ゼロ、新規/変更/削除各一件の監査、他PJ/所有者/期間保持、空/省略、直接RPC不正入力、全PJ/設定/履歴のrollback、ACL/RLS、migration順序/再適用を実行確認した。
- リポジトリの既存監査migrationからhistory table・sanitizer・監査関数・append-only関数をそのまま抽出して試験した。`auth.role()`だけは合成JWT用のfixtureであり、全業務schemaやHTTP/JWTの再現ではない。
- 同一接続のtransaction advisory lockがCOMMITまで保持されることと、同一接続へキュー投入した空/有snapshotの最終状態も成功。複数のPGlite instanceは別DBなので、複数接続による競合の証明には使っていない。
- ユーザー承認後、PostgreSQL公式Mac配布一覧に載るPostgres.app 2.9.6の17専用DMGを作業フォルダに取得した。公開GitHub asset SHA-256、disk image整合、codesign深部検証、Notarized Developer IDを確認した。global install/GUI起動/login自動起動は行っていない。
- native PostgreSQL17.11（arm64）で30項目成功。24個の共通SQL assertionとschema rollback、独立した接続の同一snapshot/空窓と有snapshot、先行要求のrollback、lock timeout、実監査関数を含む第2PJ失敗時の全体rollbackを実行した。同一snapshotの2回目は週書込み/履歴ゼロ。工数の最終値、他PJ/所有者/期間の物理行、ロック解放も確認した。
- サーバーはtask folderのdata/private socketと127.0.0.1:55432だけを使用した。使い捨て `tally_sync_test_*` DBと今回新設したNOLOGIN fixture roleは削除済み、serverは停止済み、postmaster.pidもない。CLIと停止中の空clusterは作業フォルダに残し、全MacのPATHやサービスは変更していない。
- 実際のindex/handler/payloadを読み込むRequest/Response harnessで36項目成功。認証/入力不正のSDK/SQL未到達、一回のRPCで複数PJ保存、正規化、週行/監査ゼロ、実変更/削除、空/省略、第2PJ失敗の全体rollback、実SQLエラーのHTTP変換、失敗後のretryを確認した。
- harnessのRequest/ResponseとSQL/監査は実物。Deno.env/serve、Supabase createClient/rpcはfixture adapter、auth.role/JWT claimsは合成fixture。TCP listener、実SDK、PostgREST/schema cache、JWT署名検証、デプロイ済みEdgeとの同等性、全業務schemaは未検証。PGliteは18.3、nativeは17.11であり、本番17.6と同一buildではない。無関係のwriterを含むdeadlockも未検証。
- 結果JSON: `/Users/masa/Documents/Codex/2026-10-09/task-2/tally-pglite-results.json`。実行器: `scripts/test_tally_sync_pglite.mjs`。
- native結果: `/Users/masa/Documents/Codex/2026-10-09/task-2/tally-pg17-results.json`。Request/Response結果: 同dirの `tally-edge-pglite-results.json`。配布検証/停止証拠: 同dirの `pg17-temporary/verification.json` / `lifecycle.json`。
- 実装開始時の通常端末からGitHubへの接続はDNS制限で失敗したため、正規connectorでGitHub版・本番schema/制約/監査定義を読み取り確認した。PG17取得/署名確認/共有メモリ/loopback接続に必要なsandbox外実行は、後の一時導入承認の範囲で行った。秘密値は取得していない。

## 最初の次アクション

PGlite試験はrepo rootから、既存packageの場所を渡して再実行できる。

```sh
node scripts/test_tally_sync_pglite.mjs --engine-dir /Users/masa/Documents/Codex/2026-10-01/task-2/isolated-verification/node_modules/@electric-sql/pglite
```

既存packageは上記の専用ディレクトリにあり、`validation/`そのものにはない。
PGlite側はメモリ内DBのみを使い、ネットワーク・永続DB・認証情報を使用しない。

Request/Response fixture試験も既存packageで再実行できる。

```sh
node scripts/test_tally_sync_edge_pglite.mjs --engine-dir /Users/masa/Documents/Codex/2026-10-01/task-2/isolated-verification/node_modules/@electric-sql/pglite
```

native PostgreSQL17の検証は完了した。再実行時は停止中の専用clusterをloopback限定で起動し、repo rootから次を実行する。終了時に必ず専用serverを停止する。

```sh
python3 scripts/test_tally_sync_local.py --host 127.0.0.1 --port 55432 --user postgres --psql /Users/masa/Documents/Codex/2026-10-09/task-2/pg17-temporary/Postgres.app/Contents/Versions/17/bin/psql
deno test --no-remote ios/supabase/functions/tally-sync/handler_test.ts
deno lint ios/supabase/functions/tally-sync
```

実行器はremote URLを受け付けず、一意な `tally_sync_test_*` DBをlocalhostに作成する。
fixtureとDDLをそこで実行し、完了時にそのDBと今回新設したNOLOGIN fixture roleだけを除去する。
SQLテストは無変更時の物理行・日時不変、新規/変更/削除、両端境界、空/省略、他PJ/所有者/期間、直接RPCの不正入力、全PJ/設定/履歴のrollback、RPC権限を確認する。
同時実行テストは、二番目の要求がadvisory lockを待つことと、同一snapshotの追加週変更ゼロ、空/有データsnapshotの最終値、先行rollback、lock timeoutを確認する。
native SQL共通fixtureは同一UPDATEも記録する厳格な行トリガー。nativeの競合/rollback段階とPGlite実行器はさらにリポジトリの実監査関数を追加している。
残る次アクションは、承認された使い捨て非本番Supabaseで実SDK/Edge/PostgREST/JWT→RPC→監査の接続確認。接続済み3projectにはdev branchがなく、既存projectを使い捨て環境とは扱っていない。追加環境を無承認で作成・変更しない。

## 本番反映は別途承認後

1. PGlite SQL55項目、Request/Response fixture36項目、native PostgreSQL17の30項目は成功済み。非本番Supabaseで実SDK/Edge/PostgREST/JWT→RPC→既存監査の確認を行う。
2. 最新mainを再確認し、migration番号501の競合があれば正規番号へ調整する。今回差分だけを統合する。
3. migration 501を `python3 -X utf8 pwa/scripts/apply_ddl.py pwa/scripts/migrations/501_tally_differential_sync.sql` で適用する。現在は未適用。
4. 関数ACLがPUBLIC/anon/authenticatedに開いておらず、service_roleのみ実行可、invoker、既存監査トリガー有効をreadbackする。
5. `tally-sync`の3 runtime files（index/handler/payload）をSupabase正規Edge手順で反映する。migrationを先に適用し、Edgeだけを先行させない。
6. 自然発生する通常同期を読取り観察し、同期成功、設定鮮度、週数/工数、週監査増分、DB statement calls/WALを同じ期間で比較する。検証用データの本番書込みは行わない。
7. schema dumpを正規scriptで再生成し、本番未適用というspec/manual注記を適用済みに更新する。

ロールバックは旧Edgeを先に戻す。新RPCは旧Edgeから参照されないため、緊急復旧時に関数削除は不要。
旧Edgeへの復帰はdelete/reinsertを再開することを意味するので、観察指標も記録する。

## 仕様同期・所有権

| 仕様変更 | 正本 | マニュアル | 状態 |
|---|---|---|---|
| Tallyの差分・原子保存・空/省略・日時・同時実行 | spec 3-8 | manual 2-3 | PGlite55 / Request/Response36 / native PG17 30項目成功・本番未適用を明記 |
| 変更履歴 | spec 6-1 | manual 9-3 | 追記 |
| 理論・数式 | 変更なし | 該当なし | 集計式・値を変更していない |

仕事種別はdevelopment。design_logと記憶は更新していない。会話の検討材料は0件。
認証 `31cfdb1a` とTally `943f0138` の最終差分を最新main基点へ統合し、専用checkoutでDeno11件・PGlite SQL55件・実入口→fixture SDK→SQL36件・native PG17並行実行30項目を再確認した。使い捨てDB/role/clusterは停止・削除済み。
残る実Edge/PostgREST/JWT検証と本番反映は別承認が必要。Draft PRの公開を本番反映済みと扱わない。反映順は引き続きmigration501→Edge。
