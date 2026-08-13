import { PageHeader, Panel, NotDecided } from "@/components/Panel";

/**
 * 「今日」画面。中身はまだ決まっていない（docs/DESIGN.md 参照）。
 * ここに置いてあるのは、形を見るためのダミーです。実データではありません。
 */

const DUMMY_SCHEDULE = [
  { time: "10:00", title: "（ここに予定が入ります）" },
  { time: "14:30", title: "（ここに予定が入ります）" },
];

const DUMMY_TODOS = [
  "（ここにやることが入ります）",
  "（ここにやることが入ります）",
];

export default function TodayPage() {
  return (
    <>
      <PageHeader
        title="今日"
        lead="1 日を 1 画面で見るところ。表示している内容はまだダミーです"
      />

      <div className="grid gap-4">
        <Panel title="今日の予定" hint="ダミー">
          <ul className="divide-y divide-[var(--line)]">
            {DUMMY_SCHEDULE.map((item, i) => (
              <li key={i} className="flex gap-4 py-2.5 text-sm">
                <span className="w-14 shrink-0 tabular-nums text-[var(--muted)]">
                  {item.time}
                </span>
                <span className="text-[var(--muted)]">{item.title}</span>
              </li>
            ))}
          </ul>
          <NotDecided>
            予定をどこから持ってくるか（Google カレンダー / 手で入力 / 両方）は
            まだ決まっていません。きよの使い方を聞いてから決めます。
          </NotDecided>
        </Panel>

        <Panel title="今日やること" hint="ダミー">
          <ul className="space-y-2">
            {DUMMY_TODOS.map((todo, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm text-[var(--muted)]">
                <span className="size-4 shrink-0 rounded border border-[var(--line)]" />
                {todo}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="ひとことメモ" hint="ダミー">
          <NotDecided>
            その日の記録を残す欄。保存先（この端末だけ / Supabase）が決まったら
            入力できるようにします。
          </NotDecided>
        </Panel>
      </div>
    </>
  );
}
