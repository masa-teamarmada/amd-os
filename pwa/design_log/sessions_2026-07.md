# 2026-07 Sessions

## 2026-07-02 — BZM 教科書2冊 × RT組み込み設計 (Book A/B ポートフォリオ + Ch 9.5/37.5 新設 + skeleton ステージ2確定)

### コンテキスト
- まさ依頼「BZM の教科書として (a) MBA1年生/経営学部1年生向けの本 (Book A) と (b) 産連担当者・URA・EIR・VC・起業検討研究者・新規事業開発担当者向けの分かりやすい解説書 (Book B) の2冊をどう作るか、と RT (ラウンドテーブル) を PRS/ERS 対構造にどう組み込むかを並行して議論したい」。
- 940p モノグラフ (Cambridge UP、18ヶ月、Book 0-VI) は執筆中 (Book I Ch 1 §1.0.1 + Book II Ch 5 §5.0.1 起草中、2026-06-28 まさ確定書き順)。この上に教科書2冊と RT 組み込みが乗る三正面。
- RT はまさが「PRS・ERS の2つに RT が有機的に絡みついているイメージ」「BZM の大きな要素になり得る」「retrofit 不足は自認するが仮説としてちゃんと組み入れたい」と明言。単なる補助理論ではなく本書の第三柱として扱う判断。

### 実装 / 仕様同期
1. **多視点ワークフロー (wmvi95miv)** = 9 エージェント (6視点: 教科書編集者/MBA教員/URA実務/VC/出版アーキテクト/RT理論家 + 3批判: 理論整合/市場現実/工数現実) を並列起動し、既存コーパス突合 + RT×ERS 組み込み案 + 3冊書き分け原則 + 時間軸を統合。
2. **ディスカッション土台 `2026-07-02_two_books_rt_discussion.md`** 新規作成 (commit `1cb83f28`)。まさ回答 Q1-Q12 で確定分を新正本に判例化した後、supersede 注記追加して履歴凍結。
3. **BOOKS_PORTFOLIO.md 新設** (commit `2d1579f2`) = 3冊+コーパスの L1 上位層。PF-001〜011:
   - PF-001 Book A は数式全部入り (集大成) / PF-002 学部1年捨てMBA主 / PF-003 Book B は URA案4部16章 / PF-004 素材リユースは実戦書17章のみ / PF-005 看板=出口ポートフォリオ論 / PF-006 演習パッケージ投資 / PF-007 チャネル事実訂正 (愛媛大・工学院大IM就任済み、石原先生共著内諾感触) / PF-008 RT を仮説として一級市民 / PF-009 時間軸 (2026ゲート整備・B 2027末-2028初・A 2029.4学期・自動フリーズ条項) / PF-010 校正数値非公開 / PF-011 独禁確認やる+実名交渉やってみる+連載やってみたい。
4. **RT 理論正本 `BZSF/rt_roundtable_theory.md` v0.2**: §13.4 ERS接続 (ICT レンズ + 最小サブ軸4-d/2-e/8-b、新軸9見送り) / §13.5 二重計上ガード (排他的主経路割当・take-or-pay 3分割・**leave-one-out ERS₋ᵢ**・帰属タグ・UI合成禁止) / §13.6 三項構造 (Ψ_j = Ψ̄ + β·ICT_j = Murmann coupling の**法人化前カーネル**) / §13.2 CRL 運用パラメータ (n₀=3ヶ月・Δ レベル別・L4 proxy)。
5. **D-056 判例化 + L1 反映** (commit `34a31137`): RT を仮説的第三柱として正式組み込み。940p→**980p**、**Ch 9.5「ラウンドテーブル — 二層を結合する組成機構」(28p) + Ch 37.5「自己批判とオープンプロブレム — 第二版への課題」(12p、まさ発案)** 新設。Book 0 三項構造宣言 + Ch 26b に H_RT (ICT測定開始) flush。書き順は Ch 9.5 を Ch 10.7 の後、Ch 37.5 は Book VI 内で Ch 37 と Ch 38 の間。
6. **Ch 9.5 節 skeleton ステージ1完了** (commit `61a35f82`、workflow wf_4432f1b0-6ea): 3 persona × 3 lens × synth。winner = メカニズムデザイン案、進化経済案から系譜接続 (ecosystem genesis 4文献 + SEMATECH 実証対照 + Malerba w(L))、計量案から観測装置形式化 (許容事象集合 𝔄・自動降格・三値区別・q・KM 打ち切り) を graft。8節28.0p、命題 9.5.1-9.5.4 + 仮説 9.5.H (Theorem を名乗らない Tier 謙抑)。成果物 = `CHAPTER_9_5_SKELETON.json` + `CHAPTER_9_5_PROGRESS.md`。
7. **Ch 9.5 ステージ2 (Kingpin K1-K8) 全件確定** (commit `d189ac6a`、D-057): K1 番号体系 = 定義/補題/命題/系+仮説 9.5.H / K2 主装置 = BHW+Banerjee observational learning / K3 独禁 = 仮定 L + 本文 box + Ch 37.5 番号 / K4 CRL 運用: **n₀=3ヶ月仮置き** (まさ確定「とりあえず3か月においてみよう」)・Δ L2=365/L4-5=180日・L4 proxy、数値は本文非記載で Ch 26b 事前登録凍結 / K5 RT記号 ℛ, m(e), ERS₋ᵢ, q, Ψ̄/β, n₀ を付録A冒頭 / K6 Tier A 記述 = レベル+事象種別のみ、**金額非表記で開始** / K7 節参照は章名付き / K8 各命題直後に追加仮定明示列挙。
8. **terminology_glossary.md 新設** (commit `d189ac6a` 同梱): 節参照記法 (K7) / RT 記号ブロック (K5) / 乗法/加重和/補完性の3層対応表。
9. **UI 反映** (commit `edb36a65`、BUILD_VERSION v0.37.3 → **v0.37.4**): `pwa/src/app/(app)/bzm/bzm-chapters.ts` に new-book2-ch-9-5 / new-book6-ch-37-5 追加、Book II ラベル「300p, 10章」、Book VI「72p, 4章」。build 検証: `npm run build` 成功 (clean worktree に node_modules を cp -Rc して実行)。Vercel 自動デプロイ完了。
10. **knowledge/members.md 更新** (repo外): まさ役職追加 (工学院大IM 2026 就任月要確認、香川大客員教授来年度見込み)、愛媛大IM時期訂正 (2/→4/)、社外関係者に「BZM教科書 (Book A) 共著候補」セクション新設。
11. **弁護士確認セッション起動** (task_2985c953、まさ承認済み・独立起動中): RT 独禁法務確認の発注パッケージ (§7.3 field-of-use 分割の垂直ライセンス構成) 作成タスク。成果物予定 = `/Users/masa/projects/AMD/BZSF/RT_ANTITRUST_LEGAL_REVIEW_REQUEST_202607.md`。

