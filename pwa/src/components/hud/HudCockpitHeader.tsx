"use client";

const STATUS_TONE: Record<string, { label: string; bar: string; text: string }> = {
  active: { label: "ACTIVE", bar: "bg-cyan-300", text: "text-cyan-50" },
  sales: { label: "SALES", bar: "bg-sky-300", text: "text-sky-50" },
  draft: { label: "DRAFT", bar: "bg-violet-300", text: "text-violet-50" },
  ended: { label: "ENDED", bar: "bg-zinc-400", text: "text-zinc-200" },
  frozen: { label: "FROZEN", bar: "bg-amber-300", text: "text-amber-50" },
};

interface Props {
  project: {
    projectId: string;
	    projectName: string;
	    clientName: string;
	    status: string;
	    projectCategory?: string;
	  };
  currentYm: string;
  memberCount: number;
  initiativeScore?: number | null;
}

function projectGlyph(projectName: string, projectId: string) {
  const compact = projectName.replace(/[^A-Za-z0-9]/g, "");
  if (compact.length <= 4 && compact.length > 0) return compact.toUpperCase();
  const caps = compact.match(/[A-Z0-9]/g)?.join("") ?? "";
  if (caps.length >= 2) return caps.slice(0, 3);
  return projectId.replace(/^p/i, "P").toUpperCase();
}

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}.${ym.slice(4)}`;
}

function projectDisplayName(projectName: string, projectId: string) {
  const map: Record<string, string> = {
    p21: "SolvioraX",
    p20: "CryoX",
    p99: "Autonomous Adaptive Assembly",
  };
  return map[projectId] || projectName;
}

function categoryLabel(category: string | null | undefined) {
  if (category === "ecosystem") return "ECOSYSTEM";
  if (category === "advisor") return "ADVISOR";
  return "DTSU";
}

export function HudCockpitHeader({ project, currentYm, memberCount, initiativeScore = 0 }: Props) {
  const tone = STATUS_TONE[project.status] ?? {
    label: project.status.toUpperCase(),
    bar: "bg-cyan-200",
    text: "text-cyan-50",
  };
  const glyph = projectGlyph(project.projectName, project.projectId);
  const displayName = projectDisplayName(project.projectName, project.projectId);

  return (
    <header className="relative aspect-[1895/333] overflow-hidden text-cyan-50">
      <img
        src="/hud/hud_cockpit_header_frame_clean_alpha_trim_20260518.png"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-95"
      />
      <div className="relative h-full px-8 py-5">
        <div className="absolute left-[5.0%] top-[38px] flex h-[92px] w-[14.2%] items-center justify-center overflow-hidden">
          <span className={`relative translate-x-[-1px] translate-y-[1px] font-black leading-none tracking-[0.02em] text-white [text-shadow:0_0_22px_rgba(103,232,249,0.82)] ${glyph.length <= 2 ? "text-[60px]" : "text-[50px]"}`}>
            {glyph}
          </span>
        </div>
        <div className="absolute left-[25.0%] top-[48px] w-[25.8%] min-w-0">
          <div className="mb-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200/72">
            <span>PROJECT COCKPIT v2.6.0</span>
            <span className="h-px flex-1 bg-cyan-300/35" />
            <span>{project.projectId.toUpperCase()}</span>
          </div>
          <h1 className="truncate text-[34px] font-black leading-none tracking-[0.05em] text-cyan-100 [text-shadow:0_0_18px_rgba(103,232,249,0.72)]">
            {displayName}
          </h1>
          {project.clientName && (
            <p className="mt-3 truncate text-[13px] font-bold tracking-[0.04em] text-cyan-50/76">
              {project.clientName}
            </p>
          )}
        </div>
        <div className="absolute left-[55.4%] top-[44px] grid w-[24.4%] grid-cols-2 gap-x-7 gap-y-4">
          <HeaderDatum label="STATUS" value={tone.label} accent={tone.bar} className={tone.text} />
	          <HeaderDatum label="CATEGORY" value={categoryLabel(project.projectCategory)} />
          <HeaderDatum label="TEAM" value={`${memberCount || 0}名`} />
          <HeaderDatum label="CURRENT YM" value={formatYm(currentYm)} />
        </div>
        <div className="absolute left-[calc(91.10%_-_52px)] top-[calc(50.75%_-_52px)] grid h-[104px] w-[104px] place-items-center overflow-hidden">
          {initiativeScore == null ? <HeaderLifecycleSeal label={tone.label} /> : <HeaderInitiativeRing value={initiativeScore} />}
        </div>
      </div>
    </header>
  );
}

function HeaderLifecycleSeal({ label }: { label: string }) {
  return (
    <div className="grid h-[104px] w-[104px] place-items-center font-mono">
      <svg viewBox="0 0 104 104" className="h-[104px] w-[104px]" aria-hidden="true">
        <circle cx="52" cy="52" r="42" fill="rgba(2,8,18,.34)" stroke="rgba(212,212,216,.24)" strokeWidth="2" />
        <circle cx="52" cy="52" r="31" fill="none" stroke="rgba(212,212,216,.30)" strokeWidth="8" strokeDasharray="6 8" />
        <circle cx="52" cy="52" r="23" fill="rgba(2,8,18,.92)" stroke="rgba(212,212,216,.28)" strokeWidth="1" />
        <text x="52" y="56" textAnchor="middle" fill="#d4d4d8" fontSize="10" fontWeight="900">
          {label}
        </text>
      </svg>
    </div>
  );
}

function HeaderInitiativeRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const circumference = 2 * Math.PI * 31;
  return (
    <div className="relative grid h-[104px] w-[104px] place-items-center font-mono">
      <svg viewBox="0 0 104 104" className="h-[104px] w-[104px] drop-shadow-[0_0_18px_rgba(50,231,255,.38)]" aria-hidden="true">
        <circle cx="52" cy="52" r="42" fill="rgba(2,8,18,.38)" stroke="rgba(50,231,255,.20)" strokeWidth="2" />
        <circle cx="52" cy="52" r="35" fill="none" stroke="rgba(50,231,255,.16)" strokeWidth="8" />
        <circle
          cx="52"
          cy="52"
          r="31"
          fill="none"
          stroke="#32e7ff"
          strokeWidth="10"
          strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
          strokeLinecap="butt"
          transform="rotate(-90 52 52)"
        />
        <circle cx="52" cy="52" r="23" fill="rgba(2,8,18,.94)" stroke="rgba(124,248,255,.28)" strokeWidth="1" />
        <text x="52" y="57" textAnchor="middle" fill="#e7fbff" fontSize="17" fontWeight="900">
          {pct}
        </text>
      </svg>
      <span className="absolute bottom-[13px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[7px] font-black uppercase tracking-[0.12em] text-cyan-100/58">
        先手力
      </span>
    </div>
  );
}

function HeaderDatum({
  label,
  value,
  accent,
  className = "text-cyan-50",
}: {
  label: string;
  value: string;
  accent?: string;
  className?: string;
}) {
  return (
    <div className="min-w-0 border-b border-cyan-300/14 pb-1">
      <div className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/64">{label}</div>
      <div className={`truncate text-[13px] font-black tracking-[0.06em] ${className}`}>
        {accent && <span className={`mr-2 inline-block h-2 w-5 ${accent} shadow-[0_0_12px_currentColor]`} />}
        {value}
      </div>
    </div>
  );
}
