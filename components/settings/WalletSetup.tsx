"use client";
// Onboarding wallet step, powered by wagmi (via useAgentWallet). Preferred path:
// connect your wallet → sign once → the agent wallet is derived + mapped to you,
// the same on every device. Fallback: a device-local random agent wallet.
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAgentWallet } from "@/lib/wallet/useAgentWallet";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function WalletSetup({ onReady }: { onReady?: (address: string) => void }) {
  const { agentAddress, mapped, balance, busy, error, connectAndSync, useLocal } = useAgentWallet();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (agentAddress) onReady?.(agentAddress);
  }, [agentAddress, onReady]);

  // ── no wallet yet → offer the two paths ──────────────────────
  if (!agentAddress) {
    return (
      <section className="keyline-soft rounded bg-surface p-5">
        <h3 className="font-serif text-lg font-medium">Set up your agent wallet</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Connect your wallet so your agent wallet is the <span className="text-parchment">same on every device</span>.
          One signature — not a transaction, no gas.
        </p>

        <button
          onClick={connectAndSync}
          disabled={busy}
          className="mt-4 w-full rounded bg-brass px-4 py-2.5 font-mono text-sm font-semibold text-ink transition-transform hover:-translate-y-px disabled:opacity-50"
        >
          {busy ? "waiting for signature…" : "Connect wallet & sync agent"}
        </button>

        {error &&
          (error === "no-wallet" ? (
            <a
              href="https://web3.okx.com/download"
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-center font-mono text-[10px] text-down underline"
            >
              install OKX Wallet ↗
            </a>
          ) : (
            <p className="mt-2 text-center font-mono text-[10px] text-down">{error}</p>
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
        <code className="truncate font-mono text-xs text-parchment">{agentAddress}</code>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(agentAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="shrink-0 font-mono text-[10px] text-brass transition-colors hover:text-parchment"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>

      <div className="mt-4 flex justify-center rounded bg-parchment/95 p-3">
        <QRCodeSVG value={agentAddress} size={128} bgColor="transparent" fgColor="#0a0d13" />
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
          onClick={connectAndSync}
          disabled={busy}
          className="mt-3 font-mono text-[10px] text-faint transition-colors hover:text-brass disabled:opacity-50"
        >
          {busy ? "waiting for signature…" : "↻ connect wallet to sync across devices"}
        </button>
      )}
      {error && error !== "no-wallet" && <p className="mt-2 font-mono text-[10px] text-down">{error}</p>}
    </section>
  );
}
