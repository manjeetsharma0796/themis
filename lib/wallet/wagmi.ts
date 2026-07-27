// wagmi config — the battle-tested wallet-adapter layer (EIP-6963 multi-wallet
// discovery, accountsChanged/chainChanged handling, reconnection, error codes).
// Themis's agent-wallet derivation sits on top of this (see useAgentWallet).
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { xlayerTestnet } from "@/lib/chain/xlayer";

export const wagmiConfig = createConfig({
  chains: [xlayerTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: { [xlayerTestnet.id]: http() },
  ssr: true, // hydration-safe under the Next.js App Router
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
