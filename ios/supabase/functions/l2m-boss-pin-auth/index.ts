import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = new Set(['https://l2m-boss.vercel.app', 'http://127.0.0.1:4173', 'http://localhost:4173']);
function headers(request: Request): HeadersInit {
  const origin = request.headers.get('origin');
  return {
    ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
}
function reply(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(request) });
}
function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().normalize('NFKC').toLocaleLowerCase('ja-JP');
  return /^[\p{L}\p{N}_]{2,20}$/u.test(name) ? name : null;
}
async function sha256(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function derivePassword(pepper: string, username: string, pin: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${username}:${pin}`)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(request) });
  if (request.method !== 'POST') return reply(request, { error: 'method_not_allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const pepper = Deno.env.get('L2M_BOSS_PIN_PEPPER');
  if (!url || !anon || !serviceKey || !pepper) return reply(request, { error: 'unavailable' }, 503);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return reply(request, { error: 'invalid_input' }, 400); }
  const username = normalizeName(body.username);
  const pin = body.pin;
  const action = body.action;
  if (!username || typeof pin !== 'string' || !/^\d{4}$/.test(pin) ||
      !['login', 'signup', 'claim'].includes(String(action))) {
    return reply(request, { error: 'invalid_input' }, 400);
  }

  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const publicClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  try {
    // Count attempts before checking whether a username exists, so all PIN
    // guesses share the same limit and response.
    const limits = [{ key: `name:${username}`, max: action === 'login' ? 5 : 10 }];
    if (ip) limits.push({ key: `ip:${await sha256(ip)}`, max: 30 });
    for (const limit of limits) {
      const { data, error } = await service.rpc('reserve_l2m_boss_auth_attempt', {
        target_key: limit.key, max_attempts: limit.max,
      });
      if (error) throw error;
      if (!data) return reply(request, { error: 'too_many_attempts' }, 429);
    }

    const password = await derivePassword(pepper, username, pin);
    if (action === 'claim') {
      const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      if (!token) return reply(request, { error: 'unauthorized' }, 401);
      const { data: { user }, error: userError } = await service.auth.getUser(token);
      if (userError || !user) return reply(request, { error: 'unauthorized' }, 401);
      const { data: owner } = await service.from('server_memberships').select('id')
        .eq('user_id', user.id).eq('status', 'active').eq('role', 'owner').maybeSingle();
      if (!owner) return reply(request, { error: 'owner_required' }, 403);
      const { data: existing } = await service.from('l2m_boss_pin_accounts').select('user_id').eq('user_id', user.id).maybeSingle();
      if (existing) return reply(request, { error: 'already_claimed' }, 409);
      const { error: insertError } = await service.from('l2m_boss_pin_accounts').insert({ user_id: user.id, username });
      if (insertError) return reply(request, { error: 'username_taken' }, 409);
      const { error: updateError } = await service.auth.admin.updateUserById(user.id, { password });
      if (updateError) {
        await service.from('l2m_boss_pin_accounts').delete().eq('user_id', user.id);
        throw updateError;
      }
      return reply(request, { claimed: true });
    }

    if (action === 'signup') {
      const { data: existing } = await service.from('l2m_boss_pin_accounts').select('user_id').eq('username', username).maybeSingle();
      if (existing) return reply(request, { error: 'username_taken' }, 409);
      const fakeEmail = `${crypto.randomUUID()}@accounts.l2m.invalid`;
      const { data: created, error: createError } = await service.auth.admin.createUser({
        email: fakeEmail, password, email_confirm: true,
      });
      if (createError || !created.user) throw createError ?? new Error('create_failed');
      const { error: insertError } = await service.from('l2m_boss_pin_accounts').insert({
        user_id: created.user.id, username,
      });
      if (insertError) {
        await service.auth.admin.deleteUser(created.user.id);
        return reply(request, { error: 'username_taken' }, 409);
      }
      const { data: signed, error: signError } = await publicClient.auth.signInWithPassword({ email: fakeEmail, password });
      if (signError || !signed.session) throw signError ?? new Error('session_failed');
      return reply(request, { access_token: signed.session.access_token, refresh_token: signed.session.refresh_token });
    }

    const { data: account } = await service.from('l2m_boss_pin_accounts').select('user_id').eq('username', username).maybeSingle();
    if (!account) return reply(request, { error: 'invalid_credentials' }, 401);
    const { data: found, error: foundError } = await service.auth.admin.getUserById(account.user_id);
    if (foundError || !found.user?.email) throw foundError ?? new Error('account_missing');
    const { data: signed, error: signError } = await publicClient.auth.signInWithPassword({ email: found.user.email, password });
    if (signError || !signed.session) return reply(request, { error: 'invalid_credentials' }, 401);
    return reply(request, { access_token: signed.session.access_token, refresh_token: signed.session.refresh_token });
  } catch {
    return reply(request, { error: 'unavailable' }, 503);
  }
});
