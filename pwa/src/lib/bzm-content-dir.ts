import fs from "node:fs";
import path from "node:path";

/**
 * BZM (教科書 / 一般書原稿) の md はモノレポのルート直下 `amd-os/bzm/` に置く。
 *
 * 執筆物であって PWA の実装ではないので pwa/ の中には置かない (2026-08-22 まさ確定)。
 * bzm 側は Next.js を一切意識せず、OS が「このフォルダの md を読みに行く」だけにする。
 * ディレクトリ解決をここ 1 箇所に集約しているのはそのため。散らすと移設のたびに漏れる。
 *
 * Vercel は Root Directory が `pwa` だが sourceFilesOutsideRootDirectory が有効なので
 * ビルド環境にはリポジトリ全体が入る。実行時に読めるように next.config.ts で
 * outputFileTracingRoot をリポジトリルートへ上げ、`../bzm/**\/*.md` を明示 bundle する。
 *
 * cwd は通常 Next.js のプロジェクトディレクトリ (= pwa) を指すが、実行環境によっては
 * リポジトリルートになりうる。どちらでも当たるよう候補を順に見る。
 */
const CANDIDATE_PREFIXES = ["..", "."];

export function bzmContentDir(): string {
  for (const prefix of CANDIDATE_PREFIXES) {
    const dir = path.resolve(process.cwd(), prefix, "bzm");
    if (fs.existsSync(dir)) return dir;
  }
  // 見つからない場合も想定パスを返す。呼び出し側は existsSync で分岐している。
  return path.resolve(process.cwd(), "..", "bzm");
}

/** 一般書の公開原稿 (`bzm/public-manuscript/`) */
export function bzmPublicManuscriptDir(): string {
  return path.join(bzmContentDir(), "public-manuscript");
}