### 決定事項
- RT は BZM の一級市民 (仮説的第三柱) として正式組み込み。定義・命題 (証明可能な純理論) と実証仮説 (Ch 26b 事前登録) の厳密分離で「仮説として組み込む」と「検証済みと主張しない」を両立。
- Book A = 理論の集大成テキスト (数式全部入り、共著=石原先生筆頭、2029年4月学期照準)。Book B = URA案 (大学側主語) 本体、素材は実戦書17章のみ。
- 総ページ 940p → 980p。書き順は現行維持 (Book I Ch 1 + Book II Ch 5 §5.0.1 最優先、Ch 9.5 本文着手は Ch 10.7 完了後)。
- CRL L2 規模条件 n₀ = 3ヶ月仮置き、Ch 26b 事前登録で凍結。
- BUILD_VERSION v0.37.4。

### 未完 / 次アクション
詳細は `pwa/bzm/HANDOFF_BZM_BOOK_2026-07-02.md`。弁護士確認セッション (task_2985c953) の完了待ち。

### 教訓
- **外部視点批判レビュー (市場現実 persona) の前提誤認**: 「教員ポスト・採用ネットワークゼロ」は事実誤認 (まさは既に愛媛大・工学院大 IM 就任済み、石原先生共著内諾感触あり)。今後 workflow の共有コンテキスト (SHARED) に「著者の実際のポジション・実在ネットワーク」を明示的に含める運用ルールに。
- **「本文を書く」と「本の設計を書く」の区別**: 設計 md (BOOKS_PORTFOLIO / BOOK_DECISIONS / SKELETON) を大量に書くと「本を書いた気になる」錯覚が生じる。本文が生まれるのは 6ステージ pipeline のステージ4 (段落 draft) 以降。進捗はステージで測る。

---

## 2026-07-01 — MTG prep Notion AI Meeting Notes context gate

### コンテキスト
- まさから、MTG prep で Notion 議事録のメモ欄へ固有名詞・略称などの事前情報を入れる仕組みが機能していないように見える、と確認依頼。
- KENQ prep では context が `prep_draft_md` に残る一方、当日の Notion AI Meeting Notes page に marker 付きで入ったことを確認できていなかった。
- さらに、この closeout 開始時点の current `main` には前セッションで作った未commitの gate 実装が残っていなかったため、current `origin/main` へ復元した。

### 実装 / 仕様同期
- `pwa/scripts/l6_prep_notion_context_gate.cjs` を追加。
  - target page 判定: eventId exact、title/date/attendee fallback。
  - `needs_insert` は `ready_gate='blocked_until_insert'`。
  - `injected` / `already_present` / `not_found` / `write_failed` / `ambiguous` / `wrong_page` / `skipped_after_meeting` は完了状態。
  - 既存 `prep_notion_page_id` が別日/別MTG page を指す場合は `wrong_page`。
- fixture 3件を追加:
  - `needs_insert`
  - `injected`
  - `wrong_page`
- `npm run test:l6-prep-notion-context-gate` を追加。
- prep worker prompt に Phase 5.5 を追加し、append-only insert → page 再fetch → gate 再実行を ready 条件にした。
- H-1 extract prompt、`pwa/spec/3-3-meeting-flow-current-spec.md`、`pwa/manual/2-3-pj-cockpit.md`、`pwa/manual/8-3-l2-extraction-routines-spec.md`、appendix changelog、`pwa/BUGS.md` に同期。

### Verification
- `npm --prefix pwa run test:l6-prep-notion-context-gate` passed。
- `git diff --check` passed。

### 残課題
- 実 Notion MCP での insert / re-fetch は未実行。次セッションで upcoming MTG 1件を使って本番挙動を確認する。
- H-1 Phase P には、古い `codex exec` / auto Slack DM wording と、まさの最新期待 (visible Codex thread / 未承認 auto DM なし / Eimi名義送信) のズレが残る。今回の gate bundle とは別に reconciliation が必要。

### 教訓
- MTG prep の context は「生成済み」と「当日 Notion page に実挿入済み」を分けて記録する。
- `needs_insert` は ready ではなく中間状態。ready にするには insert 後の再fetch確認か、手動対応が必要な完了状態へ落とす必要がある。

## 2026-07-01 — JC shareholder materials cockpit backfill + PRS update

### コンテキスト
- まさから、共有Drive `p09_jc/総会関連資料` に入れたJCの今回資料から情報抽出し、コックピットの然るべき場所とPRSスコアへ反映する依頼。
- 新規資料は `2026年6月-株主報告会.pdf` と `月次決算（5月末締）.pdf`。exact name `定時株主総会` の新規PDFは見当たらず、株主報告会/5月末試算表として扱った。
- 参加者一覧に個人連絡先が含まれていたため、DB summary / handoff / output memo には raw PII を入れない方針にした。

### 実施内容
- `project_documents` に2PDFをDrive link付きで登録。
- `project_strategy_signals` に4件を追加/更新: 5.9億円パイプライン、JOYCLE BOX 2号機仕様、5月末キャッシュ/ランウェイ、追加5,000万円調達・EcoBank承継。
- `project_events` に4件を追加/更新、`project_pl_monthly` に202605の月次PLを追加/更新。
- `project_xrl_log` に2026-06-30観測値を追加し、`project_xrl_evidence` に5件の根拠を追加/更新。
- `amd_score_inputs` に2026-07-01 PRS入力を追加/更新し、`amd_score_revisions` に `1389 -> 5294` のPRS改定履歴を保存。
- 2026-06 A種優先株式ラウンドへ投資家内訳を反映し、AMD貢献ステータスを暫定 `full` から `unreviewed` に戻した。
- `projects.governance_watch_shareholder_meetings=true` に更新。
- `/Users/masa/projects/knowledge/jc.md` に、6月株主報告会/5月末試算表の短い現況を追記。

### Verification
- `node /Users/masa/Documents/Codex/2026-07-01/new-chat/work/jc_db_apply.mjs` completed after schema/constraint fixes。
- `node /Users/masa/Documents/Codex/2026-07-01/new-chat/work/jc_db_read.mjs` で反映後を確認。
- 確認値: documents 2、strategy signals 4、events 5 total、project_pl_monthly 1、score rows 12、xrl logs 6、xrl evidence 5。
- 最新PRS入力: P=6 / R_net=4 / mu_i=9 / TRL=6.5 / BRL=8 / GRL=6 / SRL=7 / HRL=6 / FRL=5.5 / FRL_cap=4.5。
- 最新PRS改定履歴: old_value=1389 / new_value=5294 / evaluated_at=2026-07-01。
- app code / schema / manual の新仕様変更は無し。

