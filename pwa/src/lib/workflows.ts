export type WorkflowStatus = 'preparing' | 'submitted' | 'approved' | 'returned' | 'cancelled' | 'superseded' | 'released' | 'completed';
export const WORKFLOW_STATUS: Record<WorkflowStatus,string> = {preparing:'契約書の準備中',submitted:'きよ承認待ち',approved:'きよ承認済み',returned:'差戻し',cancelled:'取下げ',superseded:'変更あり・再申請',released:'押印手続き中',completed:'締結版照合済み'};
export type WorkflowRequest = {request_id:string;contract_id:string;document_id:string|null;requested_by:string;approver_member_id:string;status:WorkflowStatus;purpose:string;desired_date:string|null;snapshot_file_id:string|null;decision_note:string|null;created_at:string;decided_at:string|null;source_sha256:string|null;snapshot_sha256:string|null;submitted_at:string|null;contract?:WorkflowContract;terms_snapshot:Record<string,unknown>};
export type WorkflowContract = {contract_id:string;contract_title:string;counterparty_name:string|null;project_id:string;status:string;contract_type:string;amd_entity_name:string;signed_document_id:string|null};
export type WorkflowDocument = {document_id:string;contract_id:string;file_name:string;version_label:string;drive_file_id:string;mime_type:string;is_latest:boolean;document_kind:string};
export type MailEventKind = 'exchange' | 'signature_request' | 'completion';
export const MAIL_EVENT_LABEL: Record<MailEventKind,string> = {exchange:'契約のやりとり',signature_request:'署名・押印依頼',completion:'締結・押印完了の連絡'};
export type WorkflowMailEvent = {event_id:string;contract_id:string|null;direction:'sent'|'received';subject:string;event_kind:MailEventKind;occurred_at:string;source_url:string};
// Classify this message's new text, not a previous conversation or a footer.
export function currentMailText(value:string) {
 return value.split(/\n(?:On .+wrote:|.*[0-9]{4}年.*[<＜].*[>＞]:|-----Original Message-----|_{5,}|-{2,}\s*$|From:\s|差出人：)/im)[0].split('\n').filter(line=>!/^\s*>/.test(line)).join('\n').slice(0,16000);
}
export function classifyContractMail(input:{subject:string;body:string;filenames:string[];labels:string[];from:string;bulk:boolean;knownThread:boolean}):MailEventKind|null {
 if(input.labels.some(label=>['DRAFT','SPAM','TRASH'].includes(label)))return null;
 if(/パスワード|認証コード|ワンタイム|password|verification code/i.test(input.subject))return null;
 // Service notices and meeting minutes can contain contract words in footers or
 // summaries. They are not a new contract exchange or a seal request.
 const subject=input.subject.normalize('NFKC');
 if(/^メモ[:：]/.test(subject)||/^承認されていない申請があります[。.]?.*ジョブカン/.test(subject))return null;
 if(!/契約書|秘密保持|守秘義務|\bNDA\b|\bMOU\b|覚書|合意書|発注書|注文書|業務委託|共同研究契約|ライセンス契約|署名依頼|押印依頼/i.test(subject)&&
  /詐欺に注意|偽のセキュリティ警告|ログイン時のセキュリティ|利用可能枠変更|お引き落としのご連絡|ご返却ありがとうございました/.test(subject))return null;
 const freshBody=currentMailText(input.body).normalize('NFKC');
 const text=[subject,freshBody,...input.filenames].join('\n');
 const document=/契約書|秘密保持|守秘義務|(?:^|[^a-z])(?:NDA|MOU)(?:[^a-z]|$)|覚書|合意書|承諾書|誓約書|発注書|注文書|業務委託|共同研究契約|ライセンス契約|(?:^|[\s_.-])(?:contract|agreement)(?:[\s_.-]|$)/i;
 const signatureAction=/(?:合意締結|締結|押印|署名)[^\n。]{0,48}(?:依頼|完了|済|お願い)|(?:signature|signing)[^\n.]{0,48}(?:required|request|complete)|please sign|review and sign|fully (?:signed|executed)/i;
 const subjectEvidence=document.test(subject)||signatureAction.test(subject);
 const attachmentEvidence=input.filenames.some(name=>document.test(name));
 const bodyEvidence=signatureAction.test(freshBody)||freshBody.split(/[\n。]/).some(line=>document.test(line)&&/送付|受領|修正|赤入れ|条項|法務|締結|押印|署名|添付|確認|send|attach|review|redline|sign/i.test(line));
 const signature=signatureAction.test(text);
 if(input.bulk&&!signatureAction.test(subject))return null;
 if(/契約社員|雇用求人|求人情報|採用情報|メールマガジン|メルマガ|ウェビナー|セミナー案内/i.test(input.subject)&&!input.knownThread)return null;
 if(!subjectEvidence&&!attachmentEvidence&&!bodyEvidence&&!input.knownThread)return null;
 if(/合意締結.*完了|締結.*完了|押印.*(?:完了|済)|署名.*(?:完了|済)|契約締結済|fully (?:signed|executed)|completed.*(?:agreement|signature)/i.test(text))return 'completion';
 if(/署名.*依頼|押印.*依頼|確認依頼|署名して|押印して|please sign|signature requested|review and sign/i.test(text)&&signature)return 'signature_request';
 return 'exchange';
}
// Old false detections must not keep an unrelated Gmail thread permanently eligible.
export function hasContractMailThreadEvidence(events:Array<{contract_id:string|null;subject:string}>) {
 return events.some(event=>!!event.contract_id||classifyContractMail({subject:event.subject,body:'',filenames:[],labels:[],from:'',bulk:false,knownThread:false})!==null);
}
export function formatContractMailAlert(event:WorkflowMailEvent,base:string) {
 const subject=event.subject.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 return [`【契約メール】${MAIL_EVENT_LABEL[event.event_kind]}`,`${event.direction==='sent'?'まさの送信':'まさの受信'} / ${new Date(event.occurred_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}`,subject,event.event_kind==='completion'?'完了の連絡を検知。締結版と承認記録を確認。':'メールの検知通知。押印申請は契約フローから行う。',`<${base}/admin/workflows|OSのメール検知一覧を確認>`].join('\n');
}
export function workflowActions(status:WorkflowStatus,actor:string,requester:string,approver:string) {
 return {prepare:actor===requester&&status==='preparing',restart:actor===requester&&['returned','superseded'].includes(status),approve:actor===approver&&actor!==requester&&status==='submitted',return:actor===approver&&actor!==requester&&['submitted','approved','released'].includes(status),release:actor===requester&&status==='approved',cancel:actor===requester&&['preparing','submitted','approved'].includes(status),complete:actor===approver&&actor!==requester&&status==='released'};
}

