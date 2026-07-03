/**
 * Browser-safe public barrel for `@cluster/zk`. This entry MUST NOT import any
 * `node:*` module (directly or transitively) — it is the surface a browser
 * bundle (Z5) consumes. Every node:fs-touching module (circuit/VK loaders, the
 * prove ops that read vendored circuits, the JSON file store) lives on the
 * `@cluster/zk/node` subpath ({@link ./node.ts}) instead.
 */
export type { ProofEnvelope, Opening } from "./types.js";
export * from "./crypto/index.js";
export * from "./account/index.js";
export * from "./witness/index.js";
export * from "./chain/index.js";
// `proving/index.ts` re-exports ONLY `prover.js` (CircuitProver, KECCAK,
// setUltraHonkBackendLoader) — never artifacts.ts/ops.ts (node:fs).
export * from "./proving/index.js";
// Off-chain selective-disclosure surface. Browser-safe: prove.ts/verify.ts take
// an injected `CircuitProver`, so nothing here pulls the node-only circuit
// loader. The pinned-VK loader (`loadDisclosureVk`) is node-only → `./node`.
export * from "./disclosure/index.js";
// Offline state engine (browser-safe barrel; excludes node-only json-store,
// which is re-exported from `./node`).
export * from "./state/index.js";
