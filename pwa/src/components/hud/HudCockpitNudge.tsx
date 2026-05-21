"use client";

interface Nudge {
  message: string;
  status: string;
  level: string;
  postedAt: string | null;
}

const LEVEL_TONE: Record<string, { label: string; border: string; fill: string; text: string }> = {
  info: { label: "INFO", border: "border-sky-300/55", fill: "bg-sky-300", text: "text-sky-50" },
  warn: { label: "WARN", border: "border-amber-300/65", fill: "bg-amber-300", text: "text-amber-50" },
  danger: { label: "ALERT", border: "border-rose-300/70", fill: "bg-rose-300", text: "text-rose-50" },
  ok: { label: "OK", border: "border-emerald-300/60", fill: "bg-emerald-300", text: "text-emerald-50" },
};

interface Props {
  nudges: Nudge[];
}

export function HudCockpitNudge({ nudges }: Props) {
  return (
    <section className="relative overflow-hidden border border-cyan-300/35 bg-slate-950/88 p-3 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[length:100%_8px]" />
      <div className="relative mb-3 flex items-center gap-2">
        <h3 className="text-[12px] font-black uppercase tracking-[0.18em] text-cyan-100">Tsukuyomi Memo</h3>
        <span className="h-px flex-1 bg-cyan-300/35" />
        <span className="text-[10px] font-bold tabular-nums text-cyan-200/80">{String(nudges.length).padStart(2, "0")}</span>
      </div>

      <div className="relative space-y-2.5">
        {nudges.length === 0 ? (
          <div className="border border-emerald-300/35 bg-emerald-300/8 px-3 py-2 text-[12px] leading-relaxed text-emerald-50">
            今は特に気になることないよ。順調！
          </div>
        ) : (
          nudges.map((n, i) => {
            const tone = LEVEL_TONE[n.level] ?? LEVEL_TONE.info;
            return (
              <div key={`${n.postedAt ?? "nudge"}-${i}`} className={`relative border ${tone.border} bg-slate-900/76 px-3 py-2.5`}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`h-2 w-8 ${tone.fill} shadow-[0_0_12px_rgba(103,232,249,0.55)]`} />
                  <span className={`text-[10px] font-black tracking-[0.18em] ${tone.text}`}>{tone.label}</span>
                  <span className="h-px flex-1 bg-cyan-300/18" />
                  {n.status && <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-200/60">{n.status}</span>}
                </div>
                <p className="text-[12px] leading-relaxed text-cyan-50/92">{n.message}</p>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
