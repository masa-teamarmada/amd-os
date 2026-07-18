"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlus } from "lucide-react";

export function ProjectMemberAccountForm() {
  const router = useRouter();
  const [codeName, setCodeName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setCreated(false);
    try {
      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeName, memberName, email }),
      });
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; member?: { member_id?: string } };
      if (!response.ok || !payload.ok) throw new Error(payload.error || `登録に失敗 (${response.status})`);
      setMessage(`${payload.member?.member_id || "新規メンバー"} をPJ限定アカウントとして登録したよ。次にPJへ追加してね。`);
      setCreated(true);
      setCodeName("");
      setMemberName("");
      setEmail("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登録に失敗したよ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-5 rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sky-100 text-sky-800">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">PJ限定アカウントを追加</h2>
          <p className="mt-1 text-xs text-muted-foreground">登録後、Admin PJのメンバー設定でSXなど参加させるPJを指定する。</p>
        </div>
      </div>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_1fr_1.6fr_auto] md:items-end">
        <label className="grid gap-1 text-[11px] text-muted-foreground">
          codeName
          <input value={codeName} onChange={(event) => setCodeName(event.target.value)} required className="h-9 rounded border border-border bg-background px-2 text-sm text-foreground" placeholder="例: 杉浦" />
        </label>
        <label className="grid gap-1 text-[11px] text-muted-foreground">
          表示名
          <input value={memberName} onChange={(event) => setMemberName(event.target.value)} className="h-9 rounded border border-border bg-background px-2 text-sm text-foreground" placeholder="任意" />
        </label>
        <label className="grid gap-1 text-[11px] text-muted-foreground">
          Googleアカウント
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="h-9 rounded border border-border bg-background px-2 text-sm text-foreground" placeholder="name@example.ac.jp" />
        </label>
        <button type="submit" disabled={saving} className="h-9 rounded bg-foreground px-4 text-xs font-semibold text-background disabled:opacity-50">
          {saving ? "登録中" : "登録"}
        </button>
      </form>
      {message && (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          {message}{created && <> <Link href="/admin/projects" className="font-medium text-sky-700 underline underline-offset-2">Admin PJを開く</Link></>}
        </p>
      )}
    </section>
  );
}
