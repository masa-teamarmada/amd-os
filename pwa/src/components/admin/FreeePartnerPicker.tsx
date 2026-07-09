"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FreeePartnerOption = {
  id: string;
  name: string;
  code: string | null;
  shortcut1: string | null;
  shortcut2: string | null;
  kana: string | null;
};

type PartnersPayload = {
  ok?: boolean;
  partners?: FreeePartnerOption[];
  error?: string;
};

type Props = {
  value: string | null;
  initialQuery?: string | null;
  placeholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  onSelect: (partner: FreeePartnerOption) => void;
  onClear?: () => void;
};

function partnerMeta(partner: FreeePartnerOption) {
  return [partner.code, partner.shortcut1, partner.shortcut2, `ID ${partner.id}`].filter(Boolean).join(" / ");
}

export function FreeePartnerPicker({
  value,
  initialQuery,
  placeholder = "freee取引先を検索",
  compact = false,
  autoFocus = false,
  disabled = false,
  className,
  onSelect,
  onClear,
}: Props) {
  const [query, setQuery] = useState(initialQuery?.trim() || "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<FreeePartnerOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    setQuery(initialQuery?.trim() || "");
  }, [initialQuery]);

  useEffect(() => {
    if (!open && query.trim().length === 0) return;

    const seq = ++requestSeq.current;
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ query: query.trim(), limit: "60" });
        const res = await fetch(`/api/admin/freee-partners?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await res.json() as PartnersPayload;
        if (seq !== requestSeq.current) return;
        if (!res.ok || payload.ok === false) {
          setOptions([]);
          setError(payload.error || "freee取引先を取得できなかった");
          return;
        }
        setOptions(Array.isArray(payload.partners) ? payload.partners : []);
      } catch (caught) {
        if ((caught as Error).name === "AbortError") return;
        if (seq !== requestSeq.current) return;
        setOptions([]);
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [open, query]);

  const selected = useMemo(() => options.find((option) => option.id === value) ?? null, [options, value]);

  function choose(partner: FreeePartnerOption) {
    onSelect(partner);
    setQuery(partner.name);
    setOpen(false);
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          autoFocus={autoFocus}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className={cn("bg-background pl-8", compact ? "h-7 text-xs" : "h-9")}
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {value && (
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="min-w-0 truncate">
            選択中: {selected ? selected.name : `freee ID ${value}`}
          </span>
          {onClear && (
            <Button type="button" size="xs" variant="ghost" onClick={onClear} className="h-5 px-1.5">
              <X className="size-3" />
              外す
            </Button>
          )}
        </div>
      )}

      {open && (
        <div
          className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          onMouseDown={(event) => event.preventDefault()}
        >
          {error ? (
            <p className="px-2 py-2 text-xs text-red-700">{error}</p>
          ) : options.length === 0 && !loading ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">候補が見つからないよ</p>
          ) : (
            options.map((partner) => (
              <button
                key={partner.id}
                type="button"
                onClick={() => choose(partner)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-muted focus:bg-muted"
              >
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-border">
                  {value === partner.id && <Check className="size-3 text-emerald-700" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-foreground">{partner.name}</span>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">{partnerMeta(partner)}</span>
                </span>
              </button>
            ))
          )}
          {loading && <p className="px-2 py-2 text-xs text-muted-foreground">読み込み中...</p>}
        </div>
      )}
    </div>
  );
}
