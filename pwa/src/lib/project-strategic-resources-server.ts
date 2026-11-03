import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';
import {loadReferenceData} from './reference-data-cache';
import {parseStrategicResources, STRATEGIC_RESOURCES_CONFIG_KEY} from './project-strategic-resources';

/** 呼出元のPJ入場認可を済ませてから使用。公開承認済みの試算キーだけを読む。 */
export function loadProjectStrategicResources(projectId: string) {
  return loadReferenceData('project-strategic-resources:' + projectId, async () => {
    const {data, error} = await createAdminClient().from('project_config').select('value').eq('project_id', projectId).eq('key', STRATEGIC_RESOURCES_CONFIG_KEY).maybeSingle();
    if (error) throw Error('戦略余力の登録値を読み込めなかった');
    return parseStrategicResources(data?.value);
  });
}
