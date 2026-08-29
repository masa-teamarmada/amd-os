# 次セッション migration prompt — AMD OS / 《組織》セクションの続き

（このファイルは《組織》領域専用。並行セッションが使う `SESSION_MIGRATION_PROMPT.md`（BZM 3.0 モデル本体）や
`SESSION_MIGRATION_PROMPT_SPS.md` とは別物なので上書きしないこと）

cwd は `/Users/masa/projects/AMD/amd-os`。

## 読む順（この順で読む）

1. `/Users/masa/projects/AGENTS.common.md` — えいみ共通ルールの正本
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD 横断の記憶
3. `/Users/masa/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/MEMORY.md` — このPJの記憶
4. `HANDOFF.md` の「B. シーズの産業創出価値（BZM 3.0）」→「組織の器」節 — 現在地
5. `pwa/spec/4-9-project-org-section-current-spec.md` — **《組織》の契約の正本**
6. `pwa/spec/3-6-strategy-signals-current-spec.md` の「人・組織の話は《組織》へ回す」 — 経営ハイライトとの線引き
7. `model/MODEL_VERSION_LEDGER.md` の §5.3（$e$）・§5.4（$\eta_t$）・§6.B（八機能と充足の判定）・§6.C（観測の登録簿）
8. `pwa/BUGS.md` の「2026-08-28〜29 人・組織の話が、行き場が無いまま経営ハイライトへ流れ込んでいた」
9. `pwa/design_log/sessions_2026-08.md` の「2026-08-28〜29」節 — 実装履歴

## 状態スナップショット

- **git**: main一本。`64f80a0b` まで push 済み（v3.99.1）。branch / worktree は作っていない。
  **この checkout は複数セッションが共有している**。作業中は `git status` で他セッションの dirty を確認し、
  自分の対象ファイルだけを stage する。stage が外れていたら他セッションが commit した直後なので、add し直す。
- **本番**: `https://amd-os-pwa.vercel.app` に反映済み。PJコックピット → スコア詳細タブの最下段に《組織》が出る。
- **DB**: migration 333（`project_org_observations`）と 334（移設）を適用済み。観測は5行入っている
  （SX 1 / CX 1 / ORB 2 / SE 1）。
- **モデル本体は未改訂**。八機能を案件ごとに受け取る提案は `model/proposals/2026-08-28_bzm30-organization-input.md`（**未承認**）。
  今回作ったのは器だけで、計算式には触れていない。

## 次にやると効くこと（優先順）

### 1. 観測を実際に積む（いちばん効く）

いま SX は八機能すべてが「未記帳」。実態としては AMD 側が機能3〜6を担っているのに、記録が1件も無い。
**$e$ の値をいじっても金額は動かないが、機能3〜6が充足になれば担い手の充足係数が上がって動く**
（0.2〜0.8 で振っても 13〜14億円しか変わらなかったのは、他の6機能が全部空席扱いだから）。

材料はもう OS の中にある。`project_meeting_summaries`（SXは議事録158件）、`member_activities`、
`project_management_partner_interactions`、`monthly_reports` から、次の形で拾える。

- 機能3（用途と需要家の開拓）— PoC候補の発掘・条件設計。かるの事業計画・POC候補探索
- 機能4（最終意思決定）— 経営会議での決定と結果の引き受け
- 機能5（資金調達）— JAFCO のDD対応、PSI の申請
- 機能6（対外交渉）— NDA・共同研究契約の交渉と締結

**充足の条件（§6.B-2）を満たす形で入れる**: 直近12か月・3か月以上あけた2時点以上・機能ごとの証拠の下限。
機能1（対外説明）だけは相手方の記録か第三者の証言が要る（面談メモや自己申告では充足にならない）。

### 2. 画面からの入力口

いま `project_org_observations` へは DB 直で入れるしかない。まさが気づいたことをその場で足せないので、
《組織》の観測ブロックに追加・編集の口が要る。RLS は admin の全操作が通っているので、
サーバ action か API を1本足すだけ。**外部ワークスペースからは触れないままにすること。**

