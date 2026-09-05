# 自動処理の一覧（誰が見ても分かる題名で）

最終更新: 2026-09-05

> **この文書は何か**: AMD OS と、まさのMac、Google側で動いている自動処理を、
> 「いつ・何をする・どこで動く・止め方」で一覧にした正本。
> 2026-09-03〜04 の Vercel 転送量超過事故で、題名が記号だけ（`D-8` `W-1` `amd-os-2`）で
> 何のために作ったか誰にも分からなくなっていたことが分かった（まさ確定 2026-09-04
> 「すべてのオートメーションを、誰が見ても分かるタイトルにしてほしい」）。
> 新しい自動処理を作るときは、ここに1行足してから作る。題名の型は「いつ 何をする（旧記号）」。

## 1. Codex の自動処理（`~/.codex/automations/*/automation.toml`）

題名は `automation.toml` の `name` と一致させる。状態は 2026-09-04 02:00 時点。
0:31 に全32本が一時停止され、まさの指示で3本だけ再開した。

| 題名 | 状態 | 成果物の受け皿 | 備考 |
|---|---|---|---|
| 6時間ごと 社内データの差分をOSに取り込む（L2差分レビュー） | 再開 | Mac の届ける係（5分ごと）→ AMD OS | OSの本流。累計146件反映 |
| 毎日3:20 経営ハイライトを抽出する（D-6） | 再開 | 同上 | 累計46件反映 |
| 毎週水曜15:00 来週の会議準備スレッドを立ち上げる（W-Prep） | 再開 | Codex の可視スレッド | |
| 毎朝8:10 外の世界のニュースを集める（Atlas外部シグナル・D-8） | 停止 | 届ける係 → `/api/atlas/signals-ingest` | 7/9〜9/3 の62件は `amd-atlas/paused-20260904/` に退避。受け口は 2669e85a で作り直し済み。戻すかは別セッションで議論 |
| 毎朝8:25 メディア掲載・受賞の候補を集める（D-11） | 停止 | PWA route（DB直書き） | 9/3 まで毎日動作 |
| 毎日3:35 契約に関するシグナルを抽出する（D-13） | 停止 | PWA route | 同上 |
| 毎日3:50 要対応・ガバナンス候補を抽出する（D-14） | 停止 | PWA route | 同上 |
| 毎日4:05 教科書向けの実務知見を抽出する（D-7） | 停止 | outbox → 届ける係 | 同上 |
| 毎日4:20 マクロトレンド指数を監視する（D-9） | 停止 | 監視のみ（writer は PWA cron） | 同上 |
| 毎日18:30 メンバーの週次活動の根拠を抽出する（D-10） | 停止 | Supabase `member_activities` | 同上 |
| 10〜20時毎時 採否判断の候補をレビューする | 停止 | AMD OS 通知 | 同上 |
| 毎朝9:15 データ抽出の健康診断（読み取りのみ） | 停止 | 報告のみ | 見本データの検査で、実際の滞留を見ていない（要改修） |
| 毎週土曜9:00 VCニュース・資金調達シグナルを集める（W-1・受け皿なし） | 停止 | **無い** | 6/20〜8/29 の11件が `outbox/` `review-outbox/` に滞留 |
| 平日9:00 つくよみ向けの外部リサーチ候補を集める | 停止 | AMD OS 通知（review-first） | |
| 毎朝8:00 Googleアラートを選別して要点だけ拾う | 停止 | 報告 + Gmail ゴミ箱移動 | |
| 毎朝7:00 Personal OSへの日次追記案を作る | 停止 | えいみOSスイート「対話」 | |
| 毎朝6:15 えいみOSの連携ヘルスを確認する | 停止 | outbox → Mac の届ける係（5分ごと上書き） | |
| 毎朝9:00 レ・ジェイドつくば高層階の空室チェック（個人） | 停止 | 通知 | |
| 毎月27日10:00 freeeの月次会計締めを実行する | 停止 | freee 画面操作 | 実行記録なし |
| 毎月27日9:00 freeeの月次会計締め（旧版・automation-4と重複） | 停止 | — | 重複。どちらを残すかまさ判断 |
| 毎週木曜10:15 freee週次会計照合の結果を確認する | 停止 | 報告 | 実行記録なし |
| 毎月末23:00 経営数字の月末評価（予実・資金繰り） | 停止 | `company_management_signal_review` | 実行記録なし |
| 毎月末前日23:30 まさの月末前評価を作る | 停止 | orchestration-board | 8/31 動作 |
| 毎日5:30 月次報告の下書きを抽出する（M-1・停止中） | 停止 | — | 7/27 以降停止 |
| 毎週月曜7:30 マクロトレンドの根拠を見直す（緊急停止中） | 停止 | — | 5/25 以降停止 |
| （旧）MTGレビュアー・Macの仕組みへ移行済み（H-1） | 停止 | — | LaunchAgent へ移行済み |
| （旧）会議フロー処理・Macの仕組みへ移行済み（H-1） | 停止 | — | 同上 |
| （旧・停止）W-Prep 移行済み | 停止 | — | |
| （停止）司令塔の未完タスク停止防止monitor | 停止 | — | |
| （停止）L2 RED 自走復旧ループ | 停止 | — | |
| （停止）EHM OS Flutter 自走開発 worker ×2 | 停止 | — | 6/22 以降停止 |

止め方・再開: Codex Desktop の automation 一覧で一時停止/再開。`automation.toml` の `status` を直接書き換えても効くが、Codex 側の表示で確認する。

## 2. Vercel の定時処理（`pwa/vercel.json` の `crons`）

時刻は日本時間。`check_pwa_critical_ui.cjs` が「動かしてよい9本」を allowlist で固定している。
戻す・止めるときは vercel.json と allowlist を同じ commit で変える。

