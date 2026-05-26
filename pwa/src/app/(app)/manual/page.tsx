import Link from "next/link";
import { ManualMapClient } from "./ManualMapClient";
import {
  MANUAL_TOPIC_NODES,
  isChapterVisibleForAudience,
  isTopicVisibleForAudience,
} from "./manual-chapters";
import { getManualAudience, getManualBookChapters, getManualChapters } from "./manual-data";

/**
 * /manual — AMD OS マニュアル index
 *
 * 左固定メニューとセクション別目次を主役にする。
 */

export default async function ManualIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string | string[]; topic?: string | string[] }>;
}) {
  const params = await searchParams;
  const audience = getManualAudience(params);
  const initialTopicKey = Array.isArray(params.topic) ? params.topic[0] : params.topic;
  const allChapters = getManualChapters();
  const chapters = getManualBookChapters(allChapters.filter((chapter) => isChapterVisibleForAudience(chapter, audience)));
  const topics = MANUAL_TOPIC_NODES.filter((topic) => isTopicVisibleForAudience(topic, audience));
  const isDeveloper = audience === "developer";

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold">AMD OS マニュアル</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {isDeveloper
              ? "設計、実装、抽出 routine、過去判断を追う開発者向けの章。内部事情や復旧ログはここに集約する。"
              : "AMD OS を使う人が、テーマから入り、気になる章へ横移動しながら全体像を掴むための入口。"}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-muted/20 p-1 text-xs font-semibold">
          <Link
            href="/manual"
            className={`rounded-md px-3 py-1.5 transition-colors ${
              !isDeveloper ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ユーザー向け
          </Link>
          <Link
            href="/manual?audience=developer"
            className={`rounded-md px-3 py-1.5 transition-colors ${
              isDeveloper ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            開発者向け
          </Link>
        </div>
      </div>

      <ManualMapClient audience={audience} chapters={chapters} topics={topics} initialTopicKey={initialTopicKey} />

      <p className="mt-6 text-xs text-muted-foreground">
        正本: <code className="rounded bg-muted px-1">pwa/manual/*.md</code> (= git 管理)。
        新規セッション開始時 / 「なぜそうなってるか」を知りたい時に開く。
      </p>
    </div>
  );
}