### 残課題
- JC作業自体は完了。
- A種ラウンドのAMD貢献ステータスは `unreviewed`。後続で貢献証拠を確認するまで `full` / `partial` にしない。
- AA/AAA投資契約の個別価格・詳細はこのセッションでは追加取得していない。
- unrelated dirty tree に H-1/Notion property guard bundle が残っている。JC作業とは混ぜない。

### 教訓
- PostgREST write 前に `pwa/design/db_schema.md` で列名、generated column、check constraint を見る。`project_documents.web_view_link/file_name`、`project_strategy_signals.scope_key`、`polarity`、`project_xrl_evidence.axis` で実際に引っかかった。
- PRS revision は独自の単純積で概算しない。`pwa/src/lib/amd-score.ts` の `calculatePrsScore` と `computeFrlCES` に合わせる。

---

## 2026-07-03 — P1 (Research Policy 論文) S1〜S5前半を1日で完遂 (before-zero セッション)

### やったこと
- PF-013 (論文ポートフォリオ三段構え・計5本+国内1本) を BOOKS_PORTFOLIO に判例化。P2 投稿先 = 研究技術計画で確定 (Publication-first: 論文は2026年内にできるだけ多く、大会発表は2027/4以降)
- D-059 (出版経路3本立て = Cambridge UP + RP + ICC)、D-060 (P1 = 9.5k words + Supplementary Material)、D-061 (石原先生共著方針 + BZM主役framing) を判例化
- P1 本文8節 7,251語を英語起草 (PAPER_P1_DRAFT.md)。SM-A〜C の証明3本は数理経済学者エージェント3並列で起草→えいみ検収→統合 (PAPER_P1_SM.md)。Fig1-3 SVG、References 36件 (全件web照合、幻覚引用ゼロ)
- 6並列模擬査読 (RPエディター/社会選択理論家/実オプション/実証/TTO実務家/引用照合): desk-reject 1 / major 4。統合改稿計画 S5_REVISION_PLAN.md (R1-R10) に仕分け
- 検収段階で本文の実質改善4件: E2×軸7ゲート矛盾の解消 / Theorem 3 の排除条件を sign-consistency に格上げ / C3 の2読み明示 / §3.4 の8軸を institution_readiness.md 正本に準拠修正
- 論文体裁 HTML プレビュー (PAPER_P1_PREVIEW.html): pandoc --mathml + data-URI 図で JS 実行なし環境でも描画

### 主要 commit (すべて origin/main、worktree 方式)
aa143475 (PF-013) / 2e0102dd (D-059) / 83616114 (D-060/061) / b6730488 (S2 outline) / 170b234c (S3 全節) / 62fb6dd0 (S4前半 Table/refs) / f330a9c8 (S4 SM統合) / 6b4ff066 (プレビューMathML化) / 485fd2b3 (S5前半+改稿計画)

### 決めたこと・次
- 次セッション = S5後半 (改稿 R1-R10)。入口 = pwa/bzm/HANDOFF_P1_2026-07-03.md
- R10 (OSF 事前登録 = 結果が出る前の予測を日付証明つきで外部登録。CX 2026-08 / SX 2027-04 の設立判断前が期限) はまさ判断待ち
- モノグラフ Ch 10.4/9/5.5 skeleton の欠陥5点が査読で発見された → S5_REVISION_PLAN.md §5、次モノグラフセッションで L2 判例化要

---

## 2026-07-03 — P1 S5後半 セッション1: R8+R6 軽微 / R1 理論再手術 / R2 certification 対峙 (before-zero セッション)

### やったこと
- **R8+R6 軽微修正** (`09f9f2cd`): 書誌4件修正 (Arrow=Wiley / Nardo=Hoffmann・OECD Publishing / Debreu・Lakatos 頁) + Atkinson 削除 + Cobb-Douglas を σ_SU 段落に引用 + SM 引用済み4件 (Bertola/Caballero/Fishburn/Gorman) を参照リストへ。幽霊参照 (「bottom panel」「survival panel」) 削除。Table 2 の gate 起因行 T・K を WAIT に統一 (empirical MC2。Y の NO_GO は P→0 起因で別物として維持)。SM-A 誤参照3箇所 (§2→§3)
- **R1 理論再手術 完了** (`7ecd24c3`): Theorem 3 を動学的価値関数基盤で再定式化 (socialchoice 査読の構成的修理パスどおり)。f = 養育環境の価値関数 (閉形式 f = PS·exp(−r(1−R)−∫λ) の決定論的ベンチマーク部分クラスで全証明を初等化)。C1′=min(P,S) 消滅・C3′=チャネルのクラス定義化 (型エラーと §5/SM-D との自己矛盾を同時解消)・境界退化は Lemma に格下げ・**新 Theorem 3 = SH (段階依存の作用) / ED (残り道のりへの複利作用) の下で弱単調合成を排除** — 乗法・CES・min を含み、静的公理系では殺せなかった min(PRS,κ(A)) 反例を殺す。Cor 3.2 (portfolio/universal domain) 新設。SM-B GAP 5→2。SM-B はエージェント起草→えいみ検収 (検収修正3点: ε<1/80 明示・tightness 主張軟化・Hausman χ² df を制約数 q に修正)
- **R2 完了** (このセッション最終 commit): §4 に certification effects (Stuart-Hoang-Hybels 1999 / Hsu 2004 / Howell 2017、3件 web 照合済み) との正面対決段落 — certification は資本アクセス = trajectory 経由 = C3′ チャネル内 (A_4/A_5/A_8 → F/hazard/σ-exposure)、排除されるのは trajectory 固定の halo 残差のみ = Hansen-J (R1 で channel completeness 4キャリア moment に再設計済み) の標的。graceful degradation (J 棄却でも Theorem 3 は SH という観測可能な reversal のみに依存) を明示
- PROGRESS に「S5後半 改稿実行ログ」表を新設、HANDOFF_P1 を R3 起点に更新

### 学び・注意
- 並行セッションが活発で push 拒否が2回 → handoff の fetch→rebase→push 手順で事故ゼロ。worktree 方式継続が正解
- 検収で直した3点はいずれも「エージェントが正しく書いたものの主張強度・定数条件の詰め」— 起草→検収の分業は数理でも機能する
- SH/ED は「公理」ではなく観測可能な経験的条件として設計 — 登録プログラム (§7) の検証対象に載せることで査読防御と実証プログラムが一体化した

### 決めたこと・次
- 次 = R3 (Thm1/2/Prop1、SM-A + §3、M6/M7/M8) → R4 (Thm4 + Fig.3 計算版) → R5 (Simpson selection DGP)。相互独立なので並列可。入口 = HANDOFF_P1 (更新済み)
- PREVIEW.html は R1 で stale — 全 R 完了後に再生成 (手順は本ログ同日の前エントリ)
- R10 (OSF) は引き続きまさ判断待ち。モノグラフ5点の L2 判例化も未着手のまま

