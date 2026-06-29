import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import { FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter";

let initialized = false;

/**
 * Lazily initialise the Stellar Wallets Kit once (mainnet, all no-config wallet
 * modules) and return the kit class. In `@creit.tech/stellar-wallets-kit` v2 the
 * kit is a static singleton (`StellarWalletsKit.init(...)`) rather than an
 * instance, so callers use the static methods (`authModal`, `getAddress`,
 * `signMessage`) off the returned class.
 */
export function getWalletKit(): typeof StellarWalletsKit {
  if (!initialized) {
    StellarWalletsKit.init({
      network: Networks.PUBLIC, // mainnet (spec: NEXT_PUBLIC_STELLAR_NETWORK=mainnet)
      selectedWalletId: FREIGHTER_ID,
      modules: defaultModules(),
    });
    initialized = true;
  }
  return StellarWalletsKit;
}
