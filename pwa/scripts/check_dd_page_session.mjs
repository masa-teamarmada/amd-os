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

let access = null, lookups = 0, reads = 0, contentEdit = false;
const page = load('../src/app/dd/[slug]/page.tsx', {
  'react/jsx-runtime': { jsx: (_type, props) => props, jsxs: (_type, props) => props },
  'next/navigation': navigate,
  '@/lib/dd-page-session': { requireDdPageSession: guard },
  '@/lib/dd-nda-server': {loadDdNdaContext:async()=>({prompt:'test',promptHash:'hash',version:'test'}),hasDdNdaConfirmation:async()=>true},
 '@/lib/dd-nda':{ddNdaReturnPath:(_slug,value)=>value},
 '@/components/dd/DdEntryGate':{DdEntryGate:()=>null},
 '@/lib/dd-access': { resolveDdPackageAccess: async () => { lookups++; return access; } },
  '@/lib/dd-package-core': { isDdSlug: (slug) => /^[a-z0-9-]+$/.test(slug), hasDdCapability: (access, capability) => access.capabilities?.includes(capability) === true },
  '@/lib/project-surface-access': { canEditProjectSurface: async () => contentEdit },
  '@/lib/dd-pages': { DD_PAGE_KEYS: ['company', 'technology', 'poc-list'] },
  '@/lib/dd-confidentiality-server': { ddContentHash: () => 'test-hash' },
  '@/lib/dd-package-server': {
    loadDdPackageView: async () => { reads++; return { sections: [], projectName: 'test' }; },
    recordDdAccessEvent: async () => {},
  },
  '@/lib/dd-project-pages-server': { loadDdProjectPage: async () => { reads++; return { page: 'company' }; } },
  '@/components/dd/DdViewerShell': { DdViewerShell: () => null },
  '@/components/dd/DdPackageTop': { DdPackageTop: () => null },
  '@/lib/dd-report-server': {loadDdReportEdition:async()=>null},
  '@/components/dd/report/DdReportReader': {DdReportReader:()=>null},
  '@/components/dd/report/DdReportNavigation': {DdReportNavigation:()=>null},
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
const pocInput = { ...input, searchParams: Promise.resolve({ tab: 'poc-list' }) };
for (const [principal, capabilities, editable, expected] of [
  ['internal_admin', ['dd.view','dd.edit'], true, true],
  ['internal_member', ['dd.view','dd.edit'], true, true],
  ['internal_member', ['dd.view','dd.edit'], false, false],
  ['internal_member', ['dd.view'], true, false],
  ['workspace_account', ['dd.view','dd.edit'], true, false],
]) {
  access = { projectId: 'p21', slug: 'sol', principal, capabilities };
  contentEdit = editable;
  assert.equal((await page(pocInput)).children.canEditPocList, expected, `${principal}: DDと正本の既存編集権限が両方必要`);
}
console.log('DD page session: missing/empty/expired/tampered -> login with next; valid sessions still require DD grant; no email/DB');
