Vercel Functions Storageの超過対策の続きを確認して。作業場所は /Users/masa/projects/AMD/amd-os。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. リポジトリのAGENTS.mdとpwa/AGENTS.md、pwa/manual/1-1-intro.md
4. HANDOFF_FUNCTION_STORAGE_20261006.md
5. pwa/spec/5-2-development-operations-current-spec.mdの「Function保存容量の抑制」、pwa/manual/9-2-developer.md
6. pwa/BUGS.mdのFunction保存容量の項、pwa/design_log/sessions_2026-10.mdの同項

現在地:
- 依頼は「vercelのfn storageがオーバーしてる原因を特定して対策してほしい」。原因調査と対策の本番反映は済み、使用量低下は未確認。
- チーム10.1GB/10GB、amd-os-pwa10.09GB、他の主な使用はokudoor-preview10.88MB。Origin/Blobと混同しない。
- ac3866c9で文書APIの動的ディレクトリ解決を静的分岐にし、不要資料・計算pilot成果物・PDFを作らない月報routeのChromium/font同梱を抑制。実traceの重複除去後で文書API168.70→24.13MB、モデル66.61→34.55MB、月報履歴/つくよみ編集74.2→2.01MB。traceの合計はVercelの保存量そのものではない。
- postbuildのscripts/check_function_bundle_storage.mjsで容量上限と必要文書・日本語font・Chromiumの存在を検査。build、日本語PDF、書斎、モデル数式、認証を確認済み。資料室contractの既存正規表現検査は今回と無関係に失敗する。
- amd-os-pwaだけpreview/production/canceled/errored保存期間を全て1日へ変更・APIで読戻し済み。deploymentsToKeep:10も返る。公式の保持例外は現行aliasと直近正常版など。保持件数を3だけと断定しない。
- 本番は2026-10-06の最終確認でv3.159.19、b6138915、dirty:false。この版はac3866c9を含む。mainのdb51c543は検証記録だけ後続し、その重複ビルドは取り消し済み。固定SHAへ巻き戻さない。
- 実装・仕様・manual・検証記録はmainにpush済み。一時cloneは削除済み。新branch/worktreeは作っていない。
- 共有checkoutでは「PJポートフォリオの表示を高速化」（01a10f1c-985a-7ae3-912b-7817a8adedac）が3スペース高速化を実装中。変更パスと所有者は専用HANDOFF。別担当の差分はcommit/reset/stash/deleteしない。
- 未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは以前からの別作業資料。所有はタスクpt移行担当/まさ、内容不変Git保存の判断待ち。勝手に削除・今回commitしない。従来のKUTE引き継ぎはSESSION_MIGRATION_PROMPT_KUTE_20261006.mdへ内容不変で保存。

次の具体的な作業:
1. fetch/statusと/api/build-infoを確認。Chromeの https://vercel.com/armada0130/~/usage/deployments-functions?view=Projects で同じFunctions Storageの最新値を読み、現在値と期間を記録する。
2. 1日保存の期限と整理処理を経ても上限超過が続く場合は、保持中deploymentの状態・alias・保持例外と設定を再確認。新規版の軽量化、旧版の整理、請求履歴を別々に判定する。低下を実測してから解消済みと報告する。
3. 手動の旧deployment削除が必要なら稼働aliasと復旧候補を保ち、対象IDと影響を確定してまさに判断を求める。完全消去・有料プラン移行・権限変更・通知・自動監視は今回依頼に含まれない。

運用:
- cwdはモノレポルート、main一本。修正が必要な場合はmanual/specを同期し、AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.shで一括pushと本番SHA確認。直接Vercel deployをしない。
- docsだけはcommit件名に[skip ci]を付ける。並行作業をmergeする場合も最終件名に保持し、検証記録だけで重複ビルドを発生させない。
- Supabase、GAS、ネイティブ、モデル本文は今回変更なし。既適用migrationの再適用、新しいモデル前提の追加をしない。