| 題名 | 経路 | 状態 |
|---|---|---|
| 毎朝9:10 freeeの支払同期 | `/api/cron/freee-payment-sync` | 稼働 |
| 毎朝9:12 メンバーへの実支払の取り込み | `/api/cron/freee-member-payout-sync` | 稼働 |
| 毎朝9:20 納付期限の確認 | `/api/cron/payment-obligations` | 稼働 |
| 毎朝9:30 支払確認の催促 | `/api/cron/payment-confirm-nudges` | 稼働 |
| 毎朝10:00 立替のリマインド | `/api/cron/reimbursement-reminders` | 稼働 |
| 毎日2:00 支払通知書の前準備 | `/api/cron/payout-notice-prebuild` | 稼働 |
| 毎日3:05 報酬の計算結果の更新 | `/api/cron/payout-reward-cache-refresh` | 稼働 |
| 毎月1日7:00 請求の自動確定 | `/api/cron/contract-billing-auto-confirm` | 稼働 |
| 毎週木曜10:00 週次の会計照合 | `/api/cron/freee-accounting-weekly` | 稼働 |
| 毎朝9:05 会社の運営事実を更新 | `/api/cron/company-operating-facts` | 停止中（9/4 0:34〜） |
| 毎朝9:35 会社スケジュールを更新 | `/api/cron/company-schedule` | 停止中 |
| 毎朝9:15 要対応候補を抽出 | `/api/cron/proactive-todo-extract` | 停止中 |
| 毎日2:30 MS進捗を更新 | `/api/cron/ms-schedule-progress` | 停止中 |
| 毎日4:00 PJ事実の同期 | `/api/cron/sync-pj-facts` | 停止中 |
| 毎日6:00 経営スコアの更新 | `/api/cron/management-score-refresh` | 停止中 |
| 毎月1日4:00 マクロ指標の月次集計 | `/api/cron/macro-aggregate-indicators` | 停止中 |
| 毎週火曜3:20 論文の四半期取り込み | `/api/cron/papers-quarterly-ingest` | 停止中 |

従量課金AIを使う定時処理17本は `pwa/vercel.disabled-crons.json` に退避済み（7/1 の封鎖）。
`ALLOW_PWA_LLM_CRONS=1` を置かない限り動かない。詳細は `L2_DATA.md`。

## 3. まさのMacで動く自動起動（`~/Library/LaunchAgents`）

| 題名 | 周期 | 実体 |
|---|---|---|
| 5分ごと Codexの成果物（L2差分・経営ハイライト・Atlas）をAMD OSへ届ける | 300秒 | `jp.teamarmada.amd-os-ms-outbox-applier` → `scripts/run-ms-outbox-applier.sh` |
| 5分ごと えいみOSの連携ヘルスを共有DBへ書く | 300秒 | `com.teamarmada.integration-health` |
| 5分ごと 古いCodexスレッドを片付ける | 300秒 | `jp.teamarmada.codex-h1-thread-watchdog` |
| 毎時15分 会議の背景処理（H-1）を回す | 毎時 | `jp.teamarmada.amd-os-h1-background` |
| 毎時45分 会議レビューの背景処理を回す | 毎時 | `jp.teamarmada.amd-os-h1-reviewer-background` |
| 毎朝6:20 週次戦略の根拠を走査する | 毎日 | `com.teamarmada.weekly-strategy-evidence-scan` |
| 毎週木曜6:30 週次戦略ループ | 週1 | `com.teamarmada.weekly-strategy-loop`（9/3 の回は共有DB側の503で失敗 → 9/5 に手動で拾い直し済み） |

状態（2026-09-05 15:50 更新）: 9/4 00:36 に7本すべて `launchctl disable` された。9/5 にまさの指示「PDCAを再開したい」で、
`com.teamarmada.weekly-strategy-evidence-scan` と `com.teamarmada.weekly-strategy-loop` の2本だけを再開した。
この2本は えいみOSスイート共有DB の週次テーブルへ書くだけで、箱（outbox）も届ける係も外部送信も持たない。
週次ループは一時的な503で丸ごと落ちないよう、有限のやり直し（最大3回・2/8/30秒待ち、4回目で停止）を入れた
（orchestration-board v2.9.99、`BUGS.md` 2026-09-05）。残り5本（届ける係3本・H-1 の2本）は停止のまま。

止め方: `launchctl bootout gui/$(id -u)/<label>` + `launchctl disable gui/$(id -u)/<label>`。届ける係は箱（outbox）が空なら何もしない。
再開: `launchctl enable gui/$(id -u)/<label>` → `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/<label>.plist` の順。
disabled のまま bootstrap すると `Input/output error` で失敗する（各 installer は bootstrap→enable の順なので、disabled 状態からは installer だけでは戻らない）。

## 4. Google側（Apps Script）

| 題名 | 場所 | 状態 |
|---|---|---|
| 毎日7:00 Slackのつくよみがメンバー知識を要約する（Anthropic従量） | Slackボットの GAS プロジェクト `gas-slack/S090` | トリガーの有無は GAS 画面の「トリガー」でしか確認できない。止めるならそこで削除 |
| 本体GASの従量AI定期処理（報酬推定・L2知識抽出・報酬スコア） | `gas/060`, `gas/155`, `gas/056` | コード内の停止スイッチが ON（2026-05-22） |

## 5. 事故で分かった原則

- 自動処理は「作った側」と「受け取る側」を必ず対にする。受け取る側が無い自動処理を作らない（W-1 の教訓）。
- 成果物の箱に24時間以上ものが残っていたら異常。健康診断はここを見る（未実装。次の改修対象）。
- 届ける係は、失敗1件でその回を止め、封鎖中は待つ（`atlas_signal_review_tool.mjs` の cooldown）。
