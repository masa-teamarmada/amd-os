"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Code2,
  Database,
  LayoutDashboard,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";
import {
  MANUAL_CHAPTERS,
  MANUAL_SECTIONS,
  type ManualAudience,
  type ManualChapterConfig,
  type ManualSectionConfig,
  type ManualTopicColor,
  type ManualTopicIcon,
  type ManualTopicNodeConfig,
} from "./manual-chapters";

interface ManualMapClientProps {
  audience: ManualAudience;
  chapters: ManualChapterConfig[];
  topics: ManualTopicNodeConfig[];
  activeChapterSlug?: string;
  children?: ReactNode;
  initialTopicKey?: string;
  showDirectory?: boolean;
}

const iconMap: Record<ManualTopicIcon, LucideIcon> = {
  book: BookOpen,
  dashboard: LayoutDashboard,
  calendar: CalendarDays,
  brain: Brain,
  search: Search,
  database: Database,
  settings: Settings,
  code: Code2,
};

const topicColorStyles: Record<
  ManualTopicColor,
  {
    accent: string;
    surface: string;
    active: string;
    subtle: string;
    number: string;
    chip: string;
    rail: string;
    ring: string;
  }
> = {
  blue: {
    accent: "bg-blue-500",
    surface: "border-blue-200 bg-blue-50/70",
    active: "border-blue-400 bg-blue-50 text-blue-950 shadow-sm",
    subtle: "border-blue-100 bg-blue-50/45 text-blue-900",
    number: "bg-blue-600 text-white",
    chip: "border-blue-200 bg-blue-50 text-blue-900",
    rail: "border-l-blue-400",
    ring: "ring-blue-300 focus-visible:ring-blue-400",
  },
  cyan: {
    accent: "bg-cyan-500",
    surface: "border-cyan-200 bg-cyan-50/70",
    active: "border-cyan-400 bg-cyan-50 text-cyan-950 shadow-sm",
    subtle: "border-cyan-100 bg-cyan-50/45 text-cyan-900",
    number: "bg-cyan-600 text-white",
    chip: "border-cyan-200 bg-cyan-50 text-cyan-900",
    rail: "border-l-cyan-400",
    ring: "ring-cyan-300 focus-visible:ring-cyan-400",
  },
  emerald: {
    accent: "bg-emerald-500",
    surface: "border-emerald-200 bg-emerald-50/70",
    active: "border-emerald-400 bg-emerald-50 text-emerald-950 shadow-sm",
    subtle: "border-emerald-100 bg-emerald-50/45 text-emerald-900",
    number: "bg-emerald-600 text-white",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-900",
    rail: "border-l-emerald-400",
    ring: "ring-emerald-300 focus-visible:ring-emerald-400",
  },
  amber: {
    accent: "bg-amber-500",
    surface: "border-amber-200 bg-amber-50/80",
    active: "border-amber-400 bg-amber-50 text-amber-950 shadow-sm",
    subtle: "border-amber-100 bg-amber-50/55 text-amber-900",
    number: "bg-amber-500 text-amber-950",
    chip: "border-amber-200 bg-amber-50 text-amber-900",
    rail: "border-l-amber-400",
    ring: "ring-amber-300 focus-visible:ring-amber-400",
  },
  rose: {
    accent: "bg-rose-500",
    surface: "border-rose-200 bg-rose-50/70",
    active: "border-rose-400 bg-rose-50 text-rose-950 shadow-sm",
    subtle: "border-rose-100 bg-rose-50/45 text-rose-900",
    number: "bg-rose-600 text-white",
    chip: "border-rose-200 bg-rose-50 text-rose-900",
    rail: "border-l-rose-400",
    ring: "ring-rose-300 focus-visible:ring-rose-400",
  },
  violet: {
    accent: "bg-violet-500",
    surface: "border-violet-200 bg-violet-50/70",
    active: "border-violet-400 bg-violet-50 text-violet-950 shadow-sm",
    subtle: "border-violet-100 bg-violet-50/45 text-violet-900",
    number: "bg-violet-600 text-white",
    chip: "border-violet-200 bg-violet-50 text-violet-900",
    rail: "border-l-violet-400",
    ring: "ring-violet-300 focus-visible:ring-violet-400",
  },
  teal: {
    accent: "bg-teal-500",
    surface: "border-teal-200 bg-teal-50/70",
    active: "border-teal-400 bg-teal-50 text-teal-950 shadow-sm",
    subtle: "border-teal-100 bg-teal-50/45 text-teal-900",
    number: "bg-teal-600 text-white",
    chip: "border-teal-200 bg-teal-50 text-teal-900",
    rail: "border-l-teal-400",
    ring: "ring-teal-300 focus-visible:ring-teal-400",
  },
  slate: {
    accent: "bg-slate-500",
    surface: "border-slate-200 bg-slate-50",
    active: "border-slate-400 bg-slate-100 text-slate-950 shadow-sm",
    subtle: "border-slate-200 bg-slate-50 text-slate-800",
    number: "bg-slate-700 text-white",
    chip: "border-slate-200 bg-slate-50 text-slate-800",
    rail: "border-l-slate-400",
    ring: "ring-slate-300 focus-visible:ring-slate-400",
  },
  indigo: {
    accent: "bg-indigo-500",
    surface: "border-indigo-200 bg-indigo-50/70",
    active: "border-indigo-400 bg-indigo-50 text-indigo-950 shadow-sm",
    subtle: "border-indigo-100 bg-indigo-50/45 text-indigo-900",
    number: "bg-indigo-600 text-white",
    chip: "border-indigo-200 bg-indigo-50 text-indigo-900",
    rail: "border-l-indigo-400",
    ring: "ring-indigo-300 focus-visible:ring-indigo-400",
  },
};

