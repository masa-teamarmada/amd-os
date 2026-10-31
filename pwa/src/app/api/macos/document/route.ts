import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getSpecBookChapters, getSpecChapters, normalizeSpecMarkdownSource } from "@/app/(app)/spec/spec-data";
import { SPEC_SECTIONS } from "@/app/(app)/spec/spec-chapters";
import { requireAuth } from "@/lib/supabase/api-auth";

// 本・論文の原稿（旧 bzm / bzm-public）は書斎（別アプリ）へ移し、OS では返さない（2026-10-31）。
type DocumentKind = "manual" | "spec";

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

/** manual / spec は pwa 配下。 */
function documentDirectory(kind: DocumentKind): string {
  // Keep filesystem tracing bounded to these two document folders. A dynamic
  // `kind` path makes the build tracer include unrelated files across pwa/.
  if (kind === "manual") return path.join(process.cwd(), "manual");
  return path.join(process.cwd(), "spec");
}

function isKind(value: string | null): value is DocumentKind {
  return value === "manual" || value === "spec";
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

  return availableSlugs.map((slug) => ({ slug, title: slug, available: true }));
}

/**
 * Native macOS の読書画面が PWA と同じ markdown 正本を読む bridge。
 * どちらもログイン済みBearer/cookieのまま、設計書は管理者だけに返す。
 */
export async function GET(req: NextRequest) {
  const kindParam = req.nextUrl.searchParams.get("kind");
  if (!isKind(kindParam)) {
    return NextResponse.json({ ok: false, error: "kind must be manual or spec" }, { status: 400 });
  }

  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  if (kindParam === "spec") {
    const { data: member, error } = await auth.supabase
      .from("members")
      .select("is_admin")
      .eq("email", auth.user.email.toLowerCase())
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!member?.is_admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const directory = documentDirectory(kindParam);
  if (!fs.existsSync(/*turbopackIgnore: true*/ directory)) {
    return NextResponse.json({ ok: true, kind: kindParam, chapters: [] });
  }

  const chapters = fs.readdirSync(/*turbopackIgnore: true*/ directory)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""))
    .sort();
  const meta = chapterMeta(kindParam, chapters);
  const slug = safeSlug(req.nextUrl.searchParams.get("slug"));
  if (!slug) {
    return NextResponse.json({ ok: true, kind: kindParam, chapters, chapter_meta: meta });
  }

  if (!chapters.includes(slug)) {
    return NextResponse.json({ ok: false, error: "document not found" }, { status: 404 });
  }
  const rawContent = fs.readFileSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ directory, `${slug}.md`), "utf8");
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
    is_stub: false,
  });
}
