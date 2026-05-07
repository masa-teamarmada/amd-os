"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface Props {
  projectId: string;
  ym: string;
  open: boolean;
  onClose: () => void;
}

const supabase = createClient();

export function CockpitRoutineInvoiceSendConfirm({ projectId, ym, open, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function markSent() {
    setSubmitting(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("billing_cycles")
        .update({ invoice_sent_at: new Date().toISOString() })
        .eq("project_id", projectId)
        .eq("ym", ym);
      if (updateError) throw updateError;
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-background rounded-xl p-4 w-full max-w-sm space-y-3 shadow-xl">
        <h3 className="font-semibold">請求書、送付した？</h3>
        <p className="text-xs text-muted-foreground">送付済みとしてチェックが入ります</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            キャンセル
          </Button>
          <Button size="sm" onClick={markSent} disabled={submitting}>
            {submitting ? "処理中..." : "送付した"}
          </Button>
        </div>
      </div>
    </div>
  );
}
