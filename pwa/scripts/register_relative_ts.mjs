import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const target = new URL(specifier, context.parentURL);
    if (target.protocol === "file:" && !existsSync(target) && existsSync(fileURLToPath(target) + ".ts")) return { url: target.href + ".ts", shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });
