# HANDOFF — AMD OS PWA

次セッションが文脈を聞き直さずに再開できる **直近の引き継ぎだけ** をここに書く。

- ⭐⭐⭐ **AMD OS 中核データ正本** → [`design/L2_DATA.md`](design/L2_DATA.md) (L2 6 種 + cron + 動作状況 + Phase 4 構想)
- 仕様 → [`design/SPEC_pwa.md`](design/SPEC_pwa.md) (設計フォルダ全体の入口は [`design/README.md`](design/README.md))
- バグ・教訓 (症状/原因/解決策/教訓) → [`BUGS.md`](BUGS.md)
- 過去セッションの作業ログ → [`design_log/sessions_YYYY-MM.md`](design_log/)
- 共通運用ルール → リポ root の `CLAUDE.md`、PWA 確認方針 → [`AGENTS.md`](AGENTS.md)

---

## 最終更新

2026-05-09 (quirky-moore-b60501 セッション) — **Phase 4 全 4 L2 (③ MS進捗 + ⑤ メンバーナレッジ + ④ PJナレッジ + ② AMDプロトコル) 一括完了**。

**Phase 4 ③ MS進捗** (差分検知パターンの先行実装):
- 旧 `cron/daily-estimate` (03:00 daily) → 新 `cron/hourly-estimate` (PWA route)
- `progress_estimate_state` テーブル新設 (migration 029) で source_hash 差分検知
- ⚠️ Vercel Hobby plan の "daily 1 回まで" cron 制約で vercel.json には載せられない → 本体GAS `nav_pwa_pingHourlyEstimate` ([gas/154_PwaCronCaller.js](../gas/154_PwaCronCaller.js)) から毎時 curl で叩く構成 (Pro 移行後は vercel.json に戻すだけ)
- 仕様正本: [`design/ms_progress.md`](design/ms_progress.md)

**Phase 4 ⑤ メンバーナレッジ + ④ PJナレッジ + ② AMDプロトコル** (1 ファイルに 3 extractor):
- `gas/155_L2KnowledgeExtractor.js` 新規 (3 extractor + setup 関数)
- `l2_extract_state` 統合テーブル (migration 030, PK=(l2_kind, target_id, scope_key)) で 3 L2 共通の差分検知
- 入力は **既存 L2 を二次集約** する初版設計 (Phase 4.x で 5 生データ直結に改善予定):
  - ⑤ member: `member_activities` (90日) + 関連 PJ の `project_meeting_summaries` (60日)
  - ④ project: 当月 `monthly_reports.final_content/draft_content` + 当月 `project_meeting_summaries`
  - ② protocol: 当月/前月 `project_meeting_summaries.decided/risks/next_actions` から経営判断 1-3 件抽出
- LLM = Gemini Flash (既存 `llm_callJson` 流用)
- ② AMDプロトコル の `protocol_id = "p4-{projectId}-{ym}-{sha8(title)}"` で同月同タイトル再抽出時に同 ID で update。`status='candidate'` で入る → PM が UI で confirmed 昇格運用
- ④ PJナレッジ は既存 2024 行を破壊しないよう UNIQUE 制約は追加せず、`(project_id, category, entity_name)` SELECT → 既存有り PATCH / 無し INSERT で重複回避
- 仕様正本: [`design/member_knowledge.md`](design/member_knowledge.md) / [`design/project_knowledge.md`](design/project_knowledge.md) / [`design/amd_protocol.md`](design/amd_protocol.md)

**Phase 4 全 4 L2 (③⑤④②) を Swift APNs 通知に接続** (= まさが事前に決めてた標準パターン):
- 新規 `l2_notifications` テーブル (migration 031, ⑥ `meeting_notifications` の姉妹)
- UNIQUE(l2_kind, target_id, scope_key) で同抽出を 1 行集約、`saved_count`/title/summary 変化で trigger が `notified_at=NULL` に戻して再通知
- GAS 155 の 3 extractor + PWA progress-estimator.ts 末尾から `saved>0` のとき upsert
- ✅ **iOS Swift 受信実装も同セッションで完了**: AMDOSApp.swift に `NotificationService` (`@MainActor` `ObservableObject`) + Models 集約。起動時 + scenePhase==.active 復帰時に両テーブル fetch → ローカル通知 → notified_at マーク。masaiPhone (iPhone 16 Pro) install + launch 成功確認済。仕様: [`ios/HANDOFF_l2_notifications.md`](../ios/HANDOFF_l2_notifications.md) / [`ios/HANDOFF_meeting_notifications.md`](../ios/HANDOFF_meeting_notifications.md)
- 通知タップ時の画面遷移は当面 print のみ → 後続 ios セッションで l2_kind 別 navigation 実装

