"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function MonthlyReportSelectors({ months, ym, template, disabled, onChange }: {
  months: string[]; ym: string; template: "internal" | "submission"; disabled?: boolean;
  onChange: (ym: string, template: "internal" | "submission") => void;
}) {
  const monthLabel = (value: string) => `${value.slice(0, 4)}年${Number(value.slice(4))}月`;
  return <>
    <Select value={ym} disabled={disabled} onValueChange={(value) => { if (value) onChange(value, template); }}>
      <SelectTrigger aria-label="報告対象月" className="h-9 min-w-32 max-sm:h-11"><SelectValue>{monthLabel(ym)}</SelectValue></SelectTrigger>
      <SelectContent>{months.map((month) => <SelectItem key={month} value={month}>{monthLabel(month)}</SelectItem>)}</SelectContent>
    </Select>
    <Select value={template} disabled={disabled} onValueChange={(value) => { if (value === "internal" || value === "submission") onChange(ym, value); }}>
      <SelectTrigger aria-label="報告書の種類" className="h-9 min-w-24 max-sm:h-11"><SelectValue>{template === "internal" ? "社内版" : "提出版"}</SelectValue></SelectTrigger>
      <SelectContent><SelectItem value="internal">社内版</SelectItem><SelectItem value="submission">提出版</SelectItem></SelectContent>
    </Select>
  </>;
}
