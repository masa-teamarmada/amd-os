"use client";

import { useEffect, useState } from "react";
import { fetchVcDetail } from "@/lib/vc-data";
import { fetchProjectsFromSupabase, type DashProject } from "@/lib/supabase-data";
import { createClient } from "@/lib/supabase/client";
import type { VcDetail } from "@/types/vc";
import { VcDetailBody } from "./VcDetailBody";
import { VcEditBody, type MemberLite } from "./VcEditBody";

/**
 * VC リストの行クリックで開くオーバーレイ。背景クリック / ESC / ✕ で閉じる。
 * 「編集」ボタンで同じモーダル内で view ↔ edit を切り替える。
 */
export function VcDetailModal({ vcId, onClose }: { vcId: string | null; onClose: () => void }) {
  const [data, setData] = useState<VcDetail | null>(null);
  const [projects, setProjects] = useState<DashProject[]>([]);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const loadDetail = async (id: string) => {
    const d = await fetchVcDetail(id);
    return d;
  };

  // VC ID 切替時に full reset + データ取得
  useEffect(() => {
    if (!vcId) {
      setData(null);
      setNotFound(false);
      setEditMode(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    setEditMode(false);
    Promise.all([
      loadDetail(vcId),
      fetchProjectsFromSupabase().catch(() => [] as DashProject[]),
      (async () => {
        const c = createClient();
        const { data } = await c.from("members").select("member_id, code_name").order("code_name");
        return (data ?? []) as MemberLite[];
      })(),
    ])
      .then(([d, ps, ms]) => {
        if (!d) setNotFound(true);
        else setData(d);
        setProjects(ps);
        setMembers(ms);
      })
      .finally(() => setLoading(false));
  }, [vcId]);

  // ESC で閉じる (edit mode のときは view に戻すだけ)
  useEffect(() => {
    if (!vcId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editMode) setEditMode(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vcId, editMode, onClose]);

  // 背景スクロールロック
  useEffect(() => {
    if (!vcId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [vcId]);

  if (!vcId) return null;

  const reload = async () => {
    const d = await loadDetail(vcId);
    if (d) setData(d);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-xl max-w-[1400px] w-full my-4 p-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {editMode && (
            <button
              onClick={() => setEditMode(false)}
              className="text-xs px-3 py-1 rounded border border-border hover:bg-accent"
            >
              完了
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="text-muted-foreground hover:text-foreground text-sm w-7 h-7 rounded hover:bg-accent flex items-center justify-center"
          >
            ✕
          </button>
        </div>
        {loading && <div className="py-10 text-center text-sm text-muted-foreground">読み込み中…</div>}
        {notFound && <div className="py-10 text-center text-sm">VC が見つかりません</div>}
        {data &&
          (editMode ? (
            <VcEditBody
              vcId={data.vc.id}
              data={data}
              projects={projects}
              members={members}
              onChange={reload}
            />
          ) : (
            <VcDetailBody data={data} onEdit={() => setEditMode(true)} />
          ))}
      </div>
    </div>
  );
}
