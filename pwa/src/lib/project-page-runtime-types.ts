import type {CockpitData} from '@/lib/supabase-data';
import type {ProjectWorkspaceBundle,CurrentMemberAccess} from '@/lib/project-workspace';
import type {SharedWorkspaceAccess} from '@/lib/project-shared-workspace-access';
import type {ProjectCanonicalPageData} from './project-canonical-page-types';
import type {ProjectPageId} from './project-page-registry';
import type {DdLiveProjectPage} from '@/lib/dd-project-page-types';
export type ProjectPageRuntime={pageId:ProjectPageId;projectId:string;projectName:string;pdfReady?:boolean;report:ProjectCanonicalPageData|null;operations:{canExecutiveMeeting?:boolean;recordAudience?:"internal"|"shared";loaded?:boolean;cockpit:CockpitData;workspace?:ProjectWorkspaceBundle;viewer:CurrentMemberAccess|SharedWorkspaceAccess;record?:DdLiveProjectPage|null;canDownload?:boolean;resolutionDocuments?:import('@/components/project-workspace/ProjectDiligenceSection').ResolutionDocument[];canEdit:boolean}};
