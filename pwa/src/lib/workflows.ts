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
 const text=[input.subject,currentMailText(input.body),...input.filenames].join('\n');
 const signature=/押印|合意締結|電子契約|クラウドサイン|docusign|(?:署名|sign(?:ature|ing)).*(?:依頼|完了|済|契約|お願い|required|request|complete)|(?:契約|agreement).*(?:署名|signature|signing)/i.test(text);
 if(input.bulk&&!signature)return null;
 if(/契約社員|雇用求人|求人情報|採用情報|メールマガジン|メルマガ|ウェビナー|セミナー案内/i.test(input.subject)&&!input.knownThread)return null;
 const document=/契約書|秘密保持|守秘義務|\bNDA\b|\bMOU\b|覚書|合意書|発注書|注文書|業務委託|共同研究契約|ライセンス契約|contract|agreement/i.test(text);
 const generic=/契約|締結|更新条件|解約|解除/i.test(text)&&/送付|受領|確認|修正|条項|条件|依頼|更新|解約|解除|合意|締結/.test(text);
 if(!document&&!signature&&!generic&&!input.knownThread)return null;
 if(/合意締結.*完了|締結.*完了|押印.*(?:完了|済)|署名.*(?:完了|済)|契約締結済|fully (?:signed|executed)|completed.*(?:agreement|signature)/i.test(text))return 'completion';
 if(/署名.*依頼|押印.*依頼|確認依頼|署名して|押印して|please sign|signature requested|review and sign/i.test(text)&&signature)return 'signature_request';
 return 'exchange';
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
  status==='returned'?'差戻し理由を確認して修正し、再申請':status==='superseded'?'変更した文書・条件で再申請':'契約本文と添付を含む最終版PDFを登録して申請',
  '固定した最終版PDFと契約条件を確認して承認',
  status==='approved'?'承認対象を確認して押印手続きを開始':'承認された版に押印・署名し、締結版PDFを登録',
  '締結版と承認対象の内容を照合',
  'きよの照合完了を記録',
 ];
 return ['開始','契約書の準備','きよの承認','押印・締結版の保存','締結版の照合','完了'].map((label,i)=>({label,owner:i===2||i===4?approver:i===5?'—':requester,detail:details[i],state:stopped?(i===0?'done':'stopped'):status==='completed'||i<index?'done':i===index?'current':'pending'}));
}
