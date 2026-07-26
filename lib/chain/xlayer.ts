// X Layer (OKX's zkEVM L2) chain definitions — the OKX.AI settlement chain.
import { defineChain } from "viem";

// X Layer testnet is chain 1952 (both testrpc.xlayer.tech and xlayertestrpc.okx.com
// report 0x7a0). The "195" in older docs is a deprecated/earlier testnet id.
export const XLAYER_TESTNET_ID = 1952;
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

/** CAIP-2 network id used by x402 PaymentRequirements (e.g. "eip155:1952"). */
export const XLAYER_CAIP2 = `eip155:${XLAYER_TESTNET_ID}` as const;
