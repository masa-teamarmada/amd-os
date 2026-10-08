// Exercise the actual server client with a fake Auth transport: no DB or email.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { workspaceEmailCookieName, workspaceEmailLanding } from '../src/lib/workspace-email-login.ts';

const jar = new Map();
const challenges = new Map();
const requests = [];
const testState = globalThis;
testState.amieEmailTestCookies = {
  getAll: () => [...jar.values()],
  set: (name, value, options) => {
    if (options.maxAge === 0) jar.delete(name);
    else jar.set(name, { name, value, options });
  },
};
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/headers') {
      return { url: 'data:text/javascript,' + encodeURIComponent('export async function cookies(){return globalThis.amieEmailTestCookies} export async function headers(){return new Headers()}'), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const originalFetch = globalThis.fetch;
process.env.NODE_ENV = 'production';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://auth.example.test';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  assert.equal(url.host, 'auth.example.test');
  requests.push(url.pathname);
  const body = JSON.parse(String(init?.body || '{}'));
  if (url.pathname === '/auth/v1/otp') {
    const attempt = new URL(url.searchParams.get('redirect_to')).searchParams.get('attempt');
    challenges.set(attempt, body.code_challenge);
    assert.equal(body.code_challenge_method, 's256');
    return Response.json({});
  }
  if (url.pathname === '/auth/v1/token') {
    const expected = challenges.get(body.auth_code);
    const actual = createHash('sha256').update(body.code_verifier).digest('base64url');
    if (actual !== expected) return Response.json({ msg: 'bad verifier', code: 'bad_code_verifier' }, { status: 400 });
    const payload = Buffer.from(JSON.stringify({ sub: 'test-user', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    return Response.json({ access_token: `test.${payload}.test`, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user: { id: 'test-user', email: 'reader@example.test' } });
  }
  throw new Error(`Unexpected fake Auth endpoint: ${url.pathname}`);
};
try {
  const { createClient } = await import('../src/lib/supabase/server.ts');
  const attempts = [randomUUID(), randomUUID()];
  for (const attempt of attempts) {
    const client = await createClient({ cookieName: workspaceEmailCookieName(attempt) });
    const { error } = await client.auth.signInWithOtp({ email: 'reader@example.test', options: { emailRedirectTo: `https://app.example.test/auth/callback?login_scope=workspace&attempt=${attempt}` } });
    assert.equal(error, null);
  }
  // A Google start uses the shared cookie while both delivered email attempts remain usable.
  const googleClient = await createClient();
  await googleClient.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true } });
  for (const attempt of attempts) {
    const cookie = jar.get(workspaceEmailCookieName(attempt) + '-code-verifier');
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.secure, true);
    assert.equal(cookie.options.sameSite, 'lax');
    assert.equal(cookie.options.path, '/');
    const callback = await createClient({ cookieName: workspaceEmailCookieName(attempt) });
    const { error } = await callback.auth.exchangeCodeForSession(attempt);
    assert.equal(error, null, 'the first link must survive a newer email and Google login start');
  }
  assert.equal(requests.filter(p => p === '/auth/v1/token').length, 2);
  const legacyAttempts = [randomUUID(), randomUUID()];
  for (const attempt of legacyAttempts) {
    const client = await createClient();
    await client.auth.signInWithOtp({ email: 'reader@example.test', options: { emailRedirectTo: `https://app.example.test/auth/callback?attempt=${attempt}` } });
  }
  const legacyCallback = await createClient();
  const legacyResult = await legacyCallback.auth.exchangeCodeForSession(legacyAttempts[0]);
  assert.equal(legacyResult.error?.status, 400, 'shared cookie must reproduce the observed production failure');
  assert.equal(legacyResult.error?.message, 'bad verifier');
  for (const invalid of ['', '../../cookies', 'sb-member-token', 'x'.repeat(200)]) assert.equal(workspaceEmailCookieName(invalid), null);
  assert.equal(workspaceEmailLanding('/', true, true), '/workspaces');
  assert.equal(workspaceEmailLanding('/', false, true), '/dd');
  assert.equal(workspaceEmailLanding('/workspace/ehime', true, true), '/workspace/ehime');
  assert.equal(workspaceEmailLanding('/workspaces', false, true), '/dd');
  console.log('PASS: delivered email verifiers survive another email and Google start; private cookies and landing scopes verified. No real email/network.');
} finally {
  globalThis.fetch = originalFetch;
  hook.deregister();
  delete testState.amieEmailTestCookies;
}
