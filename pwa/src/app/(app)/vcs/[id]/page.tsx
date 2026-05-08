"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { fetchVcDetail } from "@/lib/vc-data";
import type { VcDetail } from "@/types/vc";
import { VcDetailBody } from "@/components/vc/VcDetailBody";

/**
 * VC 詳細ページ。通常閲覧は /vcs から行クリックでモーダルが開く。
 * このページは直接 URL で開いた / 共有された場合のフォールバック表示。
 */
export default function VcDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const [data, setData] = useState<VcDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchVcDetail(id)
      .then((d) => {
        if (!d) setNotFound(true);
        else setData(d);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">読み込み中…</div>;
  if (notFound || !data) {
    return (
      <div className="p-6 text-sm">
        VC が見つかりません。<Link href="/vcs" className="underline">VC リストに戻る</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <div className="mb-3 text-xs text-muted-foreground">
        <Link href="/vcs" className="hover:text-foreground">← VC リスト</Link>
      </div>
      <VcDetailBody data={data} />
    </div>
  );
}
