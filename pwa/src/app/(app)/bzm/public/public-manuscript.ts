import fs from "node:fs";
import path from "node:path";

export interface PublicManuscriptChapter {
  slug: string;
  number: string;
  title: string;
}

export interface PublicManuscriptPart {
  key: string;
  label: string;
  chapters: PublicManuscriptChapter[];
}

export const PUBLIC_MANUSCRIPT_PARTS: PublicManuscriptPart[] = [
  {
    key: "prologue",
    label: "Prologue",
    chapters: [{ slug: "00-prologue", number: "0", title: "会社になる前に勝負が決まる" }],
  },
  {
    key: "field",
    label: "Part 1 — Before Zero の現場",
    chapters: [
      { slug: "01-research-results-are-not-companies", number: "1", title: "研究成果は、熱意だけでは会社にならない" },
      { slug: "02-different-clocks", number: "2", title: "関係者は同じ技術を見て、別の時計で動いている" },
      { slug: "03-support-can-isolate-researchers", number: "3", title: "支援制度が増えても、研究者は孤独になる" },
    ],
  },
  {
    key: "traps",
    label: "Part 2 — Before Zero の鬼門",
    chapters: [
      { slug: "04-gap-vc-ceo-function", number: "4", title: "GAPファンドとVCのあいだで、CEO機能がねじれる" },
      { slug: "05-before-disclosure", number: "5", title: "外に出す前に、守るものを決める" },
      { slug: "06-incorporation-timing", number: "6", title: "会社化は早すぎても、遅すぎても壊れる" },
    ],
  },
  {
    key: "questions",
    label: "Part 3 — 会社にする前に聞く問い",
    chapters: [
      { slug: "07-company-now-later-or-never", number: "7", title: "いま会社にするべきか、待つべきか、しないべきか" },
      { slug: "08-who-carries-what", number: "8", title: "誰が何を背負うのか" },
      { slug: "09-before-risk-capital", number: "9", title: "リスク資本に会う前に証明すること" },
      { slug: "10-turning-failure-into-learning", number: "10", title: "関係を壊さず、学習に変える" },
    ],
  },
  {
    key: "variables",
    label: "Part 4 — 現場要素からモデル変数へ",
    chapters: [
      { slug: "11-macro-tailwinds-as-conditions", number: "11", title: "マクロの追い風は、熱量ではなく条件で読む" },
      { slug: "12-readiness-axes", number: "12", title: "技術・事業・制度・社会・人材を別々に見る" },
      { slug: "13-founder-readiness-field-language", number: "13", title: "創業者を見るとは、人を見るだけではない" },
      { slug: "14-institution-as-nursery", number: "14", title: "苗床としての研究機関を見る" },
    ],
  },
  {
    key: "theory",
    label: "Part 5 — BZM理論を現場に戻す",
    chapters: [
      { slug: "15-why-model-the-field", number: "15", title: "なぜ現場をモデルにするのか" },
      { slug: "16-readiness-axes-field-guide", number: "16", title: "「準備できている」を五つに分ける" },
      { slug: "17-macro-alignment-and-triple-helix", number: "17", title: "追い風の位相差を読む" },
      { slug: "18-founder-readiness-field-first", number: "18", title: "創業者機能を、人格評価にしない" },
      { slug: "19-integrated-score-as-next-action", number: "19", title: "統合スコアは、次の一手を変えるために使う" },
      { slug: "20-retrofit-validation-as-learning", number: "20", title: "外れた地図を、証拠ルールから直す" },
      { slug: "21-institution-readiness-as-nursery", number: "21", title: "個別案件と苗床を混ぜない" },
    ],
  },
  {
    key: "toolkit",
    label: "Toolkit — 実務道具",
    chapters: [
      { slug: "22-field-note-safety-loop", number: "A", title: "現場メモを、誰かを傷つけない問いに変える" },
      { slug: "23-decision-and-disclosure-toolkit", number: "B", title: "判断と開示の道具箱" },
      { slug: "24-institution-nursery-checklist", number: "C", title: "研究機関を、苗床として点検する" },
    ],
  },
];

export const PUBLIC_MANUSCRIPT_CHAPTERS = PUBLIC_MANUSCRIPT_PARTS.flatMap((part) => part.chapters);

export function publicManuscriptDir() {
  return path.join(process.cwd(), "bzm", "public-manuscript");
}

export function getPublicManuscriptChapter(slug: string) {
  return PUBLIC_MANUSCRIPT_CHAPTERS.find((chapter) => chapter.slug === slug) ?? null;
}

export function getPublicManuscriptMarkdown(slug: string) {
  const filePath = path.join(publicManuscriptDir(), `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}
