export type { ProofEnvelope, Opening } from "./types.js";
export * from "./crypto/index.js";
export * from "./account/index.js";
export * from "./witness/index.js";
export * from "./chain/index.js";
export * from "./proving/index.js";
// Offline state engine (browser-safe barrel; excludes node-only json-store).
export * from "./state/index.js";
// Node-only prove ops (load vendored circuits via `node:fs`). The browser build
// (Z5) supplies its own artifact path and must not pull these through a bundle.
export {
  proveRegister,
  proveTransfer,
  proveWithdraw,
  type TransferEnvelope,
} from "./proving/ops.js";
