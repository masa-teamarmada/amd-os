import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const HELPERS = new Set(['requireAuth', 'requireMember', 'requireAdmin']);

function routeFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? routeFiles(path) : entry.name === 'route.ts' ? [path] : [];
  });
}

// Conservative contract: the first statement is a direct helper call followed immediately
// by its failure return. Custom guards, aliases, nested/conditional calls and
// workspace fallback paths remain on middleware's existing getUser path.
export function hasDirectAuthGuard(handler, imports, source) {
  const statements = handler.body?.statements ?? [];
  // An earlier error return/throw would skip handler activity recording. Keep
  // those handlers in middleware so their existing activity semantics survive.
  if (statements.length < 2 || !ts.isVariableStatement(statements[0])) return false;
  const declarations = statements[0].declarationList.declarations;
  if (declarations.length !== 1) return false;
  const declaration = declarations[0];
  const initializer = declaration.initializer;
  if (!ts.isIdentifier(declaration.name) || !initializer || !ts.isAwaitExpression(initializer)) return false;
  const call = initializer.expression;
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression) || !imports.has(call.expression.text) || call.arguments.length) return false;
  const name = declaration.name.text;
  const guard = statements[1];
  if (!ts.isIfStatement(guard) || guard.elseStatement) return false;
  if (guard.expression.getText(source).replace(/\s/g, '') !== `!${name}.ok`) return false;
  const returned = ts.isBlock(guard.thenStatement) && guard.thenStatement.statements.length === 1
    ? guard.thenStatement.statements[0] : guard.thenStatement;
  return ts.isReturnStatement(returned) && returned.expression?.getText(source) === `${name}.errorResponse`;
}

export function buildApiAuthRouteInventory() {
  const root = fileURLToPath(new URL('../src/app/api', import.meta.url));
  return Object.fromEntries(routeFiles(root).sort().map(path => {
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    const imports = new Set();
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== '@/lib/supabase/api-auth') continue;
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (!element.propertyName && HELPERS.has(element.name.text)) imports.add(element.name.text);
        }
      }
    }
    const methods = [];
    const explicitHead = source.statements.some(statement =>
      (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)
        && statement.exportClause.elements.some(element => element.name.text === 'HEAD'))
      || (statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
        && ((ts.isFunctionDeclaration(statement) && statement.name?.text === 'HEAD')
          || (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.getText(source) === 'HEAD')))));
    for (const statement of source.statements) {
      if (!ts.isFunctionDeclaration(statement) || !METHODS.has(statement.name?.text) || !statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
      if (hasDirectAuthGuard(statement, imports, source)) methods.push(statement.name.text);
    }
    if (methods.includes('GET') && !explicitHead) methods.push('HEAD');
    const template = `/api${path.slice(root.length, -'/route.ts'.length)}`;
    // [] also records exceptions so a static exception can't match an audited
    // sibling dynamic route. The full-source check catches newly added routes,
    // including static routes that would otherwise match a dynamic template.
    return [template, methods.sort()];
  }));
}
