# SOL資金計画 2026-09-30

現在仕様: `spec/3-8-cockpit-current-spec.md`「SOLの資金計画」。利用手順: `manual/2-3-pj-cockpit.md`末尾。

- 共有DB: `project_monthly_cashflow.planning_details_json` はnullableで追加済み。既存PL/CF数値列・確定調達履歴は変更なし。他プラットフォームは従来列を読めるが、新しい15か月支払予算/4ケースの表示はPWAで実装。
- 旧クライアントの長期PL/CFは参考計画。移植時は現在予算と混在させず、本PWAの `project-funding-plan.ts` と同じ月・ケース整合検証を行う。
- active資本政策はシードJ-KISS・シリーズA時期を改定。A割当未定は提出版freeze不可。新規資本政策の初期原案も同期。
- 保留: シリーズA必要調達額/評価額、4レーンへの費用配賦、長期PL/工場投資との接続、STS対象経費の認定、借入条件、ブリッジ25％目標の条件設計。
- BZMモデル/スコア/正史は変更なし。通知・外部連絡なし。

| 同期対象 | 状態 |
| --- | --- |
| manual 2-3 / 9-3 | 更新 |
| spec 3-8 / 6-1 | 更新 |
| design cockpit | 正本参照を追加 |
| bzm / model | 数式変更なし・対象外 |
| iOS/macOS/Android | DB追加はnullable、表示移植は未実施 |
