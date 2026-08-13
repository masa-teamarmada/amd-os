import { SideNav, TabBar } from "@/components/OsNav";

export default function OsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh">
      <SideNav />
      <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>
      <TabBar />
    </div>
  );
}
