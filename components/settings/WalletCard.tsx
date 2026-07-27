"use client";
// Settings wallet card, powered by wagmi (via useAgentWallet). Shows the agent
// wallet (address, QR, live OKB balance), syncs it to your OKX wallet, or resets it.
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { resetWallet } from "@/lib/wallet/wallet";
import { useAgentWallet } from "@/lib/wallet/useAgentWallet";

export function WalletCard({ compact = false }: { compact?: boolean }) {
  const { agentAddress, mapped, balance, busy, error, connectAndSync, ensure, refresh } = useAgentWallet();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    ensure(); // Settings always shows a wallet — create a local one if none exists
  }, [ensure]);

  if (!agentAddress) return null;

  return (
    <section className="keyline-soft rounded bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-lg font-medium">Your wallet</h3>
        {mapped ? (
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-up">
            <span className="h-1.5 w-1.5 rounded-full bg-up" /> synced · {mapped.slice(0, 6)}…{mapped.slice(-4)}
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-widest text-faint">
            local · X Layer testnet
          </span>
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

      {!compact && (
        <div className="mt-4 flex justify-center rounded bg-parchment/95 p-3">
          <QRCodeSVG value={agentAddress} size={140} bgColor="transparent" fgColor="#0a0d13" />
        </div>
      )}

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-faint">balance</p>
          <p className="font-mono text-2xl text-parchment">
            {balance === null ? "…" : Number(balance).toFixed(4)} <span className="text-sm text-muted">OKB</span>
          </p>
        </div>
        <button
          onClick={refresh}
          className="keyline-soft rounded px-3 py-1.5 font-mono text-[11px] text-muted transition-colors hover:text-brass"
        >
          I&apos;ve funded it · refresh
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Fund this address with testnet OKB from the{" "}
        <a
          href="https://web3.okx.com/xlayer/faucet"
          target="_blank"
          rel="noreferrer"
          className="text-brass hover:underline"
        >
          X Layer faucet
        </a>
        , then refresh. The key is derived on this device and never leaves it.
      </p>

      {!compact && (
        <button
          onClick={connectAndSync}
          disabled={busy}
          className="mt-3 mr-4 font-mono text-[10px] text-faint transition-colors hover:text-brass disabled:opacity-50"
        >
          {busy
            ? "waiting for signature…"
            : mapped
              ? "↻ re-sync agent with wallet"
              : "🔗 sync agent with your wallet (same on every device)"}
        </button>
      )}

      {!compact && (
        <button
          onClick={() => {
            if (confirm("Reset wallet? The current key is erased from this device.")) {
              resetWallet();
              window.location.reload();
            }
          }}
          className="mt-3 font-mono text-[10px] text-faint transition-colors hover:text-down"
        >
          reset wallet
        </button>
      )}

      {error && error !== "no-wallet" && <p className="mt-2 font-mono text-[10px] text-down">{error}</p>}
    </section>
  );
}
