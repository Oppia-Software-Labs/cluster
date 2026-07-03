export type Vault = {
  name: string;
  symbol: string;
  asset: string;
  strategy: string;
  address: string;
  network: "testnet" | "mainnet";
  /** Decimal places of the underlying asset contract (all three are Stellar Asset Contracts → 7). */
  decimals: number;
  /** Path under /public to the asset's logo (see apps/web/public/vaults). */
  logo: string;
};

/**
 * DeFindex vaults deployed via the Factory contract
 * (CDSCWE4GLNBYYTES2OCYDFQA2LLY4RBIAX6ZI32VSUXD7GO6HRPO4A32) on Stellar
 * testnet. Manager/emergencyManager/rebalanceManager/feeReceiver all point
 * to GCZSSPNV7G5Q4GD5QE3U5G2RZLTS7A2FHP6NZZZUKC6VDPGITE3MB3PJ.
 *
 * Each vault's `network` drives the whole deposit/withdraw path (DeFindex
 * API query, envelope passphrase, RPC endpoint, explorer links) — add
 * mainnet vaults here with `network: "mainnet"` when they exist.
 */
export const vaults: Vault[] = [
  {
    name: "Neko USDC Vault",
    symbol: "NUSDC",
    asset: "USDC",
    strategy: "USDC Blend Strategy",
    address: "CCJZMNP4NDOHZ5DFIQRCJJ6EG5RSE3XANYLK5KOPNLEHQOD6OHSG7EL5",
    network: "testnet",
    decimals: 7,
    logo: "/vaults/usdc.svg",
  },
  {
    name: "Neko XLM Vault",
    symbol: "NXLM",
    asset: "XLM",
    strategy: "XLM Blend Strategy",
    address: "CAZ5R5YAABR7ZZAWJNJUMY26U3HIFAMXRZBKS6FEPACHC5EZJLAX33FU",
    network: "testnet",
    decimals: 7,
    logo: "/vaults/xlm.svg",
  },
  {
    name: "Neko CETES Vault",
    symbol: "NCETES",
    asset: "CETES",
    strategy: "CETES Blend Strategy",
    address: "CA75UCZSDPZVFC3RK26LM54SYF3RVQ5PJMVUZYE3SQVNZTB653UETWB4",
    network: "testnet",
    decimals: 7,
    logo: "/vaults/cetes.svg",
  },
];
