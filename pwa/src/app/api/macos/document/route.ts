import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  BZM_CHAPTERS,
  BZM_PARTS,
  getBzmChapterLevel,
  getBzmChapterStatus,
  sortBzmSlugs,
} from "@/app/(app)/bzm/bzm-chapters";
import {
  PUBLIC_MANUSCRIPT_CHAPTERS,
  PUBLIC_MANUSCRIPT_PARTS,
} from "@/app/(app)/bzm/public/public-manuscript";
import { getSpecBookChapters, getSpecChapters, normalizeSpecMarkdownSource } from "@/app/(app)/spec/spec-data";
import { SPEC_SECTIONS } from "@/app/(app)/spec/spec-chapters";
import { requireAuth } from "@/lib/supabase/api-auth";

type DocumentKind = "manual" | "spec" | "bzm" | "bzm-public";

type NativeDocumentChapter = {
  slug: string;
  title: string;
  summary?: string;
  number?: string;
  group_key?: string;
  group_label?: string;
  group_description?: string;
  status?: string;
  level?: number;
  available: boolean;
};

const DIRECTORY_BY_KIND: Record<DocumentKind, string> = {
  manual: "manual",
  spec: "spec",
  bzm: "bzm",
  "bzm-public": path.join("bzm", "public-manuscript"),
};

function isKind(value: string | null): value is DocumentKind {
  return value === "manual" || value === "spec" || value === "bzm" || value === "bzm-public";
}

function safeSlug(value: string | null): string | null {
  const slug = value?.trim() ?? "";
  if (!slug || slug.includes("/") || slug.includes("\\") || slug.includes("..")) return null;
  return slug.replace(/\.md$/i, "");
}

function titleFromMarkdown(content: string, fallback: string): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback;
}

function chapterMeta(kind: DocumentKind, availableSlugs: string[]): NativeDocumentChapter[] {
  const available = new Set(availableSlugs);

  if (kind === "spec") {
    const groups = new Map(
      SPEC_SECTIONS.flatMap((section) =>
        section.slugs.map((slug) => [slug, section] as const),
      ),
    );
    return getSpecBookChapters(getSpecChapters()).map((chapter) => {
      const group = groups.get(chapter.slug);
      return {
        slug: chapter.slug,
        title: chapter.title,
        summary: chapter.summary,
        number: chapter.number,
        group_key: group?.key,
        group_label: group?.label,
        group_description: group?.description,
        available: available.has(chapter.slug),
      };
    });
  }

  if (kind === "bzm") {
    const groups = new Map(
      BZM_PARTS.flatMap((part) => part.slugs.map((slug) => [slug, part] as const)),
    );
    const configured = new Map(BZM_CHAPTERS.map((chapter) => [chapter.slug, chapter]));
    return sortBzmSlugs(Array.from(new Set([...BZM_CHAPTERS.map((chapter) => chapter.slug), ...availableSlugs]))).map((slug) => {
      const chapter = configured.get(slug);
      const group = groups.get(slug);
      return {
        slug,
        title: chapter?.title ?? slug,
        summary: chapter?.summary,
        group_key: group?.key,
        group_label: group?.label,
        group_description: group?.description,
        status: getBzmChapterStatus(slug),
        level: getBzmChapterLevel(slug),
        available: available.has(slug),
      };
    });
  }

  if (kind === "bzm-public") {
    const groups = new Map(
      PUBLIC_MANUSCRIPT_PARTS.flatMap((part) =>
        part.chapters.map((chapter) => [chapter.slug, part] as const),
      ),
    );
    return PUBLIC_MANUSCRIPT_CHAPTERS.map((chapter) => {
      const group = groups.get(chapter.slug);
      return {
        slug: chapter.slug,
        title: chapter.title,
        number: chapter.number,
        group_key: group?.key,
        group_label: group?.label,
        available: available.has(chapter.slug),
      };
    });
  }

  return availableSlugs.map((slug) => ({ slug, title: slug, available: true }));
}

function bzmPendingSource(slug: string) {
  const chapter = BZM_CHAPTERS.find((item) => item.slug === slug);
  if (!chapter) return null;
  return [
    `# ${chapter.title}`,
    "",
    "> **このセクションは執筆待機中です。**",
    ">",
    "> 完成済みの章から順に本文が追加されます。左の章一覧から、完成済みまたは執筆中の章を選べます。",
    "",
    "## セクション概要",
    "",
    chapter.summary,
  ].join("\n");
}

/**
 * Native macOS の読書画面が PWA と同じ markdown 正本を読む bridge。
 * `bzm-public` だけはPWAと同様に公開、他はログイン済みBearer/cookieのままにする。
 */
export async function GET(req: NextRequest) {
  const kindParam = req.nextUrl.searchParams.get("kind");
  if (!isKind(kindParam)) {
    return NextResponse.json({ ok: false, error: "kind must be manual, spec, bzm, or bzm-public" }, { status: 400 });
  }

  // `/bzm/public` is intentionally readable without a session in the PWA.
  // Keep that boundary identical for the native reader; every other document
  // family remains behind the same member/admin authentication as the PWA.
  const auth = kindParam === "bzm-public" ? null : await requireAuth();
  if (auth && !auth.ok) return auth.errorResponse;

  if (kindParam === "spec") {
    // `spec` cannot reach this point without a valid member session above.
    if (!auth?.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { data: member, error } = await auth.supabase
      .from("members")
      .select("is_admin")
      .eq("email", auth.user.email.toLowerCase())
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!member?.is_admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const directory = path.join(process.cwd(), DIRECTORY_BY_KIND[kindParam]);
  if (!fs.existsSync(directory)) {
    return NextResponse.json({ ok: true, kind: kindParam, chapters: [] });
  }

  const chapters = fs.readdirSync(directory)
    .filter((name) => name.endsWith(".md") && (kindParam !== "bzm" || !/^[A-Z]/.test(name)))
    .map((name) => name.replace(/\.md$/, ""))
    .sort();
  const meta = chapterMeta(kindParam, chapters);
  const slug = safeSlug(req.nextUrl.searchParams.get("slug"));
  if (!slug) {
    return NextResponse.json({ ok: true, kind: kindParam, chapters, chapter_meta: meta });
  }

  const isBzmPendingChapter = kindParam === "bzm" && !chapters.includes(slug) && bzmPendingSource(slug) != null;
  if (!chapters.includes(slug) && !isBzmPendingChapter) {
    return NextResponse.json({ ok: false, error: "document not found" }, { status: 404 });
  }
  const rawContent = isBzmPendingChapter
    ? bzmPendingSource(slug)!
    : fs.readFileSync(path.join(directory, `${slug}.md`), "utf8");
  const specChapter = kindParam === "spec"
    ? getSpecBookChapters(getSpecChapters()).find((chapter) => chapter.slug === slug)
    : null;
  const content = specChapter ? normalizeSpecMarkdownSource(rawContent, specChapter) : rawContent;
  return NextResponse.json({
    ok: true,
    kind: kindParam,
    slug,
    title: titleFromMarkdown(content, slug),
    content,
    chapters,
    chapter_meta: meta,
    is_stub: isBzmPendingChapter,
  });
}
