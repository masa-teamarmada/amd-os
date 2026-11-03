type Claim={priority:number;activate:()=>void};
const documents=new WeakMap<object,Map<symbol,Claim>>();
function current(claims:Map<symbol,Claim>|undefined):symbol|undefined{
 let owner:symbol|undefined,priority=-Infinity;
 for(const [key,claim]of claims??[])if(claim.priority>=priority){owner=key;priority=claim.priority;}
 return owner;
}
export function ownsPageTitle(document:object,owner:symbol){return current(documents.get(document))===owner;}
/** 一つのdocumentでは一つの所有者だけがtitleを書ける。外枠の既定名は詳細名を上書きしない。 */
export function claimPageTitle(document:object,owner:symbol,activate:()=>void,priority=1){
 let claims=documents.get(document);if(!claims){claims=new Map();documents.set(document,claims);}
 const previous=current(claims);claims.set(owner,{priority,activate});
 const selected=current(claims);if(selected!==previous&&selected)claims.get(selected)?.activate();
 return()=>{const wasCurrent=current(claims)===owner;if(!claims.delete(owner))return;
  if(wasCurrent){const restored=current(claims);if(restored)claims.get(restored)?.activate();}
  if(!claims.size)documents.delete(document);
 };
}
