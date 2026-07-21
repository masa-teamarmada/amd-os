"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { EFFORT_CATEGORIES, type EffortCategory, type OsAccessScope } from "@/lib/project-workspace-types";

type MemberOption = { memberId: string; displayName: string };
type ManagementMilestoneOption = { id: string; title: string; track: string };

export function EffortEntryForm({
  projectId,
  currentWeekStart,
  currentMemberId,
  accessScope,
  members,
  managementMilestones,
}: {
  projectId: string;
  currentWeekStart: string;
  currentMemberId: string;
  accessScope: OsAccessScope;
  members: MemberOption[];
  managementMilestones: ManagementMilestoneOption[];
}) {
  const router = useRouter();
  const selectableMembers = useMemo(
    () => accessScope === "portfolio" ? members : members.filter((member) => member.memberId === currentMemberId),
    [accessScope, currentMemberId, members],
  );
  const [memberId, setMemberId] = useState(selectableMembers[0]?.memberId || currentMemberId);
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [category, setCategory] = useState<EffortCategory>("basic");
  const [plannedHours, setPlannedHours] = useState("");
  const [actualHours, setActualHours] = useState("");
  const [note, setNote] = useState("");
  const [managementTrack, setManagementTrack] = useState("");
  const [managementMilestoneId, setManagementMilestoneId] = useState("");
  const [deliverableLabel, setDeliverableLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/project-workspace/${encodeURIComponent(projectId)}/effort`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          weekStart,
          category,
          plannedHours: Number(plannedHours || 0),
          actualHours: Number(actualHours || 0),
          note: note.trim() || null,
          managementTrack: managementTrack || null,
          managementMilestoneId: managementMilestoneId || null,
          deliverableLabel: deliverableLabel.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || `保存に失敗 (${response.status})`);
      setMessage("保存したよ。配分表に反映した。 ");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存に失敗したよ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_1.4fr_auto] lg:items-end">
      <label className="grid gap-1.5 text-xs font-medium text-[#514e47]">
        メンバー
        <select
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
          className="h-11 rounded-md border border-[#d4ccbd] bg-[#fffdf7] px-3 text-sm text-[#24231f]"
        >
          {selectableMembers.map((member) => (
            <option key={member.memberId} value={member.memberId}>{member.displayName}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-[#514e47]">
        週の開始
        <input
          type="date"
          value={weekStart}
          onChange={(event) => setWeekStart(event.target.value)}
          className="h-11 rounded-md border border-[#d4ccbd] bg-[#fffdf7] px-3 text-sm text-[#24231f]"
          required
        />
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-[#514e47]">
        区分
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as EffortCategory)}
          className="h-11 rounded-md border border-[#d4ccbd] bg-[#fffdf7] px-3 text-sm text-[#24231f]"
        >
          {EFFORT_CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-[#514e47]">
        経営の柱
        <select
          value={managementTrack}
          onChange={(event) => { setManagementTrack(event.target.value); setManagementMilestoneId(""); }}
          className="h-11 rounded-md border border-[#d4ccbd] bg-[#fffdf7] px-3 text-sm text-[#24231f]"
        >
          <option value="">未接続</option>
          <option value="business_development">事業開発</option>
          <option value="technology_development">技術開発</option>
          <option value="funding">資金調達</option>
          <option value="organizational_building">体制構築</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-[#514e47]">
        接続ゲート
        <select
          value={managementMilestoneId}
          onChange={(event) => setManagementMilestoneId(event.target.value)}
          className="h-11 rounded-md border border-[#d4ccbd] bg-[#fffdf7] px-3 text-sm text-[#24231f]"
          disabled={!managementTrack}
        >
          <option value="">柱のみ</option>
          {managementMilestones.filter((milestone) => milestone.track === managementTrack).map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-[#514e47]">
        予定h
        <input
          type="number"
          min="0"
          max="168"
          step="0.25"
          value={plannedHours}
          onChange={(event) => setPlannedHours(event.target.value)}
          className="h-11 rounded-md border border-[#d4ccbd] bg-[#fffdf7] px-3 text-sm text-[#24231f]"
          placeholder="0"
        />
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-[#514e47]">
        実績h
        <input
          type="number"
          min="0"
          max="168"
          step="0.25"
          value={actualHours}
          onChange={(event) => setActualHours(event.target.value)}
          className="h-11 rounded-md border border-[#d4ccbd] bg-[#fffdf7] px-3 text-sm text-[#24231f]"
          placeholder="0"
        />
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-[#514e47]">
        メモ
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="h-11 rounded-md border border-[#d4ccbd] bg-[#fffdf7] px-3 text-sm text-[#24231f]"
          placeholder="例: 実験条件の再設計"
          maxLength={300}
        />
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-[#514e47]">
        次の成果
        <input
          type="text"
          value={deliverableLabel}
          onChange={(event) => setDeliverableLabel(event.target.value)}
          className="h-11 rounded-md border border-[#d4ccbd] bg-[#fffdf7] px-3 text-sm text-[#24231f]"
          placeholder="例: 試験条件表"
          maxLength={300}
        />
      </label>
      <button
        type="submit"
        disabled={saving || !memberId}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#256c55] px-4 text-sm font-semibold text-white transition hover:bg-[#1e5a47] disabled:opacity-50"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {saving ? "保存中" : "保存"}
      </button>
      {message && <p className="text-xs text-[#69665d] lg:col-span-full" role="status">{message}</p>}
    </form>
  );
}
