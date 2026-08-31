// "server-only" is a Next.js-webpack-only marker package — it is intentionally not an installed
// npm dependency (Next.js resolves it via a special bundler alias, not node_modules). Files under
// src/lib import it to guard against being accidentally bundled into client code; that guard is
// meaningless (and unresolvable) when a plain node script imports the same file directly for a
// behavioral test. This stub redirects the bare specifier to a no-op module so such a test can
// import the real production module (unmodified) instead of duplicating its logic.
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import path from "node:path";

const stubUrl = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "server_only_stub.mjs")).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: stubUrl, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
