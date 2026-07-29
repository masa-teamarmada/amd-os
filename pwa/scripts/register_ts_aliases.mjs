import { extname, resolve } from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    let target = resolve(process.cwd(), "src", specifier.slice(2));
    if (!extname(target)) target += ".ts";
    return { url: pathToFileURL(target).href, shortCircuit: true };
  },
});
