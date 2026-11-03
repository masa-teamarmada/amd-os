/** 明示された共有試算を1PJへ初回登録する。既存版は上書きしない。 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {parseStrategicResources, STRATEGIC_RESOURCES_CONFIG_KEY} from '../src/lib/project-strategic-resources.ts';
const args = process.argv.slice(2);
const option = (key: string) => {const at = args.indexOf(key); return at < 0 ? undefined : args[at + 1];};
const projectId = option('--project'), file = option('--file');
if (!projectId || !/^p\d+$/.test(projectId) || !file) throw Error('--project と --file が必要');
const data = parseStrategicResources(readFileSync(file, 'utf8'));
if (!data) throw Error('試算が空');
const value = JSON.stringify(data), hash = (v: string) => createHash('sha256').update(v).digest('hex');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false,autoRefreshToken:false}});
const existing = await db.from('project_config').select('value').eq('project_id', projectId).eq('key', STRATEGIC_RESOURCES_CONFIG_KEY).maybeSingle();
if (existing.error) throw Error(existing.error.message);
if (existing.data && hash(existing.data.value) !== hash(value)) throw Error('登録済みの別版があるため停止');
if (args.includes('--apply') && !existing.data) {
  const result = await db.from('project_config').insert({project_id:projectId,key:STRATEGIC_RESOURCES_CONFIG_KEY,value});
  if (result.error) throw Error(result.error.message);
}
const back = await db.from('project_config').select('value').eq('project_id',projectId).eq('key',STRATEGIC_RESOURCES_CONFIG_KEY).maybeSingle();
if (back.error) throw Error(back.error.message);
const matches = back.data ? hash(back.data.value) === hash(value) : false;
if (args.includes('--apply') && !matches) throw Error('登録後の読戻し不一致');
console.log(JSON.stringify({projectId,mode:args.includes('--apply')?'apply':'review',key:STRATEGIC_RESOURCES_CONFIG_KEY,bytes:Buffer.byteLength(value),sha256:hash(value),readbackMatches:matches,existing:Boolean(existing.data)}));
