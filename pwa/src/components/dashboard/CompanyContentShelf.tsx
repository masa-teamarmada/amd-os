"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { History, ImageIcon, Newspaper, ShieldCheck, Users } from "lucide-react";

export interface CompanyMemberPreview {
  memberId: string;
  codeName: string;
  displayName: string;
  role: string | null;
  status: string;
  projectCount: number;
}

export interface CompanyHistoryPreview {
  id: string;
  projectId: string | null;
  occurredOn: string | null;
  title: string;
  kind: string | null;
}

export interface CompanyPhotoPreview {
  id: string;
  title: string;
  meta: string;
  status: "unknown" | "internal_ok" | "public_ok";
}

export interface CompanyMediaMentionPreview {
  id: string;
  projectId: string;
  projectName: string;
  occurredOn: string;
  title: string;
  mediaName: string;
  kind: string;
  sourceUrl: string | null;
}

interface Props {
  members: CompanyMemberPreview[];
  history: CompanyHistoryPreview[];
  photos: CompanyPhotoPreview[];
  mediaMentions: CompanyMediaMentionPreview[];
}

export function CompanyContentShelf({ members, history, photos, mediaMentions }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Company Content
          </p>
          <h2 className="text-base font-semibold text-foreground">Team / History / Media / Photo</h2>
        </div>
        <span className="hidden rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">
          Admin draft
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <ShelfColumn
          icon={<Users className="h-4 w-4" />}
          title="メンバー"
          countLabel={`${members.length} active`}
        >
          <div className="space-y-2">
            {members.slice(0, 6).map((member) => (
              <Link
                key={member.memberId}
                href={`/mypage?memberId=${member.memberId}`}
                className="flex min-h-12 items-center gap-3 rounded-md border border-border/70 bg-white px-3 py-2 transition-colors hover:bg-muted/30"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sky-50 text-[11px] font-semibold text-sky-800">
                  {initials(member.codeName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{member.displayName}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {member.role || member.status} / {member.projectCount} PJ
                  </span>
                </span>
              </Link>
            ))}
            {members.length === 0 && (
              <EmptyLine text="active member profile はまだ読み込めていません" />
            )}
          </div>
        </ShelfColumn>

        <ShelfColumn
          icon={<History className="h-4 w-4" />}
          title="沿革"
          countLabel={`${history.length} events`}
        >
          <div className="space-y-2">
            {history.slice(0, 6).map((event) => (
              <div key={event.id} className="rounded-md border border-border/70 bg-white px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {event.occurredOn ? event.occurredOn.replaceAll("-", ".") : "date tbd"}
                  </span>
                  {event.projectId && (
                    <span className="rounded border border-border bg-muted/30 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                      {event.projectId}
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground">{event.title}</p>
                {event.kind && <p className="mt-1 text-[11px] text-muted-foreground">{event.kind}</p>}
              </div>
            ))}
            {history.length === 0 && (
              <EmptyLine text="history は Notion 移植レビュー後に増やします" />
            )}
          </div>
        </ShelfColumn>

        <ShelfColumn
          icon={<Newspaper className="h-4 w-4" />}
          title="メディア掲載"
          countLabel={`${mediaMentions.length} items`}
        >
          <div className="space-y-2">
            {mediaMentions.map((item) => (
              <div key={item.id} className="rounded-md border border-border/70 bg-white px-3 py-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                    {item.projectName}
                  </span>
                  <KindBadge kind={item.kind} />
                  <span className="font-mono text-[10px] text-muted-foreground ml-auto">
                    {item.occurredOn.replaceAll("-", ".")}
                  </span>
                </div>
                {item.sourceUrl ? (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 line-clamp-2 block text-sm font-medium leading-snug text-foreground hover:underline"
                  >
                    {item.title}
                  </a>
                ) : (
                  <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground">{item.title}</p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">{item.mediaName}</p>
              </div>
            ))}
            {mediaMentions.length === 0 && (
              <EmptyLine text="メディア掲載記録はまだありません" />
            )}
          </div>
        </ShelfColumn>

        <ShelfColumn
          icon={<ImageIcon className="h-4 w-4" />}
          title="photo"
          countLabel={`${photos.length} review`}
        >
          <div className="space-y-2">
            {photos.map((photo) => (
              <div key={photo.id} className="overflow-hidden rounded-md border border-border/70 bg-white">
                <div className="flex h-16 items-center justify-center bg-[linear-gradient(135deg,#f8fafc,#eef6ff_48%,#f7f3ea)]">
                  <ImageIcon className="h-5 w-5 text-slate-500/70" />
                </div>
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{photo.title}</p>
                    <PermissionBadge status={photo.status} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{photo.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </ShelfColumn>
      </div>
    </section>
  );
}

function ShelfColumn({
  icon,
  title,
  countLabel,
  children,
}: {
  icon: ReactNode;
  title: string;
  countLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md border border-border/70 bg-muted/30 text-muted-foreground">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="ml-auto rounded border border-border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
          {countLabel}
        </span>
      </div>
      {children}
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    coverage:      { label: "掲載",       cls: "border-sky-200 bg-sky-50 text-sky-700" },
    press_release: { label: "PR",         cls: "border-violet-200 bg-violet-50 text-violet-700" },
    funding:       { label: "資金調達",   cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    award:         { label: "受賞",       cls: "border-amber-200 bg-amber-50 text-amber-700" },
    pitch:         { label: "登壇",       cls: "border-orange-200 bg-orange-50 text-orange-700" },
    own_news:      { label: "自社News",   cls: "border-slate-200 bg-slate-50 text-slate-600" },
  };
  const { label, cls } = map[kind] ?? { label: kind, cls: "border-border bg-muted/30 text-muted-foreground" };
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${cls}`}>{label}</span>
  );
}

function PermissionBadge({ status }: { status: CompanyPhotoPreview["status"] }) {
  if (status === "public_ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
        <ShieldCheck className="h-3 w-3" />
        public
      </span>
    );
  }
  if (status === "internal_ok") {
    return (
      <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
        internal
      </span>
    );
  }
  return (
    <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
      review
    </span>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-white px-3 py-4 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function initials(value: string) {
  const ascii = value.match(/[A-Za-z0-9]+/g)?.join("");
  if (ascii) return ascii.slice(0, 2).toUpperCase();
  return value.slice(0, 2);
}
