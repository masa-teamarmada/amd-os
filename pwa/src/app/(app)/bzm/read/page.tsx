import { getReaderLibrary } from "@/lib/bzm-reader/load";
import { requireReaderAdmin } from "@/lib/bzm-reader/require-reader-admin";
import { LibraryShelf } from "./LibraryShelf";

/**
 * /bzm/read — 書斎（本棚）。専用アプリの入口なので、AMD OS の外枠なしで成り立つ簡素な見出しを自前で持つ。
 * 原稿は参照系（更新は日単位）なので、読み込み側のキャッシュ越しに一度で全冊を読む。
 * 読書位置は端末ごとの localStorage にあるので、ここ（サーバ）では出さず LibraryShelf が
 * マウント後に足す。
 */
export default async function BzmReaderLibraryPage() {
  await requireReaderAdmin();
  const books = getReaderLibrary();

  return (
    <div className="min-h-dvh bg-white text-foreground">
      <div className="mx-auto max-w-[1200px] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6 sm:pt-[max(2rem,env(safe-area-inset-top))]">
        <header className="mb-6">
          <h1 className="mb-1 text-2xl font-bold">書斎</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            執筆中の本と論文を、ページ送りで通読
          </p>
        </header>
        <LibraryShelf books={books} />
      </div>
    </div>
  );
}
