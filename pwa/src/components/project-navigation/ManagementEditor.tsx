"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./navigation.module.css";

/**
 * 選択詳細ペインの追加・編集フォーム共通部品。
 * 既存 /api/project-workspace/[projectId]/management のPOST({resource,fields})・
 * PATCH({resource,id,patch}) 契約をそのまま再利用する — 新しいAPIは作らない。
 */

export type EditorField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "select" | "number" | "checkbox";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
};

type FieldValue = string | number | boolean | null;

function initialValueFor(field: EditorField, defaults: Record<string, FieldValue> | undefined) {
  if (defaults && field.key in defaults) return defaults[field.key];
  if (field.type === "checkbox") return false;
  if (field.type === "select") return field.options?.[0]?.value ?? "";
  return "";
}

export function useManagementMutation(projectId: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(input: { method: "POST" | "PATCH"; resource: string; id?: string; fields?: Record<string, unknown>; patch?: Record<string, unknown>; expectedVersion?: number }) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/project-workspace/${encodeURIComponent(projectId)}/management`, {
        method: input.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          input.method === "POST"
            ? { resource: input.resource, fields: input.fields }
            : { resource: input.resource, id: input.id, patch: input.patch, expected_version: input.expectedVersion },
        ),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 409) {
        // The editor's expected_version is now stale. Pull the current bundle before asking the
        // server component to refresh, then return success so every caller closes the stale form
        // instead of leaving a retry loop open against the same version.
        const latest = await fetch(`/api/project-workspace/${encodeURIComponent(projectId)}/management`, {
          headers: { "Cache-Control": "no-store" },
        });
        if (!latest.ok) throw new Error("他の人が先に更新したよ。最新内容を取得できなかったから、画面を再読み込みしてね");
        await latest.json();
        window.dispatchEvent(new CustomEvent("amd-management-conflict", {
          detail: "他の人が先に更新したため、最新内容に更新して編集を閉じたよ",
        }));
        router.refresh();
        return true;
      }
      if (!response.ok) throw new Error(body?.error || "保存できなかったよ");
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できなかったよ");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { submit, pending, error, setError };
}

export function InlineForm({
  fields,
  defaults,
  submitLabel,
  onSubmit,
  onCancel,
  pending,
  error,
}: {
  fields: EditorField[];
  defaults?: Record<string, FieldValue>;
  submitLabel: string;
  onSubmit: (values: Record<string, FieldValue>) => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
}) {
  const [values, setValues] = useState<Record<string, FieldValue>>(() => {
    const initial: Record<string, FieldValue> = {};
    for (const field of fields) initial[field.key] = initialValueFor(field, defaults);
    return initial;
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(values);
  };

  return (
    <form className={styles.formCard} onSubmit={handleSubmit}>
      {fields.map((field) => (
        <div key={field.key} className={styles.formRow}>
          <label htmlFor={`nav-field-${field.key}`}>{field.label}</label>
          {field.type === "textarea" ? (
            <textarea
              id={`nav-field-${field.key}`}
              value={String(values[field.key] ?? "")}
              placeholder={field.placeholder}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          ) : field.type === "select" ? (
            <select
              id={`nav-field-${field.key}`}
              value={String(values[field.key] ?? "")}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
            >
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          ) : field.type === "checkbox" ? (
            <input
              id={`nav-field-${field.key}`}
              type="checkbox"
              checked={Boolean(values[field.key])}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.checked }))}
            />
          ) : (
            <input
              id={`nav-field-${field.key}`}
              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
              value={String(values[field.key] ?? "")}
              placeholder={field.placeholder}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          )}
        </div>
      ))}
      {error && <p className={styles.formError}>{error}</p>}
      <div className={styles.formActions}>
        <button type="submit" className={styles.formSubmit} disabled={pending}>{pending ? "保存中…" : submitLabel}</button>
        <button type="button" className={styles.formCancel} onClick={onCancel} disabled={pending}>キャンセル</button>
      </div>
    </form>
  );
}
