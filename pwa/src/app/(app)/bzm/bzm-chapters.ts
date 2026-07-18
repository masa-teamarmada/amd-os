/**
 * 教科書の目次メタデータ。
 *
 * 2026-06-13 全面改編 (まさ確定): 「章頭ストーリー型教科書」へ差し替え。
 *  - 章型 = 冒頭ストーリー → 解説 (数式・図を章内で出す) → 匿名化実例 → 章末の問い。
 *    詳細は `pwa/bzm/textbook/PUBLICATION_STRATEGY.md` §0。
 *  - 旧テキストブック (0-1〜9-4 の 24 章) は `pwa/bzm/legacy/` へ退避 (git 保全、表示はしない)。
 *    旧ナラティブ版 public-manuscript は `/bzm/public` でそのまま閲覧できる。
 *  - **slug は stable id**。part-chapter 番号を含めない (再配置に耐えるため)。
 *    表示番号は `applyBzmBookNumbering()` が BZM_PARTS の順に振る。
 *  - 章 md を追加したら、このファイルの BZM_PARTS / BZM_CHAPTERS に同じ commit で登録する。
 *    未登録の md は左ナビに出ない (prev/next 末尾には出る)。
 *
 * 内容正本は `pwa/bzm/{slug}.md` (= git 管理)。理論正本は
 * `BZSF/before_zero_theory.md` / `BZSF/SPS_STRATEGIC_SLACK_OVERVIEW_20260612.html`。
 */

export type BzmChapterStatus = "completed" | "in-progress" | "not-started" | "legacy";

/**
 * 目次階層:
 * 1 = 章 (例: Ch 5, Ch 5.5, Ch 6, ...) — bold で表示、indent 0
 * 2 = 節 (例: §5.0 章頭フック, §5.1 cross-walk 三定理, ...) — 通常 weight、indent 1 段
 * 3 = サブセクション (例: §5.0.1, §5.0.2, ...) — 細字、indent 2 段
 */
export type BzmChapterLevel = 1 | 2 | 3;

export interface BzmPartConfig {
  key: string;
  label: string;
  description: string;
  slugs: string[];
}

export interface BzmChapterConfig {
  slug: string;
  title: string;
  summary: string;
  status?: BzmChapterStatus;
  level?: BzmChapterLevel;
}

export interface BzmNumberedChapter extends BzmChapterConfig {
  number: string;
}

