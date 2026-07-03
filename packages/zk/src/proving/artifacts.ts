/**
 * Node-only loader for the vendored compiled circuits. Kept out of the browser
 * barrel ({@link ./index.ts}) because it reads from the filesystem; the browser
 * build (Z5) supplies circuits through its own vendored-artifact path.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { CompiledCircuit } from "@noir-lang/noir_js";

/** The three vendored circuits. Disclosure circuits are added by a later task. */
export type CircuitName = "register" | "withdraw" | "transfer";

const circuitsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "circuits");

export function loadCircuit(name: CircuitName): CompiledCircuit {
  return JSON.parse(readFileSync(join(circuitsDir, `${name}.json`), "utf8")) as CompiledCircuit;
}