### 追記 (同セッション続き、R3 + 日付訂正)
- **R3 完了**: SM-A 全面改修 (エージェント起草→えいみ検収、修正2点)。E4 全観測軸 strict 化 (essentiality 循環解消)・E5 (cross-context trade-off invariance) 新設で単一重みベクトルを導出 (cross-K GAP 解消)・continuum 化を Assumption A-1 に昇格 (Scott 1964)・Prop 1 の G1/G2 矛盾を (G0)/(G2′) で解消 + モデル存在例・Theorem 2 を reporting-scale 結果に再ステート (ordinal 非違反を正直に認める + gate 非有罪 remark)・SM-A.5 新設 (audited ⊥、証拠提出拒否は floor コーディング、K_obs 剥がし禁止 — practitioner MC6)。SM-A GAP 4→0 (SM 全体 20→16)。本文 §1/§3 も E 公理5本化・Thm 1/2 再ステートで整合。References +2 (Foster-Shorrocks 1991 / Scott 1964、追加時照合)
- **CX/SX 設立予定の日付訂正 (まさ確認)**: ともに **2027-03頃** (旧記載 CX 2026-08 / SX 2027-04 は古い)。P1 側 (Table 2 M 行・S5計画 R10・HANDOFF) と knowledge/ 側 (cx.md / sx.md / su.md / partner_institutions.md、changelog 付き) を同日修正。**R10 (OSF 事前登録) は急がない** — 期限は 2027-03 の設立判断前。まさの判断3点 (やるか / 公開範囲 / 名義) は HANDOFF_P1 の R10 項に記載済み

---

## 2026-07-03 — 月初合意入口モーダル closeout

### コンテキスト
- まさから、月初合意が完了するまではOSを開いた最初に月初合意を出し、かつページ遷移ではなくモーダルで出したいという指示。
- 最新 main ではモーダル化は入っていたが、背景クリックで一時的に閉じられる状態が残っており、「合意完了まで先に確認する」運用とズレていた。

### 実装 / 仕様同期
- `MonthlyAgreementGateOverlay` から背景クリックで閉じる処理を削除。
- 合意保存が成功した時だけ overlay を解決済みにし、画面を再読み込みして最新状態へ戻すようにした。
- `BUILD_VERSION` を `v0.38.11` へ更新。
- `test:critical-ui` の守りを更新し、背景クリック dismissal が戻ったら失敗する内容にした。
- `pwa/spec/3-14-monthly-work-agreement-current-spec.md`、`pwa/manual/2-2-member-workflows-quick-start.md`、`pwa/manual/6-6-member-billing-prompts-spec.md`、appendix changelog、`pwa/BUGS.md` に同期。

### Verification
- `npm run test:critical-ui` passed。
- `npm run build` passed。
- 実ログイン状態のモーダル操作確認は未実行。画面が認証・合意状態に依存するため、この closeout ではコード path、重要画面チェック、本番ビルドで代替した。

### 残課題
- まさアカウントまたはテストadminで未合意/条件更新ありの状態を作り、production で `/dashboard` などを開いたときにモーダルが前面表示され、背景クリックで閉じないことを実機確認すると安心。
- `/Users/masa/projects/AMD/amd-os` の root checkout には unrelated dirty state が残っている。今回の clean clone bundle と混ぜず、別 cleanup/reconciliation で扱う。

### 教訓
- 「モーダル」は案内表示にも必須確認にも使えるため、月初合意のような gate では「どう閉じられるか」まで仕様とテストに書く。
- 月初合意は報酬計算を変える画面ではなく、本人確認と支払gateの前提を残す画面。6月以前の移行月スキップと、7月以降の通常合意判定を混ぜない。

---

## 2026-07-03 — ZMP reward liability offset closeout + handoff

### コンテキスト
- まさから、5月稼働分は支払通知書発行・実支払済みなので変更できない前提で、シーズン全体の報酬支払が「クライアント支払額 − バッファ」の65%以内に収束するか確認・調整する依頼。
- 途中で「会社留保を減らせば吸収できる」という説明をしてしまったが、これは誤り。会社が負担して赤字を被る方針ではなく、本人の未払残からだけ相殺するのが current truth。
- しん・こうの小額過払いはまさ判断で許容。あび・うめの過払いだけ、本人自身の未払 stock から相殺する。

### 実装 / DB反映
- `reward_member_liability_offsets` を追加し、送付済み/支払済み月の過払いを同一PJ・同一シーズン・同一メンバー本人の未払残からだけ相殺する監査台帳にした。
- `buildRewardSummary`、先12か月 capped 投影、`/admin/season-pl` が同じ相殺台帳を読むようにした。
- ZMP 2026 active offset:
  - うめ `ID008`: 1,560円、`applies_from_ym=202605`
  - あび `ID009`: 1,658円、`applies_from_ym=202605`
  - こう `ID004` / しん `ID026`: 台帳なし。小額差分として許容。
- migration 162 の `metadata_json.tolerated_members` が `ID004/ID010` になっていたため、2026-07-03 に member DB で `ID010=らん`, `ID026=しん` を確認し、migration 163 で本番DBの監査メタを `ID004/ID026` に修正。計算額・active offset 金額は変更なし。

### 仕様同期
- `pwa/design/season_budget_actual.md`: 実支払い済み差分の本人別相殺台帳を追加。
- `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`: 支払済み通知書を変更せず、本人未払残からだけ差し引く運用を追加。
- `pwa/manual/7-1-reward-calc-spec.md`: 相殺台帳の計算タイミング、`pool='any'` の消化順、ZMP 2026判断を追加。
- `pwa/manual/9-3-appendix-changelog.md`: 2026-07-02 の仕様変更として記録済み。
- `pwa/BUGS.md`: 会社留保/他メンバーで吸収しない教訓と、migration 162 metadata typo を記録。

### Verification
- production `/api/build-info`: `v0.37.3`, git `45cb4e551d4a1aa24dbb8e3d9dd428ac1f5fc580`, `dirty=false` を確認。
- production reward cache refresh: `/api/cron/payout-reward-cache-refresh?ym=202601&lookahead=11` を実行し、`cycleCount=130`, `refreshedCount=130`。
- ZMP 202605 `reward_summary_json`: `liabilityOffsetAppliedYen=3,218`, `liabilityOffsetRemainingYen=0`。ID009 は 1,658円、ID008 は 1,560円を本人stockから相殺。
- ZMP 2026 season target members: ID004こう / ID008うめ / ID009あび / ID026しん は最終月 stock=0 を確認。ID008/ID009は offset 後に閉じる。
- `npx tsc --noEmit` passed。`npm run test:critical-ui` passed。
- ローカル `npm run build` は temp clone の `node_modules` symlink/Turbopack panic と既存 cssnano 系で失敗。本番 Vercel build は成功。

