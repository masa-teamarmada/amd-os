import { ManualMapClient } from "./ManualMapClient";
import { ManualTsukuyomiFloat } from "./ManualTsukuyomiFloat";
import { MANUAL_TOPIC_NODES } from "./manual-chapters";
import { getManualBookChapters, getManualChapters, getManualSearchDocuments } from "./manual-data";

/**
 * /manual — AMD OS マニュアル index
 *
 * 単一マニュアル (= 2026-05-26 まさ #88 確定で audience 切替を廃止)。
 * 全章を section ごとに並べた目次 + テーマ別クリックマップ。
 */
export default async function ManualIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialTopicKey = Array.isArray(params.topic) ? params.topic[0] : params.topic;
  const allChapters = getManualChapters();
  const chapters = getManualBookChapters(allChapters);
  const searchDocuments = getManualSearchDocuments();
  const topics = MANUAL_TOPIC_NODES;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold">AMD OS マニュアル</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          AMD OS の使い方・データの裏側・過去判断・開発手順の正本。テーマから入り、気になる章へ横移動しながら全体像を掴むための入口。
        </p>
      </div>

      <ManualMapClient chapters={chapters} topics={topics} searchDocuments={searchDocuments} initialTopicKey={initialTopicKey} />

      <p className="mt-6 text-xs text-muted-foreground">
        正本: <code className="rounded bg-muted px-1">pwa/manual/*.md</code> (= git 管理)。
        新規セッション開始時 / 「なぜそうなってるか」を知りたい時に開く。
      </p>
      <ManualTsukuyomiFloat />
    </div>
  );
}
