# SU_KNOWLEDGE_PROMOTION_LOOP — SU経営知識を複数入口から育てるループの設計

> amd-os の根幹候補。会話セッション、つくよみ、それから自動cron抽出（議事録/Slack）が、別の入口で得た「SU の経営判断・拡張機会・新規論点」を、各 SU の正本md (`knowledge/{su}.md`) に合流させる仕組み。
>
> Personal OS Loop (`/Users/masa/projects/kagami/PERSONAL_OS_LOOP.md`) の構造を SU 知識領域に拡張した姉妹設計。
>
> **このファイルは設計案。 2026-05-23 着想 / 未実装。実装する時はこのmdを正本として更新する。**
>
> セッションのきっかけ: 2026-05-22 FCとのMTGで国家戦略レベルの拡張機会が4方面噴き出した。Notion議事録 / つくよみ週次レポート / Slack には流れたが、`knowledge/sx.md` (= SU経営判断の正本) には自動では流れず、えいみが手動追記しないと次セッションのClaude/Codexから消える、という脆弱性に気づいたのが発端。

---

## 1. 違和感の正体（なぜ作るか）

```
[現状]
  Notion議事録更新 ──┐
  Slack更新       ──┤──→ つくよみ週次レポート (Slack #pXX_xx)
  Calendar event  ──┘     project_meeting_summaries (Supabase)
                                │
                                │ ❌ 自動同期されない
                                ▼
                       knowledge/{su}.md (正本md)
                                ▲
                                │ えいみ手動追記のみ (脆い)
                                │
                       えいみ会話 (セッション内)
```

- 議事録レベル (project_meeting_summaries) と 正本md (knowledge/{su}.md) の間に、**経営判断レイヤーの橋がない**
- えいみが起動された会話セッションでしか正本mdが育たない
- 「これ重い判断材料なのに、手作業頼みは脆い」(まさ 2026-05-23)

---

## 2. ループ全体図 (設計案)

```
            ┌──── B: えいみが本質的判断材料を能動的にmdへ追記 ────┐
            │   (AGENTS.common.md「AMD内部情報の追記ルール」)      │
            │                                                      │
   えいみの会話・コード作業                                        │
            │                                                      │
            ▼                                                      │
   knowledge/{su}.md (sx.md/cx.md/tiem.md/...) ◀───────────────────┤
            │                                                      │
            │ A: PostToolUse hook 自動同期 (新規)                  │
            ▼                                                      │
    ┌─ Supabase su_knowledge ───────────────────────────────────┐ │
    │                                                            │ │
    │ pull               D: amd-os cockpit / monthly_report etc │ │
    ▼                                  ▼                         │ │
 amd-os PWA Cockpit         つくよみ週次レポートが参照          │ │
       │                              │                         │ │
       ▼                              ▼                         │ │
  SU正本セクション (チームが見る)   毎週土曜の判断材料           │ │
                                      ▲                         │ │
                                      │                         │ │
                  Notion議事録 / Slack / project_meeting_summaries │
                                      │                         │ │
                                      ▼ extractSuKnowledge cron │ │
                            su_knowledge_extracts (断片)        │ │
                                      │                         │ │
                                      │ C-1: PWA admin で       │ │
                                      │ まさが「これ sx.md へ」と昇格選択
                                      ▼                         │ │
                            su_knowledge_promotions テーブル     │ │
                                      │                         │ │
                                      │ C-2: えいみが起動時に検知 │ │
                                      │ (SessionStart hook)     │ │
                                      ▼                         │ │
                              えいみが md に追記 (B経由)────────┘
```

---

## 3. 5つのパーツ

| ID | やること | 場所 | トリガ |
|---|---|---|---|
| **A** | knowledge/{su}.md 編集後に Supabase へ自動同期 | `~/.claude/settings.json` PostToolUse hook + `amd-os/scripts/sync_su_knowledge.sh` (新規) | Edit/Write が `knowledge/{su}.md` を変更したとき (Personal OS Loop の A と同列、対象ファイルを SU 一覧に拡張) |
| **B** | えいみが本質的判断材料を正本mdに能動的に追記する | `AGENTS.common.md`「AMD内部情報の追記ルール」(既に存在) | えいみの判断 (3軸2つ以上) |
| **C-1** | 議事録/Slackから抽出した経営判断/拡張機会/論点を、まさがPWA admin/cockpit で「これ sx.md へ」と承認 | amd-os PWA 新ページ `/admin/su-knowledge-promotions` または 各PJコックピット内タブ | まさの承認操作 |
| **C-2** | 承認されたものを えいみが md に追記 | SessionStart hook で pending を表示 + `/promote-su-knowledge` スキル (新規) | セッション開始 |
| **D** | amd-os PWA の cockpit / monthly_report / つくよみ週次レポート等が `su_knowledge` を読んで参照 | PWA 各画面・つくよみ system prompt | 各機能の表示・生成時 |