### 注意
- `/Users/masa/projects/AMD/amd-os` の canonical local checkout は、この時点で `origin/main` から 58 behind / 7 ahead、かつ多数の未整理変更あり。今回の報酬実装と handoff は `/tmp/amd-os-ms-overview-v03643` の clean origin/main で行った。canonical local を current truth として読まない。
- 本番DBの `reward_member_liability_offsets` には、別作業由来と思われる `status='pending'` / `amount_yen=null` の行が p19 に残っている。現行 v0.37.3 の計算は `status='active'` だけを読むため支払計算には入らない。所有者不明なので、次回も勝手に削除しない。

---

## 2026-07-06 — monthly_fixed 契約cap混在事故 closeout (KUTE)

### コンテキスト
- まさから、KUTE (`p25`) で「クライアント支払よりPJ予算が多い」「月によって計上のされ方に差があるように見える」と指摘。
- あわせて、SX のように不足が出ているのに admin/MS編集側では危険に見えないこと、`/admin/payouts` やシーズン収支でゼロ着地/不足表示の意味が曖昧なことが問題化した。
- 最重要方針として、AMD運営側が認識していないところで運営費・会社留保が勝手に削られ、「ゼロ着地」に見える設計は禁止と整理した。

### 原因
- KUTE の月別差は手入力ではなく、自動経路の混在だった。
- 2026-05-08 に plan cycle と全月 `billing_cycles` が一括生成され、その時点で `budget_yen` に gross client monthly amount が入った。
- 2026-06-18 の旧 Contract Apply は monthly_fixed で `projects.fee_type/fee_amount/end_ym` だけを反映し、月別行は `monthly_applied:0` として触らなかった。
- 2026-07-01 の contract auto-confirm だけが当月を `月額税抜×65%` へ直したため、当月は正しい65% cap、未来月は古い一括生成値という状態になった。

### 実装 / 仕様同期
- `pwa/src/lib/contracts-apply.ts` に `monthlyFixedBudgetRows` を追加。
- バッファなし monthly_fixed 契約では、未確定 `billing_cycles.budget_yen` と現行 `value_plan_cycles.budget_yen` を契約cap (= 月額税抜×65%) へ整合する。
- 確定済み/進行済み月の `budget_yen` が契約capと不一致なら、隠して進まず Contract Apply を失敗させる。
- SX のように explicit buffer / season reserve があるPJは単純上書きせず、`buffer_breakdown_json` と契約バッファ設計を優先する。
- `pwa/spec/5-6-contracts-management-current-spec.md`、`pwa/manual/6-7-contracts-management-spec.md`、`pwa/manual/7-1-reward-calc-spec.md`、appendix changelog、`pwa/BUGS.md` に同期。
- `HANDOFF.md` と `SESSION_MIGRATION_PROMPT.md` を ZMP過払いcloseout から今回の monthly_fixed cap closeout へ更新。

### Verification / Deploy
- 実装 commit: `b6be05295f91d73d8afef5d821880e1e893a3e4f` (`fix(finance): reconcile fixed contract budgets`)。
- 初回本番確認: `v0.39.1 / b6be0529`, `dirty=false`。
- 実行済み:
  - `npx tsc --noEmit`
  - `npm run test:critical-ui`
  - `npm run test:deploy-version-guard`
  - `npm run lint -- src/lib/contracts-apply.ts`
  - `npm run build`
- 2026-07-06 closeout 開始時点では、他セッションの main 進行により production は `v0.39.5 / bd209e00`。当該修正 commit は main 履歴に含まれる。

### 残課題 / 注意
- canonical checkout `/Users/masa/projects/AMD/amd-os` は stale/dirty。clean worktree または `origin/main` / production build-info を current truth として使う。
- SX はバッファありPJなので、KUTE型の bufferless monthly_fixed 整合をそのまま当てない。`buffer_breakdown_json` と契約termsを先に読む。
- MS編集/Contract Apply の出口では、client payment / buffer / PJ budget / member payment / company reserve / ending unpaid balance を同時に見せ、不足があるまま正常に見せない。

### 教訓
- `billing_cycles.budget_yen` が明示値であることと、それが契約capの正しい値であることは別。Contract Apply 済みの monthly_fixed では、古い一括生成値を正本扱いして放置しない。
- 「不足を赤表示するだけ」は、ゼロ着地を必須にする設計の代替にならない。運営費を黙って削る補正は禁止で、ゼロ着地に必要な資金構造を編集時点で見える化・検算する。

---

## 2026-07-03 — 月初合意 / MS編集 支払実績の freee 照合化

### コンテキスト
- まさから、MSを期中編集しても過去に支払った金額は変えず、編集によるPJ予算赤字を編集中に分かるようにしたいという依頼。
- 初期対応では `monthly_reward_payout` の再計算/補完値を支払実績扱いしていたが、まさから「実際の支払額と同一かわからない」と指摘。実績判定の根拠を freee 出金まで戻して確認し直した。

### 実装 / DB反映
- `支払実績` は、保存済みの `monthly_reward_payout.total_pay` 税抜額に消費税を掛けた税込額が freee `wallet_txns.amount` と一致し、かつ `billing_cycles.reward_paid_by` が `freee_wallet_txn_verified:<wallet_txn_ids>` を持つ月だけに限定した。
- `reward_paid_at` だけある月、または銀行出金は見えるがPJ別明細額と一致しない月は `要照合` / `実績未照合` として分離し、実績にも未来予定にも混ぜない。
- 以前に計算補完した `monthly_reward_payout` rows は削除。ZMP p19 202604/202605 は freee 出金と1円単位で一致したため実績確定。p19 202601〜202603 は支払い自体はあるがPJ別明細額と一致しないため `要照合`。p19 202606 は7月支払い証跡が未確認のため `保存済み` に戻した。
- `/monthly-agreement` は `支払済み実績(税込)` / `実績未照合(税込)` / `これから支払予定(税込)` を分け、支払明細は税抜/税込を併記する。
- `/admin/ms-overview` の保存前支払検算は、実績確定分だけを固定支払として扱い、未照合月があれば `blocked` にする。

### 仕様同期
- `pwa/spec/3-14-monthly-work-agreement-current-spec.md`: freee 照合済み実績、未照合、税込表示を追記。
- `pwa/manual/6-8-admin-ms-overview-spec.md`: MS編集の予算影響で支払済み固定/実績未照合/保存後残予算を分け、未照合を保存不可にする仕様を追記。
- `pwa/manual/7-1-reward-calc-spec.md`: 支払実績と報酬計算キャッシュの境界を同期。
- `pwa/manual/9-3-appendix-changelog.md` / `pwa/spec/6-1-appendix-changelog.md`: 2026-07-03 の変更履歴に記録。
- `pwa/BUGS.md`: 計算キャッシュを実績扱いした事故と再発防止を記録。

