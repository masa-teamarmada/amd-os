import fs from "node:fs";
import path from "node:path";
import Link from "next/link";

/**
 * /manual — AMD OS マニュアル index
 *
 * pwa/manual/ 配下の章 md ファイル一覧 + 各章 1 行 description を表示。
 * (まさ #23 確定 2026-05-24)
 */

interface ChapterMeta {
  slug: string;
  title: string;
  description: string;
}

function getChapters(): ChapterMeta[] {
  const dir = path.join(process.cwd(), "manual");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  return files.map((f) => {
    const slug = f.replace(/\.md$/, "");
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    const lines = text.split("\n");
    const h1 = lines.find((l) => l.startsWith("# "))?.replace(/^# /, "").trim() || slug;
    // 最初の h1 直後の non-empty 段落を description として拾う
    let description = "";
    const h1Idx = lines.findIndex((l) => l.startsWith("# "));
    if (h1Idx >= 0) {
      for (let i = h1Idx + 1; i < lines.length && i < h1Idx + 20; i++) {
        const l = lines[i].trim();
        if (!l) continue;
        if (l.startsWith("#")) break;
        if (l.startsWith("> ")) continue;
        description = l.replace(/[*_`]/g, "").slice(0, 120);
        break;
      }
    }
    return { slug, title: h1, description };
  });
}

export default function ManualIndexPage() {
  const chapters = getChapters();
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-bold mb-1">📖 AMD OS マニュアル</h1>
      <p className="text-sm text-muted-foreground mb-6">
        AMD OS の使い方・データの裏側・過去判断・開発手順の正本。新セッションのえいみも必ずここから読む。
      </p>
      <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
        {chapters.map((c) => (
          <li key={c.slug} className="px-4 py-3 hover:bg-muted/30 transition-colors">
            <Link href={`/manual/${encodeURIComponent(c.slug)}`} className="block">
              <div className="text-sm font-semibold text-foreground">{c.title}</div>
              {c.description && (
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</div>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground mt-6">
        正本: <code className="rounded bg-muted px-1">pwa/manual/*.md</code> (= git 管理)。
        新規セッション開始時 / 「なぜそうなってるか」を知りたい時に開く。
      </p>
    </div>
  );
}
