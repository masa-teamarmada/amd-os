"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchVcDetail } from "@/lib/vc-data";
import { fetchProjectsFromSupabase, type DashProject } from "@/lib/supabase-data";
import { createClient } from "@/lib/supabase/client";
import type { VcDetail } from "@/types/vc";
import { VcEditBody, type MemberLite } from "@/components/vc/VcEditBody";

/**
 * VC 編集ページ。直接 URL で開いた場合に使われるフォールバック。
 * 通常は /vcs リスト画面のモーダル内で編集 (VcDetailModal が VcEditBody をマウント)。
 */
export default function VcEditPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const [data, setData] = useState<VcDetail | null>(null);
  const [projects, setProjects] = useState<DashProject[]>([]);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const d = await fetchVcDetail(id);
    setData(d);
  };

  useEffect(() => {
    Promise.all([
      fetchVcDetail(id),
      fetchProjectsFromSupabase().catch(() => []),
      (async () => {
        const c = createClient();
        const { data } = await c.from("members").select("member_id, code_name").order("code_name");
        return (data ?? []) as MemberLite[];
      })(),
    ]).then(([d, ps, ms]) => {
      setData(d);
      setProjects(ps);
      setMembers(ms);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">読み込み中…</div>;
  if (!data) return <div className="p-6 text-sm">VC が見つかりません</div>;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          <Link href={`/vcs/${id}`} className="hover:text-foreground">← 詳細に戻る</Link>
        </div>
        <button
          onClick={() => router.push(`/vcs/${id}`)}
          className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent"
        >
          完了
        </button>
      </div>

      <VcEditBody vcId={id} data={data} projects={projects} members={members} onChange={reload} />
    </div>
  );
}
