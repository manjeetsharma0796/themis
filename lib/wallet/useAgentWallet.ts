"use client";
// The one wallet hook every surface uses. wagmi handles the hard parts (EIP-6963
// discovery, accountsChanged/chainChanged, reconnection, typed error codes); this
// adds Themis's agent-wallet derivation: sign once → deterministic key mapped to
// the user's wallet, the same on every device. Falls back to a device-local wallet.
import { useCallback, useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage, useSwitchChain } from "wagmi";
import { keccak256, type Hex } from "viem";
import {
  getWalletAddress,
  getOrCreateWallet,
  getMappedAddress,
  setAgentKey,
  clearMapping,
} from "@/lib/wallet/wallet";
import { xlayerTestnet } from "@/lib/chain/xlayer";

const DERIVATION_MESSAGE =
  "Themis — derive my agent wallet (v1).\n\n" +
  "Signing this creates a trading-agent wallet that follows you across devices. " +
  "It is a signature, NOT a transaction — no gas, no funds move. " +
  "Only sign this on themis / trythemis.vercel.app.";

function friendlyError(e: unknown): string {
  const err = e as { name?: string; code?: number; shortMessage?: string; message?: string };
  if (err?.name === "ConnectorNotFoundError") return "no-wallet";
  if (err?.code === 4001 || /rejected|denied/i.test(err?.message ?? "")) return "You declined the request.";
  if (err?.code === -32002 || /pending|already processing/i.test(err?.message ?? ""))
    return "Check your wallet — a request is already open.";
  return err?.shortMessage || err?.message || "Connection failed.";
}

export function useAgentWallet() {
  const { address: userAddress, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();

  const [agentAddress, setAgentAddress] = useState<string | null>(null);
  const [mapped, setMapped] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async (addr: string) => {
    try {
      const r = await fetch(`/api/wallet/balance?address=${addr}`);
      const j = await r.json();
      setBalance(typeof j.balance === "string" ? j.balance : "0");
    } catch {
      setBalance("0");
    }
  }, []);

  // Reflect an existing agent wallet (do not auto-create — callers choose).
  useEffect(() => {
    const a = getWalletAddress();
    if (a) {
      setAgentAddress(a);
      setMapped(getMappedAddress());
      void refreshBalance(a);
    }
  }, [refreshBalance]);

  const pickConnector = useCallback(() => {
    return (
      connectors.find((c) => c.name?.toLowerCase().includes("okx")) ??
      connectors.find((c) => c.type === "injected") ??
      connectors[0]
    );
  }, [connectors]);

  const connectAndSync = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      let user = userAddress as string | undefined;
      if (!isConnected || !user) {
        const connector = pickConnector();
        if (!connector) {
          setError("no-wallet");
          return;
        }
        const res = await connectAsync({ connector });
        user = res.accounts[0];
      }
      try {
        await switchChainAsync({ chainId: xlayerTestnet.id });
      } catch {
        /* user may decline the switch — derivation is chain-agnostic */
      }
      const signature = await signMessageAsync({ message: DERIVATION_MESSAGE });
      const pk = keccak256(signature as Hex); // deterministic per (wallet, message)
      const addr = setAgentKey(pk, user!);
      setAgentAddress(addr);
      setMapped(user!);
      void refreshBalance(addr);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }, [userAddress, isConnected, pickConnector, connectAsync, switchChainAsync, signMessageAsync, refreshBalance]);

  const useLocal = useCallback(() => {
    const w = getOrCreateWallet();
    setAgentAddress(w.address);
    setMapped(null);
    void refreshBalance(w.address);
  }, [refreshBalance]);

  // Guarantee a wallet exists without disturbing an existing (possibly synced) one.
  const ensure = useCallback(() => {
    if (getWalletAddress()) return;
    const w = getOrCreateWallet();
    setAgentAddress(w.address);
    void refreshBalance(w.address);
  }, [refreshBalance]);

  const disconnect = useCallback(async () => {
    try {
      await disconnectAsync();
    } catch {
      /* ignore */
    }
    clearMapping();
    setMapped(null);
  }, [disconnectAsync]);

  // wagmi keeps userAddress live via accountsChanged — detect a switched account.
  const accountMismatch = Boolean(
    mapped && userAddress && userAddress.toLowerCase() !== mapped.toLowerCase()
  );

  return {
    agentAddress,
    mapped,
    balance,
    busy,
    error,
    userAddress: userAddress ?? null,
    isConnected,
    accountMismatch,
    connectAndSync,
    useLocal,
    ensure,
    disconnect,
    refresh: () => {
      if (agentAddress) void refreshBalance(agentAddress);
    },
  };
}