詳細: [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) 末尾エントリ

---

## 1 つ前のセッション

2026-05-09 (brave-cohen-15d352 セッション) — **MTGサマリ Phase 2 + Phase 3 完了 + Phase 4 方針確定**。

**Phase 2 (前段)**: 1 MTG = 1 calendar event 主軸 / Notion 本文 + Gmail (`reportEmails` ±1日) 結合 / Gemini Flash 抽出 / 議事録なしマーカー / migration 027。動作確認 OK (p21 SX で `notion+gmail` 2 件 / `notion` 5 件 等)。

**Phase 3 (本セッションの本丸)**:
- **毎時 0 分 cron** ([gas/153_MeetingHourlyTrigger.js](../gas/153_MeetingHourlyTrigger.js) `nav_meeting_pollRecentlyEndedEvents`) で「過去 60-180 分に終わった PJ 関連 events」を polling
- 各 event を [074 `nav_meeting_processOneEvent_`](../gas/074_MeetingSummaryRepo.js) で抽出 → 拾えれば [migration 028](scripts/migrations/028_meeting_notifications.sql) `meeting_notifications` に upsert
- iOS Swift が polling/realtime sub で受けて APNs 通知 → [`ios/HANDOFF_meeting_notifications.md`](../ios/HANDOFF_meeting_notifications.md) へハンドオフ済 (実装は別セッション)
- 03:00 daily cron は **Phase 2 月単位 fallback** だけに簡素化
- UI: `source_kinds='none'` を「議事録なし」、それ以外で内容空を「議事録あり・抽出空」と区別表示
- ⚠️ 設計判断: 当初 ad-hoc trigger を試したが GAS time-trigger 上限で破綻 → polling 方式に切替 (BUGS.md 参照)

**Phase 4 方針 (まさ確定、次セッション着手)**:
- Phase 3 のパターン (毎時 polling + source_hash 差分検知) を **L2 全データ 6 種に横展開**
- 優先順: ③ MS進捗 → ⑤ メンバーナレッジ + ④ PJナレッジ → ② AMDプロトコル
- spawn task の chip 経由で次セッションに送信済 (詳細は [L2_DATA.md](design/L2_DATA.md) の Phase 4 セクション)

詳細は [`design_log/sessions_2026-05.md`](design_log/sessions_2026-05.md) の末尾エントリ。

---

## リポ状態

- 作業 worktree: `/Users/masa/projects/AMD/amd-os/.claude/worktrees/brave-cohen-15d352`
- 作業 branch: `claude/brave-cohen-15d352`
- main HEAD: **`e200e2c`** (Phase 4 方針 md commit まで反映済)
- 適用済 migrations: …024 / 025 / 026 (seeds_data_round2、別セッション) / **027 (pms phase2)** / **028 (meeting_notifications)**
- GAS Web App deployment: `AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G` → **v1430** (`v1430_phase3_hourly_polling`)
- 設置済 trigger: `nav_meeting_pollRecentlyEndedEvents` 毎時 0 分 1 個 (本番で次の正時に発火)
- PWA Vercel deploy: ✅ 完了 5分51秒 / 本番 URL `amd-os-pwa.vercel.app` 反映済

---

## L2 データ動作状況サマリ (詳細は [`design/L2_DATA.md`](design/L2_DATA.md))

| L2 | 状態 |
|---|---|
| ① monthly report | ✅ R313 (AMD-Report GAS, 05:00) — 集計性が強いので Phase 4 では別扱い (Phase 2.5 = MTGサマリ集約に書き換え予定) |
| ② **AMDプロトコル** | ✅ **Phase 4 完了** GAS 155 `nav_protocol_pollAll` 毎時 + 二次集約 ([amd_protocol.md](design/amd_protocol.md))。UI 既存 |
| ③ MS進捗 | ✅ **Phase 4 完了** GAS → PWA `cron/hourly-estimate` 毎時 + 差分検知 ([ms_progress.md](design/ms_progress.md)) |
| ④ PJナレッジ | ✅ **Phase 4 完了** GAS 155 `nav_project_knowledge_pollAll` 毎時 + 二次集約 + 既存 2024 行を破壊しない ([project_knowledge.md](design/project_knowledge.md)) |
| ⑤ **メンバーナレッジ** | ✅ **Phase 4 完了** GAS 155 `nav_member_knowledge_pollAll` 毎時 + 二次集約 ([member_knowledge.md](design/member_knowledge.md)) |
| ⑥ MTGサマリ | ✅ **Phase 3 稼働** (毎時 polling、Notion + Gmail 結合) |

