# SESSION MIGRATION PROMPT — PF-021 ナラティブ白紙再構築 (Ch1完了・Ch2以降へ)

*このファイルは Book A『ディープテック起業の経営学』章頭ナラティブ白紙再構築 (PF-021) の次セッション用引き継ぎプロンプト。repo root の `SESSION_MIGRATION_PROMPT.md` は別PJ (月初合意モーダル closeout) 用のため触れず、bzm 配下にこのファイルを新設した。*

```text
cd /Users/masa/projects/AMD/amd-os

最初に読む順 (この順で、省略しない):
1. /Users/masa/projects/AGENTS.common.md — えいみ共通ルール正本 (人格・実行姿勢・記憶管理)
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md — AMD level memory
3. /Users/masa/projects/AMD/amd-os/CLAUDE.md — モノレポ全体ルール (ブランチ作成全面禁止・commit即push・dirty容認)
4. /Users/masa/projects/AMD/amd-os/pwa/bzm/2026-07-12_narrative_rebuild_handoff.md — PF-021 状態 (Ch1完了・本セッション役目終了マーカー)
5. /Users/masa/projects/AMD/amd-os/pwa/bzm/BOOK_A_NARRATIVE_DESIGN.md — 設計正本、全節。特に §8 (中心命題台帳v2) / §6 (白紙構想の作業手順・改定版) / §3 (技法反復管理・読者誘導の設計/現実考証ゲート) / §1 (16話設計表) / §2.5 (全体ストーリー)
6. /Users/masa/projects/AMD/amd-os/pwa/bzm/COMMANDER_TASKS.md — ストリーム O セクション全文 (Ch1経緯・司令塔対応・申し送り)
7. /Users/masa/projects/AMD/amd-os/pwa/bzm/2026-07-13_narrative_rebuild_ch2_v2.md — Ch2 白紙構想v2 (まさ未提示、最先端の未完了成果物)
8. /Users/masa/projects/AMD/amd-os/pwa/bzm/2026-07-12_narrative_rebuild_ch1_v5.md — Ch1確定版。文体・技法・ゲート運用の実例リファレンス
9. /Users/masa/projects/AMD/amd-os/pwa/bzm/book-a-ch-1.md — Ch1正本 (v5反映済み、全文Read)
10. /Users/masa/projects/AMD/amd-os/pwa/bzm/book-a-ch-2.md — Ch2正本 (現行、まだv2構想未反映。x.0節だけでなく理論側2.4/2.5の「鬼門」15箇所も見る)
11. /Users/masa/projects/AMD/amd-os/pwa/bzm/9-5-appendix-changelog.md — 変更履歴 (末尾から)
12. /Users/masa/projects/knowledge/EPISODE_BANK.md — 実話在庫41件 (非公開・変装レベル遵守)
```

## 状態スナップショット (2026-07-13時点)

- **git**: origin/main 先端 `c36e89d3`。全変更 push 済み、dirty 無し (このセッションが確認した時点)。ただし複数セッション並行稼働のため、作業開始前に必ず `git fetch origin main` で再確認すること。
- **Ch1**: v4→v5 (まさFB4点反映) で確定・まさ承認済み。正本 `book-a-ch-1.md` への反映も司令塔が完了済み (`5126e672`: 1.0節をv5本文で全置換+理論側微修正4点)。**完全に閉じている、これ以上触らない。**
- **Ch2**: 「ストリームO Ch2以降担当セッション」が白紙構想v2まで到達 (`2026-07-13_narrative_rebuild_ch2_v2.md`、commit `1c97e23a`)。中心命題・白紙検討で棄却した4案・v2の一行定義「他人の時計を、自分の指で書き写していたことに、本人だけが気づかない話」・「鬼門」代替語候補3案 (A推奨=不可逆点/B=分水嶺/C=帰還不能点) を含む。**まだまさに提示していない (提示→確定→本文化の前段階で止まっている)。**
- **本セッション (Ch1担当・引っ越し先)**: Ch1完了・正本反映確認・司令塔への引き継ぎ完了をもって役目終了。`/handoff` → `/closeout` を実行中。
- **Ch3以降**: 未着手。COMMANDER_TASKS.md には他ストリームも並行稼働中 (C=第9〜16章章ワーカー並列起草、B=第3〜8章まさ段落確定待ち、E/F=巻頭巻末、G=図版、H=演習パッケージ、I=タイトル副題、J=著者体制、K=自費出版実務、L=章間整合パス)。ストリームOはナラティブ白紙再構築専用。

