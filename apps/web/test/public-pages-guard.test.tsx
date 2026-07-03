import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Regression fence (SELECTIVE_DISCLOSURE.md §5.3 / §6.7): the public /verify and
// /auditor client components are wallet-free and session-free BY CONSTRUCTION.
// They must never import auth, the wallet kit, or TanStack Query — pulling any of
// those in would drag a provider requirement into a page that renders bare for
// any third party. This is a static source scan (vitest runs from apps/web, so
// paths are resolved relative to process.cwd()), independent of the render-based
// checks in verify-page.test.tsx / auditor-page.test.tsx.
const FORBIDDEN = /useAuth|@\/lib\/auth|stellar-wallets-kit|wallet-kit|useQueryClient/;

/**
 * Strip comments before scanning so the guard fires on real imports/usages, not
 * on the doc-comments that describe the wallet-free invariant (both files spell
 * out "imports neither `useAuth` nor the wallet kit" in prose). A genuine
 * `import { useAuth }` or `stellar-wallets-kit` dependency still trips it.
 */
function code(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/\/\/.*$/gm, ""); // line comments
}

describe("public confidential pages stay wallet-free", () => {
  it("public /verify client never imports auth or wallet kit", () => {
    expect(code("app/verify/verify-client.tsx")).not.toMatch(FORBIDDEN);
  });

  it("public /auditor client never imports auth or wallet kit", () => {
    expect(code("app/auditor/auditor-client.tsx")).not.toMatch(FORBIDDEN);
  });
});
