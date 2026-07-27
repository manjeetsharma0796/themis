"use client";
// Header wallet menu, powered by wagmi (via useAgentWallet). Shows the personal
// agent wallet + live OKB balance; the popover copies, funds, syncs with OKX, or
// disconnects. wagmi handles account/chain changes, EIP-6963, and error codes.
import { useEffect, useRef, useState } from "react";
import { useAgentWallet } from "@/lib/wallet/useAgentWallet";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function ConnectWallet() {
  const {
    agentAddress,
    mapped,
    balance,
    busy,
    error,
    accountMismatch,
    connectAndSync,
    disconnect,
    refresh,
  } = useAgentWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // No agent wallet yet → plain connect button
  if (!agentAddress) {
    return (
      <span className="flex items-center gap-2">
        <button
          onClick={connectAndSync}
          disabled={busy}
          className="keyline rounded px-3 py-1.5 font-mono text-[11px] text-brass transition-colors hover:bg-brass hover:text-ink disabled:opacity-50"
        >
          {busy ? "connecting…" : "Connect OKX Wallet"}
        </button>
        {error &&
          (error === "no-wallet" ? (
            <a
              href="https://web3.okx.com/download"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] text-down underline"
            >
              install OKX Wallet ↗
            </a>
          ) : (
            <span className="font-mono text-[10px] text-down">{error}</span>
          ))}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="keyline flex items-center gap-2 rounded px-2.5 py-1.5 font-mono text-[11px] transition-colors hover:border-hairline"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            accountMismatch ? "bg-down" : mapped ? "bg-up" : "bg-faint"
          }`}
        />
        <span className="text-parchment">{short(agentAddress)}</span>
        {balance !== null && <span className="text-faint">· {Number(balance).toFixed(3)} OKB</span>}
        <span className="text-faint">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 keyline rounded bg-raised p-3 shadow-xl">
          <p className="font-mono text-[9px] uppercase tracking-widest text-faint">agent wallet · X Layer</p>
          <div className="mt-1 flex items-center justify-between gap-2 rounded bg-ink px-2 py-1.5">
            <code className="truncate font-mono text-[10px] text-parchment">{agentAddress}</code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(agentAddress);
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
            <button onClick={refresh} className="font-mono text-[9px] text-muted transition-colors hover:text-brass">
              ↻ refresh
            </button>
          </div>

          {accountMismatch && (
            <p className="mt-2 font-mono text-[9px] leading-relaxed text-down">
              Connected wallet changed. Re-sync to derive this account&apos;s agent wallet.
            </p>
          )}

          <div className="mt-2 flex items-center justify-between">
            <a
              href="https://web3.okx.com/xlayer/faucet"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] text-brass hover:underline"
            >
              fund via faucet ↗
            </a>
            {mapped && !accountMismatch ? (
              <span className="flex items-center gap-1 font-mono text-[9px] text-up">
                <span className="h-1 w-1 rounded-full bg-up" /> synced · {short(mapped)}
              </span>
            ) : (
              <button
                onClick={connectAndSync}
                disabled={busy}
                className="font-mono text-[10px] text-brass transition-colors hover:underline disabled:opacity-50"
              >
                {busy ? "signing…" : accountMismatch ? "re-sync ↗" : "sync with OKX ↗"}
              </button>
            )}
          </div>

          {error && error !== "no-wallet" && <p className="mt-1 font-mono text-[9px] text-down">{error}</p>}

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
