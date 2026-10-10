import {Buffer} from 'node:buffer';
import {unzipSync} from 'fflate';
import {WORD_DOC,WORD_DOCX,WORKFLOW_FILE_LIMIT} from '@/lib/workflow-files';
export function validateWorkflowBytes(bytes:Buffer,mime:string) {
 if(!bytes.length||bytes.length>WORKFLOW_FILE_LIMIT)throw new Error('25MB以下の文書を選択してください');
 if(mime==='application/pdf'&&bytes.subarray(0,5).toString()==='%PDF-')return;
 if(mime===WORD_DOC&&bytes.subarray(0,8).toString('hex')==='d0cf11e0a1b11ae1')return;
 if(mime===WORD_DOCX){
  const names=new Set<string>();
  try{unzipSync(bytes,{filter:file=>{names.add(file.name);return false;}});}catch{throw new Error('Wordファイルを読み取れなかった。保存し直してください');}
  if(names.has('[Content_Types].xml')&&names.has('word/document.xml')&&!names.has('word/vbaProject.bin'))return;
 }
 throw new Error('文書の形式と内容が一致していません。WordかPDFとして保存し直してください');
}
