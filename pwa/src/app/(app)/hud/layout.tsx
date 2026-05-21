import { HudShell } from "@/components/hud/HudShell";

export default function HudLayout({ children }: { children: React.ReactNode }) {
  return <HudShell>{children}</HudShell>;
}