## 次タスクの詳細

**Ch2 白紙構想v2をまさに提示するところから再開する** (このセッションでは未実施、次セッションの最初の仕事):

1. `2026-07-13_narrative_rebuild_ch2_v2.md` の内容 (あらすじ+装置+幕引き+鬼門代替語A/B/C案) をチャットに全文貼ってまさに提示する
2. まさのツッコミを受けて確定
3. 確定後、本文を執筆 (提案md `2026-07-12_narrative_rebuild_ch{N}_v{X}.md` 形式 + **チャットにも全文貼る**、まさの環境はmdリンクを開けない)
4. 理論側回収節との照応を検算 (合わなければ理論側修正案も添える、正本反映は司令塔ゲート)
5. 「鬼門」代替語のまさ確定は、理論側15箇所 (`book-a-ch-2.md` 2.4/2.5 の背骨) の改修とセットで進める — 代替語が確定するまでこの15箇所は手をつけない

その後 Ch3〜Ch16 (新章CEO含む) へ同じ5ステップフローを繰り返す。中心命題は §8 で全章確定済みなので、白紙構想はその命題を撃つことだけを目的関数にする。

## 確立済み運用ルール (Ch1セッションで確立・差し戻し2連発から学習)

- **正本 `book-a-ch-N.md` はまさが明示的に「正本に入れて」と言うまで編集しない**
- **編集したら即 commit & push** (main直接、ブランチ作成禁止、`git add .` 禁止)
- **AskUserQuestion ツール禁止** — 選択肢は普通のテキストで「A. ... B. ... どれ?」
- **まさの環境は md リンクを開けない** — 成果物は必ずチャットに全文貼る
- **決定事項は `BOOK_A_NARRATIVE_DESIGN.md` に記帳してから次へ**。`COMMANDER_TASKS.md` ストリームOにも要点反映
- **技法反復の管理** (§3): 「一瞬・間」系は場面内1回まで、比喩の章間使い回し禁止、開幕は物語一行目から (Ch9型)
- **「ゼロから書き直す」を骨格温存で骨抜きにしない** — Ch1 v2 (削る推敲)・Ch2 v1 (骨格温存) と2回連続で同じパターンで差し戻された (「え、これほんとに抜本的に変える気ある?」「それもう忘れたってこと?」)。骨格の善し悪しは「中心命題を撃っているか」でのみ測る。比較して現行が勝つ場合も「ゼロから考えても同じ答えだった」と説明できる状態が完了条件
- **並行セッション運用**: このリポは複数worktree・複数セッション (司令塔+複数worker) が並行稼働している。**push前に必ず `git fetch origin main` して最新を確認する** — 他セッション (特に司令塔) が同じファイル・同じストリームを並行更新している可能性が高い。このセッションで2回実例発生、`CLAUDE.md` に明文化済み

## ファイル責任分離 (このPJでのhandoffの型)

- `2026-07-12_narrative_rebuild_handoff.md` — 最新状態・次アクション (スリム、上書き型)
- `BOOK_A_NARRATIVE_DESIGN.md` — 設計正本 (中心命題台帳・作業手順・技法管理、更新の都度)
- `COMMANDER_TASKS.md` ストリームO — 進捗ログ (append-only、司令塔と共有)
- `9-5-appendix-changelog.md` — 変更履歴 (append-only)
- 各章の提案md (`2026-07-1X_narrative_rebuild_ch{N}_v{X}.md`) — 構想・本文の草稿置き場、確定後に正本へ反映

*作成: 2026-07-13 えいみ (Ch1担当セッション、/handoff Step 9)*
