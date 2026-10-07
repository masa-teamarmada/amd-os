import {normalizeWorkspaceEmail} from './workspace-email';

export function newWorkspaceAccountIdentity(body:{email?:unknown;displayName?:unknown;affiliation?:unknown}) {
 const email=normalizeWorkspaceEmail(body.email);
 if(!email) return {ok:false as const,error:'invalid_email'};
 const displayName=typeof body.displayName==='string'?body.displayName.trim():'';
 if(!displayName||displayName.length>120) return {ok:false as const,error:'invalid_display_name'};
 const affiliation=typeof body.affiliation==='string'?body.affiliation.trim():'';
 if(!affiliation||affiliation.length>160) return {ok:false as const,error:'invalid_affiliation'};
 return {ok:true as const,email,display_name:displayName,affiliation};
}
