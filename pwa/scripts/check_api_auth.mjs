// Real Supabase SSR/client code with a fake transport; no credentials or live DB.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { AsyncLocalStorage } from 'node:async_hooks';
import ts from 'typescript';
import { buildApiAuthRouteInventory, hasDirectAuthGuard } from './api_auth_route_inventory.mjs';
import { API_ROUTE_AUTH_METHODS, apiRouteOwnsAuthentication } from '../src/lib/supabase/api-auth-routes.ts';

const require = createRequire(import.meta.url);
globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
const next = require('next/server');
const ssr = require('@supabase/ssr');
const { unstable_doesMiddlewareMatch } = require('next/experimental/testing/server');
function load(relative, mocks) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const output = {};
  new Function('require', 'exports', code)(name => { assert.ok(name in mocks, `Unexpected dependency: ${name}`); return mocks[name]; }, output);
  return output;
}

assert.deepEqual(API_ROUTE_AUTH_METHODS, buildApiAuthRouteInventory(), 'Review changed route guards and update the method inventory before shipping');
// Conditional auth and a guard hidden inside a try/block must stay conservative.
for (const body of [
  'if (flag) { const auth = await requireAuth(); if (!auth.ok) return auth.errorResponse; }',
  'try { const auth = await requireAuth(); if (!auth.ok) return auth.errorResponse; } catch {}',
  'const auth = await requireAuth(); if (!auth.ok && !external) return auth.errorResponse;',
  'const auth = await requireAuth(); if (!auth.ok) console.log(auth.errorResponse);',
  'if (!projectId) return Response.json({}, {status:400}); const auth = await requireAuth(); if (!auth.ok) return auth.errorResponse;',
]) {
  const source = ts.createSourceFile('test.ts', `export async function GET() { ${body} }`, ts.ScriptTarget.Latest, true);
  assert.equal(hasDirectAuthGuard(source.statements[0], new Set(['requireAuth']), source), false);
}
for (const [path, method, expected] of [
  ['/api/action-items', 'GET', true], ['/api/action-items/', 'HEAD', true],
  ['/api/action-items', 'OPTIONS', false], ['/api/action-items/new-route', 'GET', false],
  ['/api/auth/email-start', 'POST', false], ['/api/cron/slack-source-sync', 'GET', false],
  ['/api/workspace-documents/doc1', 'GET', false], ['/api/project-tech', 'GET', false],
  ['/api/ms/auth/callback', 'GET', false], ['/api/unknown', 'GET', false],
  ['/api/action-items', 'get', false], ['/dashboard', 'GET', false],
]) assert.equal(apiRouteOwnsAuthentication(path, method), expected, `${method} ${path}`);
for (const [template, methods] of Object.entries(API_ROUTE_AUTH_METHODS)) {
  const pathname = template.replace(/\[\[?\.{3}[^\]]+\]\]?/g, 'one/two').replace(/\[[^\]]+\]/g, 'test-id');
  for (const method of methods) assert.equal(apiRouteOwnsAuthentication(pathname, method), true, `${template} ${method}`);
}

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://auth.example.test';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const originalFetch = globalThis.fetch;
let mode = 'valid', calls = [], activityWrites = [], context;
const USER = { id: 'user-1', email: 'member@example.test' };
const COOKIE = 'sb-auth-auth-token';
function session(expired = false) {
  const exp = Math.floor(Date.now() / 1000) + (expired ? -3600 : 3600);
  const payload = Buffer.from(JSON.stringify({ sub: USER.id, exp, session_id: 'test-session' })).toString('base64url');
  return { access_token: `test.${payload}.signature`, refresh_token: 'test-refresh', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: USER };
}
function cookieValue(expired = false) { return `base64-${Buffer.from(JSON.stringify(session(expired))).toString('base64url')}`; }
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  assert.equal(url.host, 'auth.example.test', 'Real network is forbidden');
  calls.push(url.pathname);
  if (url.pathname === '/auth/v1/token') {
    if (mode === 'expired') return Response.json({ msg: 'Refresh token revoked', code: 'refresh_token_not_found', error_code: 'refresh_token_not_found' }, { status: 400 });
    assert.equal(JSON.parse(init.body).refresh_token, 'test-refresh');
    return Response.json(session());
  }
  if (url.pathname === '/auth/v1/user') {
    assert.match(new Headers(init?.headers).get('authorization'), /^Bearer test\./i);
    if (mode === 'revoked') return Response.json({ msg: 'Session revoked', code: 'session_not_found', error_code: 'session_not_found' }, { status: 401 });
    if (mode === 'invalid') return Response.json({ msg: 'Invalid token', error_code: 'bad_jwt' }, { status: 401 });
    if (mode === 'no-email') return Response.json({ id: USER.id });
    return Response.json(USER);
  }
  if (url.pathname === '/auth/v1/logout') return new Response(null, { status: 204 });
  if (url.pathname === '/rest/v1/members') {
    if (init?.method === 'PATCH') {
      assert.equal(new Headers(init.headers).get('apikey'), 'activity-test-service-key');
      assert.equal(new Headers(init.headers).get('authorization'), 'Bearer activity-test-service-key');
      activityWrites.push({ filter: url.searchParams.get('email'), values: JSON.parse(init.body) });
      return new Response(null, { status: 204 });
    }
    return Response.json(mode === 'external' ? null : { member_id: 'member-1', is_admin: mode === 'admin' });
  }
  throw new Error(`Unexpected fake endpoint ${url.pathname}`);
};
const server = load('../src/lib/supabase/server.ts', {
  '@supabase/ssr': ssr,
  'next/headers': { cookies: async () => context.cookies, headers: async () => context.headers },
});
const lastLogin = load('../src/lib/supabase/last-login.ts', { '@supabase/supabase-js': require('@supabase/supabase-js') });
const apiAuth = load('../src/lib/supabase/api-auth.ts', { '@/lib/supabase/server': server, 'next/server': next,
  'next/headers': { cookies: async () => context.cookies, headers: async () => context.headers }, '@/lib/supabase/last-login': lastLogin });