export const BZM_PARTS: BzmPartConfig[] = [
  // ============================================================
  // Book A 教科書『ディープテック起業の経営学』(仮題、PF-012 で 2026-07-03 起草開始)
  // — 15章 = 数式全部入り (PF-001)。L1 = pwa/bzm/BOOK_A_MASTER_PLAN.md。
  //   まさ指示 2026-07-03「Book A の最初の章から順に書いていく。OS の教科書ページから
  //   見れるようにして」により、起草中の主戦場として先頭配置 (モノグラフはその下)。
  //   2026-07-12: 新章「CEOという難問」(仮) 挿入で 15章→16章化 (TOC v2、PF-014 改定)。
  //   2026-07-16: Ch4(P) + Ch5(R) を統合し 16章→15章化 (TOC v3)。旧Ch6〜16は新Ch5〜15へ繰り上げ。
  // ============================================================
  {
    key: "book-a",
    label: "Book A 教科書 — ディープテック起業の経営学 (仮題、15章 ≈ 440p)",
    description: "理論の集大成テキスト (数式全部入り)。主対象 = MBA/MOT 院1年 + 学部3-4年ゼミ + URA/EIR/VC 研修。三項構造 (観測二層 SPS/ECR + 行動一層 RT) + 出口ポートフォリオ論 (看板、第14章)。15章構成。TOC v3 は BOOK_A_MASTER_PLAN.md 正本。",
    slugs: [
      "book-a-frontmatter",
      "book-a-ch-1",
      "book-a-ch-2",
      "book-a-ch-3",
      "book-a-ch-4-5",
      "book-a-ch-6",
      "book-a-ch-7",
      "book-a-ch-8",
      "book-a-ch-9",
      "book-a-ch-10",
      "book-a-ch-11",
      "book-a-ch-12",
      "book-a-ch-13",
      "book-a-ch-13-5",
      "book-a-ch-14",
      "book-a-ch-15",
      "book-a-backmatter",
    ],
  },

  // ============================================================
  // 新 BZM 本書 940p (Cambridge UP Schumpeter モノグラフ + Research Policy 特集号 + ICC 三経路)
  // — まさ確定 2026-06-27 で先頭配置だったが、PF-012 (2026-07-03) で起草主戦場の Book A を上に置く
  // ============================================================
  {
    key: "new-bzm-book0",
    label: "Book 0 — 序章 (70p, 6 章)",
    description: "Before Zero という領土の宣言。本書の射程 / 状態空間 / 四スクール継承 / 未engage 文献 / 二層 readiness 方法論 / 本書の貢献の三つ。",
    slugs: [
      "new-book0-ch-0-0",
      "new-book0-ch-0-1",
      "new-book0-ch-0-2a",
      "new-book0-ch-0-2b",
      "new-book0-ch-0-3",
      "new-book0-ch-0-4",
    ],
  },
  {
    key: "new-bzm-book1",
    label: "Book I — 領土の定義 (110p, 4 章)",
    description: "観測量と典型動学。状態空間 / SPS / ECR / 失敗パターンの抽象。",
    slugs: [
      // Ch 1 (= 章 level 1) → §1.0〜§1.7 (= 節 level 2) → §1.0.1〜 (= サブセクション level 3) の三層 (執筆中)
      "new-book1-ch-1",
      "new-book1-ch-1-section-0",
      "new-book1-ch-1-section-0-1",
      "new-book1-ch-1-section-0-2",
      "new-book1-ch-1-section-0-3",
      "new-book1-ch-1-section-0-4",
      "new-book1-ch-1-section-1",
      "new-book1-ch-1-section-2",
      "new-book1-ch-1-section-3",
      "new-book1-ch-1-section-4",
      "new-book1-ch-1-section-5",
      "new-book1-ch-1-section-6",
      "new-book1-ch-1-section-7",
      // Ch 2-4 (level 1 のみ、節レベル展開は執筆順序に応じて追加)
      "new-book1-ch-2",
      "new-book1-ch-3",
      "new-book1-ch-4",
    ],
  },
  {
    key: "new-bzm-book2",
    label: "Book II — 機構 (300p, 10 章 + Ch 10 11 節, load-bearing core)",
    description: "数学装置層。Triple Helix SSM / GO ゲート / SPS 期待値分解 / F-CES / 戦略余力動学 / ECR 加重和 / Ch 10 進化経済形式接続 / h パラメータ族 / 試験運用実装。",
    slugs: [
      // Ch 5 (= 章 level 1) → §5.0〜§5.7 (= 節 level 2) → §5.0.1〜 (= サブセクション level 3) の三層
      "new-book2-ch-5",
      "new-book2-ch-5-section-0",
      "new-book2-ch-5-section-0-1",
      "new-book2-ch-5-section-0-2",
      "new-book2-ch-5-section-0-3",
      "new-book2-ch-5-section-0-4",
      "new-book2-ch-5-section-1",
      "new-book2-ch-5-section-2",
      "new-book2-ch-5-section-3",
      "new-book2-ch-5-section-4",
      "new-book2-ch-5-section-5",
      "new-book2-ch-5-section-6",
      "new-book2-ch-5-section-7",
      // 他章 (level 1 のみ、節レベル展開は執筆順序に応じて追加)
      "new-book2-ch-5-5",
      "new-book2-ch-6",
      "new-book2-ch-7",
      "new-book2-ch-8",
      "new-book2-ch-9",
      "new-book2-ch-9-5",
      "new-book2-ch-10-0",
      "new-book2-ch-10-1",
      "new-book2-ch-10-2",
      "new-book2-ch-10-3",
      "new-book2-ch-10-4",
      "new-book2-ch-10-5",
      "new-book2-ch-10-6",
      "new-book2-ch-10-7",
      "new-book2-ch-10-8",
      "new-book2-ch-10-9",
      "new-book2-ch-10-10",
      "new-book2-ch-11",
      "new-book2-ch-11-5",
    ],
  },
  {
    key: "new-bzm-book3",
    label: "Book III — 動機付け事例とパターン・ライブラリ (200p, 16 章)",
    description: "8 PJ ケース + 5 機関ケース + 層間結合 3 章。TIEM / BWE / CX / SX / CTB / YD / JC / CLG / 機関 type 5 種 / Ch 25-26b。",
    slugs: [
      "new-book3-ch-12", "new-book3-ch-13", "new-book3-ch-14", "new-book3-ch-15",
      "new-book3-ch-16", "new-book3-ch-17", "new-book3-ch-18", "new-book3-ch-19",
      "new-book3-ch-20", "new-book3-ch-21", "new-book3-ch-22", "new-book3-ch-23", "new-book3-ch-24",
      "new-book3-ch-25", "new-book3-ch-26a", "new-book3-ch-26b",
    ],
  },
  {
    key: "new-bzm-book4",
    label: "Book IV — 時系列現場接続 (110p, 5 章)",
    description: "実践の背骨。掘り起こし / 第一歩 / GAP / 設立 / 資金調達。",
    slugs: [
      "new-book4-ch-27", "new-book4-ch-28", "new-book4-ch-29",
      "new-book4-ch-30", "new-book4-ch-31",
    ],
  },
  {
    key: "new-bzm-book5",
    label: "Book V — 機関側設計 (90p, 4 章)",
    description: "機関側プレイブック。ECR 8 軸別処方 / 三制度導線 / 地域 産学官 / 政策含意。",
    slugs: [
      "new-book5-ch-32", "new-book5-ch-33", "new-book5-ch-34", "new-book5-ch-35",
    ],
  },
  {
    key: "new-bzm-book6",
    label: "Book VI — 新領域宣言 (72p, 4 章)",
    description: "新領域宣言と次の研究プログラム。機関 KPI / 真正面の比較 / 自己批判とオープンプロブレム / 新領域宣言。",
    slugs: [
      "new-book6-ch-36", "new-book6-ch-37", "new-book6-ch-37-5", "new-book6-ch-38",
    ],
  },
  {
    key: "new-bzm-appendix",
    label: "付録 (160p, A/B/C)",
    description: "数学補遺 70p + データ仕様 55p + やらかし図鑑 35p。",
    slugs: [
      "new-appendix-a", "new-appendix-b", "new-appendix-c",
    ],
  },

  // ============================================================
  // 旧版アーカイブ (= 2026-06-13 章割で起草した実戦書素材、まさ確定 2026-06-28)
  // 新 BZM 本書 940p (Cambridge UP 学術モノグラフ) とは別の道として、現場運用に直接使える実戦的な内容を
  // ナラティブ + 道具集の形でまとめる本として構想。素材は 2026-06-13 章割で起草済み
  // (preface/field/model/nursery/toolkit)。学術書 (新 BZM 本書) で立てた理論を、
  // 実戦書で現場へ橋渡しする二段構えという企画自体はここでは判断しない。
  // 2026-07-18 追記 (まさフィードバック対応): Book A (上記) が完成し正本になったため、
  // 読者向け UI 表示は「[実戦書]」→「[旧版アーカイブ]」に変更。通読の入口 (/bzm) で
  // です・ます調の旧序文に当たって Book A と取り違えられる混乱を防ぐための表示替え。
  // 本文 md ファイルは削除せず保全する (履歴保全、実戦書としての将来出版可否は別途判断)。
  // ============================================================
  {
    key: "practical-preface",
    label: "[旧版アーカイブ] 序章 — この本の読み方",
    description: "旧版アーカイブ (Book A 完成前に 2026-06-13 章割で起草した実戦書素材) の序章。正本は上記 Book A。学術書 (新 BZM 本書) で立てた天井 × 到達 × 生存のモデルを、研究者・支援者・投資家の現場で明日から使える形にまとめようとした草稿。",
    slugs: ["preface"],
  },
  {
    key: "practical-field",
    label: "[旧版アーカイブ] 第 I 部 — Before Zero の現場",
    description: "旧版アーカイブの第 I 部 (現場誌)。会社になる前に何が起きるか、関係者の時計のズレ、不可逆点、誰が何を背負うかを現場目線で描く。学術書では Book I (Ch 1-4) として再編・形式化。",
    slugs: ["field-before-zero", "field-clocks", "field-gates", "field-who-carries"],
  },
  {
    key: "practical-model",
    label: "[旧版アーカイブ] 第 II 部 — Before Zero Model",
    description: "旧版アーカイブの第 II 部 (モデル説明)。SPS = 天井 P × 到達 R × 生存 S と戦略余力を、現場で使える形で説明する。学術書では Book II (Ch 5-11.5) として理論的に再編・拡張。",
    slugs: [
      "why-valuation-fails",
      "model-overview",
      "p-potential",
      "r-readiness",
      "s-survival",
      "score-and-bottleneck",
      "strategic-slack",
      "model-critiques",
      "retrofit-verification",
    ],
  },
  {
    key: "practical-nursery",
    label: "[旧版アーカイブ] 第 III 部 — 苗床",
    description: "旧版アーカイブの第 III 部 (ECR エコシステム構築率)。研究機関をベンチャーを生み育てる装置として読み、整備度の測り方と制度設計を扱う。学術書では Book III + Book V として再編される。",
    slugs: ["nursery-ers"],
  },
  {
    key: "practical-toolkit",
    label: "[旧版アーカイブ] 第 IV 部 — 実践ツールキット",
    description: "旧版アーカイブの第 IV 部 (実践道具集)。面談の問い、開示台本、判断チェックリスト、九十日 pilot charter など、明日から使える道具集。学術書では Book IV + 付録 B として再編される。",
    slugs: ["field-toolkit"],
  },
  {
    key: "practical-appendix",
    label: "[旧版アーカイブ] 巻末資料",
    description: "旧版アーカイブの巻末資料 (倫理・変更履歴)。著者性・利害・倫理への批判と附則。学術書では Ch 0.0 + 付録 として再編される。",
    slugs: ["ethics-and-authorship", "9-5-appendix-changelog"],
  },
  {
    key: "proposals_20260625",
    label: "[本文外] 設計提案 (2026-06-25)",
    description: "本書全体を Book 0-VI 構造に再設計する議論の記録。本文ではなく提案物。順序通り読むと: (1) 全体構造案 → (2) 既存章 → 新章 mapping → (3) Book II OPENER 構造手術 Rev 1 → (4) Rev 2。",
    slugs: [
      "2026-06-25_proposal_book0_vi",
      "2026-06-25_mapping_existing_to_new",
      "2026-06-25_book2_evol_econ_surgery",
      "2026-06-25_book2_evol_econ_major_revision",
    ],
  },
];

