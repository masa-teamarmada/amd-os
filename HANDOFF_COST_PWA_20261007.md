## 2026-10-07 インストール済みPWAのコスト試算表示差・終了

- 実装: e2143fedf3bc8f690090180e5746bf8b1dceb76c / v3.160.27。正規deploy scriptが2分40秒で成功、本番build-infoの版とSHAを確認。
- 原因: 1280px以上だけ横並び・コンパクト表示だったため、Chromeインストール済みPWAの1234px表示で縦積み。再読み込みでも同じ形を確認。
- 共通変更: 1024pxで明細をコンパクト化、1100pxで2ペイン化。結果320px、1280pxで380px。3つのエンジンと3領域へ同じ部品で適用。数値・保存・認可・DB・計算式は変更なし。
- 検証: アプリ1172×898で606.9px/320pxの横並び、入力28px、横はみ出しなし。入力パネル自然高さ16508px（修正前1234px表示では28563px）。燃料も横並び・31920.0円/L。排水402.5円/m³を保持。ブラウザ1392×824で766.9px/380px、横はみ出しなし。390×800は入力44px/16px、横はみ出しなし。
- project-cost-model（廃液・燃料・汎用）、TypeScript、正規deployの必須検査が成功。表示レビュー8.5/10、重大な重なり・切れなし。
- 同期: manual/2-3・9-3、spec/3-8・6-1、ios/DESIGN。BZM/modelは変更なし。iOS/macOS/Androidの独立ネイティブ画面は未移植。今回のアプリはChromeインストール済みPWA。
- 他作業境界: regular checkoutの製品画像・DD本文密度・製品説明部品・会社情報・認証確認用previewの別作業は取り込まず保持。専用cloneから自分のcommitだけを本番反映。

### 最新の現在地

まさが受入れ、handoff/closeoutを依頼。今回は記録を整えるだけで製品の再反映はしない。開始時点の正規repoはmain eb3b939a・origin差0/0・dirty/競合0、本番は後続更新のv3.161.16 / 6191ad90。自分の修正e2143fedは現行mainに含まれ、1100pxの横並びも現行実装に保持。現行本番全画面の再検収はしていない。

- 未解決の今回タスク: なし。最初の次の行動: 新しい依頼が来たら、正規repo /Users/masa/projects/AMD/amd-osでgitと本番の最新状態を確認。
- 引き継ぎ・棚卸し: [終了記録](pwa/design_log/CLOSEOUT_SOL_DD_COST_20261007.md)、[移行文](SESSION_MIGRATION_PROMPT_COST_PWA_20261007.md)。症状・原因・対応・再発防止は[BUGS.md](BUGS.md)。開発履歴はpwa/design_log/sessions_2026-10.md。
- 計画内容の正本: /Users/masa/projects/AMD/SOL/LONG_TERM_PLAN.md、SOL_DD_CONTENTS_PLAN.md。初版から後続v0.5へ更新済み。コスト精査は別タスクのHANDOFF_COST_REVIEW_20261007.mdを読み、明示依頼まで自動再開しない。
- 使い捨てcloneはcleanを確認して復元可能なcleanup_archivesへ退避済み。旧work/261006_dd_development_issues/amd-osを作業開始先にしない。branch/worktree新規0、正規repoはmainのみ。
- 会話の検討材料: 0件。個人の傾向として保存する内容なし。