---

## 残タスク (次セッションで対応)

### 高優先

1. **Phase 4 全 L2 完了** (本セッションで一括完了):
   - ③ MS進捗 ✅ ([ms_progress.md](design/ms_progress.md))
   - ⑤ メンバーナレッジ ✅ ([member_knowledge.md](design/member_knowledge.md))
   - ④ PJナレッジ ✅ ([project_knowledge.md](design/project_knowledge.md))
   - ② AMDプロトコル ✅ ([amd_protocol.md](design/amd_protocol.md))
   - **次の改善 (Phase 4.x)**: 二次集約 → 5 生データ直結への深化 (Slack 個人 DM / Notion 経営戦略 page から直接抽出)、AMDプロトコル UI に「candidate → confirmed 昇格」ボタン追加
2. **iOS Swift 側の APNs 受信実装** ← 別セッション、ios/ worktree で ([`ios/HANDOFF_meeting_notifications.md`](../ios/HANDOFF_meeting_notifications.md))

### 並行 / 既存

3. **MTGサマリ Phase 2.5: AMD-Report GAS R313 を会議サマリ集約方式に書き換え** (別 clasp、別セッション)
4. **MTGサマリ Phase 2.1: pickup ウィンドウ ±1日 → ±3〜±7日 拡大検討** (任意、議事録メールが遅れて届く運用なら効く)
5. **CX (p20) / CTB (p06) / SE (p10) / p11 で次期 MS 期間 (2026 Q2 〜) を設定**
6. **過去 monthly_reports (4月分等) の復元** — restore script 未実装
7. **5月分の monthly_reports 自動生成** (no report content) — cron 検討
8. `saveProjectMembers` 全削除→挿入をやめて incremental update に (将来事故防止)
9. 本体GAS `cron_invoiceSendNudge_` が 4 重複 → 整理 (GAS time-trigger 枠浪費)

---

## 次セッションの最初の一手

1. リポ状態 4 ステップ (`git fetch --all --prune` → `git log --branches --not --remotes --oneline` → `git branch -a` → `git status -s`)
2. **`pwa/design/L2_DATA.md` を読む** ← Phase 4 仕様の正本
3. **`pwa/design/ms_progress.md` を読む** ← ③ MS進捗 Phase 4 完了仕様 (横展開のパターン元)
4. **`pwa/design/meeting_summaries.md` を読む** ← Phase 3 のパターン (横展開元)
5. **`gas/153_MeetingHourlyTrigger.js` を読む** ← Phase 3 参考実装
6. **`BUGS.md` 最新 3 件を読む** (worktree 取り違え / GAS trigger 上限 / Web App Session)
7. Phase 4 残り (⑤ メンバーナレッジ → ④ PJナレッジ → ② AMDプロトコル) 着手

---

## 運用コマンド (継続)

- **本番 deploy + 通知**: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`
- **DDL 適用** (worktree からだと .env.local が無いので main worktree 経由):
  ```sh
  cd /Users/masa/projects/AMD/amd-os/pwa
  python3 -X utf8 scripts/apply_ddl.py /path/to/worktree/pwa/scripts/migrations/NNN_name.sql
  ```
- **GAS Web App 経由で関数実行**:
  ```sh
  URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_WEBAPP_URL=//' | tr -d '"')
  KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^NEXT_PUBLIC_GAS_API_KEY=//' | tr -d '"')
  curl -sL "$URL?mode=pwaApi&key=$KEY&action=listProps"        # ScriptProperties 一覧
  curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_meeting_listAllProjectTriggers"  # trigger 一覧
  ARGS=$(node -e 'console.log(encodeURIComponent(JSON.stringify(["arg1","arg2"])))')
  curl -sL --max-time 360 "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=FUNCTION_NAME&args=$ARGS"
  ```
- **GAS push + deploy update**:
  ```sh
  cd /Users/masa/projects/AMD/amd-os/.claude/worktrees/<worktree>/gas
  npx --yes @google/clasp@latest push --force
  npx --yes @google/clasp@latest deploy --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G --description "v<n>_<desc>"
  ```