export const BZM_CHAPTERS: BzmChapterConfig[] = [
  // --- Book A 教科書 15章 (PF-012、L1 = BOOK_A_MASTER_PLAN.md、L3 = BOOK_A_CHAPTER_*_PROGRESS.md) ---
  // 巻頭・巻末は 2026-07-17 起草、2026-07-18 登録 (まさ 2026-07-18 フィードバック対応:
  // /bzm の入口が旧版アーカイブの序文に飛んでいた導線バグを塞ぎ、Book A を巻頭から巻末まで揃える)。
  { slug: "book-a-frontmatter", title: "序・凡例・記号一覧", summary: "「会社は、生まれる前に、いちばん多く死ぬ」から始まる序文。Before Zero の領土宣言、道具立ての由来、検証済みと仮説の峻別方針、そして全15章の記号・数式一覧 (凡例)。", status: "in-progress" },
  { slug: "book-a-ch-1", title: "第1章 — ディープテック起業と Before Zero — なぜ設立前を経営学の対象にするのか", summary: "章頭ケース「設立三周年の花束」(逆年表)。標準アントレ理論が「ゼロの後」から始まる射程の限界を示し、Before Zero の領土宣言・状態空間 (ι, F, D0, I)・三項構造 (観測二層 SPS/ECR + 行動一層 RT) を本書15章の地図として提示。22p。v1 確定 (まさレビュー完了)。", status: "completed" },
  { slug: "book-a-ch-2", title: "第2章 — 関係者の時計と不可逆点 — 開示の順序・法人化境界・進める/待つ/止めるの語彙", summary: "関係者×関心×時計の地図、三つの不可逆点 (開示順序・会社化タイミング・早すぎる CEO 要求)、GO/WAIT/NO_GO/HOLD と WAIT の3部品。意図的に数式ゼロの回 (数式強度曲線の起点)。24p。v1 確定 (まさレビュー完了)。", status: "completed" },
  { slug: "book-a-ch-3", title: "第3章 — 評価問題の定式化 — Valuation の限界と期待値分解 M×P×R×S", summary: "DCF が Before Zero で壊れる四つの壁を示し、評価問題を E[V] = P×R×S へ定式化し直す。乗法/加重和/補完性の3層対応表を導入。26p。起草中 (v1 draft)。", status: "in-progress" },
  { slug: "book-a-ch-4-5", title: "第4章 — 外の必要と内の到達 — M と R を観測で採点する", summary: "現行第4章(P)と第5章(R)を統合する章。中心命題: 事業は外の必要(M)と内の到達(R)の積で動き、どちらも他方の代わりにならない。章頭(4.0)は断熱素材のサンプルのなりゆきを通じて M と R を観測で採点する場面を描く (まさ承認済み)。市場の天井(P)は第3章へ前方参照。理論本文(4.1以降)は執筆中。54p目安。", status: "in-progress" },
  { slug: "book-a-ch-6", title: "第5章 — 生存の静学 — 生存条件式と創業者機能 F-CES", summary: "生存は残り時間ではなく、自分の手で稼ぎながら学習し続ける力で測る。生存条件式 B−R_net≤F と F 内部の CES 補完 (資質×実行力は両方必須) — 3層対応表の中核回。30p。起草中 (v1 draft)。", status: "in-progress" },
  { slug: "book-a-ch-7", title: "第6章 — マクロ追い風の計測 — Triple Helix と投入シグナル σ_SU", summary: "「追い風」を雰囲気でなく観測量にする: σ_SU の Triple Helix Cobb-Douglas 構成と状態空間モデルの直感。ハイプと真の進展、揃った風と乖離の先行窓を識別する。28p。起草中 (v1 draft)。", status: "in-progress" },
  { slug: "book-a-ch-8", title: "第7章 — 生存の動学 — 戦略余力と first-passage 生存確率", summary: "(x, y) 平面と y = 主導権を保って走れる残り月数 (5成分・単位=月)。S = Pr(τ_x < τ_y) の first-passage 定式化と Excel モンテカルロ。軌跡4型 (鋸歯/ゾンビ/即落/自走)。32p。起草中 (v1 draft)。", status: "in-progress" },
  { slug: "book-a-ch-9", title: "第8章 — 統合スコアと律速診断 — 乗法モデルの設計と校正", summary: "9軸 Cobb-Douglas 乗法 (+1 シフト) 統合と律速診断 (次の一手の機械的抽出)。なぜ足し算でなく掛け算か。採点ワークシートで中間課題に接続。28p。起草中 (v1 draft)。", status: "in-progress" },
  { slug: "book-a-ch-10", title: "第9章 — GO/WAIT/NO_GO — 最適停止としての設立判断 (SPS≠GO)", summary: "設立判断を実物オプションの最適停止として導出: GO(t,i) = 𝟙[σ_SU ≥ θ_σ*]·g_TRL(t)。SPS≠GO の1ページ図解正本と必須演習「SPS 高だが WAIT」。「やめる/待つ」を教える本書の差別化の核。30p。", status: "in-progress" },
  { slug: "book-a-ch-11", title: "第10章 — 苗床を測る — エコシステム構築率 ECR の8軸と加重和", summary: "案件を生み出す装置を測る第二の観測層。ECR 加重和 (充足率)・8軸 rubric・軸7のゲート性・unknown vs not_started。「張るのは案件、通うのは苗床」。28p。", status: "in-progress" },
  { slug: "book-a-ch-12", title: "第11章 — 二層非可換性 — 案件と機関を混ぜてはいけない理由", summary: "SPS (乗法・案件) と ECR (加重和・機関) を単一スコアへ結合してはならないことを、公理 A1-A4 の不可能性定理ステートメント+証明スケッチと Simpson 反転 worked example で示す「読む数学」の回。26p。", status: "in-progress" },
  { slug: "book-a-ch-13", title: "第12章 — ラウンドテーブル — 二層を結合する組成機構 [仮説的第三柱]", summary: "RT = Before Zero の DTSU を keystone に据えた多者・連鎖・相互牽制の共同体 ℛ。成立3条件の命題化・CRL/ICT レンズ・Ψ 分解仮説 (検証プログラム付き仮説と明示)。独禁注意喚起 Box 必置。32p。", status: "in-progress" },
  { slug: "book-a-ch-13-5", title: "第13章 — CEOという難問 — 機能は分割できても、愛情の総量だけは外注できない", summary: "章頭は「肩書のまま決める機能を失った男」(一枚の組織図)。CEO 像の通時変化・制度と市場の不整合・機能分割 (第5章 §5.7 の実務適用)・エバンジェリスト機能の非外注性・育成可能性・肩書だけの CEO という7つの問いを実話で辿り、Before Zero から法人化後までの一気通貫供給を解として示す「問い×実話」変奏章。AMD の実践は序章/あとがき/著者性 Box でのみ明かす (a案)。26p。", status: "in-progress" },
  { slug: "book-a-ch-14", title: "第14章 — 出口ポートフォリオ — シーズごとに正しいサイズの成功を", summary: "本書の看板主張: ユニコーン単願ではなく出口ポートフォリオを設計する。絶対スケール+達成率の2読み方式の正準オーナー回。「サイズを選ぶ」という第三の判断。26p。起草中 (理論パート 14.1-14.9 正本化済み、章頭 14.0 は別途)。", status: "in-progress" },
  { slug: "book-a-ch-15", title: "第15章 — 検証と限界 — 総合演習: モデルを疑いながら使う", summary: "後付け校正と検証の峻別 (Tier 規律)、blind retrofit、反証条件リスト = BZM の可死性の明文化。総合演習 = 期末課題 (フル評価レポート)。「モデルは信じるものではなく検証するもの」で本を閉じる。28p。", status: "in-progress" },
  { slug: "book-a-backmatter", title: "読書案内と索引", summary: "全15章の文献をテーマ別に組み直した読書案内と、記号・用語の索引。巻末パッケージ初版 (2026-07-17)、第11〜15章のまさレビュー後に本文追随が必要な暫定版。", status: "in-progress" },

  {
    slug: "preface",
    title: "序章 — この本の読み方",
    summary: "誰のための本か、四部構成で何が手に入るか、どこから読むか、本書が約束しないこと。実例はすべて匿名化 composite であることの明記。",
  },
  {
    slug: "field-before-zero",
    title: "Before Zero — 会社になる前に勝負が決まる",
    summary: "技術が強く、制度も人もあるのに事業化が止まるのはなぜか。会社が生まれる前の時間「Before Zero」を定義し、七つの不確実性の地図と、早すぎる設立・遅すぎる決断の両側を示す開幕章。",
  },
  {
    slug: "field-clocks",
    title: "関係者の時計 — 善意のズレが研究者を孤立させる",
    summary: "研究者・大学・企業・VC・行政・支援者は別々の関心と時計で動く。悪意なき「正しい圧力の未調整」が研究者を急がせ孤立させる構造と、相手の時計から逆算する会話設計。",
  },
  {
    slug: "field-gates",
    title: "不可逆点 — 進める、待つ、止めるを分ける",
    summary: "外部開示の順序、会社化のタイミング、CEO機能の早すぎる要求。GO/WAIT/NO_GO/HOLD の語彙で空気から判断を取り戻し、戻る条件を書いた WAIT が未来の GO を作る。",
  },
  {
    slug: "field-who-carries",
    title: "誰が何を背負うのか — 創業者機能の分解と、失敗を学習に変える",
    summary: "最後に研究人生を背負うのは研究者一人。創業者機能を五つに分解し「誰が・いつまで・どこまで」を九十日メモで合意する方法と、失敗を判断ルールへ変える記録の粒度。",
  },
  {
    slug: "why-valuation-fails",
    title: "何を解くか — Valuation は Before Zero でなぜ機能しないのか",
    summary: "「5年後売上30億円」は何を測っていたのか。期待を単一値に圧縮する Valuation が設立前に突き当たる四つの壁を解き、天井P×到達R×生存Sの骨格を示す開幕章。",
  },
  {
    slug: "model-overview",
    title: "全体像 — 天井 × 到達 × 生存",
    summary: "評価は「天井P×到達R×生存S」の積で読む。判定層と動学層の二層構造、戦略余力を軸でなく動学に置く理由、モデル進化の三世代を一望する章。",
  },
  {
    slug: "p-potential",
    title: "潜在規模 P — 天井の大きさと、証拠の質",
    summary: "最大限うまくいったときの経済的インパクトの天井 P。市場規模の主張の大きさではなく証拠の質で測り、天井そのものを戦略で書き換える打ち手までを扱う。",
  },
  {
    slug: "r-readiness",
    title: "到達度 R — 不可逆な達成の蓄積",
    summary: "「技術はできています」は五枚に割れる。TRL/BRL/GRL/SRL/HRL の五軸と Yes/No 観測項目、研究室と自社の TRL ギャップ、達成 R と消費資源 y の線引き。",
  },
  {
    slug: "s-survival",
    title: "生存確率 S — 死なずに、主導権を保って走り切れるか",
    summary: "死因第一位「本命が整う前の資金切れ」を測る因子 S。生存条件式 B−R_net≤F、互いに補い合う三要素、資質×経営実行力の CES 合成、設立を遅らせる選択肢。",
  },
  {
    slug: "score-and-bottleneck",
    title: "計算式と律速診断 — 9つの軸をひとつの判断へ",
    summary: "9軸を +1 シフトの Cobb-Douglas 積で統合スコアへ。重み α と K の校正、律速診断 argmax α/(X+1) で「次の一手」を機械的に取り出す。手計算の例題つき。",
  },
  {
    slug: "strategic-slack",
    title: "戦略余力 — 主導権を保って走り切る",
    summary: "事業化到達度 × 戦略余力の (x, y) 平面。y=0 主導権喪失ライン、鋸歯の補充、交渉力と KPI、開示 Lv1〜4、出口設計 (ライセンス vs 自社事業化)。",
  },
  {
    slug: "model-critiques",
    title: "モデルの限界と批判 — この物差しが測れないもの",
    summary: "割引率の三つの仕事のうち S が肩代わりできるのは失敗リスク補正だけ。経済学からの5批判・経営学からの6批判を正面から認め、道具が役に立つ条件を明確にする。",
  },
  {
    slug: "retrofit-verification",
    title: "検証 — 過去の軌跡がモデルを鍛える",
    summary: "モデルは信じるものではなく検証するもの。blind retrofit と事前予測で後知恵を断ち、見送り案件を対照群に、軌跡の型と R/y の線引きを実データで確かめる。",
  },
  {
    slug: "nursery-ers",
    title: "苗床 — 研究機関は、ベンチャーを生み育てる装置になっているか",
    summary: "同じシーズでも機関の土壌で事業化速度はまるで違う。エコシステム構築率を8軸×Lv1〜5で測る ECR、案件評価 (掛け算) と異なる加重和を採る理由、弱い軸の外部連携と90日 pilot。",
  },
  {
    slug: "field-toolkit",
    title: "実践ツールキット — 明日の面談から使う道具",
    summary: "初回面談の問いから機関の九十日 pilot まで、本書各章の考え方を現場の紙に落とした七つの道具集。いつ使うか・道具本体・注意の順で参照できる。",
  },
  {
    slug: "ethics-and-authorship",
    title: "著者性・利害・倫理 — この本はどこから語っているのか",
    summary: "出版時に問われる著者の立場、利害関係、匿名化実例、当事者経験の扱い、評価バイアス、研究者の主導権、執筆責任への批判を巻末で正面から扱う補論。",
  },
  {
    slug: "9-5-appendix-changelog",
    title: "附則（テキストブック変更履歴）",
    summary: "教科書の追加・変更・削除を日付つきで残す append-only の変更履歴。",
  },
  {
    slug: "2026-06-25_proposal_book0_vi",
    title: "本書 Book 0-VI 構造再設計案 (synth 出力)",
    summary: "870 ページ / 18 ヶ月の Tier 3 学術モノグラフとして本書を Book 0-VI + 付録に作り直す案。5 経済学者批判と整合性監査を吸収した synth が出した最終 TOC + 中核命題 + 18 chunk 詳細 + まさへの開放論点。設計提案の読み始め。",
  },
  {
    slug: "2026-06-25_mapping_existing_to_new",
    title: "既存章 → 新 Book 0-VI 配置 mapping (節レベル)",
    summary: "既存 13 章 md の 194 節を、新 Book 0-VI 構造の 37 章にどう配置するかを節レベルで対応付け。新章ごと統合 view と既存グループごと解体 view の二視点。執筆時の素材棚として使う。",
  },
  {
    slug: "2026-06-25_book2_evol_econ_surgery",
    title: "Book II OPENER 構造手術 Rev 1 — 進化経済批判 NO → 条件付き受理",
    summary: "5 経済学者批判で唯一 NO だった進化経済査読を条件付き受理に動かす構造手術。Ch 10 を Book II の OPENER に移し、BZM の進化経済学への 3 寄与 (B 起動時の τ_x レジーム切換え / F-CES の委譲不可コア / 二層非可換性) を形式的に書き起こす。",
  },
  {
    slug: "2026-06-25_book2_evol_econ_major_revision",
    title: "Book II OPENER 改訂 Rev 2 — 条件付き受理 → 軽微修正 (受理可)",
    summary: "Rev 1 で残った 6 条件 (C2/C3 強化、Murmann/Klepper/Malerba との形式的接続、t* ファジー境界、N≈32 試験データ設計) に対応した改訂版。進化経済査読が軽微修正に動き、Cambridge UP Schumpeter モノグラフ + Research Policy 特集号への二段構え publication path が確定。",
  },
  // --- 新 BZM 本書 940p 全章 entry (status field 付き、執筆順序 D-007) ---

  // Book 0 — 序章 (70p, 6 章)
  { slug: "new-book0-ch-0-0", title: "Ch 0.0 — 本書の射程と匿名化方針", summary: "何を主張し、何を主張しないか。(a) deep-tech, (b) 日本の大学・国研文脈, (c) Before Zero 段階に scope を限定。普遍的アントレプレナーシップ一般理論として主張しない。8p。", status: "not-started" },
  { slug: "new-book0-ch-0-1", title: "Ch 0.1 — Before Zero 領土宣言", summary: "状態空間 (ι, F, S0, I) と二層観測。14p。", status: "not-started" },
  { slug: "new-book0-ch-0-2a", title: "Ch 0.2a — 四スクールからの継承", summary: "Shane / Sarasvathy / Etzkowitz / Nelson-Winter からの理論的継承。18p。", status: "not-started" },
  { slug: "new-book0-ch-0-2b", title: "Ch 0.2b — 未engage の文献群", summary: "Reynolds-Curtin PSED I/II / Stam-van de Ven entrepreneurial ecosystems / Cohen-Levinthal ACAP / Teece dynamic capabilities を未engage 文献として処理。10p。", status: "not-started" },
  { slug: "new-book0-ch-0-3", title: "Ch 0.3 — 二層 readiness 方法論", summary: "宣言形 (導出は Book II)。Nelson-Winter 選抜環境本格展開はここ (Ch 5.0/5.3 から逆流委託、D-048)。12p。", status: "not-started" },
  { slug: "new-book0-ch-0-4", title: "Ch 0.4 — 本書の貢献の三つ", summary: "何を新規に主張するか。load-bearing 定理 (二層非可換性 / GO 最適停止 / F-CES) の front-load 予告。8p。", status: "not-started" },

  // Book I — 領土の定義 (110p, 4 章)
  { slug: "new-book1-ch-1", title: "Ch 1 — 状態空間と観測量", summary: "Before Zero を測るとはどういうことか。状態空間 (= プロジェクトを 1 点として打つ多次元の空間)、観測量 (= 状態から漏れ出てくる代理指標)、二層観測 (= 案件層 SPS + 機関層 ECR) の足場を立てる章。30p。執筆中 (§1.0 章頭フックから着手)。", status: "in-progress", level: 1 },
  // Ch 1 節レベル (level 2) — Workflow wlewsdw8l outline 由来
  { slug: "new-book1-ch-1-section-0", title: "§1.0 — 章頭フック: 三人の起業家、三つの「測れなさ」 (2.5p)", summary: "Ch 1 全体と §1.0 章頭フックの入口。Zero = 会社を設立する瞬間 / Before Zero = ゼロより前という本書の核心定義を確定し、ゼロイチ本との対比から本書独自の位置取りを示す。会社未満の時間にこそその後の十年を左右する判断 (誰と組むか / 応用領域 / 法人化タイミング / 知財帰属) が詰まること、製品 0・売上 0・会社未満で「測る」という奇妙な営みの中心問いを立てる。4 サブセクション §1.0.1〜§1.0.4 (場面 → ずれの正体 → 三つの実務的要請 → ロードマップ) を一望し、月曜の国立大学キャンパスの一室へと §1.0.1 へ橋渡しする節の冒頭文 (1,380 字 4 段落、完成)。", status: "completed", level: 2 },
  { slug: "new-book1-ch-1-section-1", title: "§1.1 — 「測る」とは何をすることか: 状態・観測・推定の三項 (4p)", summary: "対象物理学的な「測定」と社会経済的な「測定」の違いを整理し、状態 (見えない) と観測量 (見える) と推定 (橋渡し) という三項関係を Before Zero 文脈で定義する。", status: "not-started", level: 2 },
  { slug: "new-book1-ch-1-section-2", title: "§1.2 — 状態空間 (state space) という発想: プロジェクトを 1 点として打つ (5p)", summary: "プロジェクトを多次元空間の 1 点として捉える視点を導入し、本書が採用する三因子 (天井 P、到達度 R、生存確率 S) の状態ベクトルを比喩と図で説明する。", status: "not-started", level: 2 },
  { slug: "new-book1-ch-1-section-3", title: "§1.3 — 観測量 (observable) と代理指標: 見えないものを見える数で挟む (5p)", summary: "状態は直接観測できないため、論文数・特許・調達額・採用ペース等の代理指標を経由する必要があることを示し、観測量の選び方が推定の質を決めることを論じる。", status: "not-started", level: 2 },
  { slug: "new-book1-ch-1-section-4", title: "§1.4 — Before Zero がとりわけ難しい理由: 製品 0・売上 0・会社未満の観測問題 (5p)", summary: "売上・顧客・製品がまだ存在しない段階での観測の困難 (シグナル/ノイズ比の低さ、survivorship bias、観測コスト) を整理し、それでも測る必要性を関係者間の共通言語・判断の構造化・再現可能性の三点で示す。", status: "not-started", level: 2 },
  { slug: "new-book1-ch-1-section-5", title: "§1.5 — 二層観測の予告: 案件層 (SPS) と機関層 (ECR) (4p)", summary: "個別案件 j を見る層 (SPS = Seed Prospect Score) と、機関 i の生態を見る層 (ECR = Ecosystem Construction Rate) という二層構造を予告し、Ch 2 と Ch 3 への接続を示す。", status: "not-started", level: 2 },
  { slug: "new-book1-ch-1-section-6", title: "§1.6 — 失敗パターンと校正: 観測が壊れるとき (3p)", summary: "観測量と状態のリンクが切れる典型失敗 (Goodhart 化、観測の自己実現、欠測の系統性) を提示し、Ch 4 (失敗パターン) と Book III (validation) への送りを置く。", status: "not-started", level: 2 },
  { slug: "new-book1-ch-1-section-7", title: "§1.7 — 本章のまとめと Book II への橋渡し (1.5p)", summary: "本章で立てた状態空間と観測量の足場を、Book II 機構層 (天井動学・到達動学・生存動学の数学装置) がどう引き取るかを 1 ページで予告する。", status: "not-started", level: 2 },
  // Ch 1 §1.0 サブセクション (level 3)
  { slug: "new-book1-ch-1-section-0-1", title: "§1.0.1 — 同じ問いの前で立ち尽くす三人 (章頭場面)", summary: "2024 年初秋の一週間に開かれた三つの面談 (月曜 国立大学産学連携本部 A 氏 / 水曜 都内 VC B 氏 / 金曜 地方公設試 C 氏) を blockquote 並置。三者三様の領域・段階・相手だが、底に流れる同じ問い「いま、このプロジェクトは、どこにいるのか」。Before Zero / 状態 (state) / 観測量 (observable) を直後括弧定義、Kalman 1960 / Stokey-Lucas-Prescott 1989 / Simon 1962 引用、軽い式 $s_t = (P_t, R_t, S_t)$ + $y_t = g(s_t) + \\varepsilon_t$ を display で。完成 v1 (約 2,390 字 5 段落、まさレビュー待ち)。", status: "completed", level: 3 },
  { slug: "new-book1-ch-1-section-0-2", title: "§1.0.2 — ずれの肥大: 状態と観測量の差が Before Zero で開く理由", summary: "翌週月曜の A 氏 (= ペロブスカイト准教授) と URA の小部屋場面を冒頭 blockquote に、まさが提供した具体的セリフ (「引用してくれるのが、ほとんど同じ研究室の出身者か、同じ学会の旧知の先生方ばっかり」「サンプル提供のお問い合わせ件数、去年の同じ時期の三分の一」「指標は伸びてるのに、引き合いだけが落ちてる。理屈が合わないんですよ」) で前 v1 の「外に出せる気がしない」hallucination を完全除去。観測ギャップ (observation gap) 概念を、写像 g のつぶれ + ノイズ ε + 選抜歪み + 観測本数の少なさの四つの圧力に分解。display 式 $y_t = g(s_t) + \\varepsilon_t$ + $\\mathrm{Var}(y_t) = \\mathrm{Var}(g(s_t)) + \\mathrm{Var}(\\varepsilon_t)$ (独立性仮定下の標準分解、射程明示の留保つき)。曇りガラス越しに人影 + 窓のメタファ (g 写像 / ノイズ / 枚数) の比喩。Polanyi 1966 / Heckman 1979 / Goodhart 1975 / Cover-Thomas 2006 引用 (全 4 件新規系譜)。批判 panel + adversarial reviewer 9 must_fix 全反映。v2 完成 (約 3,050 字 6 段落、まさレビュー待ち)。", status: "completed", level: 3 },
  { slug: "new-book1-ch-1-section-0-3", title: "§1.0.3 — 測らない自由はない: 共通言語・判断の構造化・再現可能性", summary: "翌週月曜朝、地方合同庁舎三階の給湯室で、C 氏 (= 公設試の主任研究員、陸上養殖) と新キャラ D 氏 (= 同じ公設試の食品加工チームの先輩研究員) の対話を冒頭 blockquote に。セリフが完全に現場感: 「結局、担当官の方に『で、C さんとしてはどう思います』って逆に振られて、何も言えなかったんですよ」「先月の問い合わせ三件のうち二件は既存取引先だった、ってとこまでしか話せてなくて」「来年俺が異動になったら、養液の循環、なんで今のやり方に変えたか、たぶん誰も説明できなくなるんですよ」。観測の手続きが背負わされた三脚 (共通言語 / 判断の構造化 / 再現可能性) を立てる。display 式 $\\mathbb{E}[L(d,s)|y] = \\int L(d, s) p(s|y) ds$ で「観測しない = 事後分布を事前に縮退」を支える。Hayek 1945 (市場価格を典型例とする調整機構) / Simon 1955 (限定合理性) / Popper 1959 (intersubjective testability 経由で再現可能性に翻訳、原著 Logik der Forschung 1934) / Knight 1921 (主観確率で不確実性に対処) 引用、§1.0.1+§1.0.2 既出を完全回避。「自選バイアスは三脚を立てるだけでは取り除けません (= §1.2 以降)」留保 + 「測らない自由はない。だからこそ、どう測るかを決める手前で、何のために測るのかを先に決める必要があります」クロージング。批判 panel + adversarial reviewer 9 must_fix 全反映。v2 完成 (約 2,790 字 6 段落、まさレビュー待ち)。", status: "completed", level: 3 },
  { slug: "new-book1-ch-1-section-0-4", title: "§1.0.4 — 本章の道筋: 二項関係を二層に開く", summary: "§1.0 全体を閉じるロードマップ章 (冒頭 blockquote 省略)。第 1 段落で §1.0.1 の三人 (= 月曜午前ペロブスカイト准教授 A 氏 / 水曜午後創薬ポスドク B 氏 / 金曜夕方陸上養殖公設試研究員 C 氏) を thin 再導入で呼び戻し、§1.0.1〜§1.0.3 の後方参照を行う。§1.1 = 三項関係 + 尺度水準 / §1.2 = 状態空間 P×R×S / §1.3 = 観測量 y = g(s) + ε / §1.4 = Before Zero 観測問題 / §1.5 = 二層観測 (案件層 SPS + 機関層 ECR) / §1.6 = 校正 / §1.7 = Book II 機構層への橋。display 式 $\\mathrm{SPS}_t = P_t \\times R_t \\times S_t$ + $\\mathrm{ECR} = 100 \\cdot \\frac{\\sum_k w_k A_k}{\\sum_k w_k}$ (SPS は [0,1] 正規化、ECR は 0-100 スケール、尺度の違い自体が SPS×ECR 一本化禁止の伏線)。乗法 vs 加重和の対比を C 氏の陸上養殖を例に解説。クロージングで三人を呼び戻し、まさのセリフ案 (「論文は通るけど、共同研究の声がかからない」/「データは出てるんだけど、製薬企業からの引き合いが続かない」/「指標は良くなってるんだけど、社会実装のスジが見えない」) を本文に組み込んで s-survival 末尾オマージュ「あの違和感に答える章が、ここから始まります」で §1.0 全体を閉じる。学術引用は本文に出さず「§1.1 / Ch 3 で示します」と先送り (ロードマップ章での引用密度最小化)。批判 panel + adversarial reviewer must_fix 全反映。v2 完成 (約 2,260 字 5 段落、まさレビュー待ち)。", status: "completed", level: 3 },
  { slug: "new-book1-ch-2", title: "Ch 2 — SPS — 天井 × 到達 × 生存の概念体系", summary: "SPS = P × R × S。30p。", status: "not-started" },
  { slug: "new-book1-ch-3", title: "Ch 3 — ECR — 苗床という第二の対象", summary: "含: unknown vs not_started 区別の正準オーナー = Ch 3.5。30p。", status: "not-started" },
  { slug: "new-book1-ch-4", title: "Ch 4 — 失敗パターンの抽象", summary: "Book II 数学装置への索引 (前方参照ティーザー)。20p。", status: "not-started" },

  // Book II — 機構 (272p, 9 章 + Ch 10 11 節)
  { slug: "new-book2-ch-5", title: "Ch 5 — Triple Helix SSM と σ_SU の生成", summary: "Cobb-Douglas σ_SU = ∛((μ_A+1)(μ_I+1)(μ_G+1)) - 1, K=3 MS-SSM (S₀/S₁/S₂), Π^pre/Π^post 二段, η_jt softmax coupling, cross-walk 三定理。Ch 5.1 = Leydesdorff mutual information T(AIG) との cross-walk。28p heavy 数学。執筆中 (§5.0 章頭フックから着手)。", status: "in-progress", level: 1 },
  // Ch 5 節レベル (level 2)
  { slug: "new-book2-ch-5-section-0", title: "§5.0 — 章頭フック (2.5p)", summary: "CX vs YD の対照観察を起点に、4 サブセクションで Ch 5 全体の動機を立てる。§5.0.1 対照的な二領域 / §5.0.2 CX 三位一体加速 / §5.0.3 対照事例 YD と σ_SU 必要条件性 / §5.0.4 方法論的位置取りと境界宣言。", status: "in-progress", level: 2 },
  { slug: "new-book2-ch-5-section-1", title: "§5.1 — cross-walk 三定理 (5p)", summary: "Leydesdorff の Triple Helix 相互情報量 T(AIG) と Cobb-Douglas σ_SU の cross-walk。定理 5.1.1-5.1.3 + 系 5.1.4。BZM の Triple Helix 文献への貢献 1 (事業化用途 CD 採用の理論的根拠化)。", status: "not-started", level: 2 },
  { slug: "new-book2-ch-5-section-2", title: "§5.2 — 観測方程式と loading matrix C (5p)", summary: "7 観測量 (P/B/V/R/I_R/N/C_compete) と loading 行列 C、三段識別補題 5.3、命題 5.3b (逐次識別順序 μ_G→μ_A→μ_I)、Phase 2 欠損下の識別パワー。", status: "not-started", level: 2 },
  { slug: "new-book2-ch-5-section-3", title: "§5.3 — σ_SU の Markov 切換え状態空間モデル正準形 (5p)", summary: "命題 5.1 (K=3 MS-SSM 正準形)、命題 5.1b (CD 合成 operator G[μ_t; ω])。Hamilton (1989)-Kim (1994) filter の Triple Helix 適用。Nelson-Winter 選抜環境節 (D-048 圧縮 2/3)。", status: "not-started", level: 2 },
  { slug: "new-book2-ch-5-section-4", title: "§5.4 — τ_B 不連続 shift Π^pre ≠ Π^post と Jovanovic/Klepper supply (4p)", summary: "命題 5.5 (τ_B 不連続 shift)、Jovanovic (1982) 退出ハザード coupling、Klepper (1996) shakeout 対称二相、Pakes-Ericson active/passive learning。", status: "not-started", level: 2 },
  { slug: "new-book2-ch-5-section-5", title: "§5.5 — 制度状態 η_jt と σ_SU の coupling (2.5p)", summary: "命題 5.6 (η_jt softmax coupling Π(η_jt))、Murmann (2003) 共進化への pre-form、F-5.6 (η_E Granger 先行関係) commission。", status: "not-started", level: 2 },
  { slug: "new-book2-ch-5-section-6", title: "§5.6 — 装置を当てる: CX/YD への適用と 8 PJ generalizability (3p)", summary: "Kalman + Hamilton-Kim joint filter、CX の (μ_A, μ_I, μ_G) 3 レーン分解、CX regime posterior S₁→S₂、YD regime S₀ stuck、SIP CE2023 政策→産業→学術 Granger 先行関係。", status: "not-started", level: 2 },
  { slug: "new-book2-ch-5-section-7", title: "§5.7 — Triple Helix 文献への 3 貢献確定 + 下流章 supply + 章末問い (1p)", summary: "貢献 1 (CD 理論的根拠化) / 貢献 2 (SIP CE2023 5RL 体系接続) / 貢献 3 (regime-switching SSM 化)。Ch 26b への F-5.1〜F-5.6 commission、horse-race protocol 確定、章末の問い。", status: "not-started", level: 2 },
  // Ch 5 §5.0 サブセクション (level 3)
  { slug: "new-book2-ch-5-section-0-1", title: "§5.0.1 — 対照的な二領域と政策密度 P の段階的上昇", summary: "2020Q4-2023Q4 の同一窓に CX (カーボンニュートラル/GX) 系と YD (養殖/フード) 系を並置観察。片方は Triple Helix 三レーンが同位相加速し σ_SU が本書最高水準、他方は政策密度 P_t が立ち上がらず σ_SU 低位張り付き。非対称の起点 = 2020/10/26 CN 宣言。MS-SSM への動機素材。完成 v3 (2,280 字、5 段落、まさレビュー反映済み)、引用+式入りの v4 起草中。", status: "completed", level: 3 },
  { slug: "new-book2-ch-5-section-0-2", title: "§5.0.2 — CX 三位一体加速の事実構造", summary: "GX 経済移行債・GX-ETS・SIP CE 第3期の連続立ち上げによる公募予算 B 並走、CVC/VC 脱炭素配分 V ピーク、論文 N + 研究費 I_R 連動上昇、政策-研究ラグ 8-12Q → 4-6Q 縮減、σ_SU 本書最高水準到達 (S₂ レジーム予告)。1,500-2,000 字。", status: "not-started", level: 3 },
  { slug: "new-book2-ch-5-section-0-3", title: "§5.0.3 — 対照事例 YD と σ_SU の必要条件性", summary: "YD 系領域 μ_G フラット、Cobb-Douglas 幾何平均構造による σ_SU 抑制、AMD OS UE 律速 NO_GO、σ_SU は GO の必要条件であって十分条件ではない (二層非可換性入口)、K=3 レジーム S₀/S₁/S₂ 物語的予告。1,500-2,000 字。", status: "not-started", level: 3 },
  { slug: "new-book2-ch-5-section-0-4", title: "§5.0.4 — 方法論的位置取りと本章境界宣言", summary: "Markov イベント記述妥当性、Nelson-Winter 選抜環境への意味論的橋渡し (D-048 圧縮、Book 0 Ch 0.3 へ逆流)、Ch 5 射程と他章への委託、load-bearing 命題 5.1/5.1b/5.3b/5.5/5.6 + cross-walk 三定理 + 系 5.1.4 の予告、§5.1 D-047 pre-commit への橋渡し。1,500-2,000 字。", status: "not-started", level: 3 },
  { slug: "new-book2-ch-5-5", title: "Ch 5.5 — GO ゲートの導出", summary: "実オプション最適停止からの一次条件。GO(t,i) = 𝟙[σ_SU ≥ θ_σ*] · g_TRL(t)、θ_σ* は (P, F, B, レジーム遷移) に対して内生的。18p。", status: "not-started" },
  { slug: "new-book2-ch-6", title: "Ch 6 — SPS = P × R × S 期待値分解", summary: "honest 位置付け。22p。", status: "not-started" },
  { slug: "new-book2-ch-7", title: "Ch 7 — S の内部構造 — F-CES と委譲不可能コア", summary: "F = CES(F_char, F_cap; a, ρ)。形式定義 + 校正手続き。38p。", status: "not-started" },
  { slug: "new-book2-ch-8", title: "Ch 8 — 戦略余力動学", summary: "2D jump-diffusion と τ_x/τ_y、y 5 成分集約 (cash/moat/trust/options/focus)。32p。", status: "not-started" },
  { slug: "new-book2-ch-9", title: "Ch 9 — ECR 加重和の導出", summary: "ECR = 100 · Σ w_k A_k / Σ w_k。二層非可換性定理の代数的バックボーン。34p。", status: "not-started" },
  { slug: "new-book2-ch-9-5", title: "Ch 9.5 — ラウンドテーブル — 二層を結合する組成機構", summary: "RT を仮説的第三柱として組み込む新章 (D-056)。組 ℛ の形式定義 / 成立3条件の命題化 (多者性・連鎖性・相互牽制) / 観測レンズ CRL・ICT / 排他的主経路割当と leave-one-out / 仮説 9.5.H (Ψ 分解 = Murmann coupling の法人化前カーネル)。28p。skeleton ステージ2確定済 (D-057)。", status: "not-started" },
  { slug: "new-book2-ch-10-0", title: "Ch 10.0 — プロローグ", summary: "物語的橋渡し。", status: "not-started" },
  { slug: "new-book2-ch-10-1", title: "Ch 10.1 — 設定 — 6 軽微修正課題 C1-C6 と本章の射程", summary: "進化経済 persona 軽微修正 6 件。", status: "not-started" },
  { slug: "new-book2-ch-10-2", title: "Ch 10.2 — C1 レジーム切換え B (法人化境界) の formal definition", summary: "Jovanovic (1982) noisy selection の二レジーム拡張。", status: "not-started" },
  { slug: "new-book2-ch-10-3", title: "Ch 10.3 — C2 F-CES ρ Kmenta 識別", summary: "命題 1 + 系 1 + 事前登録 H_C2: ρ<0。", status: "not-started" },
  { slug: "new-book2-ch-10-4", title: "Ch 10.4 — C3 Theorem 3 二層非可換性 Arrow スタイル不可能性", summary: "4 公理 A1-A4 + 系 3.1 (Simpson 反転 / 四分位不安定性 / Hausman 棄却)。", status: "not-started" },
  { slug: "new-book2-ch-10-5", title: "Ch 10.5 — Klepper 入れ子 (統合ハザード + 命題 4-5)", summary: "h(t,n;θ) = 𝟙{t<τ_B}·h_pre + 𝟙{t≥τ_B}·h_post。", status: "not-started" },
  { slug: "new-book2-ch-10-6", title: "Ch 10.6 — Malerba SSI 全射 φ + レーン重み w(L)", summary: "φ: {1..8} → 2^{K,A,I,D,T} + 命題 5.M / 5.L + 系 5.NW。", status: "not-started" },
  { slug: "new-book2-ch-10-7", title: "Ch 10.7 — Murmann 双方向 ECR-SPS coupling", summary: "命題 10.6.3 + 定理 10.6.5 + 系 10.6.4。", status: "not-started" },
  { slug: "new-book2-ch-10-8", title: "Ch 10.8 — シャープ → ファジー境界 h パラメータ族", summary: "B_h(t) = K((t-t*_mid)/h)。", status: "not-started" },
  { slug: "new-book2-ch-10-9", title: "Ch 10.9 — N≈32 試験プロトコル前倒し (Tier B)", summary: "Andrews-Quandt sup-Wald + OSF 事前登録。", status: "not-started" },
  { slug: "new-book2-ch-10-10", title: "Ch 10.10 — 統合 — BZM = Klepper と Murmann に境界づけられた Nelson-Winter の法人化前精緻化", summary: "統合節。", status: "not-started" },
  { slug: "new-book2-ch-11", title: "Ch 11 — h パラメータ族の h↑∞ 境界事例", summary: "強い事前分布下の事後分布要約と honest 不確実性 (Tier A)。14p。", status: "not-started" },
  { slug: "new-book2-ch-11-5", title: "Ch 11.5 — §10.9 事前登録試験の運用実装", summary: "レジストリ更新メカニズム、N=32 → 64 段階ゲート。14p。", status: "not-started" },

  // Book III — 動機付け事例 (200p, 16 章)
  { slug: "new-book3-ch-12", title: "Ch 12 — TIEM — 早すぎ起業の解剖 (ゾンビ型 参照事例)", summary: "Y-001 + Y-004 重複原型。露出制限: 本章 + Ch 4 + Ch 26 + Ch 37 + 付録 C のみ。16p。", status: "not-started" },
  { slug: "new-book3-ch-13", title: "Ch 13 — BWE — 健全型 参照事例", summary: "F-CES 補完成功 (F_char 高 × F_cap 後発補完)。14p。", status: "not-started" },
  { slug: "new-book3-ch-14", title: "Ch 14 — CX — Carbon, R_net 共食いの観測", summary: "μ_I 単独高位 Triple Helix 不均衡。12p。", status: "not-started" },
  { slug: "new-book3-ch-15", title: "Ch 15 — SX — 半導体, σ_SU 追い風 × R_net 共食い", summary: "R-bundle min (GRL 律速) 主要事例 (Ch 2.3)。14p。", status: "not-started" },
  { slug: "new-book3-ch-16", title: "Ch 16 — CTB — 創薬, 鋸歯型軌跡と段階補充", summary: "Ch 8.4 鋸歯型主要参照 + Ch 7.5 F_cap 経験順序 + Ch 29 GAP 期主要事例。14p。", status: "not-started" },
  { slug: "new-book3-ch-17", title: "Ch 17 — YD — 波力, UE 律速 NO_GO (即落型)", summary: "Ch 26b アンカーケース。NO_GO 判定の日付印付き公開記録 1 例を予測登録簿に登録。12p。", status: "not-started" },
  { slug: "new-book3-ch-18", title: "Ch 18 — JC — 浅技術型, 自走型 参照事例", summary: "σ_SU 低 / F 高 / R_net 早期。10p。", status: "not-started" },
  { slug: "new-book3-ch-19", title: "Ch 19 — CLG — σ_SU 追い風依存型 参照事例", summary: "σ_SU 高 → R_net 立たず F_char 摩耗。Ch 30 設立期主要事例。10p。", status: "not-started" },
  { slug: "new-book3-ch-20", title: "Ch 20 — Research-Org-Type 機関", summary: "NIMS 等。type 名のみ運用 (D-034)。12p。", status: "not-started" },
  { slug: "new-book3-ch-21", title: "Ch 21 — Private-Engineering-Univ-Type 機関", summary: "桑折 MTG 2026-06-24 一次情報の正準オーナー (7 論点)。14p。", status: "not-started" },
  { slug: "new-book3-ch-22", title: "Ch 22 — Regional-National-Univ-Type 機関群", summary: "愛媛 + 香川 等。14p。", status: "not-started" },
  { slug: "new-book3-ch-23", title: "Ch 23 — Integrated-Large-Univ-Type 機関", summary: "京大 / 山口大 / 東京科学大 等。12p。", status: "not-started" },
  { slug: "new-book3-ch-24", title: "Ch 24 — 国際比較 — International-TTO-Type 後付け校正", summary: "P-002 で対象機関確定 (MIT Deshpande / EPFL TTO / TU Munich UnternehmerTUM / KIT Karlsruhe / Tsinghua x-lab 候補)。12p。", status: "not-started" },
  { slug: "new-book3-ch-25", title: "Ch 25 — 層間結合の実質的所見", summary: "記述、識別主張なし (Tier A)。14p。", status: "not-started" },
  { slug: "new-book3-ch-26a", title: "Ch 26a — 標本内整合性チェック (Tier A)", summary: "校正であって validation ではない。10p。", status: "not-started" },
  { slug: "new-book3-ch-26b", title: "Ch 26b — 前向き反証プロトコル (Tier B)", summary: "何が反証されたら本書は死ぬか。OSF 事前登録、F-5.1〜F-5.6 + Y 系の予測登録簿。10p。", status: "not-started" },

  // Book IV — 時系列現場接続 (110p, 5 章)
  { slug: "new-book4-ch-27", title: "Ch 27 — 技術シーズの掘り起こし", summary: "P(t) を待たずに U(t) を広げる。20p。", status: "not-started" },
  { slug: "new-book4-ch-28", title: "Ch 28 — 先生が第一歩を踏み出すとき", summary: "賭け金の全量と F の起点 (Ch 21 pointer: 出資金 / 退路 / 学生責任)。22p。", status: "not-started" },
  { slug: "new-book4-ch-29", title: "Ch 29 — GAP ファンド期", summary: "機関 ECR が y を非希薄化的に厚くする時間窓 (CTB 主要事例)。22p。", status: "not-started" },
  { slug: "new-book4-ch-30", title: "Ch 30 — 会社設立期", summary: "B の起動と F の充足を一致させる不可逆 GO (CLG 主要事例、Ch 21 pointer: 取締役個人責任)。22p。", status: "not-started" },
  { slug: "new-book4-ch-31", title: "Ch 31 — 資金調達期", summary: "F の現場運用、J カーブ批判、撤退四経路。24p。", status: "not-started" },

  // Book V — 機関側設計 (90p, 4 章)
  { slug: "new-book5-ch-32", title: "Ch 32 — ECR 8 軸別処方 — 運用者向けプレイブック", summary: "Atlas 8 軸 × Lv1-5 × 凹みパターン処方 (Ch 21 pointer: COI)。30p。", status: "not-started" },
  { slug: "new-book5-ch-33", title: "Ch 33 — GAP + URA + EIR — 三制度を一つの導線に", summary: "Ch 21 pointer: 論文-特許順序事故。22p。", status: "not-started" },
  { slug: "new-book5-ch-34", title: "Ch 34 — 地域 産学官 双対動態", summary: "σ_SU を県境で読む (Ch 10.7 Murmann coupling の政策・実務翻訳)。22p。", status: "not-started" },
  { slug: "new-book5-ch-35", title: "Ch 35 — BZ 段階への政策含意", summary: "σ_SU と ECR を政策レバーに翻訳。16p。", status: "not-started" },

  // Book VI — 新領域宣言 (60p, 3 章)
  { slug: "new-book6-ch-36", title: "Ch 36 — 機関 KPI と ECR — Goodhart 回避の評価指標化", summary: "funder / 政策向け。18p。", status: "not-started" },
  { slug: "new-book6-ch-37", title: "Ch 37 — 真正面の比較 — BZM vs Triple Helix vs Effectuation vs Nelson-Winter (Tier B)", summary: "共通スコアリング規則 = 24ヶ月 outcome class log-loss。20p。", status: "not-started" },
  { slug: "new-book6-ch-37-5", title: "Ch 37.5 — 自己批判とオープンプロブレム — 第二版への課題", summary: "RT を含む全理論の弱点・未検証点・想定されるツッコミを著者自ら列挙し、第二版で解くべき課題として宣言する (D-056、まさ発案)。12p。", status: "not-started" },
  { slug: "new-book6-ch-38", title: "Ch 38 — 新領域宣言 — 何が獲得され、何が次の 10 年に持ち越されたか", summary: "Before Zero Studies (新サブ領域、進化経済 × イノベーション・システム × 学術アントレ研究 の交差点) の宣言。22p。", status: "not-started" },

  // 付録 (160p, A/B/C)
  { slug: "new-appendix-a", title: "付録 A — 数学補遺", summary: "導出、校正、感度、shift +1 数値手続き。Book II load-bearing 章の完全証明はここ (D-047)。記号表記正本 (C / Π / Σ / κ / θ) 冒頭配置。70p。", status: "not-started" },
  { slug: "new-appendix-b", title: "付録 B — データ仕様, プロトコル, 予測登録簿, OSF 事前登録手続き", summary: "55p。", status: "not-started" },
  { slug: "new-appendix-c", title: "付録 C — やらかし図鑑 Y-001〜Y-008 全文", summary: "TIEM 露出制限 (D-010) の対象外。35p。", status: "not-started" },
];

