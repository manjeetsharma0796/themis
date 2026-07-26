"use client";
// Frictionless wallet — auto-created on first view, funded by QR, balance on X Layer.
import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getOrCreateWallet, resetWallet } from "@/lib/wallet/wallet";

export function WalletCard({ compact = false }: { compact?: boolean }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (addr: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/wallet/balance?address=${addr}`);
      const j = await r.json();
      setBalance(typeof j.balance === "string" ? j.balance : "0");
    } catch {
      setBalance("0");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const w = getOrCreateWallet();
    setAddress(w.address);
    void refresh(w.address);
  }, [refresh]);

  if (!address) return null;
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <section className="keyline-soft rounded bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-lg font-medium">Your wallet</h3>
        <span className="font-mono text-[10px] uppercase tracking-widest text-faint">
          auto-created · X Layer testnet
        </span>
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

      {!compact && (
        <div className="mt-4 flex justify-center rounded bg-parchment/95 p-3">
          <QRCodeSVG value={address} size={140} bgColor="transparent" fgColor="#0a0d13" />
        </div>
      )}

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-faint">balance</p>
          <p className="font-mono text-2xl text-parchment">
            {balance === null ? "…" : Number(balance).toFixed(4)}{" "}
            <span className="text-sm text-muted">OKB</span>
          </p>
        </div>
        <button
          onClick={() => void refresh(address)}
          disabled={loading}
          className="keyline-soft rounded px-3 py-1.5 font-mono text-[11px] text-muted transition-colors hover:text-brass disabled:opacity-50"
        >
          {loading ? "checking…" : "I've funded it · refresh"}
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
        , then refresh. Key is generated on this device and never leaves it.
      </p>

      {!compact && (
        <button
          onClick={() => {
            if (confirm("Reset wallet? The current key is erased from this device.")) {
              resetWallet();
              const w = getOrCreateWallet();
              setAddress(w.address);
              void refresh(w.address);
            }
          }}
          className="mt-3 font-mono text-[10px] text-faint transition-colors hover:text-down"
        >
          reset wallet
        </button>
      )}
    </section>
  );
}
