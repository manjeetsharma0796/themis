"use client";
// Header wallet menu. Shows the user's personal agent wallet (address + live OKB
// balance) and, on click, a popover to copy, fund, sync with OKX, or disconnect.
// Connecting derives the agent wallet from the OKX wallet (mapped, cross-device).
import { useCallback, useEffect, useRef, useState } from "react";
import { getWalletAddress, getMappedAddress, clearMapping } from "@/lib/wallet/wallet";
import { connectAndDeriveAgent } from "@/lib/wallet/injected";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function ConnectWallet() {
  const [addr, setAddr] = useState<string | null>(null);
  const [mapped, setMapped] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadBalance = useCallback(async (a: string) => {
    try {
      const r = await fetch(`/api/wallet/balance?address=${a}`);
      const j = await r.json();
      setBalance(typeof j.balance === "string" ? j.balance : "0");
    } catch {
      setBalance("0");
    }
  }, []);

  useEffect(() => {
    const a = getWalletAddress();
    if (a) {
      setAddr(a);
      setMapped(getMappedAddress());
      void loadBalance(a);
    }
  }, [loadBalance]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const connect = async () => {
    setBusy(true);
    setErr(null);
    const r = await connectAndDeriveAgent();
    setBusy(false);
    if ("error" in r) {
      setErr(r.error);
      return;
    }
    setAddr(r.agentAddress);
    setMapped(r.userAddress);
    void loadBalance(r.agentAddress);
    setOpen(true);
  };

  const disconnect = () => {
    clearMapping();
    setMapped(null);
    setOpen(false);
  };

  // No agent wallet yet → plain connect button
  if (!addr) {
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

  // Agent wallet exists → chip + popover menu
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="keyline flex items-center gap-2 rounded px-2.5 py-1.5 font-mono text-[11px] transition-colors hover:border-hairline"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${mapped ? "bg-up" : "bg-faint"}`} />
        <span className="text-parchment">{short(addr)}</span>
        {balance !== null && <span className="text-faint">· {Number(balance).toFixed(3)} OKB</span>}
        <span className="text-faint">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 keyline rounded bg-raised p-3 shadow-xl">
          <p className="font-mono text-[9px] uppercase tracking-widest text-faint">agent wallet · X Layer</p>
          <div className="mt-1 flex items-center justify-between gap-2 rounded bg-ink px-2 py-1.5">
            <code className="truncate font-mono text-[10px] text-parchment">{addr}</code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(addr);
                setCopied(true);
                setTimeout(() => setCopied(false), 1000);
              }}
              className="shrink-0 font-mono text-[9px] text-brass hover:text-parchment"
            >
              {copied ? "copied" : "copy"}
            </button>
          </div>

          <div className="mt-2 flex items-end justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-faint">balance</p>
              <p className="font-mono text-lg text-parchment">
                {balance === null ? "…" : Number(balance).toFixed(4)} <span className="text-xs text-muted">OKB</span>
              </p>
            </div>
            <button
              onClick={() => void loadBalance(addr)}
              className="font-mono text-[9px] text-muted transition-colors hover:text-brass"
            >
              ↻ refresh
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <a
              href="https://web3.okx.com/xlayer/faucet"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] text-brass hover:underline"
            >
              fund via faucet ↗
            </a>
            {mapped ? (
              <span className="flex items-center gap-1 font-mono text-[9px] text-up">
                <span className="h-1 w-1 rounded-full bg-up" /> synced · {short(mapped)}
              </span>
            ) : (
              <button
                onClick={connect}
                disabled={busy}
                className="font-mono text-[10px] text-brass transition-colors hover:underline disabled:opacity-50"
              >
                {busy ? "signing…" : "sync with OKX ↗"}
              </button>
            )}
          </div>

          {err && err !== "no-wallet" && <p className="mt-1 font-mono text-[9px] text-down">{err}</p>}

          <div className="mt-2 border-t border-hairline-soft pt-2">
            <button
              onClick={disconnect}
              disabled={!mapped}
              className="font-mono text-[10px] text-down transition-colors hover:underline disabled:text-faint disabled:no-underline"
              title={mapped ? "Forget the OKX link — keeps your agent wallet" : "Not connected to an OKX wallet"}
            >
              {mapped ? "disconnect" : "not connected"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