const ddCore = load('../src/lib/dd-package-core.ts', {});
const sessionMiddleware = load('../src/lib/supabase/middleware.ts', {
  '@supabase/ssr': ssr,
  'next/server': next, '@/lib/dd-package-core': ddCore,
  '@/lib/supabase/api-auth-routes': { apiRouteOwnsAuthentication },
  '@/lib/supabase/last-login': lastLogin,
});
const hostPolicy = load('../src/lib/bzm-reader/hosts.ts', {});
const rootMiddleware = load('../src/middleware.ts', {
  'next/server': next, '@/lib/supabase/middleware': sessionMiddleware, '@/lib/bzm-reader/hosts': hostPolicy,
});

let ownershipChecks = 0;
for (const [template, methods] of Object.entries(API_ROUTE_AUTH_METHODS)) {
  const pathname = template.replace(/\[\[?\.{3}[^\]]+\]\]?/g, 'asset/path').replace(/\[[^\]]+\]/g, 'test-id');
  for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.equal(apiRouteOwnsAuthentication(pathname, method), methods.includes(method), `${template} ${method} ownership`);
    ownershipChecks++;
  }
  if (methods.length) assert.equal(unstable_doesMiddlewareMatch({ config: rootMiddleware.config, url: pathname }), true, template);
}
// The unchanged static-asset matcher also excludes API image URLs. Their route
// helper remains responsible for validation/refresh; they never had middleware
// getUser duplication. Static exception routes must win over dynamic siblings.
for (const pathname of ['/api/bzm-reader/asset/test.svg', '/api/bzm-reader/asset/test.png']) {
  assert.equal(apiRouteOwnsAuthentication(pathname, 'GET'), true);
  assert.equal(unstable_doesMiddlewareMatch({ config: rootMiddleware.config, url: pathname }), false);
}
for (const method of ['GET', 'POST']) assert.equal(apiRouteOwnsAuthentication('/api/meeting-assets/adopt-drive-folder', method), false);
console.log(`PASS: ${ownershipChecks} method ownership checks; audited route matching and static exceptions`);

