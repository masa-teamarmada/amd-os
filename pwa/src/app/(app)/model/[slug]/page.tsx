import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BzmMarkdown } from "@/components/bzm/BzmMarkdown";
import { ModelSideNav, type ModelSideNavGroup } from "@/components/model/ModelSideNav";
import { BZM_SLUG_ALIASES } from "../../bzm/bzm-chapters";
import { buildModelSideNavGroups, getModelMarkdownSource, loadModelCurrent } from "../model-data";

/**
 * /model/[slug] — モデル台帳の各文書
 *
 * getModelMarkdownSource で md (model/ 配下 or 台帳が許可した bzm/ 配下) を読み、
 * BzmMarkdown (= 表・数式・見出しアンカー対応 renderer) で描画する。
 * admin 限定 (= model/layout.tsx)。
 */
export default async function ModelDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  const aliasTarget = BZM_SLUG_ALIASES[decoded];
  if (aliasTarget) {
    redirect(`/model/${aliasTarget}`);
  }

  const source = getModelMarkdownSource(decoded);
  if (!source) {
    notFound();
  }

  const current = loadModelCurrent();
  const navGroups: ModelSideNavGroup[] = current ? buildModelSideNavGroups(current) : [];

  return (
    <section className="grid gap-6 px-6 py-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
        <ModelSideNav groups={navGroups} activeSlug={decoded} />
      </aside>

      <div className="min-w-0">
        <article className="mx-auto max-w-3xl">
          <Link href="/model" className="mb-4 inline-block text-xs text-muted-foreground hover:text-foreground">
            ← モデル
          </Link>
          <BzmMarkdown source={source} />
        </article>
      </div>
    </section>
  );
}
