export function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {title}
        </h3>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