---

## 4. なぜ KAGAMI ではなく amd-os か（重要）

- **KAGAMI はまさ個人の Personal OS ツール**。SOUL/MEMORY/DREAMS/HABIT は本質的にまさ1人のもの
- **SU 知識は AMD チーム全員が利用する経営アセット**。チーム共有が前提
- まさは「kagamiアプリは個人ログだから、AMDの話を持ってくるのは変。OSでやろう」と明言 (2026-05-23)
- データ・UI・運用ガバナンスすべて amd-os 配下に置く

承認UIはどちらも「まさ」が承認者だが:
- Personal OS Loop の C-1 → KAGAMI iOS Settings 画面
- SU Knowledge Loop の C-1 → amd-os PWA admin/cockpit

---

## 5. データモデル (新規)

```sql
-- 議事録 / Slack 等から抽出した経営判断/拡張機会/論点の断片
CREATE TABLE su_knowledge_extracts (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL,            -- p21, p20, etc
  category        TEXT NOT NULL,            -- 'decision' / 'opportunity' / 'risk' / 'milestone' / 'partner' / 'tech_finding'
  proposed_text   TEXT NOT NULL,            -- md に追記する文面案 (LLM生成)
  source_kind     TEXT NOT NULL,            -- 'meeting_summary' / 'slack' / 'monthly_report' / 'manual'
  source_ref      JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {meeting_id, slack_ts, channel_id, etc}
  reason          TEXT,                     -- なぜ昇格に値するか (LLM判断)
  confidence      REAL,                     -- 0.0-1.0
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- まさが承認した昇格候補 (md に追記される直前)
CREATE TABLE su_knowledge_promotions (
  id              TEXT PRIMARY KEY,
  extract_id      TEXT REFERENCES su_knowledge_extracts(id),
  project_id      TEXT NOT NULL,
  target_md       TEXT NOT NULL,            -- 'knowledge/sx.md' など
  target_section  TEXT,                     -- 例: '## 意思決定ログ' / '## 課題・論点' / '## 外部関係者'
  approved_text   TEXT NOT NULL,            -- まさが承認した最終文面 (編集可)
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending / applied / rejected
  approved_at     TIMESTAMPTZ,
  applied_at      TIMESTAMPTZ,
  applied_by      TEXT,                     -- 'eimi-claude' / 'eimi-codex'
  rejected_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 各 SU 正本mdの Supabase ミラー (Personal OS の personal_os に相当)
CREATE TABLE su_knowledge (
  project_id      TEXT PRIMARY KEY,         -- p21, p20, etc
  md_path         TEXT NOT NULL,            -- '/Users/masa/projects/knowledge/sx.md'
  content_md      TEXT NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      TEXT                      -- 'eimi-claude' / 'eimi-codex' / 'masa-manual'
);

CREATE TABLE su_knowledge_changelog (
  id              BIGSERIAL PRIMARY KEY,
  project_id      TEXT NOT NULL,
  date            DATE NOT NULL,
  what_changed    TEXT NOT NULL,
  why             TEXT,
  changed_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 6. 抽出 cron 設計 (C-1 の input 側)

```
[既存: project_meeting_summaries / Slack / monthly_reports]
        │
        ▼
[新規: extractSuKnowledgeCron (毎時 or 毎日)]
  - 直近24-48hの新規 / 更新分を pickup
  - LLM (Claude Sonnet) で「これは knowledge/{su}.md 級の経営判断/拡張機会/論点か」を判定
  - 該当するものを su_knowledge_extracts に upsert (重複は source_ref + project_id + proposed_text の hash で検知)
        │
        ▼
[PWA admin/cockpit に「未承認 N件」バッジ表示]
        │
        ▼ まさが承認操作
