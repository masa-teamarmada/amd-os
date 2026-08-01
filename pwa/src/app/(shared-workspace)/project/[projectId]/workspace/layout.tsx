export default function SharedWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Never look up the project here: generateMetadata renders before the page's own
// access check, so a DB-backed title would leak project name/existence to an
// unauthorized caller. Always show a generic title regardless of auth outcome.
export async function generateMetadata() {
  return { title: "ワークスペース" };
}