// --- 実戦書 (= 2026-06-13 章割で起草済みの実践書、後から出版予定) の slug 集合 — 動的 status 判定用。
// status: "legacy" は「学術書 (新 BZM 本書) とは別の道として整理中」を意味する (まさ確定 2026-06-28)。
const LEGACY_SLUGS = new Set<string>([
  "preface",
  "field-before-zero", "field-clocks", "field-gates", "field-who-carries",
  "why-valuation-fails", "model-overview", "p-potential", "r-readiness", "s-survival",
  "score-and-bottleneck", "strategic-slack", "model-critiques", "retrofit-verification",
  "nursery-ers",
  "field-toolkit",
  "ethics-and-authorship", "9-5-appendix-changelog",
  "2026-06-25_proposal_book0_vi", "2026-06-25_mapping_existing_to_new",
  "2026-06-25_book2_evol_econ_surgery", "2026-06-25_book2_evol_econ_major_revision",
]);

/**
 * slug pattern から目次階層を動的判定。
 * - new-book2-ch-5-section-0-1 → level 3 (サブセクション = §5.0.1)
 * - new-book2-ch-5-section-0 → level 2 (節 = §5.0)
 * - new-book2-ch-5 / new-book0-ch-0-0 / それ以外 → level 1 (章)
 * entry に level field が明示されていればそれを優先。
 */