[su_knowledge_promotions に row insert (status=pending)]
```

判定基準 (LLMに渡すルール):
- 3軸2つ以上当てはまるか (再利用性 / 非自明性 / 判断影響度)
- 単発の出来事・愚痴・既知情報のオウム返しは除外
- 「これ次回別セッションで参照する価値があるか」
- AGENTS.common.md「AMD内部情報の追記ルール」と完全に同じ基準

---

## 7. 安全装置 (Personal OS Loop と共通の原則)

- **C-1 の昇格対象は project_id 必須**。SU が紐付かない断片は昇格しない
- **C-2 のえいみ追記は必ず差分プレビュー**。Edit ツールで old_string → new_string をまさに見せてから書く
- **A の hook 失敗はサイレントにしない**。stderr にログを残す
- **D の参照は読み取りのみ**。`knowledge/{su}.md` を Supabase 経由で書き換えない (書き込みは A → B/C-2 経由のみ)
- **まさが否定したものは applied しない**。su_knowledge_promotions.rejected_reason に記録

---

## 8. 実装段階 (段階的に作る)

### Phase 1: Supabase 構造 + 手動 promotion
1. migration 追加 (上記4テーブル)
2. `su_knowledge` テーブルに既存 knowledge/{su}.md を全件 seed (one-time script)
3. `su_knowledge_promotions` への手動 insert で C-2 経由の動作確認

### Phase 2: A (自動同期) + えいみ運用
1. `~/.claude/settings.json` PostToolUse hook を `knowledge/*.md` 全体に拡張 (現状は SOUL/MEMORY/DREAMS/HABIT のみ)
2. `amd-os/scripts/sync_su_knowledge.sh` 作成 (kagami/scripts/sync_personal_os.sh を参考)
3. えいみが knowledge/{su}.md 編集 → 自動で su_knowledge upsert

### Phase 3: C-1 抽出 cron (低 confidence でまず流す)
1. `pwa/src/app/api/cron/extract-su-knowledge/route.ts` 新規
2. 直近24h の project_meeting_summaries / Slack を見て、LLMで判定
3. su_knowledge_extracts に upsert
4. PWA admin/cockpit に「未承認 N件」表示 (UIだけ、承認操作はまだなし)

### Phase 4: C-1 承認 UI
1. `pwa/src/app/(app)/admin/su-knowledge-promotions/page.tsx` 新規
2. extracts 一覧 → まさが「approve / reject / edit text」操作
3. approve で su_knowledge_promotions に row 作成

### Phase 5: C-2 えいみ側
1. `~/.claude/commands/promote-su-knowledge.md` 新規 (kagami/scripts/promote-personal-os 相当)
2. SessionStart hook で pending を「えいみ起動時に表示」
3. えいみが diff 表示 → まさ確認 → md追記 → su_knowledge_promotions.status='applied'

### Phase 6: D 参照経路
1. PWA Cockpit の各 SU タブに「正本 md ハイライト」表示
2. つくよみ週次レポート生成時に su_knowledge を system prompt に注入
3. monthly_report 生成時の根拠データとして利用

---

## 9. 関連ファイル

- 設計の元: `/Users/masa/projects/kagami/PERSONAL_OS_LOOP.md` (姉妹設計、Personal OS の C-2)
- えいみ運用ルール: `/Users/masa/projects/AGENTS.common.md`「AMD内部情報の追記ルール」セクション
- SU 正本md一覧: `/Users/masa/projects/knowledge/su.md` (目次) + `knowledge/{su}.md` (各SU)
- 既存 MTGサマリ設計: `pwa/design/meeting_summaries.md`
- 既存 L2 中核データ: `pwa/design/L2_DATA.md`

---

## 10. 着想ログ

| 日付 | 何が起きた | 着想 / 学び |
|---|---|---|
| 2026-05-23 | 2026-05-22 FCとのMTGで国家戦略レベルの拡張機会4方面が浮上。Notion議事録・つくよみ週次レポート・Slackには流れたが knowledge/sx.md には自動同期されず、えいみが手動追記しないと次セッションで消える脆弱性が顕在化。まさが「OS の根幹機能なんだから OS でやろう」と判断。Personal OS Loop の C-2 を SU 知識領域に拡張する設計として整理。 | KAGAMI ではなく amd-os 配下に作る (個人OS vs チームOS の境界線)。承認者は両方とも まさ。 |

---

## 11. 次セッションへの引き継ぎ

- このmdを正本として、まずは Phase 1 (migration) から着手
- 既存 Personal OS Loop の実装パターンを参照 (`kagami/scripts/sync_personal_os.sh` / `kagami/scripts/promote-personal-os` / `~/.claude/settings.json` PostToolUse hook)
- AGENTS.common.md の「AMD内部情報の追記ルール」と整合性を保つこと (B の運用ルールは既に存在、抽出/承認は C-1/C-2 で自動化)
