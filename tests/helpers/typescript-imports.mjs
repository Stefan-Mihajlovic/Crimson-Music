import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';

// Node's type stripping intentionally does not resolve Metro's extensionless TS imports.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(candidate)) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
} });