export function getDefaultBzmLevel(slug: string): BzmChapterLevel {
  const m = slug.match(/-section-\d+(?:-\d+)?$/);
  if (!m) return 1;
  // -section-X-Y → サブセクション、-section-X → 節
  const sectionPart = m[0];
  const dashCount = (sectionPart.match(/\d+/g) ?? []).length;
  return dashCount >= 2 ? 3 : 2;
}

/**
 * slug から status を動的判定 (entry に status field がない場合のフォールバック)。
 * 旧 BZM slug は legacy、新 BZM 章は not-started を既定値とする。
 */
export function getDefaultBzmStatus(slug: string): BzmChapterStatus {
  if (LEGACY_SLUGS.has(slug)) return "legacy";
  return "not-started";
}

const partOrder = new Map(
  BZM_PARTS.flatMap((part, partIdx) => part.slugs.map((slug, slugIdx) => [slug, partIdx * 100 + slugIdx] as const)),
);

const chapterBySlug = new Map(BZM_CHAPTERS.map((chapter) => [chapter.slug, chapter]));

/** entry の status を取得 (明示 > 動的判定) */
export function getBzmChapterStatus(slug: string): BzmChapterStatus {
  const ch = chapterBySlug.get(slug);
  return ch?.status ?? getDefaultBzmStatus(slug);
}

