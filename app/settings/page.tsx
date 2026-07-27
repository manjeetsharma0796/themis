"use client";
// Settings — wallet + BYOK keys/models, all persisted in-browser.
import Link from "next/link";
import { WalletCard } from "@/components/settings/WalletCard";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { KeyManager } from "@/components/settings/KeyManager";
import { McpManager } from "@/components/settings/McpManager";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-ink">
      <header className="flex items-center justify-between border-b border-hairline px-4 py-3 sm:px-6">
        <Link href="/" className="font-serif text-xl font-semibold tracking-wide">
          Themis<span className="text-brass">.</span>
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">settings</span>
        <Link
          href="/console"
          className="keyline rounded px-2.5 py-1 font-mono text-[10px] font-medium text-brass transition-colors hover:bg-brass hover:text-ink"
        >
          console →
        </Link>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
        <WalletCard />
        <section className="keyline-soft rounded bg-surface p-5">
          <h3 className="font-serif text-lg font-medium">Connect an external wallet</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Prefer your own OKX Wallet? Connect the extension — it&apos;ll switch to X Layer testnet.
          </p>
          <div className="mt-4">
            <ConnectWallet />
          </div>
        </section>
        <KeyManager />
        <McpManager />
        <section className="keyline-soft rounded bg-surface p-5">
          <h3 className="font-serif text-lg font-medium">Telegram (remote)</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Message the copilot away from the browser: create a bot with @BotFather, set{" "}
            <code className="text-brass">TELEGRAM_BOT_TOKEN</code> in <code className="text-brass">.env</code>, and run{" "}
            <code className="text-brass">npm run bot</code>.
          </p>
        </section>
      </main>
    </div>
  );
}
