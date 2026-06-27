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
 * `BZSF/before_zero_theory.md` / `BZSF/PRS_STRATEGIC_SLACK_OVERVIEW_20260612.html`。
 */

export type BzmChapterStatus = "completed" | "in-progress" | "not-started" | "legacy";

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
}

export interface BzmNumberedChapter extends BzmChapterConfig {
  number: string;
}

export const BZM_PARTS: BzmPartConfig[] = [
  {
    key: "preface",
    label: "序章",
    description: "この本の読み方。研究成果が会社になる前の混乱を、現場 → モデル → 実践の順で読む。",
    slugs: ["preface"],
  },
  {
    key: "field",
    label: "第 I 部 — Before Zero の現場",
    description: "会社になる前に勝負が決まる場所。関係者の時計のズレ、鬼門、誰が何を背負うか。",
    slugs: ["field-before-zero", "field-clocks", "field-gates", "field-who-carries"],
  },
  {
    key: "model",
    label: "第 II 部 — Before Zero Model",
    description: "PRS × 戦略余力。天井 P・到達度 R・生存確率 S と、その土台になる (x, y) の動学。",
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
    key: "nursery",
    label: "第 III 部 — 苗床",
    description: "研究機関をベンチャーを生み育てる装置として読む。整備度の測り方と制度設計。",
    slugs: ["nursery-ers"],
  },
  {
    key: "toolkit",
    label: "第 IV 部 — 実践ツールキット",
    description: "面談の問い、開示台本、判断チェックリスト、90日 pilot charter。現場で使う道具集。",
    slugs: ["field-toolkit"],
  },
  {
    key: "appendix",
    label: "巻末資料",
    description: "著者性・利害・倫理への批判と、附則 (変更履歴)。参考文献・記号・用語は各部の完成にあわせて再構築する。",
    slugs: ["ethics-and-authorship", "9-5-appendix-changelog"],
  },
  {
    key: "proposals_20260625",
    label: "設計提案 (2026-06-25, 本文外)",
    description: "本書全体を Book 0-VI 構造に再設計する議論の記録。本文ではなく提案物。順序通り読むと: (1) 全体構造案 → (2) 既存章 → 新章 mapping → (3) Book II OPENER 構造手術 Rev 1 → (4) Rev 2 (進化経済査読が条件付き受理 → 軽微修正に到達)。",
    slugs: [
      "2026-06-25_proposal_book0_vi",
      "2026-06-25_mapping_existing_to_new",
      "2026-06-25_book2_evol_econ_surgery",
      "2026-06-25_book2_evol_econ_major_revision",
    ],
  },
  // --- 新 BZM 本書 940p (Cambridge UP Schumpeter モノグラフ + Research Policy 特集号 + ICC 三経路) ---
  {
    key: "new-bzm-book0",
    label: "新 BZM 本書 — Book 0 序章 (70p, 6 章)",
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
    label: "新 BZM 本書 — Book I 領土の定義 (110p, 4 章)",
    description: "観測量と典型動学。状態空間 / PRS / ERS / 失敗パターンの抽象。",
    slugs: [
      "new-book1-ch-1",
      "new-book1-ch-2",
      "new-book1-ch-3",
      "new-book1-ch-4",
    ],
  },
  {
    key: "new-bzm-book2",
    label: "新 BZM 本書 — Book II 機構 (272p, 9 章 + Ch 10 11 節, load-bearing core)",
    description: "数学装置層。Triple Helix SSM / GO ゲート / PRS 期待値分解 / F-CES / 戦略余力動学 / ERS 加重和 / Ch 10 進化経済形式接続 (11 節 OPENER) / h パラメータ族 / 試験運用実装。",
    slugs: [
      "new-book2-ch-5",
      "new-book2-ch-5-section-0-1",
      "new-book2-ch-5-section-0-2",
      "new-book2-ch-5-section-0-3",
      "new-book2-ch-5-section-0-4",
      "new-book2-ch-5-5",
      "new-book2-ch-6",
      "new-book2-ch-7",
      "new-book2-ch-8",
      "new-book2-ch-9",
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
    label: "新 BZM 本書 — Book III 動機付け事例とパターン・ライブラリ (200p, 16 章)",
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
    label: "新 BZM 本書 — Book IV 時系列現場接続 (110p, 5 章)",
    description: "実践の背骨。掘り起こし / 第一歩 / GAP / 設立 / 資金調達。",
    slugs: [
      "new-book4-ch-27", "new-book4-ch-28", "new-book4-ch-29",
      "new-book4-ch-30", "new-book4-ch-31",
    ],
  },
  {
    key: "new-bzm-book5",
    label: "新 BZM 本書 — Book V 機関側設計 (90p, 4 章)",
    description: "機関側プレイブック。ERS 8 軸別処方 / 三制度導線 / 地域 産学官 / 政策含意。",
    slugs: [
      "new-book5-ch-32", "new-book5-ch-33", "new-book5-ch-34", "new-book5-ch-35",
    ],
  },
  {
    key: "new-bzm-book6",
    label: "新 BZM 本書 — Book VI 新領域宣言 (60p, 3 章)",
    description: "新領域宣言と次の研究プログラム。機関 KPI / 真正面の比較 / 新領域宣言。",
    slugs: [
      "new-book6-ch-36", "new-book6-ch-37", "new-book6-ch-38",
    ],
  },
  {
    key: "new-bzm-appendix",
    label: "新 BZM 本書 — 付録 (160p, A/B/C)",
    description: "数学補遺 70p + データ仕様 55p + やらかし図鑑 35p。",
    slugs: [
      "new-appendix-a", "new-appendix-b", "new-appendix-c",
    ],
  },
];

export const BZM_CHAPTERS: BzmChapterConfig[] = [
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
    title: "鬼門 — 進める、待つ、止めるを分ける",
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
    summary: "同じシーズでも機関の土壌で事業化速度はまるで違う。機関整備度を8軸×Lv1〜5で測る ERS、案件評価 (掛け算) と異なる加重和を採る理由、弱い軸の外部連携と90日 pilot。",
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
  { slug: "new-book1-ch-1", title: "Ch 1 — 状態空間と観測量", summary: "Before Zero を測るとはどういうことか。30p。", status: "not-started" },
  { slug: "new-book1-ch-2", title: "Ch 2 — PRS — 天井 × 到達 × 生存の概念体系", summary: "PRS = P × R × S。30p。", status: "not-started" },
  { slug: "new-book1-ch-3", title: "Ch 3 — ERS — 苗床という第二の対象", summary: "含: unknown vs not_started 区別の正準オーナー = Ch 3.5。30p。", status: "not-started" },
  { slug: "new-book1-ch-4", title: "Ch 4 — 失敗パターンの抽象", summary: "Book II 数学装置への索引 (前方参照ティーザー)。20p。", status: "not-started" },

  // Book II — 機構 (272p, 9 章 + Ch 10 11 節)
  { slug: "new-book2-ch-5", title: "Ch 5 — Triple Helix SSM と σ_SU の生成", summary: "Cobb-Douglas σ_SU = ∛((μ_A+1)(μ_I+1)(μ_G+1)) - 1, K=3 MS-SSM (S₀/S₁/S₂), Π^pre/Π^post 二段, η_jt softmax coupling, cross-walk 三定理。Ch 5.1 = Leydesdorff mutual information T(AIG) との cross-walk。28p heavy 数学。執筆中。", status: "in-progress" },
  { slug: "new-book2-ch-5-section-0-1", title: "§5.0.1 — 対照的な二領域と政策密度 P の段階的上昇", summary: "2020Q4-2023Q4 の同一窓に CX (カーボンニュートラル/GX) 系と YD (養殖/フード) 系を並置観察。片方は Triple Helix 三レーンが同位相加速し σ_SU が本書最高水準、他方は政策密度 P_t が立ち上がらず σ_SU 低位張り付き。非対称の起点 = 2020/10/26 CN 宣言。MS-SSM への動機素材。完成 (2,020 字、4 段落、まさレビュー待ち)。", status: "completed" },
  { slug: "new-book2-ch-5-section-0-2", title: "§5.0.2 — CX 三位一体加速の事実構造", summary: "GX 経済移行債・GX-ETS・SIP CE 第3期の連続立ち上げによる公募予算 B 並走、CVC/VC 脱炭素配分 V ピーク、論文 N + 研究費 I_R 連動上昇、政策-研究ラグ 8-12Q → 4-6Q 縮減、σ_SU 本書最高水準到達 (S₂ レジーム予告)。1,500-2,000 字。", status: "not-started" },
  { slug: "new-book2-ch-5-section-0-3", title: "§5.0.3 — 対照事例 YD と σ_SU の必要条件性", summary: "YD 系領域 μ_G フラット、Cobb-Douglas 幾何平均構造による σ_SU 抑制、AMD OS UE 律速 NO_GO、σ_SU は GO の必要条件であって十分条件ではない (二層非可換性入口)、K=3 レジーム S₀/S₁/S₂ 物語的予告。1,500-2,000 字。", status: "not-started" },
  { slug: "new-book2-ch-5-section-0-4", title: "§5.0.4 — 方法論的位置取りと本章境界宣言", summary: "Markov イベント記述妥当性、Nelson-Winter 選抜環境への意味論的橋渡し (D-048 圧縮、Book 0 Ch 0.3 へ逆流)、Ch 5 射程と他章への委託、load-bearing 命題 5.1/5.1b/5.3b/5.5/5.6 + cross-walk 三定理 + 系 5.1.4 の予告、§5.1 D-047 pre-commit への橋渡し。1,500-2,000 字。", status: "not-started" },
  { slug: "new-book2-ch-5-5", title: "Ch 5.5 — GO ゲートの導出", summary: "実オプション最適停止からの一次条件。GO(t,i) = 𝟙[σ_SU ≥ θ_σ*] · g_TRL(t)、θ_σ* は (P, F, B, レジーム遷移) に対して内生的。18p。", status: "not-started" },
  { slug: "new-book2-ch-6", title: "Ch 6 — PRS = P × R × S 期待値分解", summary: "honest 位置付け。22p。", status: "not-started" },
  { slug: "new-book2-ch-7", title: "Ch 7 — S の内部構造 — F-CES と委譲不可能コア", summary: "F = CES(F_char, F_cap; a, ρ)。形式定義 + 校正手続き。38p。", status: "not-started" },
  { slug: "new-book2-ch-8", title: "Ch 8 — 戦略余力動学", summary: "2D jump-diffusion と τ_x/τ_y、y 5 成分集約 (cash/moat/trust/options/focus)。32p。", status: "not-started" },
  { slug: "new-book2-ch-9", title: "Ch 9 — ERS 加重和の導出", summary: "ERS = 100 · Σ w_k A_k / Σ w_k。二層非可換性定理の代数的バックボーン。34p。", status: "not-started" },
  { slug: "new-book2-ch-10-0", title: "Ch 10.0 — プロローグ", summary: "物語的橋渡し。", status: "not-started" },
  { slug: "new-book2-ch-10-1", title: "Ch 10.1 — 設定 — 6 軽微修正課題 C1-C6 と本章の射程", summary: "進化経済 persona 軽微修正 6 件。", status: "not-started" },
  { slug: "new-book2-ch-10-2", title: "Ch 10.2 — C1 レジーム切換え B (法人化境界) の formal definition", summary: "Jovanovic (1982) noisy selection の二レジーム拡張。", status: "not-started" },
  { slug: "new-book2-ch-10-3", title: "Ch 10.3 — C2 F-CES ρ Kmenta 識別", summary: "命題 1 + 系 1 + 事前登録 H_C2: ρ<0。", status: "not-started" },
  { slug: "new-book2-ch-10-4", title: "Ch 10.4 — C3 Theorem 3 二層非可換性 Arrow スタイル不可能性", summary: "4 公理 A1-A4 + 系 3.1 (Simpson 反転 / 四分位不安定性 / Hausman 棄却)。", status: "not-started" },
  { slug: "new-book2-ch-10-5", title: "Ch 10.5 — Klepper 入れ子 (統合ハザード + 命題 4-5)", summary: "h(t,n;θ) = 𝟙{t<τ_B}·h_pre + 𝟙{t≥τ_B}·h_post。", status: "not-started" },
  { slug: "new-book2-ch-10-6", title: "Ch 10.6 — Malerba SSI 全射 φ + レーン重み w(L)", summary: "φ: {1..8} → 2^{K,A,I,D,T} + 命題 5.M / 5.L + 系 5.NW。", status: "not-started" },
  { slug: "new-book2-ch-10-7", title: "Ch 10.7 — Murmann 双方向 ERS-PRS coupling", summary: "命題 10.6.3 + 定理 10.6.5 + 系 10.6.4。", status: "not-started" },
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
  { slug: "new-book4-ch-29", title: "Ch 29 — GAP ファンド期", summary: "機関 ERS が y を非希薄化的に厚くする時間窓 (CTB 主要事例)。22p。", status: "not-started" },
  { slug: "new-book4-ch-30", title: "Ch 30 — 会社設立期", summary: "B の起動と F の充足を一致させる不可逆 GO (CLG 主要事例、Ch 21 pointer: 取締役個人責任)。22p。", status: "not-started" },
  { slug: "new-book4-ch-31", title: "Ch 31 — 資金調達期", summary: "F の現場運用、J カーブ批判、撤退四経路。24p。", status: "not-started" },

  // Book V — 機関側設計 (90p, 4 章)
  { slug: "new-book5-ch-32", title: "Ch 32 — ERS 8 軸別処方 — 運用者向けプレイブック", summary: "Atlas 8 軸 × Lv1-5 × 凹みパターン処方 (Ch 21 pointer: COI)。30p。", status: "not-started" },
  { slug: "new-book5-ch-33", title: "Ch 33 — GAP + URA + EIR — 三制度を一つの導線に", summary: "Ch 21 pointer: 論文-特許順序事故。22p。", status: "not-started" },
  { slug: "new-book5-ch-34", title: "Ch 34 — 地域 産学官 双対動態", summary: "σ_SU を県境で読む (Ch 10.7 Murmann coupling の政策・実務翻訳)。22p。", status: "not-started" },
  { slug: "new-book5-ch-35", title: "Ch 35 — BZ 段階への政策含意", summary: "σ_SU と ERS を政策レバーに翻訳。16p。", status: "not-started" },

  // Book VI — 新領域宣言 (60p, 3 章)
  { slug: "new-book6-ch-36", title: "Ch 36 — 機関 KPI と ERS — Goodhart 回避の評価指標化", summary: "funder / 政策向け。18p。", status: "not-started" },
  { slug: "new-book6-ch-37", title: "Ch 37 — 真正面の比較 — BZM vs Triple Helix vs Effectuation vs Nelson-Winter (Tier B)", summary: "共通スコアリング規則 = 24ヶ月 outcome class log-loss。20p。", status: "not-started" },
  { slug: "new-book6-ch-38", title: "Ch 38 — 新領域宣言 — 何が獲得され、何が次の 10 年に持ち越されたか", summary: "Before Zero Studies (新サブ領域、進化経済 × イノベーション・システム × 学術アントレ研究 の交差点) の宣言。22p。", status: "not-started" },

  // 付録 (160p, A/B/C)
  { slug: "new-appendix-a", title: "付録 A — 数学補遺", summary: "導出、校正、感度、shift +1 数値手続き。Book II load-bearing 章の完全証明はここ (D-047)。記号表記正本 (C / Π / Σ / κ / θ) 冒頭配置。70p。", status: "not-started" },
  { slug: "new-appendix-b", title: "付録 B — データ仕様, プロトコル, 予測登録簿, OSF 事前登録手続き", summary: "55p。", status: "not-started" },
  { slug: "new-appendix-c", title: "付録 C — やらかし図鑑 Y-001〜Y-008 全文", summary: "TIEM 露出制限 (D-010) の対象外。35p。", status: "not-started" },
];

const partOrder = new Map(
  BZM_PARTS.flatMap((part, partIdx) => part.slugs.map((slug, slugIdx) => [slug, partIdx * 100 + slugIdx] as const)),
);

const chapterBySlug = new Map(BZM_CHAPTERS.map((chapter) => [chapter.slug, chapter]));

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
 * 章番号を part-chapter 形式 (= "2-1" など) で振る。
 * 序章は part index 0。
 */
export function applyBzmBookNumbering(chapters: BzmChapterConfig[]): BzmNumberedChapter[] {
  const numberBySlug = new Map<string, string>();
  BZM_PARTS.forEach((part, partIdx) => {
    const isProposals = part.key.startsWith("proposals_");
    part.slugs.forEach((slug, chapterIdx) => {
      if (isProposals) {
        numberBySlug.set(slug, `提案 ${chapterIdx + 1}`);
      } else {
        numberBySlug.set(slug, `${partIdx}-${chapterIdx + 1}`);
      }
    });
  });
  return chapters.map((chapter) => ({
    ...chapter,
    number: numberBySlug.get(chapter.slug) ?? "--",
  }));
}

export function getBzmChapter(slug: string) {
  return chapterBySlug.get(slug) ?? null;
}
