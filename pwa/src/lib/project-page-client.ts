import type {ProjectPageRuntime} from './project-page-runtime-types';
/** 初回取得と保存後の読み戻しを同じページ取得口に集約する。 */
export async function readProjectPageRuntime(endpoint:string,signal?:AbortSignal):Promise<ProjectPageRuntime>{
 const response=await fetch(endpoint,{cache:'no-store',signal});
 const payload=await response.json();
 if(!response.ok||!payload.runtime)throw new Error(payload.error||'ページを読み込めなかった');
 return payload.runtime;
}
