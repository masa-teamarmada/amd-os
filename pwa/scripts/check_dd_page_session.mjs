import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { signWorkspaceSessionValue, verifyWorkspaceSessionValue } from '../src/lib/workspace-access-session-core.ts';

function load(path, mocks) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const output = {};
  new Function('require', 'exports', code)((name) => { assert.ok(name in mocks, name); return mocks[name]; }, output);
  return output;
}
const navigate = {
  redirect: (location) => { throw Object.assign(new Error('redirect'), { location }); },
  notFound: () => { throw new Error('not-found'); },
};
let member = null, cookie = null;
const secret = 'dd-session-test-only';
const validCookie = signWorkspaceSessionValue({ accountId: 'test-account', email: 'viewer@example.test' }, secret);
const guard = load('../src/lib/dd-page-session.ts', {
  'server-only': {}, 'next/navigation': navigate,
  '@/lib/project-workspace': { getCurrentMemberAccess: async () => member },
  '@/lib/workspace-access-session': { getWorkspaceAccessCandidateSession: async () => verifyWorkspaceSessionValue(cookie, secret) },
  '@/lib/workspace-next-path': { sanitizeNextPath: (next) => next.startsWith('/') && !next.startsWith('//') ? next : '/' },
}).requireDdPageSession;
for (const value of [null, '', 'invalid', validCookie.slice(0, -2) + 'xx', signWorkspaceSessionValue({ accountId: 'test-account', email: 'viewer@example.test' }, secret, 0)]) {
  cookie = value;
  await assert.rejects(guard('/dd/sol?tab=company'), (error) => new URL('https://example.test' + error.location).searchParams.get('next') === '/dd/sol?tab=company');
}
cookie = validCookie;
await guard('/dd/sol');
member = { memberId: 'member' }; cookie = null;
await guard('/dd/sol');
member = null;
await assert.rejects(guard('//outside.example'), (error) => error.location === '/auth/login?next=%2F');

let access = null, lookups = 0, reads = 0;
const page = load('../src/app/dd/[slug]/page.tsx', {
  'react/jsx-runtime': { jsx: () => null, jsxs: () => null },
  'next/navigation': navigate,
  '@/lib/dd-page-session': { requireDdPageSession: guard },
  '@/lib/dd-access': { resolveDdPackageAccess: async () => { lookups++; return access; } },
  '@/lib/dd-package-core': { isDdSlug: (slug) => /^[a-z0-9-]+$/.test(slug), hasDdCapability: () => false },
  '@/lib/dd-pages': { DD_PAGE_KEYS: ['company', 'technology'] },
  '@/lib/dd-confidentiality-server': { ddContentHash: () => 'test-hash' },
  '@/lib/dd-package-server': {
    loadDdPackageView: async () => { reads++; return { sections: [], projectName: 'test' }; },
    recordDdAccessEvent: async () => {},
  },
  '@/lib/dd-project-pages-server': { loadDdProjectPage: async () => { reads++; return { page: 'company' }; } },
  '@/components/dd/DdViewerShell': { DdViewerShell: () => null },
  '@/components/dd/DdPackageTop': { DdPackageTop: () => null },
}).default;
const input = { params: Promise.resolve({ slug: 'sol' }), searchParams: Promise.resolve({ tab: 'technology' }) };
await assert.rejects(page(input), (error) => error.location && new URL('https://example.test' + error.location).searchParams.get('next') === '/dd/sol?tab=technology');
assert.equal(lookups, 0, '匿名にはパッケージの存在を読まない');
assert.equal(reads, 0);
cookie = validCookie;
await assert.rejects(page(input), /not-found/);
assert.equal(reads, 0, 'ログイン済みでもDD個別付与がなければ本文を読まない');
access = { projectId: 'p21', slug: 'sol' };
await page(input);
assert.equal(reads, 2, '許可済みの人だけDDのヘッダと選択ページを読む');
console.log('DD page session: missing/empty/expired/tampered -> login with next; valid sessions still require DD grant; no email/DB');
