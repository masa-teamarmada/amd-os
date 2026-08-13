import type { ReactNode } from "react";

export function PageHeader({
  title,
  lead,
}: {
  title: string;
  lead?: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {lead ? <p className="mt-1 text-sm text-[var(--muted)]">{lead}</p> : null}
    </header>
  );
}

export function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {hint ? (
          <span className="text-[11px] text-[var(--muted)]">{hint}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** まだ中身が決まっていない枠に置く注記。 */
export function NotDecided({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-[var(--line)] px-3 py-4 text-xs leading-relaxed text-[var(--muted)]">
      {children}
    </p>
  );
}
