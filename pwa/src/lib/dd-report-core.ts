import {hasDdCapability,type DdViewerAccess} from './dd-package-core';
import type {DdReportEdition} from './dd-report-types';
export function canReadDdReport(access:DdViewerAccess,edition:Pick<DdReportEdition,'package_id'|'status'>) {
  return access.packageId===edition.package_id&&edition.status!=='archived'&&(edition.status==='published'||access.principal!=='workspace_account');
}
export function canEditDdReport(access:DdViewerAccess) {return access.principal!=='workspace_account'&&hasDdCapability(access,'dd.edit');}
