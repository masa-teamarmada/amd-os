"use client";

/**
 * admin/projects のセル (PL / PM / クローザー) クリックで開く編集モーダル。
 *
 * - ロール 1 つだけを編集 (集合更新)
 * - 既存の他ロール (例: PL モーダル開いても is_pm/is_closer/role_label/join_ym は触らない)
 * - 「修正」ボタンで /api/admin/project-members/role に POST → incremental 更新
 *
 * 旧 AdminProjectMembersModal (全削除→挿入) は破壊的だったため廃止。
 */

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type RoleKind = "pl" | "pm" | "closer";

const ROLE_LABEL: Record<RoleKind, string> = {
  pl: "PL",
  pm: "PM",
  closer: "クローザー",
};

const ROLE_FLAG: Record<RoleKind, "is_pl" | "is_pm" | "is_closer"> = {
  pl: "is_pl",
  pm: "is_pm",
  closer: "is_closer",
};

interface MemberOption {
  memberId: string;
  display: string; // codeName 優先、無ければ memberName
  isAssigned: boolean; // モーダル開いた時点で該当ロールに割当て済みか
}

interface Props {
  projectId: string;
  projectName: string;
  role: RoleKind;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function AdminProjectRoleEditModal({ projectId, projectName, role, open, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<MemberOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const flagCol = ROLE_FLAG[role];
        const [memRes, pmRes] = await Promise.all([
          supabase
            .from("members")
            .select("member_id, member_name, code_name, status")
            .order("code_name", { ascending: true }),
          supabase
            .from("project_members")
            .select(`member_id, ${flagCol}`)
            .eq("project_id", projectId),
        ]);
        if (cancelled) return;
        if (memRes.error) throw new Error(memRes.error.message);
        if (pmRes.error) throw new Error(pmRes.error.message);

        const assignedSet = new Set<string>();
        for (const row of pmRes.data ?? []) {
          const r = row as Record<string, unknown>;
          if (r[flagCol]) assignedSet.add(String(r.member_id));
        }

        const opts: MemberOption[] = (memRes.data ?? [])
          .filter((m) => (m.status ?? "active") === "active" || assignedSet.has(m.member_id))
          .map((m) => ({
            memberId: m.member_id,
            display: m.code_name || m.member_name || m.member_id,
            isAssigned: assignedSet.has(m.member_id),
          }));
        setOptions(opts);
        setSelected(new Set(assignedSet));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, projectId, role]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      o.display.toLowerCase().includes(q) || o.memberId.toLowerCase().includes(q)
    );
  }, [options, filter]);

  const toggle = (memberId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const dirty = useMemo(() => {
    const orig = new Set(options.filter((o) => o.isAssigned).map((o) => o.memberId));
    if (orig.size !== selected.size) return true;
    for (const m of selected) if (!orig.has(m)) return true;
    return false;
  }, [options, selected]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/project-members/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          role,
          memberIds: Array.from(selected),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || `HTTP ${res.status}`);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="!max-w-md sm:!max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {projectName} — {ROLE_LABEL[role]} 編集
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">読み込み中...</p>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="メンバー検索"
              className="w-full border border-border rounded px-2 py-1.5 text-[13px] bg-background"
            />

            <div className="border border-border rounded-md max-h-[50vh] overflow-y-auto divide-y divide-border">
              {filtered.length === 0 && (
                <p className="text-[12px] text-muted-foreground py-4 text-center">該当なし</p>
              )}
              {filtered.map((o) => (
                <label
                  key={o.memberId}
                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(o.memberId)}
                    onChange={() => toggle(o.memberId)}
                  />
                  <span className="text-[13px] flex-1">{o.display}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{o.memberId}</span>
                </label>
              ))}
            </div>

            {error && <p className="text-[12px] text-destructive">{error}</p>}

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {selected.size} 名 選択中{dirty ? " (未保存)" : ""}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
                  キャンセル
                </Button>
                <Button size="sm" onClick={save} disabled={saving || !dirty}>
                  {saving ? "保存中..." : "修正"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
