export type WorkflowStatus = 'submitted' | 'approved' | 'returned' | 'cancelled' | 'superseded' | 'released' | 'completed';
export const WORKFLOW_STATUS: Record<WorkflowStatus,string> = {submitted:'きよ承認待ち',approved:'きよ承認済み',returned:'差戻し',cancelled:'取下げ',superseded:'変更あり・再申請',released:'押印手続き中',completed:'締結版照合済み'};
export type WorkflowRequest = {request_id:string;contract_id:string;document_id:string;requested_by:string;approver_member_id:string;status:WorkflowStatus;purpose:string;desired_date:string|null;snapshot_file_id:string;decision_note:string|null;created_at:string;decided_at:string|null;source_sha256:string;snapshot_sha256:string;terms_snapshot:Record<string,unknown>};
export type WorkflowContract = {contract_id:string;contract_title:string;counterparty_name:string|null;project_id:string;status:string};
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
 return {approve:actor===approver&&actor!==requester&&status==='submitted',return:actor===approver&&actor!==requester&&['submitted','approved','released'].includes(status),release:actor===requester&&status==='approved',cancel:actor===requester&&['submitted','approved'].includes(status),complete:actor===approver&&actor!==requester&&status==='released'};
}
