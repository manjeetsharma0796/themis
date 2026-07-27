"use client";
// Connect-wallet adapter — connects the OKX Wallet extension and switches it to
// X Layer testnet. Shows a compact connected state; links to install if missing.
import { useState } from "react";
import { connectOkx } from "@/lib/wallet/injected";

export function ConnectWallet() {
  const [addr, setAddr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    setErr(null);
    const r = await connectOkx();
    setBusy(false);
    if ("error" in r) {
      setErr(r.error);
      return;
    }
    setAddr(r.address);
  };

  if (addr) {
    return (
      <span className="flex items-center gap-2 font-mono text-[11px]">
        <span className="h-1.5 w-1.5 rounded-full bg-up" />
        <span className="text-parchment">
          {addr.slice(0, 6)}…{addr.slice(-4)}
        </span>
        <span className="text-faint">· X Layer</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={connect}
        disabled={busy}
        className="keyline rounded px-3 py-1.5 font-mono text-[11px] text-brass transition-colors hover:bg-brass hover:text-ink disabled:opacity-50"
      >
        {busy ? "connecting…" : "Connect OKX Wallet"}
      </button>
      {err &&
        (err === "no-wallet" ? (
          <a
            href="https://web3.okx.com/download"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] text-down underline"
          >
            install OKX Wallet ↗
          </a>
        ) : (
          <span className="font-mono text-[10px] text-down">{err}</span>
        ))}
    </span>
  );
}
