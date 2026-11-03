import type {CurrentMemberAccess,WorkspaceProjectAccess} from '@/lib/project-workspace';
import type {SharedWorkspaceAccess} from '@/lib/project-shared-workspace-access';
export type ProjectPageActor={
 external:boolean;canReadDraft:boolean;canEditRecords:boolean;canSaveInputs:boolean;canDownload:boolean;
 disclosures:{workspace:boolean;dd:boolean};memberId?:string;viewer:CurrentMemberAccess|SharedWorkspaceAccess;workspaceAccess:WorkspaceProjectAccess;
};
