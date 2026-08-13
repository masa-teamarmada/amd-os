import { isSupabaseConfigured } from "@/lib/supabase";
import { PageHeader, Panel } from "@/components/Panel";

/**
 * 設定画面。
 * 秘密値は「設定されているか / いないか」だけを出す。値そのものは絶対に描画しない。
 */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] py-2.5 text-sm last:border-0">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const connected = isSupabaseConfigured();

  return (
    <>
      <PageHeader title="設定" lead="接続の状態と、動いている環境の確認" />

      <div className="grid gap-4">
        <Panel title="データの保存先">
          <Row
            label="Supabase"
            value={connected ? "接続されています" : "未接続（ダミーデータで表示中）"}
          />
          <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
            {connected
              ? "本物のデータベースに繋がっています。"
              : "データベースはまだ用意していません。画面はダミーのデータで動いています。中身が固まったら、まさが Supabase プロジェクトを作ります（月額 $10）。"}
          </p>
        </Panel>

        <Panel title="環境">
          <Row label="アプリ" value="きよOS v0.1.0" />
          <Row label="実行モード" value={process.env.NODE_ENV} />
        </Panel>

        <Panel title="安全のためのきまり">
          <ul className="space-y-1.5 text-xs leading-relaxed text-[var(--muted)]">
            <li>・パスワードや API キーは、この画面にも保存先にも出しません</li>
            <li>・会社のシステム（AMD OS）のデータは、ここからは触りません</li>
            <li>・詳しくは AGENTS.common.md を見てください</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
