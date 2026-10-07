import type { Metadata } from 'next';
import { SpacePermissionsAdminPanel } from '@/components/admin/SpacePermissionsAdminPanel';
export const metadata: Metadata = {title:{absolute:'Admin 閲覧・編集権限 - AMD OS'}};
export default function SpacePermissionsPage() {
  return <div className="min-w-0"><h1 className="text-lg font-semibold">閲覧・編集権限</h1><p className="mb-3 mt-1 text-xs text-muted-foreground">PJごとに、コックピット・ワークスペース・DDパッケージへ入れる人と編集できる範囲を確認する。</p><SpacePermissionsAdminPanel /></div>;
}
