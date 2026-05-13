"use client";

/**
 * admin/projects の「メンバー」列クリックで開く編集モーダル。
 * ProjectMembersEditor を Dialog でラップしただけ (= UI / 保存ロジック共通)。
 *
 * 旧 AdminProjectRoleEditModal (PL/PM/Closer ロール別、フラグ単一編集) は
 * このモーダルに統合され削除済 (2026-05-13)。
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProjectMembersEditor } from "@/components/project-members/ProjectMembersEditor";

interface Props {
  projectId: string;
  projectName: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function AdminProjectMembersModal({ projectId, projectName, open, onClose, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="!max-w-3xl sm:!max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{projectName} — PJ メンバー編集</DialogTitle>
        </DialogHeader>
        <ProjectMembersEditor
          projectId={projectId}
          onSaved={() => onSaved?.()}
        />
      </DialogContent>
    </Dialog>
  );
}
