export const WORKFLOW_UPLOAD_BUCKET='workflow-document-uploads';
export const WORKFLOW_FILE_LIMIT=25_000_000;
export const WORD_DOCX='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const WORD_DOC='application/msword';
export type WorkflowFileKind='draft'|'revision'|'signed';
export function workflowFileType(name:string) {
 const extension=name.split('.').pop()?.toLowerCase();
 return extension==='pdf'?'application/pdf':extension==='docx'?WORD_DOCX:extension==='doc'?WORD_DOC:null;
}
export function workflowFileError(name:string,size:number,kind:WorkflowFileKind) {
 const mime=workflowFileType(name);
 if(!mime)return 'Word（.docx・.doc）かPDFを選択してください';
 if(!Number.isInteger(size)||size<1||size>WORKFLOW_FILE_LIMIT)return '空のファイルは登録できません。25MB以下の文書を選択してください';
 if(kind!=='draft'&&mime!=='application/pdf')return '承認に出す最終版・締結版はPDFを選択してください。Wordは下書きとして登録できます';
 return '';
}