### 3. 議事録からの自動抽出へ接続

既存の関連メンバー抽出 cron（`/api/cron/founding-members-extract`）は**旧 HRL 向け**で、八機能とは接続していない。
議事録から「誰が・どの機能の・どんな実働をしたか」を拾って観測の candidate にする経路を作れば、
1 が自動で埋まっていく。**通知は既定OFF**、まずは candidate 止まりで。

### 4. 会社設立後の組織図

いまは全PJでメンバー表を出している。登記上の役員・部門・指揮系統のデータを OS が持っていないため。
何を元に描くかを決めるところから（`project_shareholders` / `project_equity_entries` はあるが役員台帳は無い）。

## このPJで確立済みの運用ルール（守る）

- **八機能の一覧を画面やコードへ書き写さない。** 正本 `model/MODEL_VERSION_LEDGER.md` §6.B-1 の表から
  実行時に読む（`loadTeamFunctions`）。見つからなければ機能表を丸ごと出さない。
  判定条件の数字だけコード側（`team-fulfillment.ts` の `FULFILLMENT_RULE`）に持ち、
  `npm run check:team-function-contract` が正本とのずれを検出する。
- **肩書・名義・役職の台帳を充足の判定に入れない。** 正本の「肩書・名義・意思表明では充足にしない」。
- **記録が無いことを「空席」と出さない。** 直近6か月1件以下は「未記帳」（§6.C-3 の3）。
- **負の観測（`direction='negative'`、画面の「重し」）を充足へ数えない。** 正本の充足判定は質を見ないので、
  逆効果の実働が機能を埋めたことになってしまう。数値への効かせ方はモデル側の宿題。
- **人の性質・組織の状態を経営ハイライトへ入れない。** 起きたこと（事象）なら経営ハイライトに残す。
  判定表は spec 3-6。L9 抽出 SKILL にも除外規定が入っている。
- **個人の評価は外へ出さない。** `project_org_observations` の RLS は member 以上のみで `anon` の SELECT が無い。
  まさ 2026-08-28「外部には見せないよ、スコア詳細タブの中にあるし」。この境界を緩めない。
- **メンバーの表記ゆれを画面側で寄せない。** 別人を混ぜる。データ側で揃え、自動抽出には
  `project_venture_members` の名前も既知として渡す。役割が違う同一人物は `／` で併記する。
- 参照系キャッシュ契約（spec 5-10）に `/api/project/:p/org` を登録済み。
  新しい画面のデータ取得を書く前に参照系/可変系を分類し、`check_reference_data_cache_contract.mjs` を通す。
- DDL適用は `pwa/` から `python3 -X utf8 scripts/apply_ddl.py scripts/migrations/NNN_x.sql`。
  DDL変更時は同じ commit で `python3 -X utf8 scripts/dump_schema.py` を回す。
  読み取りは Supabase MCP `execute_sql`（`project_id: nbnhrhybjslbawdukvvk` が必須）。
- **ローカルのPWA画面を認証付きで見る手順**は amd-os の memory
  `reference_local_pwa_screenshot_auth.md` にある（Google OAuth しか無いので service role で
  セッションを起こして cookie へ入れる）。desktop 1440 と mobile 375 の実寸と、
  `documentElement.scrollWidth === clientWidth` を毎回確認する。
- 日本語を含む Python はヒアドキュメント直接実行が落ちる。scratchpad へ `.py` を書いて
  `python3 -X utf8 <file>` で走らせる。
- changelog の向き: `pwa/spec/6-1-appendix-changelog.md` と `pwa/manual/9-3-appendix-changelog.md` は
  **3行目に prepend**（行間に空行1つ）、`pwa/bzm/9-5-appendix-changelog.md` は**末尾に追記**。
- git: main一本、branch/worktree禁止、`git add .` 禁止。着手前に `git fetch` して
  `HEAD..origin/main` が 0 であることを確認する。DB migration と本番データ書き込みは事前承認不要。
- **セッション間メッセージを送らない**（相手側で user turn として着弾し、まさの承認と誤読される）。