### Verification
- `npx tsc --noEmit --pretty false` passed。
- `npm run test:critical-ui` passed。
- `git diff --check` passed。
- `npm run build` passed。
- `npm run lint` は既存の unrelated lint error で失敗。今回変更箇所由来ではない。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で本番反映。観測時点では `v0.38.3 / 7a7b0ddc70439cc977c80fc6593f467eba0e89d9`。
- 本番 `/monthly-agreement?ym=202607&memberId=ID026` で、`支払済み実績(税込) ¥68,855`、`実績未照合(税込) ¥96,525`、`これから支払予定(税込) ¥223,726`、行別の `支払実績` / `要照合` / `保存済み` 表示を確認。

### 注意 / 次
- 最新 production はこの後 `v0.39.5` まで進んでいる。次セッションは必ず `/api/build-info` と `origin/main` を見て、最新線で作業する。
- p19 202601〜202603 の `要照合` を消すには、PJ別明細と銀行出金が一致する根拠を追加で探す必要がある。推測で `freee_wallet_txn_verified:` を付けない。

---

## 2026-07-08 — MTGカード 予定/準備/日程未確定 亡霊解消

### コンテキスト
- まさから、複数PJの MTGカード周りに `MTG準備` や `日程調整中MTG` が亡霊のように残ると指摘。
- 初回修正後、KUTE cockpit のスクショで `日程調整中MTG` 別欄に 2026-06-23 / 2026-06-22 の古い行が残っていることが判明。
- まさの追加判断: 「日程調整中」欄は不要。予定MTG欄に `日程未確定` と表示すれば足りる。

### 原因
- 予定MTG欄が `meeting_date >= today` ベースだったため、開始時刻を過ぎた当日MTGも予定として残った。
- 開催済み議事録詳細が同じ `calendar_event_id` の `upcoming:` 行を無条件に `MTG準備情報` として拾い、薄い calendar sync テンプレートまで会議後に残した。
- `next_meeting_prep` TODO に MTG開始後の自動終了出口がなく、期限超過しても残り続けた。
- `meeting_id` が `upcoming:` で始まるだけで準備カード扱いしていたため、`source_kinds='notion+gmail+pre_mtg_prep'` のように中身は開催済み議事録へ変わった row まで `日程調整中MTG` に落ちた。
- `upcoming_tentative` を別欄 `日程調整中MTG` として出していたため、日程未確定メモが予定欄とは別の古いレーンに見えた。

### 実装 / 仕様同期
- `v0.39.6` (`bec41598`) で、予定MTG表示を `meeting_start_at > now` に変更し、画面を開いたままでも1分ごとに現在時刻更新するようにした。
- 開催済み議事録に紐づける準備メモは、手動準備または prep worker 成果 (`prep_draft_md` / readiness / session) がある row だけに限定。`calendar-future-sync` だけの薄い予定テンプレートは出さない。
- `proactive-todo-extract` に Stage 5 を追加し、開始時刻を過ぎたMTGに紐づく open/blocked `next_meeting_prep` を `done` へ自動終了するようにした。
- `v0.39.7` (`80cd1fe5`) で、`日程調整中MTG` 別欄を廃止。`upcoming_tentative` は同じ `予定MTG / 準備中` 欄に入れ、日付欄を `日程未確定` と表示する。
- `meeting_id` prefix だけで準備カード扱いしないようにし、`source_kinds` が開催済みソースへ変わった row は準備カードから除外した。
- `pwa/spec/3-3-meeting-flow-current-spec.md`、`pwa/spec/2-4-proactive-todo-current-spec.md`、`pwa/manual/2-3-pj-cockpit.md`、`pwa/BUGS.md`、appendix changelog に同期済み。

### Verification / Deploy
- `npx tsc --noEmit` passed。
- `npm run test:critical-ui` passed。
- predicate 小テスト passed (future upcoming / started upcoming / pending tentative / old tentative / held-source upcoming-id)。
- `git diff --check` passed。
- `npm run build` passed。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で `v0.39.6` と `v0.39.7` を本番反映。
- production `/api/build-info`: `v0.39.7 / 80cd1fe557282e8bced855c60426735aab62de90 / dirty=false`。
- production cleanup: `proactive-todo-extract` one-shot で `closed_expired_prep: 13`。開始済みMTGに紐づく open/blocked `next_meeting_prep` は 0。
- KUTE p25 を新判定で確認し、予定欄に出るのは未来3件のみ。スクショの 2026-06-23 / 2026-06-22 rows は予定欄に入らない。
- ブラウザ自動確認は認証壁まで。desktop/mobile login 画面は overflow / console error なし。authenticated cockpit はまさが `調整中なくなった` と確認。

### 注意 / 次
- もし今後も古いMTGカードが見える場合、まず画面左上 version / `/api/build-info` が `v0.39.7` 以上か確認する。
- `v0.39.7` でも残る場合は、推測でDBを消さず、`project_meeting_summaries.source_kinds`、`meeting_id` prefix、`meeting_start_at`、`calendar_event_id`、`prep_status`、`generated_by_model` を見て、どのpredicateへ入ったかを切り分ける。
- canonical checkout `/Users/masa/projects/AMD/amd-os` は stale/dirty。今回の修正は clean disposable clone `/tmp/amd-os-mtg-ghost-fix-1783401569` から origin/main / production に反映済み。

---

## 2026-07-08 — repo closeout / handoff refresh

### コンテキスト
- handoff / closeout スキル実行。
- 直前の `HANDOFF.md` には、MTGカード亡霊修正の実装時点の注意として「canonical checkout が stale/dirty」という前提が残っていた。
- closeout 実行時点では、docs closeout commit まで main に入り、canonical checkout は origin/main と一致して clean になっていた。

### 実施内容
- `HANDOFF.md` を最新の closeout 状態へ更新。
- `SESSION_MIGRATION_PROMPT.md` を、common 先頭・AMD level memory 併記・現在の main/production 状態込みの濃い再開プロンプトへ更新。
- この design_log に closeout refresh の事実を追記。

### Closeout snapshot
- repo: `/Users/masa/projects/AMD/amd-os`
- branch: `main`
- HEAD / origin/main: `04a3a55d0cf62c48b588c8ba8f0c140cc41a022d`
- production `/api/build-info`: `v0.39.7` / `04a3a55d0cf62c48b588c8ba8f0c140cc41a022d` / `dirty=false`
- `git status -sb --untracked-files=all`: clean
- registered worktree: `/Users/masa/projects/AMD/amd-os [main]` only
- local branches: `main` only
- local main vs origin/main: ahead `0`, behind `0`

### 注意
- `/tmp/amd-os-*` の disposable clone / artifact は複数残っているが、git worktree registry には載っていない。削除は `rm -rf` 系の破壊的操作になるため、この closeout では削除していない。掃除するなら別途、 exact path を出して承認を取ってから行う。

