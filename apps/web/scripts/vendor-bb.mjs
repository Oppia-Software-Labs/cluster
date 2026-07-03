/**
 * Vendor @aztec/bb.js's browser build into apps/web's public/ directory.
 *
 * Why: bb.js spawns its wasm Web Worker with
 *   new Worker(new URL(/* webpackIgnore *​/ './main.worker.js', import.meta.url), { type: 'module' })
 * The `webpackIgnore` means a bundler neither rewrites that URL nor emits the
 * worker file, so once webpack bundles bb.js into a hashed chunk the worker
 * resolves to a non-existent `/_next/static/chunks/main.worker.js` and proving
 * hangs forever. Serving the intact `dest/browser/` directory at a stable
 * public path lets `import.meta.url`-relative resolution find the sibling
 * worker + wasm files. The app loads it as native ESM (see lib/bb-loader.ts),
 * bypassing webpack entirely.
 *
 * Idempotent: re-copies on every run (predev/prebuild), overwriting the target.
 */
import { cp, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// apps/web/scripts -> apps/web
const appRoot = resolve(here, "..");

// Locate bb.js's dest/browser. npm hoists @aztec/bb.js to the workspace root
// node_modules, but it may also resolve locally under apps/web. Use Node's own
// resolver against the package root, then fall back to a couple of known paths.
function findBrowserDir() {
  const candidates = [];
  try {
    const require = createRequire(join(appRoot, "package.json"));
    const pkgJson = require.resolve("@aztec/bb.js/package.json");
    candidates.push(join(dirname(pkgJson), "dest", "browser"));
  } catch {
    // ignore — fall through to path guesses
  }
  candidates.push(join(appRoot, "node_modules", "@aztec", "bb.js", "dest", "browser"));
  candidates.push(join(appRoot, "..", "..", "node_modules", "@aztec", "bb.js", "dest", "browser"));
  return candidates.find((d) => existsSync(join(d, "index.js")));
}

const srcDir = findBrowserDir();
if (!srcDir) {
  throw new Error("could not locate @aztec/bb.js dest/browser under node_modules");
}

const destDir = resolve(appRoot, "public", "vendor", "bb");
await mkdir(destDir, { recursive: true });
await cp(srcDir, destDir, { recursive: true });

const files = await readdir(destDir);
console.log("vendored @aztec/bb.js browser build");
console.log(`  from ${srcDir}`);
console.log(`  to   ${destDir}`);
console.log(`  files: ${files.join(", ")}`);
