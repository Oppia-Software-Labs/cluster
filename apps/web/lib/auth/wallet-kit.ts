// Type-only import: erased at build time so the (browser-only) kit package is
// never evaluated on the server. The real module is loaded lazily below.
import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";

let kitPromise: Promise<typeof StellarWalletsKit> | null = null;

/**
 * Lazily load and initialise the Stellar Wallets Kit (mainnet, all no-config
 * wallet modules) and return the kit class. In `@creit.tech/stellar-wallets-kit`
 * v2 the kit is a static singleton (`StellarWalletsKit.init(...)`), so callers
 * use the static methods (`authModal`, `getAddress`, `signMessage`,
 * `signTransaction`) off the returned class.
 *
 * The kit touches browser storage at module-eval time, so it MUST NOT be
 * imported on the server (it crashes Next's SSR/prerender). Importing it
 * dynamically here, guarded by a `window` check, keeps it strictly client-side.
 * This is why `getWalletKit` is async.
 */
export async function getWalletKit(): Promise<typeof StellarWalletsKit> {
  if (typeof window === "undefined") {
    throw new Error("The Stellar Wallets Kit is only available in the browser.");
  }
  if (!kitPromise) {
    kitPromise = (async () => {
      const [{ StellarWalletsKit, Networks }, { defaultModules }, { FREIGHTER_ID }] =
        await Promise.all([
          import("@creit.tech/stellar-wallets-kit"),
          import("@creit.tech/stellar-wallets-kit/modules/utils"),
          import("@creit.tech/stellar-wallets-kit/modules/freighter"),
        ]);
      StellarWalletsKit.init({
        network: Networks.PUBLIC, // mainnet (spec: NEXT_PUBLIC_STELLAR_NETWORK=mainnet)
        selectedWalletId: FREIGHTER_ID,
        modules: defaultModules(),
      });
      return StellarWalletsKit;
    })();
  }
  return kitPromise;
}
