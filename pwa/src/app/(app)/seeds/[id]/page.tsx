"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeedDetailModal } from "@/components/seeds/SeedDetailModal";

/**
 * シーズ詳細ページ。
 * 通常は /seeds から行クリックでモーダルが開く。
 * このページは直接 URL で開いた / 共有された場合のフォールバック。
 * 閉じるとリスト画面に戻る。
 */
export default function SeedDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6">
      <div className="mb-3 text-xs text-muted-foreground">
        <Link href="/seeds" className="hover:text-foreground">← Seeds リスト</Link>
      </div>
      <SeedDetailModal
        key={reloadKey}
        seedId={id}
        createMode={false}
        onClose={() => router.push("/seeds")}
        onSaved={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}