---

## 2026-07-08 — D-10 Member Activity Evidence を Codex automation 合成へ移管

### コンテキスト
- まさから、MyPage「今週やったこと」の中身がひどいと指摘。スクショでは `source_fusion` の行に、メール本文冒頭、HTMLタグ、`meeting_id=upcoming... runner_surface=...` が title として出ていた。
- 途中で、D-10 が Codex automation 内に既に存在し active なのに、なぜ定額外トークン例外扱いになっていたのかも確認した。
- まさの整理: `ALLOW_PWA_LLM_CRONS=1` で D-10 を復活させるのではなく、D-10 の合成処理を Codex automation 側へ移す。

### 原因
- `/mypage` は `member_activities(source='member_weekly')` を読む。
- D-10 route は背景 Anthropic 封鎖後、LLM synthesis の代わりに fallback synthesis で保存していた。
- fallback synthesis は `best.snippet` を title に使っており、Gmail本文・Calendar description・runner marker が活動タイトルとして保存されうる状態だった。
- Codex automation `amd-os-l2-2` は active だったが、中身は PWA route を `interactive=1` で叩く trigger であり、活動文の合成本体はまだ PWA route 側に残っていた。つまり「Codex automation内にD-10がある」だけでは定額内化になっていなかった。

### 実装 / 仕様同期
- `pwa/src/app/api/cron/member-weekly-activities/route.ts`
  - `GET ?mode=evidence` / `?evidence=1` を追加。Gmail / Calendar / source_cache / meeting summary の evidence groups だけ返し、保存も Anthropic 呼び出しもしない。
  - `POST /api/cron/member-weekly-activities` を追加。Codex automation が作った `activities[]` を検証し、全 group がそろっている時だけ窓単位 delete-then-upsert する。保存時は `raw_metadata.synthesis_method='codex'`。
  - legacy `interactive=1` GET は `ALLOW_PWA_LLM_CRONS=1` が無い限り `disabled:true / saved:0` とし、fallback row で上書きしないようにした。
  - fallback title と `cleanText()` も HTML tag / basic entity / raw snippet title を避けるように強化。
- `/Users/masa/.codex/automations/amd-os-l2-2/automation.toml` を更新し、`mode=evidence` 取得 -> Codex 合成 -> POST 保存 -> `synthesis_method=codex` 検証の流れへ変更。
- `pwa/spec/3-0-l2-data-list-current-spec.md`、`pwa/spec/3-1-l2-data-extraction-current-spec.md`、`pwa/spec/5-3-automation-responsibility-current-spec.md`、`pwa/spec/5-8-l1-l3-codex-migration-current-spec.md`、`pwa/manual/3-2-data-and-extraction.md`、`pwa/manual/6-1-operations-settings-spec.md`、`pwa/manual/8-3-l2-extraction-routines-spec.md`、`pwa/design/mypage.md`、`pwa/design/L2_DATA.md`、`pwa/design/SPEC_pwa.md`、`pwa/src/lib/operations-catalog.ts`、appendix changelog に同期。
- `pwa/BUGS.md` に事故と再発防止を追記。

### Verification / Deploy
- `npm run lint -- src/app/api/cron/member-weekly-activities/route.ts src/lib/operations-catalog.ts` passed。
- `npx tsc --noEmit --pretty false` passed。
- `npm run build` passed。
- `git diff --check` passed。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で本番反映。
- production smoke:
  - legacy GET `interactive=1` は `disabled:true / saved:0`。
  - evidence mode は evidence groups を返し、Anthropic synthesis なし。
- 本番データ補正:
  - 現行週 `member_activities(source='member_weekly')` は 22 row。
  - `raw_metadata.synthesis_method='codex'` が 22 row。
  - `<p>`、`runner_surface`、`meeting_id=upcoming`、メール挨拶文など既知 bad pattern は 0 件。

### 注意 / 次
- `/mypage` の「いますぐ抽出」ボタンは、まだ古い refresh route 経由で legacy GET を呼ぶ。今は legacy GET が保存しないため、D-10修復ボタンとしては機能しない。次に直すなら、ボタンを Codex automation / request queue に接続する。
- Windows MMO Task Scheduler launcher を復活させる場合も、legacy GET ではなく Mac と同じ evidence -> Codex合成 -> POST 保存方式へ更新する。
- closeout 時点の canonical checkout には、D-10とは別の dirty `pwa/scripts/atlas_signal_review_tool.mjs` がある。内容は Atlas ingest disabled 時に outbox へ残す retryable exit の追加。D-10 session では触らない。

### 教訓
- 背景LLMを封鎖した route で fallback synthesis を保存に使うと、LLM品質低下ではなく表示汚染として表に出る。
- 「Codex automation が active」でも、実際に何を実行しているかを見る。route trigger だけなら合成本体は移管できていない。
- MyPage の週次活動 title は、snippet ではなく活動単位の要約である必要がある。HTML / runner marker / メール挨拶文は表示前に落とすだけでなく、保存時に入れない。

---

## 2026-07-08 — Admin MS Overview 個人名カード回帰防止 / v0.39.13 closeout

### コンテキスト
- まさから、`/admin/ms-overview` の上段メトリクスに個人名同士を比べるカードが戻っていると指摘。
- まさの補足: 本来は上段4枚構成で、そのカードをなくして別のカードを入れていたはず。
- さらに、設計書に旧カードを連想させる文言が残ると再発するため、該当文言もすべて削除したいという指示。

### 原因
- 初期実装で個人名カードが入り、後続修正では円額だけが消えてカード自体は残った。
- 設計書・重要UI登録簿・変更履歴に旧カードを連想させる文言が残っており、後続作業がそれを current truth と読んで温存しやすかった。
- 最初の対応で3枚化してしまい、まさが覚えていた「本来4枚」という構造とズレた。

### 実装 / 仕様同期
- `c7578d30 fix(admin): restore MS overview finance metric card`
  - 上段を4枚構成へ戻し、4枚目を `budgetImpact` 由来の `PJ予算残` / `不足額` / `予算不足` / `原資超過` カードにした。
  - `BUILD_VERSION` を `v0.39.11` へ更新。
- `b84f73ab docs(admin): lock MS overview metric guard`
  - `pwa/manual/6-8-admin-ms-overview-spec.md` と `pwa/design/FEATURE_REGISTRY.md` に、4枚固定・3枚化禁止・個人名カード復帰禁止・4枚目 `budgetImpact` 固定を追記。
- `a89683e0 docs(admin): remove old MS metric wording`
  - current tree から旧カードを連想させる文言を削除。
- `cb584019 chore(pwa): bump build version for MS guard`
  - まさ指摘「上げないとだめ」を受け、`BUILD_VERSION` を `v0.39.13` へ更新。
  - manual/spec appendix に、再発防止が本番版として判別できるようにした理由を追記。
