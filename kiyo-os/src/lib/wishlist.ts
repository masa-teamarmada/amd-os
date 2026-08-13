/**
 * きよの「ほしいもの」候補。docs/INTAKE.md と対になっている。
 *
 * きよが何か言ったら、まずここと INTAKE.md の両方に足す（実装はまだしない）。
 * 実装したら state を "作った" に更新する。
 */

export type WishState = "聞いた" | "作ると決めた" | "作った" | "やめた";

export type WishCategory = "質問" | "候補メニュー" | "仕事まわり" | "きよが書いた";

export type Wish = {
  id: string;
  category: WishCategory;
  title: string;
  detail: string;
  state: WishState;
  /** 決まっていないものは null */
  note?: string;
};

export const WISHES: Wish[] = [
  // ① まず聞きたいこと
  {
    id: "q1",
    category: "質問",
    title: "面倒だと感じていることは？",
    detail: "毎日 or 毎週やっていることで、手間だと思っているもの",
    state: "聞いた",
    note: "未回答",
  },
  {
    id: "q2",
    category: "質問",
    title: "忘れて困ったことは？",
    detail: "後から探すのが大変だったもの",
    state: "聞いた",
    note: "未回答",
  },
  {
    id: "q3",
    category: "質問",
    title: "今どこに記録している？",
    detail: "紙 / スマホのメモ / Excel / 頭の中",
    state: "聞いた",
    note: "未回答",
  },
  {
    id: "q4",
    category: "質問",
    title: "スマホとPC、どっちで見る？",
    detail: "多いほうに合わせて作りを変える",
    state: "聞いた",
    note: "未回答",
  },
  {
    id: "q5",
    category: "質問",
    title: "仕事だけ？ プライベートも？",
    detail: "扱う範囲を決める",
    state: "聞いた",
    note: "未回答",
  },

  // ② 候補メニュー（えいみOSスイート由来）
  {
    id: "m1",
    category: "候補メニュー",
    title: "今日の操縦席",
    detail: "その日の予定・やること・メモを 1 画面に",
    state: "聞いた",
    note: "要否 未確認",
  },
  {
    id: "m2",
    category: "候補メニュー",
    title: "週次のふりかえり",
    detail: "週の初めに 3 つ決めて、週末に答え合わせ",
    state: "聞いた",
    note: "要否 未確認",
  },
  {
    id: "m3",
    category: "候補メニュー",
    title: "家計・お金",
    detail: "収支、資産、固定費の管理",
    state: "聞いた",
    note: "要否 未確認",
  },
  {
    id: "m4",
    category: "候補メニュー",
    title: "目標・習慣",
    detail: "目標の進み具合と、続けたい習慣の記録",
    state: "聞いた",
    note: "要否 未確認",
  },
  {
    id: "m5",
    category: "候補メニュー",
    title: "生活の記録（ログ）",
    detail: "日々の出来事を溜めて後から検索する",
    state: "聞いた",
    note: "要否 未確認",
  },
  {
    id: "m6",
    category: "候補メニュー",
    title: "外部脳",
    detail: "読んだもの・調べたことを繋げて溜める",
    state: "聞いた",
    note: "要否 未確認",
  },
  {
    id: "m7",
    category: "候補メニュー",
    title: "対話ログ",
    detail: "AI と話して決めたことを議事録として残す",
    state: "聞いた",
    note: "要否 未確認",
  },
  {
    id: "m8",
    category: "候補メニュー",
    title: "移動・おでかけ",
    detail: "行った場所、旅の記録",
    state: "聞いた",
    note: "要否 未確認",
  },
  {
    id: "m9",
    category: "候補メニュー",
    title: "健康",
    detail: "睡眠・歩数・体調",
    state: "聞いた",
    note: "要否 未確認",
  },
  {
    id: "m10",
    category: "候補メニュー",
    title: "契約・手続き台帳",
    detail: "何をどこと契約しているか、支払い方法の一覧",
    state: "聞いた",
    note: "要否 未確認",
  },

  // ③ 仕事まわり
  {
    id: "w1",
    category: "仕事まわり",
    title: "月次の締めチェックリスト",
    detail: "毎月やる経理作業の手順と進捗",
    state: "聞いた",
    note: "会社の本番データには触らない前提",
  },
  {
    id: "w2",
    category: "仕事まわり",
    title: "支払い・入金の予定表",
    detail: "いつ何の支払いがあるか",
    state: "聞いた",
    note: "会社の本番データには触らない前提",
  },
  {
    id: "w3",
    category: "仕事まわり",
    title: "立替精算のメモ",
    detail: "自分の立替の記録",
    state: "聞いた",
    note: "会社の本番データには触らない前提",
  },
  {
    id: "w4",
    category: "仕事まわり",
    title: "やりとりの記録",
    detail: "誰に何を頼んだか、返事待ち",
    state: "聞いた",
    note: "会社の本番データには触らない前提",
  },
];

export const WISH_CATEGORIES: WishCategory[] = [
  "質問",
  "候補メニュー",
  "仕事まわり",
  "きよが書いた",
];

export const STATE_CLASS: Record<WishState, string> = {
  聞いた: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  作ると決めた: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  作った: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  やめた: "bg-rose-500/10 text-rose-300/70 ring-rose-500/20",
};
