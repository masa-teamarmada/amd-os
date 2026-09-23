import { createClient } from '@supabase/supabase-js';

const cors = (request: Request) => ({
  'Access-Control-Allow-Origin': Deno.env.get('L2M_BOSS_WEB_ORIGIN') ?? request.headers.get('origin') ?? '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Origin',
});
const json = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(request) });

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function encodeBase64(value: Uint8Array): string {
  let binary = '';
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function encrypt(value: unknown): Promise<string> {
  const rawKey = Deno.env.get('L2M_BOSS_WEB_PUSH_STORAGE_KEY');
  if (!rawKey) throw new Error('storage_key_missing');
  const keyBytes = decodeBase64(rawKey);
  if (keyBytes.byteLength !== 32) throw new Error('storage_key_invalid');
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv); combined.set(encrypted, iv.byteLength);
  return encodeBase64(combined);
}
async function sha256(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405);
  const supabaseURL = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseURL || !anonKey || !serviceKey || !authorization) return json(request, { error: 'unauthorized' }, 401);
  const caller = createClient(supabaseURL, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await caller.auth.getUser();
  if (userError || !user) return json(request, { error: 'unauthorized' }, 401);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json(request, { error: 'invalid_json' }, 400); }
  const serverID = body.game_server_id;
  const installationID = body.installation_id;
  const subscription = body.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
  if (typeof serverID !== 'string' || typeof installationID !== 'string' ||
      typeof subscription?.endpoint !== 'string' || !subscription.endpoint.startsWith('https://') ||
      typeof subscription.keys?.p256dh !== 'string' || typeof subscription.keys.auth !== 'string') {
    return json(request, { error: 'invalid_subscription' }, 400);
  }
  const service = createClient(supabaseURL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: membership } = await service.from('server_memberships').select('id').eq('game_server_id', serverID).eq('user_id', user.id).eq('status', 'active').maybeSingle();
  if (!membership) return json(request, { error: 'membership_required' }, 403);
  try {
    const ciphertext = await encrypt(subscription);
    const endpointHash = await sha256(subscription.endpoint);
    const { error } = await service.from('web_push_subscriptions').upsert({
      game_server_id: serverID, user_id: user.id, installation_id: installationID,
      endpoint_hash: endpointHash, subscription_ciphertext: ciphertext,
      revoked_at: null, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'installation_id' });
    if (error) throw error;
    return json(request, { registered: true });
  } catch { return json(request, { error: 'registration_failed' }, 500); }
});
