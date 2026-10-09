// A disposable Next app exercises the actual cookie/header plumbing over HTTP.
// It uses the repository's middleware + SSR/auth helpers, a loopback fake Auth
// server, and no production routes, secrets, emails or DB writes.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, copyFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const require = createRequire(import.meta.url);
const { splitCookiesString } = require('next/dist/server/web/utils');
const responseCookies = response => response.headers.getSetCookie().flatMap(splitCookiesString);
const root = fileURLToPath(new URL('..', import.meta.url));
const production = process.argv.includes('--production');
const fixture = await mkdtemp(join(tmpdir(), 'amd-api-auth-http-'));
const USER = { id: 'http-test-user', email: 'http-member@example.test' };
let mode = 'valid', calls = [], activityWrites = [];
const TOUCH = 'amd_os_last_login_touch';
function session(expired = false) {
  const exp = Math.floor(Date.now() / 1000) + (expired ? -3600 : 3600);
  const payload = Buffer.from(JSON.stringify({ sub: USER.id, exp, session_id: 'http-test-session' })).toString('base64url');
  return { access_token: `test.${payload}.signature`, refresh_token: 'http-test-refresh', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: USER };
}
function cookie(expired = false, withTouch = true) { return `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session(expired))).toString('base64url')}${withTouch ? `; ${TOUCH}=${Date.now()}` : ''}`; }
const fakeAuth = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  calls.push(path);
  res.setHeader('content-type', 'application/json');
  res.setHeader('x-supabase-api-version', '2024-01-01');
  if (path === '/auth/v1/token') {
    if (mode === 'expired') { res.statusCode = 400; res.end(JSON.stringify({ msg: 'Expired refresh token', code: 'refresh_token_not_found' })); return; }
    res.end(JSON.stringify(session())); return;
  }
  if (path === '/auth/v1/user') {
    if (mode === 'revoked' || mode === 'invalid') { res.statusCode = 401; res.end(JSON.stringify({ msg: 'Rejected session', code: 'session_not_found' })); return; }
    res.end(JSON.stringify(USER)); return;
  }
  if (path === '/auth/v1/logout') { res.statusCode = 204; res.end(); return; }
  if (path === '/rest/v1/members') {
    if (req.method === 'PATCH') {
      assert.equal(req.headers.apikey, 'http-test-service-key');
      assert.equal(req.headers.authorization, 'Bearer http-test-service-key');
      let body = ''; for await (const chunk of req) body += chunk;
      activityWrites.push({ email: new URL(req.url, 'http://localhost').searchParams.get('email'), values: JSON.parse(body) });
      res.statusCode = 204; res.end(); return;
    }
    res.end(JSON.stringify({ member_id: 'http-member', is_admin: false })); return;
  }
  res.statusCode = 500; res.end(JSON.stringify({ error: 'Unexpected test endpoint' }));
});
fakeAuth.listen(0, '127.0.0.1'); await once(fakeAuth, 'listening');
const authPort = fakeAuth.address().port;
const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
let child, output = '', passed = false;
async function put(path, content) { const target = join(fixture, path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, content); }
try {
  await symlink(dirname(require.resolve('next/package.json')).replace(/\/next$/, ''), join(fixture, 'node_modules'), 'dir');
  await put('package.json', JSON.stringify({ private: true, dependencies: { next: '16.3.0', react: '19.2.4', 'react-dom': '19.2.4' } }));
  await put('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'esnext', moduleResolution: 'bundler', jsx: 'preserve', strict: true, skipLibCheck: true, esModuleInterop: true, paths: { '@/*': ['./src/*'] } } }));
  await put('src/app/layout.tsx', 'export default function Layout({children}: {children: React.ReactNode}) {return <html><body>{children}</body></html>}');
  await put('src/app/page.tsx', 'export default function Page() {return <p>HTTP auth fixture</p>}');
  await put('src/app/dashboard/page.tsx', 'export default function Page() {return <p>Protected fixture</p>}');
  for (const path of ['middleware.ts', 'lib/supabase/middleware.ts', 'lib/supabase/api-auth-routes.ts', 'lib/supabase/last-login.ts', 'lib/supabase/server.ts', 'lib/supabase/api-auth.ts', 'lib/dd-package-core.ts', 'lib/bzm-reader/hosts.ts', 'app/auth/logout/route.ts']) {
    const target = join(fixture, 'src', path); await mkdir(dirname(target), { recursive: true }); await copyFile(join(root, 'src', path), target);
  }
  await put('src/lib/workspace-access-session.ts', 'export const WORKSPACE_SESSION_COOKIE="amd_os_workspace_session";');
  await put('src/lib/project-workspace-session.ts', 'export const PROJECT_WORKSPACE_SESSION_COOKIE="amd_os_project_session";');
  for (const [path, helper] of [['action-items', 'requireAuth'], ['admin/change-history', 'requireAdmin'], ['unknown', 'requireAuth']]) {
    await put(`src/app/api/${path}/route.ts`, `import {${helper}} from '@/lib/supabase/api-auth'; import {NextResponse} from 'next/server'; export async function GET(){const auth=await ${helper}(); if(!auth.ok)return auth.errorResponse; return NextResponse.json({id:auth.user.id});}`);
  }
  await put('src/app/api/project/monthly-reports/route.ts', "import {requireAuth} from '@/lib/supabase/api-auth'; import {NextResponse} from 'next/server'; export async function GET(req:Request){if(!new URL(req.url).searchParams.get('projectId'))return NextResponse.json({error:'projectId required'},{status:400}); const auth=await requireAuth(); if(!auth.ok)return auth.errorResponse; return NextResponse.json({id:auth.user.id});}");
  // Pass only runtime basics and fixture values, never inherited credentials.
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SHELL'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  Object.assign(env, { NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${authPort}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'http-test-key', SUPABASE_SERVICE_ROLE_KEY: 'http-test-service-key', NEXT_TELEMETRY_DISABLED: '1' });
  function launch(args) {
    child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), ...args], { cwd: fixture, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  }
  if (production) {
    launch(['build', '--webpack']);
    let buildTimer;
    try {
      const [exitCode] = await Promise.race([once(child, 'exit'), new Promise((_, reject) => { buildTimer = setTimeout(() => reject(new Error('Fixture production build exceeded 90 seconds')), 90000); })]);
      assert.equal(exitCode, 0, 'Fixture production build failed');
    } finally { clearTimeout(buildTimer); }
    console.log('PASS HTTP: disposable production build compiled and type-checked');
  }
  launch([...(production ? ['start'] : ['dev', '--webpack']), '--hostname', '127.0.0.1', '--port', String(port)]);
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 40000;
  let ready = false;
  while (Date.now() < deadline && child.exitCode === null) {
    try { const response = await fetch(base, { signal: AbortSignal.timeout(1500) }); if (response.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, 'Local Next server did not become ready within 40 seconds');
  async function get(path, cookieValue, headers = {}) {
    return fetch(base + path, { headers: { ...(cookieValue ? { cookie: cookieValue } : {}), ...headers }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  }
  calls = [];
  let response = await get('/api/action-items', cookie());
  assert.equal(response.status, 200); assert.equal((await response.json()).id, USER.id);
  assert.deepEqual(calls, ['/auth/v1/user']);
  calls = [];
  response = await fetch(base + '/api/action-items', { method: 'HEAD', headers: { cookie: cookie() }, signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200); assert.equal(await response.text(), ''); assert.deepEqual(calls, ['/auth/v1/user']);
  console.log('PASS HTTP: valid GET and implicit HEAD each validate once');
  calls = [];
  response = await get('/api/action-items', cookie(true));
  assert.equal(response.status, 200); assert.deepEqual(calls, ['/auth/v1/token', '/auth/v1/user']);
  const refreshed = responseCookies(response).find(value => value.startsWith('sb-127-auth-token='));
  assert.ok(refreshed); assert.match(refreshed, /Path=\/.*SameSite=lax/i);
  assert.match(response.headers.get('cache-control'), /private.*no-store/);
  calls = [];
  response = await get('/api/action-items', `${refreshed.split(';')[0]}; ${TOUCH}=${Date.now()}`);
  assert.equal(response.status, 200); assert.deepEqual(calls, ['/auth/v1/user']);
  console.log('PASS HTTP: refreshed request cookie reaches route; Set-Cookie survives response and next request');
  calls = [];
  response = await get('/api/action-items', null, { 'x-user-id': USER.id, 'x-user-email': USER.email });
  assert.equal(response.status, 401); assert.equal(response.headers.get('location'), null); assert.equal(calls.length, 0);
  response = await get('/dashboard?tab=tasks');
  assert.equal(response.status, 307); assert.equal(new URL(response.headers.get('location'), base).searchParams.get('next'), '/dashboard?tab=tasks');
  console.log('PASS HTTP: forged identity headers fail, API 401 versus page redirect');
  mode = 'expired'; calls = [];
  response = await get('/api/action-items', cookie(true));
  assert.equal(response.status, 401); assert.ok(responseCookies(response).some(value => value.startsWith('sb-127-auth-token=;') && value.includes('Max-Age=0')));
  response = await get('/dashboard', cookie(true));
  assert.equal(response.status, 307); assert.ok(responseCookies(response).some(value => value.includes('Max-Age=0')));
  console.log('PASS HTTP: expired refresh token clears cookies on API 401 and page redirect');
  mode = 'revoked'; calls = [];
  response = await get('/api/action-items', cookie());
  assert.equal(response.status, 401); assert.deepEqual(calls, ['/auth/v1/user']);
  assert.ok(responseCookies(response).some(value => value.includes('Max-Age=0')));
  console.log('PASS HTTP: getUser revocation denial retains Route Handler cookie deletion');
  mode = 'valid'; calls = [];
  response = await get('/api/admin/change-history', cookie()); assert.equal(response.status, 403);
  calls = [];
  response = await get('/api/admin/change-history', cookie(true)); assert.equal(response.status, 403);
  assert.deepEqual(calls, ['/auth/v1/token', '/auth/v1/user']);
  assert.ok(responseCookies(response).some(value => value.startsWith('sb-127-auth-token=base64-')));
  assert.match(response.headers.get('cache-control'), /private.*no-store/);
  response = await get('/api/action-items', 'amd_os_workspace_session=external-test'); assert.equal(response.status, 401);
  console.log('PASS HTTP: admin denial preserves refresh cookies; external session member-API denial');
  calls = [];
  response = await get('/api/unknown', cookie()); assert.equal(response.status, 200);
  assert.equal(calls.filter(value => value === '/auth/v1/user').length, 2);
  console.log('PASS HTTP: unregistered API retains existing middleware validation');
  response = await get('/auth/logout', `${cookie()}; amd_os_workspace_session=external-test; amd_os_project_session=legacy-test`);
  assert.equal(response.status, 307);
  const cleared = responseCookies(response);
  // Next's mutable-cookie merge may normalize expiry attributes on the two
  // explicit response cookies. The security contract is that all values are
  // cleared; the existing signed-cookie verifiers reject empty values.
  const blankCookies = [];
  for (const name of ['sb-127-auth-token', 'amd_os_workspace_session', 'amd_os_project_session']) {
    const clearedCookie = cleared.find(value => value.startsWith(name + '=;'));
    assert.ok(clearedCookie, name); assert.match(clearedCookie, /Path=\//);
    blankCookies.push(clearedCookie.split(';')[0]);
  }
  response = await get('/api/action-items', blankCookies.join('; ')); assert.equal(response.status, 401);
  console.log('PASS HTTP: actual logout route clears Supabase, workspace and legacy cookies');
  calls = []; activityWrites = [];
  response = await get('/api/action-items', cookie(false, false)); assert.equal(response.status, 200);
  assert.deepEqual(calls, ['/auth/v1/user', '/rest/v1/members']); assert.equal(activityWrites.length, 1);
  assert.equal(activityWrites[0].email, `eq.${USER.email}`); assert.deepEqual(Object.keys(activityWrites[0].values), ['last_login_at']);
  assert.ok(Math.abs(Date.now() - Date.parse(activityWrites[0].values.last_login_at)) < 5000);
  const touched = responseCookies(response).find(value => value.startsWith(TOUCH + '='));
  assert.ok(touched); assert.match(touched, /Path=\/.*Max-Age=3600.*SameSite=lax/i);
  if (production) assert.match(touched, /Secure/i);
  console.log('PASS HTTP: API-only activity writes the existing member timestamp after one identity check and emits its cookie');
  calls = [];
  response = await get('/api/action-items', `${cookie(false, false)}; ${touched.split(';')[0]}`); assert.equal(response.status, 200);
  assert.deepEqual(calls, ['/auth/v1/user']); assert.equal(activityWrites.length, 1);
  response = await get('/api/action-items', `${cookie(false, false)}; ${TOUCH}=${Date.now() - 7200000}`); assert.equal(response.status, 200);
  assert.equal(activityWrites.length, 2);
  console.log('PASS HTTP: browser activity cookie suppresses repeated writes for one hour, then permits the next update');
  activityWrites = [];
  for (const deniedMode of ['invalid', 'revoked', 'expired', 'valid']) {
    mode = deniedMode;
    response = await get('/api/action-items', deniedMode === 'valid' ? undefined : cookie(deniedMode === 'expired', false), { 'x-user-email': USER.email, 'x-amd-os-api-activity': '1' });
    assert.equal(response.status, 401); assert.equal(responseCookies(response).some(value => value.startsWith(TOUCH + '=')), false);
  }
  assert.equal(activityWrites.length, 0);
  console.log('PASS HTTP: missing/forged/invalid/revoked identity never creates an activity write or cookie');
  mode = 'valid'; calls = [];
  response = await get('/api/admin/change-history', cookie(false, false)); assert.equal(response.status, 403); assert.equal(activityWrites.length, 1);
  calls = []; activityWrites = [];
  response = await get('/api/unknown', cookie(false, false), { 'x-amd-os-api-activity': '1' }); assert.equal(response.status, 200);
  assert.equal(activityWrites.length, 1); assert.equal(calls.filter(path => path === '/auth/v1/user').length, 2);
  console.log('PASS HTTP: verified admin denial retains activity; unregistered API retains exactly one middleware activity write');
  calls = []; activityWrites = [];
  response = await get('/api/project/monthly-reports', cookie(false, false)); assert.equal(response.status, 400);
  assert.equal(activityWrites.length, 1); assert.equal(calls.filter(path => path === '/auth/v1/user').length, 1);
  assert.ok(responseCookies(response).some(value => value.startsWith(TOUCH + '=')));
  console.log('PASS HTTP: pre-helper input 400 preserves the original middleware activity write and cookie');
  passed = true;
  console.log(`API auth HTTP: 13 scenarios passed with real Next ${production ? 'production server' : 'development server'} and Supabase SSR on loopback; no production access.`);
} finally {
  if (child && child.exitCode === null) {
    process.kill(-child.pid, 'SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 5000))]);
    if (child.exitCode === null) process.kill(-child.pid, 'SIGKILL');
  }
  fakeAuth.closeAllConnections(); await new Promise(resolve => fakeAuth.close(resolve));
  if (!passed) console.error(output.slice(-12000));
  await rm(fixture, { recursive: true, force: true });
}
