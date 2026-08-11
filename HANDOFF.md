# AMD OS Handoff

最終更新: 2026-08-11 JST

対象: つくよみ外部リサーチの重複防止、OS通知レビュー、PJコックピット蓄積

作業種別: 開発・自動化運用・本番反映

## 今回の到達点

- 平日09:00の外部リサーチはSlackへ送らず、AMD OSの通常通知へ1件ずつ出す。
- 同じURLと同じ出来事は、未判断・採用・見送り・保管済みの全履歴と未反映outboxで重複排除する。
- 通知の`採用`で確認済みになった候補だけを、該当PJコックピットの`経営ハイライト → 採用リサーチ`へ残す。
- 未判断候補と見送りはコックピットへ出さず、従来の内部情報は`重要な動き`として別棚に維持する。
- 人が見る運用正本は、AMD OSマニュアル3-3章へ集約した。ローカルの実行SKILLはautomation向け実装手順であり、日常運用の入口にしない。

## 正本と現在地

- 人向け運用正本: `pwa/manual/3-3-notifications-and-tsukuyomi.md` の「つくよみ外部リサーチ」。
- 確定仕様: `pwa/spec/3-6-strategy-signals-current-spec.md`、`3-7-notifications-current-spec.md`、`3-8-cockpit-current-spec.md`。
- 設計正本: `pwa/design/project_strategy_signals.md`、`pwa/design/notifications.md`、`pwa/design/L2_DATA.md`。
- 実装commit: `d6686547`。マニュアル正本化commit: `f8b32f16`。
- 外部リサーチ機能とマニュアル表示はbuild `v3.71.1` / `f8b32f16`で確認済み。その後の別作業を取り込み、closeout文書はbuild `v3.71.3` / `41151f12`をbaseにしている。closeout文書commit後のlive SHAは、次セッション開始時に`/api/build-info`で`origin/main`と照合する。
- Codex automation `automation-2`「つくよみ 外部リサーチ候補」はACTIVE。平日09:00 JST、失敗時だけ通知する。
- 実行repo `/Users/masa/projects/AMD/amd-os-automation-runtime` はmainへ同期済み。既存の未追跡probe 1件は別運用のため触っていない。
- 旧GASのSlack外部リサーチ入口はearly returnへ変更し、`clasp push`とremote code readbackまで完了している。

## 検証済み

- `npm run test:external-research`
- `npm run test:critical-ui`
- 対象ファイルのESLint
- 環境設定を読み込んだ`npm run build`。550ページ生成とTypeScript成功。
- production `/api/build-info`で`v3.71.1`とfeature SHAを確認。
- ログイン済み本番マニュアルで、実行時刻、対象7PJ、重複防止、採否、保存先、異常時の表を読み戻し。

## 未解決

- automation作成後の最初の自然な平日09:00実行は未観測。次回予定は2026-08-12 09:00 JST。
- 新規候補0件は正常で、通知もoutboxも作らない。0件を失敗扱いしない。

## 次セッションで最初にすること

2026-08-12 09:00 JST以降に、automationの実行結果をread-onlyで確認する。
成功または候補0件、Slack送信なし、新規候補がある場合だけOS通知が1候補1件で作られたことを確認する。
まさの明示判断なしに候補の`採用`または`見送り`を押さない。

## 参照先

- 次セッション用プロンプト: `SESSION_MIGRATION_PROMPT.md`
- 開発履歴: `pwa/design_log/sessions_2026-08.md`
- 再発防止: `pwa/BUGS.md`
- automation実行手順: `pwa/scheduled-tasks/amd-os-external-research/SKILL.md`
