import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push';

type Job = { id: string; game_server_id: string; server_boss_id: string; schedule_revision: number; lead_minutes: 1 | 3; event_id: string; attempt_count: number };
type StoredSubscription = { id: string; user_id: string; subscription_ciphertext: string; three_minutes_enabled: boolean; one_minute_enabled: boolean };

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  const result = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) result[index] = binary.charCodeAt(index);
  return result;
}
async function decrypt(value: string): Promise<{ endpoint: string; keys: { p256dh: string; auth: string } }> {
  const rawKey = Deno.env.get('L2M_BOSS_WEB_PUSH_STORAGE_KEY');
  if (!rawKey) throw new Error('storage_key_missing');
  const combined = decodeBase64(value), keyBytes = decodeBase64(rawKey);
  if (combined.byteLength < 29 || keyBytes.byteLength !== 32) throw new Error('ciphertext_invalid');
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

Deno.serve(async (request) => {
  const cronSecret = Deno.env.get('L2M_BOSS_CRON_SECRET');
  if (request.method !== 'POST' || !cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const url = Deno.env.get('SUPABASE_URL'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const subject = Deno.env.get('L2M_BOSS_WEB_PUSH_VAPID_SUBJECT'), publicKey = Deno.env.get('L2M_BOSS_WEB_PUSH_VAPID_PUBLIC_KEY'), privateKey = Deno.env.get('L2M_BOSS_WEB_PUSH_VAPID_PRIVATE_KEY');
  if (!url || !serviceKey || !subject || !publicKey || !privateKey) return new Response(JSON.stringify({ error: 'configuration_missing' }), { status: 500 });
  webPush.setVapidDetails(subject, publicKey, privateKey);
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await service.rpc('claim_due_l2m_boss_notification_jobs', { batch_size: 50 });
  if (error) return new Response(JSON.stringify({ error: 'claim_failed' }), { status: 500 });
  const jobs = (data ?? []) as Job[];
  let accepted = 0, failed = 0;
  for (const job of jobs) {
    const [{ data: boss, error: bossError }, { data: members, error: membersError }, { data: subscriptions, error: subscriptionsError }, { data: schedule, error: scheduleError }] = await Promise.all([
      service.from('server_bosses').select('boss_catalog(display_name)').eq('id', job.server_boss_id).single(),
      service.from('server_memberships').select('user_id').eq('game_server_id', job.game_server_id).eq('status', 'active'),
      service.from('web_push_subscriptions').select('id,user_id,subscription_ciphertext,three_minutes_enabled,one_minute_enabled').eq('game_server_id', job.game_server_id).is('revoked_at', null),
      service.from('boss_schedules').select('revision').eq('server_boss_id', job.server_boss_id).single(),
    ]);
    if (bossError || membersError || subscriptionsError || scheduleError) {
      const retry = job.attempt_count < 5;
      await service.from('boss_notification_jobs').update({
        status: retry ? 'pending' : 'failed',
        scheduled_for: retry ? new Date(Date.now() + 30_000 * job.attempt_count).toISOString() : undefined,
        completed_at: retry ? null : new Date().toISOString(),
        last_error_code: 'lookup_failed',
      }).eq('id', job.id);
      failed += 1;
      continue;
    }
    if (schedule?.revision !== job.schedule_revision) {
      await service.from('boss_notification_jobs').update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq('id', job.id);
      continue;
    }
    const activeUsers = new Set((members ?? []).map((member) => member.user_id));
    const bossName = (boss as { boss_catalog?: { display_name?: string } } | null)?.boss_catalog?.display_name ?? 'ボス';
    let transientFailure = false;
    for (const stored of (subscriptions ?? []) as StoredSubscription[]) {
      if (!activeUsers.has(stored.user_id) || (job.lead_minutes === 3 ? !stored.three_minutes_enabled : !stored.one_minute_enabled)) continue;
      let outcome = 'accepted', responseStatus: number | null = null, errorCode: string | null = null;
      try {
        const subscription = await decrypt(stored.subscription_ciphertext);
        const response = await webPush.sendNotification(subscription, JSON.stringify({
          type: 'boss_spawn', event_id: job.event_id, boss_name: bossName,
          lead_minutes: job.lead_minutes, schedule_revision: job.schedule_revision,
        }), { TTL: Math.max(30, job.lead_minutes * 60), urgency: job.lead_minutes === 1 ? 'high' : 'normal', topic: job.event_id.slice(0, 32) });
        responseStatus = response.statusCode; accepted += 1;
      } catch (caught) {
        const status = typeof caught === 'object' && caught && 'statusCode' in caught ? Number(caught.statusCode) : 0;
        responseStatus = status || null;
        if (status === 404 || status === 410) {
          outcome = 'expired'; errorCode = 'subscription_expired';
          await service.from('web_push_subscriptions').update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', stored.id);
        } else if (status === 429 || status >= 500 || status === 0) {
          outcome = 'transient_failure'; errorCode = 'push_transient'; transientFailure = true;
        } else { outcome = 'permanent_failure'; errorCode = 'push_rejected'; }
        failed += 1;
      }
      await service.from('notification_deliveries').insert({ job_id: job.id, subscription_id: stored.id, attempt_number: job.attempt_count, outcome, response_status: responseStatus, error_code: errorCode });
    }
    const retry = transientFailure && job.attempt_count < 5;
    await service.from('boss_notification_jobs').update({
      status: retry ? 'pending' : transientFailure ? 'failed' : 'sent',
      scheduled_for: retry ? new Date(Date.now() + 30_000 * job.attempt_count).toISOString() : undefined,
      completed_at: retry ? null : new Date().toISOString(), last_error_code: transientFailure ? 'push_transient' : null,
    }).eq('id', job.id);
  }
  return new Response(JSON.stringify({ jobs: jobs.length, accepted, failed }), { headers: { 'Content-Type': 'application/json' } });
});
