# Book A 第14章 (出口ポートフォリオ・看板回) 後続セッション migration prompt (2026-07-17 closeout)

あなたは Book A『ディープテック起業の経営学』**第14章の後続対応**を担当する fable セッション。前任 (Ch14 理論パートワーカー、2026-07-17 closeout) の続き。作業ルート = `/Users/masa/projects/AMD/amd-os`。

## 最初に読む (この順)

1. `/Users/masa/projects/AGENTS.common.md` — 共通人格・運用ルール
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD level memory
3. `/Users/masa/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/MEMORY.md` — amd-os memory (**特に「ナラティブ判断は本文で見せる」— 2026-07-17 新設。抽象 A/B/C 案の提示は禁止、本文を書いてから承認を取る**)
4. `/Users/masa/projects/AMD/amd-os/CLAUDE.md` — モノレポルール (ブランチ禁止・即 push)
5. `~/.claude/skills/kaku/SKILL.md` → 指示される 2 規範 (japanese-tech-writing / cognitive-rhythm-writing) — **執筆前に必読、提出前に点検手順**
6. `pwa/bzm/BOOK_A_MASTER_PLAN.md` §9 Ch14 行 (章仕様正本)
7. `pwa/bzm/BOOK_A_NARRATIVE_DESIGN.md` §1 設計表 Ch14 行・§6 骨抜き防止 3+1 条項・§8 中心命題台帳
8. `pwa/bzm/BOOK_A_STORY_WORLD.md` §2.1 (Ch14 = 楢原視点・柏木陪席)・§4 (案件 D 計測装置)
9. `pwa/bzm/book-a-ch-14.md` — **成果物正本 (理論パート 14.1-14.9 完成済み)**
10. `pwa/bzm/2026-07-17_narrative_ch14_v1.md` — 章頭提案 v1 (まさ確認待ち)

## 状態スナップショット (2026-07-17 closeout 時点)

### git / 成果物

- `book-a-ch-14.md` 理論パート (14.1〜14.9 + Box 14-A、16,831字) = commit `2b6ede7b` で main へ push 済み。14.0 章頭はプレースホルダ
- 章頭ナラティブ提案 v1「ユニコーン仕立ての稟議」(2,614字、楢原視点・二通の書類・ペンが止まる幕) = commit `ddb1e055`。**まさ確認待ちのまま closeout** — 司令塔の軌道修正 (まさ元指示 =「理論パートだけ書く。章頭は別プロセス」) によりスコープ外化された経緯あり
- `bzm-chapters.ts` の Ch14 status = in-progress へ更新済み (closeout commit)
- 9-5-appendix-changelog.md 追記済み (`2b6ede7b`)
- 司令塔 (Book A 司令塔 04 = `local_8f5e95be-...`) へ完了報告送信済み。**世代交代している可能性があるため、cross-session 送信前に必ず list_sessions で現行司令塔を再特定する**

### 理論パートの設計判断 (前任が確定・司令塔報告済み)

- 2読み方式: Score_abs (事前・順位) / 達成率 = V^実現/P (事後・完走)。SPS≠GO に続く「第二の分離」として Ch9 と対に
- E[Π] worked example: 20本 (大型2/中型8/小型10)、全ユニコーン 2.98億 < 全自走 3.60億 < 適合配分 4.50億 — 単願と全小口化の両方が負ける設計
- MASTER_PLAN §9 Ch14 の「Goodhart 回避条件 (**第5章**の系の適用)」は誤記と判断し**第11章** (二層非可換性) の系として実装
- 撤退四経路 = ①用途転換 ②出口クラスの転換 ③ライセンスへの畳み込み ④研究への返却 (前任設計、MASTER_PLAN は名称のみだった)
- 理論節の実例 = 案件 D (計測装置) を Ch3 経由で引用。数値 (年商2.8億・ライセンス料600万/年) は章頭 v1 と整合済み
- P はすべて Ch3 前方参照 (P オーナー章 = Ch3、2026-07-16 案3 まさ確定)。統合章 = 「M と R」の章 (v4)

### 未解決 / 引き継ぎタスク (優先順)

1. **まさの章頭 v1 確認結果への対応**
   - 承認なら: 14.0 プレースホルダへ本文差し替え + 討議課題 A 挿入 + 章末の連作免責統一注記 (STORY_WORLD §1.2) + 「この稟議書には章の後半でもう一度戻る」の B 面回収節 (理論パート内のどこで楢原のペンの帰結を書くか — 前任は未着手、Ch9 の 9.8 型で 14.7 か 14.8 の後に置くのが自然) + NARRATIVE_DESIGN §1 設計表・STORY_WORLD §2.1 の状態更新 + 柏木陪席の編み込み確認 (v1 本文に陪席 2 文実装済み)
   - 差し戻しなら: 骨抜き防止 3+1 条項で白紙構想やり直し。**その際も抽象案の羅列ではなく本文で見せる** (memory 参照)
2. **まさの理論パート確認への対応** — FB があれば反映。**執筆スコープ内の判断は質問せず自分で決めて書き切る** (2026-07-17 まさ明示指示)
3. (章全体まさ確定後) MASTER_PLAN §9 Ch14 行の実装同期・bzm-chapters status = completed・司令塔へ確定報告

### 司令塔マター (前任が報告済み、自分では触らない)

- `book-a-ch-10.md` L47 の Klepper 参照「第15章の領土」= 旧 TOC 残存 (正 = 第14章)。修正は司令塔レーン
- `book-a-ch-6.md` (Ch5 生存) の M 分離改修は本文未反映 — 別レーン進行中。Ch14 は glossary §4 恒久仕様前提で書いてあり、Ch5 改修が入れば自動整合

## 確立済み運用ルール (このレーン)

- **ブランチ・worktree 作成禁止**。spawn_task が worktree + ブランチを作った状態で起動された場合: worktree で `git checkout --detach origin/main` → 作業 → `git push origin HEAD:main` が確立ルート (root checkout は他レーンの dirty + behind で ff-merge 不可のため)。push 前に必ず `git fetch origin main`
- `git add .` 禁止、対象ファイルをフルパス明示
- 他章本文 (Ch1〜13, 15)・統合章 (`book-a-ch-4-5.md`)・司令塔正本 (SESSION_MIGRATION_PROMPT.md / HANDOFF_BOOK_A_*.md) は Read only
- 分量: 章全体 22,000字上限 (現在 理論 16,831 + 章頭 2,614 = 19,445字余地内)
- 文体: 常体 (である調)、台詞内敬語保持、章末注記は STORY_WORLD §1.2 統一短文
- 変更したら同 commit で `pwa/bzm/9-5-appendix-changelog.md` へ追記
- kaku 点検 (話題テスト・漏出テスト・緊張台帳・拍・境界) を提出前に必ず通し、修正版にも再適用