/** entry の level を取得 (明示 > 動的判定) */
export function getBzmChapterLevel(slug: string): BzmChapterLevel {
  const ch = chapterBySlug.get(slug);
  return ch?.level ?? getDefaultBzmLevel(slug);
}

export function sortBzmSlugs(slugs: string[]) {
  return [...slugs].sort((a, b) => {
    const aOrder = partOrder.get(a);
    const bOrder = partOrder.get(b);
    if (aOrder != null && bOrder != null) return aOrder - bOrder;
    if (aOrder != null) return -1;
    if (bOrder != null) return 1;
    return a.localeCompare(b);
  });
}

/**
 * 章番号 (旧 "1-1" 等の part-chapter index) はまさ確定 2026-06-28 で廃止。
 * title 自体に "Ch 1" "§1.0" "§1.0.1" のような章番号が入っているため、
 * その前にさらに part index を振るのはミスリーディング。
 * BzmNumberedChapter インターフェース互換のため空文字を返す。
 */
export function applyBzmBookNumbering(chapters: BzmChapterConfig[]): BzmNumberedChapter[] {
  return chapters.map((chapter) => ({
    ...chapter,
    number: "",
  }));
}

export function getBzmChapter(slug: string) {
  return chapterBySlug.get(slug) ?? null;
}