function request(path, value, extra = {}) {
  return new next.NextRequest(`https://app.example.test${path}`, { headers: { ...(value === undefined ? {} : { cookie: `${COOKIE}=${value}` }), ...extra } });
}
function routeContext(req) {
  const written = new next.NextResponse();
  context = {
    headers: req.headers,
    cookies: { get: name => req.cookies.get(name), getAll: () => req.cookies.getAll(), set: (name, value, options) => { req.cookies.set(name, value); written.cookies.set(name, value, options); } },
  };
  return written;
}
function reset(nextMode = 'valid') { mode = nextMode; calls = []; activityWrites = []; apiAuth.invalidateMemberLookupCache(); }
async function pipeline(path, value, guard = 'requireAuth', extra) {
  const req = request(path, value, extra);
  const middleware = await rootMiddleware.middleware(req);
  const written = routeContext(req);
  const result = await apiAuth[guard]();
  return { req, middleware, written, result };
}

let assertions = 0;
async function scenario(name, fn) { reset(); await fn(); assertions++; console.log(`PASS: ${name}`); }
try {
  await scenario('valid cookie: one remote user validation across middleware + helper', async () => {
    const { result, middleware } = await pipeline('/api/action-items', cookieValue());
    assert.equal(result.ok, true); assert.deepEqual(calls, ['/auth/v1/user']);
    assert.equal(middleware.headers.get('x-pathname'), '/api/action-items');
    assert.equal(middleware.headers.get('location'), null);
  });
  await scenario('missing session returns API 401; identity headers cannot authenticate', async () => {
    const { result } = await pipeline('/api/action-items', undefined, 'requireAuth', { 'x-user-id': USER.id, 'x-user-email': USER.email, 'x-pathname': '/admin' });
    assert.equal(result.ok, false); assert.equal(result.errorResponse.status, 401); assert.equal(calls.length, 0);
  });
  await scenario('unverified cookie identity is ignored and invalid tokens still fail', async () => {
    const forged = session(); forged.user = { id: 'forged-admin', email: 'forged@example.test' };
    const value = `base64-${Buffer.from(JSON.stringify(forged)).toString('base64url')}`;
    const valid = await pipeline('/api/action-items', value);
    assert.deepEqual(valid.result.user, USER);
    mode = 'invalid';
    const invalid = await pipeline('/api/action-items', value);
    assert.equal(invalid.result.errorResponse.status, 401);
  });
  await scenario('expired access token refreshes once and preserves request/response cookies and cache headers', async () => {
    const before = cookieValue(true);
    const { req, middleware, result } = await pipeline('/api/action-items', before);
    assert.equal(result.ok, true); assert.deepEqual(calls, ['/auth/v1/token', '/auth/v1/user']);
    assert.notEqual(req.cookies.get(COOKIE).value, before);
    assert.equal(middleware.cookies.get(COOKIE).value, req.cookies.get(COOKIE).value);
    assert.match(middleware.headers.get('set-cookie'), /Path=\/.*SameSite=lax/i);
    assert.match(middleware.headers.get('cache-control'), /private.*no-store/);
    assert.equal(middleware.headers.get('pragma'), 'no-cache');
  });
  await scenario('revoked refresh token returns 401 with cookie deletion', async () => {
    mode = 'expired';
    const { result, middleware } = await pipeline('/api/action-items', cookieValue(true));
    assert.equal(result.ok, false); assert.equal(result.errorResponse.status, 401);
    assert.deepEqual(calls, ['/auth/v1/token']);
    assert.equal(middleware.cookies.get(COOKIE).maxAge, 0);
  });
  await scenario('revoked user/session is rejected on every request despite member cache', async () => {
    const first = await pipeline('/api/admin/change-history', cookieValue(), 'requireMember'); assert.equal(first.result.ok, true);
    mode = 'revoked';
    const second = await pipeline('/api/admin/change-history', cookieValue(), 'requireMember');
    assert.equal(second.result.ok, false); assert.equal(second.result.errorResponse.status, 401);
    assert.equal(calls.filter(path => path === '/auth/v1/user').length, 2);
    assert.equal(second.written.cookies.get(COOKIE).maxAge, 0);
  });
  await scenario('regular member is denied admin; current admin is allowed', async () => {
    const denied = await pipeline('/api/admin/change-history', cookieValue(), 'requireAdmin'); assert.equal(denied.result.errorResponse.status, 403);
    reset('admin');
    const allowed = await pipeline('/api/admin/change-history', cookieValue(), 'requireAdmin'); assert.equal(allowed.result.ok, true);
    assert.equal(calls.filter(path => path === '/auth/v1/user').length, 1);
  });
  await scenario('non-member Supabase user cannot use member or admin access', async () => {
    mode = 'external';
    const member = await pipeline('/api/action-items', cookieValue(), 'requireMember'); assert.equal(member.result.errorResponse.status, 403);
    apiAuth.invalidateMemberLookupCache();
    const admin = await pipeline('/api/admin/change-history', cookieValue(), 'requireAdmin'); assert.equal(admin.result.errorResponse.status, 403);
  });
  await scenario('external workspace cookie cannot authenticate a member API', async () => {
    const { result } = await pipeline('/api/action-items', undefined, 'requireMember', { cookie: 'amd_os_workspace_session=test-external-session' });
    assert.equal(result.errorResponse.status, 401); assert.equal(calls.length, 0);
  });
  await scenario('page redirect retains original query; missing API session remains 401', async () => {
    const response = await rootMiddleware.middleware(request('/dashboard?tab=tasks'));
    assert.equal(response.status, 307); const target = new URL(response.headers.get('location'));
    assert.equal(target.pathname, '/auth/login'); assert.equal(target.searchParams.get('next'), '/dashboard?tab=tasks');
    const { middleware, result } = await pipeline('/api/action-items');
    assert.equal(middleware.headers.get('location'), null); assert.equal(result.errorResponse.status, 401);
  });
  await scenario('failed page refresh keeps deletion cookies on login redirect', async () => {
    mode = 'expired';
    const response = await rootMiddleware.middleware(request('/dashboard', cookieValue(true)));
    assert.equal(response.status, 307); assert.equal(response.cookies.get(COOKIE).maxAge, 0);
    assert.match(response.headers.get('cache-control'), /no-store/);
  });
  await scenario('workspace session gates only existing shared pages, never internal pages', async () => {
    for (const path of ['/workspaces', '/workspace/sol', '/project/p21/workspace', '/dd/sol']) {
      const response = await rootMiddleware.middleware(request(path, undefined, { cookie: 'amd_os_workspace_session=existing-candidate' }));
      assert.equal(response.headers.get('location'), null, path);
    }
    for (const path of ['/dashboard', '/admin', '/project/p21/cockpit']) {
      const response = await rootMiddleware.middleware(request(path, undefined, { cookie: 'amd_os_workspace_session=existing-candidate' }));
      assert.equal(response.status, 307, path);
    }
  });
  await scenario('custom/workspace API and unknown method keep middleware user validation', async () => {
    for (const path of ['/api/project-tech', '/api/workspace-documents/doc1']) {
      const response = await rootMiddleware.middleware(request(path, cookieValue())); assert.equal(response.headers.get('location'), null);
    }
    assert.equal(calls.filter(path => path === '/auth/v1/user').length, 2);
  });
  await scenario('native Bearer validates on API even without cookie; malformed Bearer is rejected', async () => {
    const result = await pipeline('/api/action-items', undefined, 'requireAuth', { authorization: `Bearer ${session().access_token}` });
    assert.equal(result.result.ok, true); assert.deepEqual(calls, ['/auth/v1/user']);
    const malformed = await pipeline('/api/action-items', undefined, 'requireAuth', { authorization: 'Bearer token injected' });
    assert.equal(malformed.result.errorResponse.status, 401);
  });
  await scenario('logout clears session and the next API request is unauthorized', async () => {
    const { req } = await pipeline('/api/action-items', cookieValue());
    routeContext(req);
    const client = await server.createClient();
    const { error } = await client.auth.signOut({ scope: 'local' }); assert.equal(error, null);
    assert.equal(req.cookies.get(COOKIE).value, '');
    const nextRequest = await pipeline('/api/action-items', req.cookies.get(COOKIE).value);
    assert.equal(nextRequest.result.errorResponse.status, 401);
  });
  await scenario('middleware matching keeps auth callbacks/static/build-info exclusions and API host routing', async () => {
    const matches = url => unstable_doesMiddlewareMatch({ config: rootMiddleware.config, url });
    for (const path of ['/api/action-items', '/api/auth/email-start', '/dashboard', '/workspace/sol']) assert.equal(matches(path), true, path);
    for (const path of ['/_next/static/test.js', '/_next/image', '/favicon.ico', '/manifest.json', '/manifest-shosai.json', '/auth/callback', '/api/build-info', '/asset.png']) assert.equal(matches(path), false, path);
    const response = await rootMiddleware.middleware(request('/dashboard', undefined, { host: hostPolicy.SHOSAI_HOST }));
    assert.equal(calls.length, 0, 'host redirects happen before auth');
    assert.equal(response.status, 307);
  });
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'activity-test-service-key';
  await scenario('API-only verified activity keeps member timestamp and response cookie; helpers write once per request', async () => {
    const { result, written } = await pipeline('/api/action-items', cookieValue());
    assert.equal(result.ok, true); assert.deepEqual(calls, ['/auth/v1/user', '/rest/v1/members']);
    assert.equal(activityWrites.length, 1); assert.equal(activityWrites[0].filter, `eq.${USER.email}`);
    assert.deepEqual(Object.keys(activityWrites[0].values), ['last_login_at']);
    assert.ok(Math.abs(Date.now() - Date.parse(activityWrites[0].values.last_login_at)) < 5000);
    const touched = written.cookies.get(lastLogin.LAST_LOGIN_TOUCH_COOKIE);
    assert.equal(touched.maxAge, 3600); assert.equal(touched.path, '/'); assert.equal(touched.sameSite, 'lax');
    await apiAuth.requireAuth(); assert.equal(activityWrites.length, 1);
    assert.equal(calls.filter(path => path === '/auth/v1/user').length, 2, 'identity is still checked each helper invocation');
    const recent = await pipeline('/api/action-items', cookieValue(), 'requireAuth', { cookie: `${COOKIE}=${cookieValue()}; ${lastLogin.LAST_LOGIN_TOUCH_COOKIE}=${touched.value}` });
    assert.equal(recent.result.ok, true); assert.equal(activityWrites.length, 1); assert.equal(recent.written.cookies.get(lastLogin.LAST_LOGIN_TOUCH_COOKIE), undefined);
  });
  await scenario('expired or malformed hour throttle records verified API activity again', async () => {
    for (const touched of [String(Date.now() - 7200000), 'invalid-time']) {
      await pipeline('/api/action-items', cookieValue(), 'requireAuth', { cookie: `${COOKIE}=${cookieValue()}; ${lastLogin.LAST_LOGIN_TOUCH_COOKIE}=${touched}` });
    }
    assert.equal(activityWrites.length, 2); assert.equal(calls.filter(path => path === '/auth/v1/user').length, 2);
  });
  await scenario('missing, forged, invalid and revoked identity never writes activity or its cookie', async () => {
    for (const nextMode of ['valid', 'invalid', 'revoked', 'expired', 'no-email']) {
      mode = nextMode;
      const { result, written } = await pipeline('/api/action-items', nextMode === 'valid' ? undefined : cookieValue(nextMode === 'expired'), 'requireAuth', { 'x-user-email': USER.email, [lastLogin.API_ACTIVITY_HEADER]: '1' });
      assert.equal(result.errorResponse.status, 401); assert.equal(written.cookies.get(lastLogin.LAST_LOGIN_TOUCH_COOKIE), undefined);
    }
    assert.equal(activityWrites.length, 0);
  });
  await scenario('activity update uses the verified user email, never forged cookie or identity headers', async () => {
    const forged = session(); forged.user = { id: 'forged-user', email: 'victim@example.test' };
    await pipeline('/api/action-items', `base64-${Buffer.from(JSON.stringify(forged)).toString('base64url')}`, 'requireAuth', { 'x-user-email': 'other-victim@example.test', [lastLogin.API_ACTIVITY_HEADER]: '1' });
    assert.equal(activityWrites.length, 1); assert.equal(activityWrites[0].filter, `eq.${USER.email}`);
  });
  await scenario('verified admin 403 retains prior activity semantics; excluded routes strip forged recording hints', async () => {
    const denied = await pipeline('/api/admin/change-history', cookieValue(), 'requireAdmin');
    assert.equal(denied.result.errorResponse.status, 403); assert.equal(activityWrites.length, 1);
    reset();
    const legacy = await pipeline('/api/unknown', cookieValue(), 'requireAuth', { [lastLogin.API_ACTIVITY_HEADER]: '1' });
    assert.equal(legacy.result.ok, true); assert.equal(legacy.req.headers.has(lastLogin.API_ACTIVITY_HEADER), false);
    assert.equal(activityWrites.length, 1, 'excluded route records in middleware only');
    assert.equal(calls.filter(path => path === '/auth/v1/user').length, 2);
  });
  await scenario('Bearer activity semantics remain unchanged; mixed cookie and Bearer principals keep both validations', async () => {
    await pipeline('/api/action-items', undefined, 'requireAuth', { authorization: `Bearer ${session().access_token}` });
    assert.equal(activityWrites.length, 0); assert.equal(calls.filter(path => path === '/auth/v1/user').length, 1);
    reset();
    const mixed = await pipeline('/api/action-items', cookieValue(), 'requireAuth', { authorization: `Bearer ${session().access_token}` });
    assert.equal(mixed.result.ok, true); assert.equal(activityWrites.length, 1);
    assert.equal(calls.filter(path => path === '/auth/v1/user').length, 2);
    assert.equal(mixed.req.headers.has(lastLogin.API_ACTIVITY_HEADER), false);
  });
  await scenario('member display/order and append-only audit still consume the original last_login_at update', async () => {
    await pipeline('/api/action-items', cookieValue());
    const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(read('../src/app/(app)/admin/members/page.tsx'), /order\("last_login_at"/);
    const table = ts.createSourceFile('members.tsx', read('../src/components/admin/AdminMembersTable.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const format = table.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'formatLastLogin');
    const formatterCode = ts.transpileModule(format.getText(table), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const formatLastLogin = new Function(formatterCode + '; return formatLastLogin;')();
    assert.equal(formatLastLogin(null), '—'); assert.equal(formatLastLogin('invalid'), '—');
    assert.notEqual(formatLastLogin(activityWrites[0].values.last_login_at), '—');
    let comparator;
    function findSort(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'sort' && node.arguments[0]?.getText(table).includes('last_login_at')) comparator = node.arguments[0];
      ts.forEachChild(node, findSort);
    }
    findSort(table);
    const compareCode = ts.transpileModule(`const compare = ${comparator.getText(table)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const compare = new Function(compareCode + '; return compare;')();
    const members = [{ code_name: 'old', last_login_at: '2020-01-01T00:00:00Z' }, { code_name: 'active', last_login_at: activityWrites[0].values.last_login_at }].sort(compare);
    assert.equal(members[0].code_name, 'active');
    const migration = read('../../ios/supabase/migrations/20260916223000_os_data_change_history_and_workspace_access_requests.sql');
    assert.match(migration, /AFTER INSERT OR UPDATE OR DELETE/);
    const excluded = migration.match(/c\.relname NOT IN \(([\s\S]*?)\)/)[1];
    assert.doesNotMatch(excluded, /'members'/);
    assert.match(migration, /amd_os_data_change_history_append_only/);
  });
  console.log(`API auth regression: ${assertions} scenarios; ${Object.keys(API_ROUTE_AUTH_METHODS).length} route files inventoried; no live network/DB.`);
} finally { globalThis.fetch = originalFetch; delete process.env.SUPABASE_SERVICE_ROLE_KEY; }