- `pwa/BUGS.md` に本件の症状・原因・対応・再発防止策を追加。
- root `HANDOFF.md` / `SESSION_MIGRATION_PROMPT.md` を本件の restart state へ更新。

### Verification / Deploy
- `npm run test:critical-ui` passed。
- `npm run test:deploy-version-guard` passed。
- `npx tsc --noEmit` passed。
- deploy rollback guard passed。
- `git push origin main` 後、Vercel production が Ready になり、`https://amd-os-pwa.vercel.app/api/build-info` が `v0.39.13` / `cb584019ca8710b684322688069c42bf1012d652` / `dirty:false` を返すことを確認。
- 禁止語 `rg` はゼロ件。

### 注意 / 次
- accepted release 後も、別件の dirty が5ファイル残っている。今回の closeout では触らない。
- MS系3ファイルは「設計額を丸め済み1pt単価ではなく、原資×pt比で出す」方向のWIPに見える。採用するなら spec/manual 同期・テスト・build version bump・deploy が必要。
- L6 prep SKILL と Atlas script の dirty も別 lane として扱う。

### 教訓
- 消したいUIの旧名や旧説明を正本mdに残すと、それが後続作業の復活根拠になる。
- 「戻さない」だけでなく「何を代わりに固定するか」まで書く。今回なら「4枚固定、4枚目は `budgetImpact`」が再発防止の核。
- 画面上でまさが確認する変更は、docs guard だけでも build version で判別できるようにする。

---

## 2026-07-08 — PJ cockpit 今シーズン収支 cash-basis 収支 / v0.39.12

### コンテキスト
- まさから、PJ cockpit の season 全体の月次予算内訳にある `内部留保` / `会社留保` は、実質的に役員報酬相当額なのでメンバー向けには見せなくてよいという指示。
- 続いて、`未払残` と `予算残` が同額に見えたことで、予算超過なのかという不安が出た。
- 調査すると、表示されていた `残` は cash movement ではなく、hidden budget safety calc の義務残だった。まさの意図は現金主義でその月の収支を見ることだった。

### 実装 / 仕様同期
- `0eee5780 Show cockpit season finance cash balance`
  - `pwa/src/lib/supabase-data.ts` に cash-basis `cashBalanceYen` を追加。
  - `pwa/src/components/cockpit/CockpitSeasonFinance.tsx` の月次表を `残` から `収支` に変更。
  - `収支 = クライアント支払 - バッファ - メンバー支払` に固定。
  - `会社留保` / 役員報酬相当額は member-facing table から削除。
  - hidden safety calc として `companyReserveYen` / `finalUnpaidYen` / `finalRemainingYen` は保持。
- `pwa/scripts/check_pwa_critical_ui.cjs` を新しい `収支` 表示に合わせて更新。
- `pwa/manual/2-3-pj-cockpit.md`、`pwa/spec/3-8-cockpit-current-spec.md`、`pwa/design/FEATURE_REGISTRY.md`、manual/spec appendix changelog に同期。
- この件は表示定義の修正で、障害ログ化するほどの incident ではないため `pwa/BUGS.md` は対象外。

### Verification / Deploy
- `npx tsc --noEmit` passed。
- `npm run test:critical-ui` passed。
- `npm run build` passed。
- local browser route check は認証前 `/auth/login` まで確認。認証後の cockpit 目視は未実施。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で main push / Vercel production 反映。
- production `/api/build-info` は finance cockpit 変更時点で `v0.39.12` / `0eee5780...` / `dirty:false` を確認。
- 後続の MS Overview guard commit により、closeout 時点の production は `v0.39.13` / `2d64a3fa...` / `dirty:false`。

### 教訓
- `残` という語は、財務表では cash residual と obligation residual のどちらにも読める。メンバー向け画面では目的に合わせて `収支` など意味が閉じる名前にする。
- 役員報酬相当額のような内部向け配分は、内部計算には残しても、メンバーのPJ画面に露出させない。

---

## 2026-07-09 — Finance cockpit + MS guard handoff closeout refresh

### コンテキスト
- まさから `handoff` / `closeout` の実行依頼。
- 直近の accepted work は、PJ cockpit の cash-basis `収支` 化と Admin MS Overview の個人名カード回帰防止。
- closeout 時点で main / origin/main / production は一致していたが、別 lane の dirty が残っていた。作業中に並行WIPが増えたため、最終 handoff では19ファイルとして棚卸しした。

### 実施内容
- root `HANDOFF.md` を、finance cockpit と MS guard の両方が再開できる current truth に更新。
- root `SESSION_MIGRATION_PROMPT.md` を、common 先頭・AMD level memory 併記・PJ cockpit / MS Overview 読み順込みの再開プロンプトへ更新。
- dirty 19ファイルはこの handoff bundle へ含めず、owner guess / next action / risk 付きで棚卸しした。

### Closeout snapshot
- repo: `/Users/masa/projects/AMD/amd-os`
- branch: `main`
- HEAD / origin/main before handoff docs refresh: `2d64a3faa8571d1e7cb26d928712bf700eaefdba`
- production `/api/build-info` before handoff docs refresh: `v0.39.13` / `2d64a3faa8571d1e7cb26d928712bf700eaefdba` / `main` / `dirty=false`
- local main vs origin/main before handoff docs refresh: ahead `0`, behind `0`
- registered worktree: `/Users/masa/projects/AMD/amd-os [main]` only
- local branches: `main` only
- remaining dirty:
  - `pwa/src/app/api/admin/ms-overview/route.ts`
  - `pwa/src/components/admin/AdminMsOverviewClient.tsx`
  - `pwa/src/lib/admin/ms-overview-calc.ts`
  - `pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx`
  - `pwa/src/app/(app)/institutions/[institutionId]/cockpit/page.tsx`
  - `pwa/src/components/cockpit/CockpitNudge.tsx`
  - `pwa/src/components/cockpit/CockpitView.tsx`
  - `pwa/src/components/dashboard/CyberHudWallDashboard.tsx`
  - `pwa/src/lib/build-info.ts`
  - `pwa/scripts/check_pwa_critical_ui.cjs`
  - `pwa/manual/2-3-pj-cockpit.md`
  - `pwa/spec/3-8-cockpit-current-spec.md`
  - `pwa/design/FEATURE_REGISTRY.md`
  - `pwa/design/cockpit.md`
  - `pwa/design/proactive_operating_loop.md`
  - `pwa/manual/9-3-appendix-changelog.md`
  - `pwa/spec/6-1-appendix-changelog.md`
  - `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md`
  - `pwa/scripts/atlas_signal_review_tool.mjs`

### Closeout decision
- この lane は完了済み。
- checkout 全体は dirty 19ファイルが残るため `do not archive`。