const sectionColorByKey: Record<string, ManualTopicColor> = {
  entry: "blue",
  usage: "cyan",
  architecture: "slate",
  decision: "violet",
  assets: "amber",
  "admin-finance": "emerald",
  "knowledge-automation": "teal",
  "developer-history": "indigo",
};

function manualChapterHref(chapter: ManualChapterConfig) {
  return `/manual/${encodeURIComponent(chapter.slug)}`;
}

function manualTopicHref(topicKey: string, audience: ManualAudience) {
  const params = new URLSearchParams();
  if (audience === "developer") params.set("audience", "developer");
  params.set("topic", topicKey);
  return `/manual?${params.toString()}`;
}

function selectedTopicFromUrl(
  topics: ManualTopicNodeConfig[],
  initialTopicKey: string | undefined,
  activeChapterSlug: string | undefined,
  chapterBySlug: Map<string, ManualChapterConfig>,
) {
  if (initialTopicKey && topics.some((topic) => topic.key === initialTopicKey)) return initialTopicKey;
  if (typeof window !== "undefined") {
    const topicKey = new URLSearchParams(window.location.search).get("topic");
    if (topicKey && topics.some((topic) => topic.key === topicKey)) return topicKey;
  }
  const activeChapter = activeChapterSlug ? chapterBySlug.get(activeChapterSlug) : undefined;
  const chapterTopicKey = activeChapter?.topics.find((key) => topics.some((topic) => topic.key === key));
  if (chapterTopicKey) return chapterTopicKey;
  const containingTopic = activeChapterSlug ? topics.find((topic) => topic.chapterSlugs.includes(activeChapterSlug)) : undefined;
  return containingTopic?.key ?? topics[0]?.key ?? "";
}

