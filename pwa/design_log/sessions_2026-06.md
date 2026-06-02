# Sessions 2026-06 — AMD OS PWA design log

過去セッションの作業ログ (append-only)。新規設計 md はここに作らない。

---

## 2026-06-02 — 通知の文字化け (mojibake) 調査・恒久 fix・DB 掃除

### きっかけ
まさが `/notifications` で OS台帳差分通知のスクショを共有。「?? ZMP: ??????」とタイトル・ヘッドライン・evidence snippet が `?` だらけ。「どうしてハテナがいっぱい出てるの?」

### 調査 (原因特定)
- 表示コンポーネント `pwa/src/components/notifications/NotificationsClient.tsx` を確認 → `i.data.title` / `i.data.summary` をそのまま表示。表示ロジックの化けではない。
- DB を直接 `repr()` で確認: `l2_notifications.title = '?? ZMP: ???'`。ASCII (`ZMP`, メールアドレス, `source_kind`) は無傷で **multibyte だけ `?`** → 書き込み時の lossy 変換確定。
- `created_by = codex-automation`、6/1 00:46 の同一 run で書かれた行に集中。
- automation `amd-os-ms` の prompt は「Gmail 等を直接検索して snippet 抽出 → outbox JSON」指示。**LLM が outbox を書く段で日本語を `?` に潰した**一過性の事故。同 run の strategy_signal 等は正常 = 恒常バグではない。
- applier `pwa/scripts/ms_progress_review_tool.mjs` の `requestJson` は `setEncoding("utf8")` 済みで無実、`writeJson` も無実。snapshot `os-latest.json` の化け 88 件は、化けた `l2_notifications` を export で読み戻した二次現象 (7343 件の日本語は無傷)。

### A. 恒久 fix (再発防止)
- `ms_progress_review_tool.mjs` に `assertNoMojibake(payload, file)` を追加。`?{3,}` を再帰 walk で検知し throw。
- `applyOutbox` 冒頭と `notify` 入口で呼ぶ。`applyOutboxDir` が throw を拾って outbox を `failed/` へ退避 → DB 非汚染、次回 run が再生成。
- 実データ (化けた行 / 正常 KUTE タイトル) でゲート動作をテスト済み。`node --check` syntax OK。

### B. DB 掃除
- 全テーブル横断スキャンで化け行を特定: `l2_notifications` 7 / `project_registry_diffs` 2 / `project_xrl_evidence` 1 / `ms_progress_revisions` 2。
- p21 `ms_progress_revisions` (af79cb2d…) は **まさ confirm 済み・revised_note の "kyoko????" は文字化け部分を指す意図的注記**と判明 → 除外。
- 残り 11 行を削除 (全て pending/candidate で未採否、生データ無事で再生成可能)。削除前バックアップを `pwa/scripts/_mojibake_cleanup_2026-06-02_backup.json` に保存。
- 削除後再スキャンで、化け残りは p21 の正規 1 件のみ (期待通り) を確認。

### 残課題・次の一手
- 削除した候補 (KUTE のPJメンバー候補 / ZMP の関係先メール候補 / SE の TRL根拠 / p25 のMS進捗) は **次回 Codex automation run (6h ごと) が生データから自動再生成する想定**。まさは「待っとく」判断。
- 次セッションで `/notifications` を見て、再生成された候補が正常な日本語で入っているか確認すると良い。もし入っていなければ手動で automation を走らせる。

### commit
- `99c4324 fix(automation): reject mojibake outbox before writing to DB + clean 11 garbled rows` (push 済み)
  - `pwa/scripts/ms_progress_review_tool.mjs` (ゲート追加)
  - `pwa/scripts/_mojibake_cleanup_2026-06-02_backup.json` (削除バックアップ)
- 詳細・教訓は `pwa/BUGS.md` の `[automation/mojibake] ... (2026-06-02)` 参照。
