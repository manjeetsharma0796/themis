// X Layer (OKX's zkEVM L2) chain definitions — the OKX.AI settlement chain.
import { defineChain } from "viem";

export const XLAYER_TESTNET_ID = 195;
export const XLAYER_MAINNET_ID = 196;

export const xlayerTestnet = defineChain({
  id: XLAYER_TESTNET_ID,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.XLAYER_RPC_URL || "https://testrpc.xlayer.tech"],
    },
  },
  blockExplorers: {
    default: { name: "OKLink", url: "https://www.oklink.com/x-layer-testnet" },
  },
  testnet: true,
});

/** CAIP-2 network id used by x402 PaymentRequirements (e.g. "eip155:195"). */
export const XLAYER_CAIP2 = `eip155:${XLAYER_TESTNET_ID}` as const;
