export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Project validation is done in the cockpit page itself via GAS API
  return <>{children}</>;
}
