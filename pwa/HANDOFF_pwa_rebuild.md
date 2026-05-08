# HANDOFF — AMD OS PWA

次セッションが文脈を聞き直さずに再開できる **直近の引き継ぎだけ** をここに書く。

- 仕様 → `design/SPEC_pwa.md` (設計フォルダ全体の入口は `design/README.md`)
- バグ・教訓 (症状/原因/解決策/教訓) → `BUGS.md`
- 過去セッションの作業ログ → `design_log/sessions_YYYY-MM.md`
- 共通運用ルール → リポ root の `CLAUDE.md`、PWA 確認方針 → `pwa/AGENTS.md`

---

## 最終更新

2026-05-08 (keen-wescoff セッション) — admin/projects の PL/PM/クローザー編集を **集合 incremental 更新** に再設計。「全削除→挿入」事故を根絶。1 列 → 3 列分割、編集ボタン廃止、セルクリックでロール別モーダル → 「修正」で FIX。テーブル `min-width: 1600px` に拡張。

[2026-05-08 (blissful-mcclintock セッション)] — 月次ルーティン × 各ステップ専用モーダル逆移植、設計 md 集約 (`pwa/design/`)、admin/projects 大改修 (セル単位編集 / PL/PM/クローザー / 凍結再開予定 / 支払期日 / 関係先メアド)、`member_activities` 連鎖 3 件修正で cron 復活、スプシから projects + project_members 復元、deploy.sh Ready 通知。

詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) の末尾エントリ参照。

---

## リポ状態

- 作業 worktree: `/Users/masa/projects/AMD/amd-os/.claude/worktrees/keen-wescoff-c6a97b`
- 作業 branch: `claude/keen-wescoff-c6a97b` (main にも順次 merge + push 済)
- main HEAD: `54f99c2` (2026-05-08 blissful-mcclintock の最終 merge)
- 本番デプロイ: `https://amd-os-pwa.vercel.app` 反映済
- 適用済 migrations: 018 / 019 / 020 / 021 / 022 / 023

---

## 残タスク (次セッションで対応)

### 高優先 — データの欠損を埋める
1. **CX (p20) / CTB (p06) / SE (p10) / p11 で次期 MS 期間 (2026 Q2 〜) を設定**
   - 現状 plan_cycle が 2026-03 で切れている。cockpit 開いた時に「⚠️ 今期の MS 期間 (2026/03) は終了しています」警告 + 次期 MS 設定バナーが表示される
   - 設定すれば cron が member_activities を自動で埋める
2. **過去 monthly_reports (4月分等) の復元**
   - スプシ `DB_MonthlyReports` (sheetId=1184379351) からの restore script は **未実装**
   - 既存の `/api/admin/restore-from-sheet` route と同じパターンで実装可能
   - 5月分はそもそもまだ生成されていない (`no report content`) → 別途生成 (PWA に generate ボタン or cron)

### 中優先 — UI / UX 確認
3. CX cockpit でスコアリングボードの PL/PM/クローザー / AMD 期間バッジが表示されているか **まさが目視確認** (hard reload 推奨)
4. admin/projects のセル単位編集が問題なく動くかまさが触って確認
5. ✅ ~~`saveProjectMembers` の「全削除→挿入」をやめて incremental update に~~ (2026-05-08 keen-wescoff セッションで完了。`AdminProjectMembersModal` / 旧 `/api/admin/project-members` POST / `saveProjectMembers` 関数は削除済。代わりに `/api/admin/project-members/role` ロール別 incremental API + `AdminProjectRoleEditModal`)

### 低優先 — 仕組み改善
6. invoice_to_emails (請求書送付先) の自動セット — スプシ `DB_Projects` に値が入っていない PJ が多い。現状は admin/projects で手入力する想定だが、復元戦略を検討
7. 5月分の monthly_reports 自動生成 cron の検討

---

## 次セッションの最初の一手

1. **`pwa/design/README.md` から読む**。設計の入口
2. その後 `pwa/design/SPEC_pwa.md` (全体仕様) → `pwa/design/cockpit.md` → `pwa/design/routine.md` (月次ルーティン正本仕様)
3. `BUGS.md` の最新 5 エントリ (member_activities 連鎖 3 件、supabase.functions.invoke、vercel ls、GAS bridge、RLS) を読む
4. リポ状態 4 ステップ (`git fetch --all --prune` → `git log --branches --not --remotes --oneline` → `git branch -a` → `git status -s`)
5. 上記「残タスク 1.」(CX 等で次期 MS 設定) から着手
   - もしくはまさが別件を優先するならその指示に従う

---

## 運用コマンド (このセッションで確立した正本)

- **本番 deploy + 通知**: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`
  - macOS Glass 音で Build Ready を通知。直接 `npx vercel` を叩かない
- **DDL 適用**: `python -X utf8 scripts/apply_ddl.py scripts/migrations/NNN_name.sql` (リポ pwa/ から)
- **cron 手動 trigger**: `curl -H "Authorization: Bearer $CRON_SECRET" "https://amd-os-pwa.vercel.app/api/cron/<name>?ym=YYYYMM"`
- **スプシから復元**: `curl -H "Authorization: Bearer $CRON_SECRET" "https://amd-os-pwa.vercel.app/api/admin/restore-from-sheet?spreadsheetId=..."`
