"use client";
// Onboarding wallet step. Preferred path: connect your wallet → sign once → the
// agent wallet is derived from that signature and mapped to you, so it's the same
// on every device. Fallback: a device-local random agent wallet. No auto-create
// on mount — the user chooses.
import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getOrCreateWallet, getWalletAddress, getMappedAddress } from "@/lib/wallet/wallet";
import { connectAndDeriveAgent } from "@/lib/wallet/injected";

export function WalletSetup({ onReady }: { onReady?: (address: string) => void }) {
  const [address, setAddress] = useState<string | null>(null);
  const [mapped, setMapped] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async (addr: string) => {
    try {
      const r = await fetch(`/api/wallet/balance?address=${addr}`);
      const j = await r.json();
      setBalance(typeof j.balance === "string" ? j.balance : "0");
    } catch {
      setBalance("0");
    }
  }, []);

  // Reflect an existing wallet, but do NOT auto-create — let the user choose.
  useEffect(() => {
    const a = getWalletAddress();
    if (a) {
      setAddress(a);
      setMapped(getMappedAddress());
      void refresh(a);
      onReady?.(a);
    }
  }, [refresh, onReady]);

  const sync = async () => {
    setBusy(true);
    setErr(null);
    const r = await connectAndDeriveAgent();
    setBusy(false);
    if ("error" in r) {
      setErr(r.error);
      return;
    }
    setAddress(r.agentAddress);
    setMapped(r.userAddress);
    void refresh(r.agentAddress);
    onReady?.(r.agentAddress);
  };

  const useLocal = () => {
    const w = getOrCreateWallet();
    setAddress(w.address);
    setMapped(null);
    void refresh(w.address);
    onReady?.(w.address);
  };

  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

  // ── no wallet yet → offer the two paths ──────────────────────
  if (!address) {
    return (
      <section className="keyline-soft rounded bg-surface p-5">
        <h3 className="font-serif text-lg font-medium">Set up your agent wallet</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Connect your wallet so your agent wallet is the <span className="text-parchment">same on every device</span>.
          One signature — not a transaction, no gas.
        </p>

        <button
          onClick={sync}
          disabled={busy}
          className="mt-4 w-full rounded bg-brass px-4 py-2.5 font-mono text-sm font-semibold text-ink transition-transform hover:-translate-y-px disabled:opacity-50"
        >
          {busy ? "waiting for signature…" : "Connect wallet & sync agent"}
        </button>

        {err &&
          (err === "no-wallet" ? (
            <a
              href="https://web3.okx.com/download"
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-center font-mono text-[10px] text-down underline"
            >
              install OKX Wallet ↗
            </a>
          ) : (
            <p className="mt-2 text-center font-mono text-[10px] text-down">{err}</p>
          ))}

        <button
          onClick={useLocal}
          className="mt-3 block w-full text-center font-mono text-xs text-faint transition-colors hover:text-muted"
        >
          or use a device-local wallet (this browser only)
        </button>
      </section>
    );
  }

  // ── wallet exists → show it + sync status ────────────────────
  return (
    <section className="keyline-soft rounded bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-lg font-medium">Your agent wallet</h3>
        {mapped ? (
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-up">
            <span className="h-1.5 w-1.5 rounded-full bg-up" /> synced · {short(mapped)}
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-widest text-faint">local · this device</span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded bg-ink px-3 py-2">
        <code className="truncate font-mono text-xs text-parchment">{address}</code>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="shrink-0 font-mono text-[10px] text-brass transition-colors hover:text-parchment"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>

      <div className="mt-4 flex justify-center rounded bg-parchment/95 p-3">
        <QRCodeSVG value={address} size={128} bgColor="transparent" fgColor="#0a0d13" />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-faint">balance</p>
          <p className="font-mono text-2xl text-parchment">
            {balance === null ? "…" : Number(balance).toFixed(4)} <span className="text-sm text-muted">OKB</span>
          </p>
        </div>
        <a
          href="https://web3.okx.com/xlayer/faucet"
          target="_blank"
          rel="noreferrer"
          className="keyline-soft rounded px-3 py-1.5 font-mono text-[11px] text-brass transition-colors hover:bg-brass hover:text-ink"
        >
          fund via faucet ↗
        </a>
      </div>

      {!mapped && (
        <button
          onClick={sync}
          disabled={busy}
          className="mt-3 font-mono text-[10px] text-faint transition-colors hover:text-brass disabled:opacity-50"
        >
          {busy ? "waiting for signature…" : "↻ connect wallet to sync across devices"}
        </button>
      )}
    </section>
  );
}