export const WORKFLOW_CONTRACT_TYPES: Record<string,string> = {
 nda:'秘密保持契約（NDA）',outsourcing:'業務委託契約',joint_research:'共同研究契約',mou:'覚書・合意書',order:'発注書・注文書',license:'ライセンス契約',contract:'その他の契約',
};
export type WorkflowStep = {label:string;owner:string;detail:string;state:'done'|'current'|'pending'|'stopped'};
// Approval and the signed artifact are separate evidence; a file alone never means complete.
export function workflowProgress(status:WorkflowStatus,requester:string,approver:string,signedArtifact=false):WorkflowStep[] {
 const stopped=status==='cancelled';
 const index=status==='preparing'||status==='returned'||status==='superseded'?1:status==='submitted'?2:status==='approved'?3:status==='released'?(signedArtifact?4:3):status==='completed'?5:1;
 const details=[
  '相手先・契約の種類・目的を登録',
  status==='returned'?'差戻し理由を確認して修正し、再申請':status==='superseded'?'変更した文書・条件で再申請':'Word・PDFで案を準備し、固まった内容を最終版PDFで申請',
  '固定した最終版PDFと契約条件を確認して承認',
  status==='approved'?'承認対象を確認して押印手続きを開始':'承認された版に押印・署名し、締結版PDFを登録',
  '締結版と承認対象の内容を照合',
  'きよの照合完了を記録',
 ];
 return ['開始','契約書の準備','きよの承認','押印・締結版の保存','締結版の照合','完了'].map((label,i)=>({label,owner:i===2||i===4?approver:i===5?'—':requester,detail:details[i],state:stopped?(i===0?'done':'stopped'):status==='completed'||i<index?'done':i===index?'current':'pending'}));
}
