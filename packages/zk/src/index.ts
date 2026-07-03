export type { ProofEnvelope, Opening } from "./types.js";
export * from "./crypto/index.js";
export * from "./account/index.js";
export * from "./witness/index.js";
export * from "./chain/index.js";
export * from "./proving/index.js";
// Off-chain selective-disclosure surface (browser-safe: no node:fs). The pinned
// VK loader is node-only, exported from the ops block below.
export * from "./disclosure/index.js";
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
// Node-only pinned-VK loader for the disclosure circuits (reads circuits/vks).
export { loadDisclosureVk, type DisclosureCircuitName } from "./proving/artifacts.js";