function ChapterCard({
  chapter,
  color,
  topicByKey,
  active,
}: {
  chapter: ManualChapterConfig;
  color: ManualTopicColor;
  topicByKey: Map<string, ManualTopicNodeConfig>;
  active?: boolean;
}) {
  const style = topicColorStyles[color];
  const chapterTopics = chapter.topics.map((key) => topicByKey.get(key)).filter((topic): topic is ManualTopicNodeConfig => topic != null).slice(0, 3);

  return (
    <Link
      href={manualChapterHref(chapter)}
      className={`group flex min-w-0 items-start gap-2 rounded-lg border border-l-4 bg-white/80 px-2.5 py-2 outline-none transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-offset-2 ${
        active ? "ring-2 ring-offset-1" : ""
      } ${style.rail} ${style.ring}`}
    >
      <span className={`flex h-7 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-black ${style.number}`}>
        {chapter.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-bold leading-snug text-foreground group-hover:underline">
            {chapter.title}
          </span>
          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
        <span className="mt-0.5 line-clamp-1 block text-[11px] leading-relaxed text-muted-foreground">
          {chapter.summary}
        </span>
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          {chapterTopics.slice(0, 2).map((topic) => {
            const topicStyle = topicColorStyles[topic.color];
            return (
              <span key={topic.key} className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${topicStyle.chip}`}>
                {topic.label}
              </span>
            );
          })}
          {chapter.screens?.slice(0, 1).map((screen) => (
            <span key={screen} className="rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
              {screen}
            </span>
          ))}
          {active && (
            <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-black leading-none ${style.chip}`}>
              表示中
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}

function ChapterList({
  chapters,
  color,
  topicByKey,
  activeChapterSlug,
}: {
  chapters: ManualChapterConfig[];
  color: ManualTopicColor;
  topicByKey: Map<string, ManualTopicNodeConfig>;
  activeChapterSlug?: string;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
      {chapters.map((chapter) => (
        <ChapterCard
          key={chapter.slug}
          chapter={chapter}
          color={color}
          topicByKey={topicByKey}
          active={chapter.slug === activeChapterSlug}
        />
      ))}
    </div>
  );
}

function SectionBlock({
  section,
  sectionChapters,
  topicByKey,
  sectionNumber,
}: {
  section: ManualSectionConfig;
  sectionChapters: ManualChapterConfig[];
  topicByKey: Map<string, ManualTopicNodeConfig>;
  sectionNumber: number;
}) {
  const color = sectionColorByKey[section.key] ?? "blue";
  const style = topicColorStyles[color];

  if (sectionChapters.length === 0) return null;

  return (
    <section id={`manual-section-${section.key}`} className="scroll-mt-24">
      <div className={`rounded-lg border bg-white p-4 shadow-sm ${style.surface}`}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="mb-1 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${style.accent}`} aria-hidden="true" />
            <h3 className="text-base font-black text-foreground">
              <span className="mr-2 tabular-nums">{sectionNumber}.</span>
              {section.label}
            </h3>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${style.chip}`}>
            {sectionChapters.length} chapters
          </span>
        </div>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{section.description}</p>
        <div className="mt-3 divide-y divide-slate-200/70 overflow-hidden rounded-md border border-slate-200 bg-white/75">
          {sectionChapters.map((chapter) => {
            const chapterTopics = chapter.topics
              .map((key) => topicByKey.get(key))
              .filter((topic): topic is ManualTopicNodeConfig => topic != null)
              .slice(0, 2);
            return (
              <Link
                key={chapter.slug}
                id={`manual-chapter-${chapter.slug}`}
                href={manualChapterHref(chapter)}
                className="grid gap-2 px-3 py-2.5 transition-colors hover:bg-slate-50 sm:grid-cols-[4.2rem_minmax(0,1fr)]"
              >
                <span className="text-xs font-black tabular-nums text-slate-500">{chapter.number}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-black leading-snug text-slate-950">{chapter.title}</span>
                  <span className="mt-0.5 line-clamp-1 block text-xs leading-relaxed text-slate-600">
                    {chapter.summary}
                  </span>
                  {chapterTopics.length > 0 && (
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {chapterTopics.map((topic) => {
                        const topicStyle = topicColorStyles[topic.color];
                        return (
                          <span key={topic.key} className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${topicStyle.chip}`}>
                            {topic.label}
                          </span>
                        );
                      })}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ManualGlobalToc({
  groups,
  activeChapterSlug,
}: {
  groups: { section: ManualSectionConfig; chapters: ManualChapterConfig[] }[];
  activeChapterSlug?: string;
}) {
  const initialOpen = useMemo(() => {
    return Object.fromEntries(groups.map((group) => [group.section.key, true]));
  }, [groups]);
  const [openById, setOpenById] = useState<Record<string, boolean>>(initialOpen);

  useEffect(() => {
    setOpenById(initialOpen);
  }, [initialOpen]);

  if (groups.length === 0) return null;

  function toggle(id: string) {
    setOpenById((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 border-b border-slate-200 pb-2">
        <h2 className="text-sm font-black text-slate-950">目次</h2>
      </div>
      <div className="space-y-2">
        {groups.map(({ section, chapters: sectionChapters }, sectionIndex) => {
          const isOpen = Boolean(openById[section.key]);
          const sectionNumber = sectionIndex + 1;
          return (
            <div key={section.key} className="border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggle(section.key)}
                  className="grid size-5 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  aria-label={isOpen ? `${section.label} を閉じる` : `${section.label} を開く`}
                  aria-expanded={isOpen}
                >
                  {isOpen ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={() => toggle(section.key)}
                  className="min-w-0 flex-1 rounded-md px-1.5 py-1 text-left leading-snug text-slate-950 transition-colors hover:bg-slate-50"
                >
                  <span className="grid min-w-0 grid-cols-[1.7rem_minmax(0,1fr)] items-baseline gap-1.5">
                    <span className="text-[11px] font-black tabular-nums text-slate-500">{sectionNumber}.</span>
                    <span className="min-w-0 truncate text-[12px] font-black">{section.label}</span>
                  </span>
                </button>
              </div>
              {isOpen && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {sectionChapters.map((chapter) => {
                    const isActive = chapter.slug === activeChapterSlug;
                    return (
                      <Link
                        key={chapter.slug}
                        href={manualChapterHref(chapter)}
                        className={`grid grid-cols-[2.4rem_minmax(0,1fr)] gap-1.5 rounded-md px-1.5 py-1.5 text-[11px] leading-snug transition-colors ${
                          isActive
                            ? "bg-cyan-50 font-black text-cyan-950 ring-1 ring-cyan-200"
                            : "font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                        }`}
                      >
                        <span className="tabular-nums text-slate-500">{chapter.number}</span>
                        <span className="min-w-0">{chapter.title}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ManualMapClient({
  audience,
  chapters,
  topics,
  activeChapterSlug,
  children,
  initialTopicKey,
  showDirectory = true,
}: ManualMapClientProps) {
  const router = useRouter();
  const chapterBySlug = useMemo(() => new Map(chapters.map((chapter) => [chapter.slug, chapter])), [chapters]);
  const topicByKey = useMemo(() => new Map(topics.map((topic) => [topic.key, topic])), [topics]);
  const initialSelectedKey = useMemo(
    () => selectedTopicFromUrl(topics, initialTopicKey, activeChapterSlug, chapterBySlug),
    [activeChapterSlug, chapterBySlug, initialTopicKey, topics],
  );
  const [selectedKey, setSelectedKey] = useState(initialSelectedKey);
  const configuredSlugs = useMemo(() => new Set(MANUAL_CHAPTERS.map((chapter) => chapter.slug)), []);
  const groupedSlugs = useMemo(() => new Set(MANUAL_SECTIONS.flatMap((section) => section.slugs)), []);

  useEffect(() => {
    setSelectedKey(initialSelectedKey);
  }, [initialSelectedKey]);

  const selected = topicByKey.get(selectedKey) ?? topics[0];
  const selectedStyle = selected ? topicColorStyles[selected.color] : topicColorStyles.blue;
  const visibleSections = useMemo(
    () =>
      MANUAL_SECTIONS.map((section) => ({
        section,
        chapters: section.slugs
          .map((slug) => chapterBySlug.get(slug))
          .filter((chapter): chapter is ManualChapterConfig => chapter != null),
      })).filter((group) => group.chapters.length > 0),
    [chapterBySlug],
  );
  const uncategorized = chapters.filter((chapter) => !groupedSlugs.has(chapter.slug));
  const missingMetadata = chapters.filter((chapter) => !configuredSlugs.has(chapter.slug));

  function selectTopic(key: string) {
    if (!showDirectory) {
      router.push(manualTopicHref(key, audience));
      return;
    }

    setSelectedKey(key);
    const url = new URL(window.location.href);
    if (audience === "developer") {
      url.searchParams.set("audience", "developer");
    } else {
      url.searchParams.delete("audience");
    }
    url.searchParams.set("topic", key);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);

    const firstChapterSlug = topicByKey.get(key)?.chapterSlugs.find((slug) => chapterBySlug.has(slug));
    if (firstChapterSlug) {
      window.setTimeout(() => {
        document.getElementById(`manual-chapter-${firstChapterSlug}`)?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      }, 0);
    }
  }

  if (!selected) return null;

  return (
    <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
        <div className="space-y-3">
          <ManualGlobalToc groups={visibleSections} activeChapterSlug={activeChapterSlug} />

          <div className="rounded-lg border border-border bg-background p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-foreground">カテゴリメニュー</h2>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${selectedStyle.chip}`}>
                {audience === "developer" ? "dev" : "user"}
              </span>
            </div>

            <div className="space-y-1.5">
              {topics.map((topic) => {
                const Icon = iconMap[topic.icon];
                const style = topicColorStyles[topic.color];
                const isActive = topic.key === selected.key;
                const visibleCount = topic.chapterSlugs.filter((slug) => chapterBySlug.has(slug)).length;
                return (
                  <button
                    key={topic.key}
                    type="button"
                    onClick={() => selectTopic(topic.key)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      isActive ? style.active : `${style.subtle} hover:brightness-95`
                    }`}
                  >
                    <span className={`grid size-7 shrink-0 place-items-center rounded-md ${style.number}`}>
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-black">{topic.label}</span>
                      <span className="block text-[10px] font-semibold opacity-70">{visibleCount} chapters</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 space-y-6">
        {children}

        {showDirectory && (
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-black text-foreground">セクション別目次</h2>
            </div>
            <div className="space-y-8">
              {visibleSections.map(({ section, chapters: sectionChapters }, sectionIndex) => (
                <SectionBlock
                  key={section.key}
                  section={section}
                  sectionChapters={sectionChapters}
                  topicByKey={topicByKey}
                  sectionNumber={sectionIndex + 1}
                />
              ))}
            </div>
          </section>
        )}

        {showDirectory && missingMetadata.length > 0 && (
          <section className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
            <h3 className="text-sm font-black text-amber-950">メタデータ未設定</h3>
            <div className="mt-3">
              <ChapterList chapters={missingMetadata} color="amber" topicByKey={topicByKey} activeChapterSlug={activeChapterSlug} />
            </div>
          </section>
        )}

        {showDirectory && uncategorized.length > 0 && (
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-950">未分類</h3>
            <div className="mt-3">
              <ChapterList chapters={uncategorized} color="slate" topicByKey={topicByKey} activeChapterSlug={activeChapterSlug} />
            </div>
          </section>
        )}

        {showDirectory && (
          <section id="manual-all-chapters" className="scroll-mt-24">
            <h3 className="text-sm font-black text-foreground">全章一覧</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {chapters.map((chapter) => {
                const topic = chapter.topics.map((key) => topicByKey.get(key)).find(Boolean);
                const style = topicColorStyles[topic?.color ?? "slate"];
                return (
                  <Link
                    key={chapter.slug}
                    href={manualChapterHref(chapter)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors hover:brightness-95 ${style.chip}`}
                  >
                    {chapter.number}. {chapter.title}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
