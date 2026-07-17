"use client";
// The Themis console — motion, docket + evidence, ledger. One court, one screen.
import Link from "next/link";
import { ChatPanel } from "@/components/console/ChatPanel";
import { Docket } from "@/components/console/Docket";
import { CandleChart } from "@/components/console/CandleChart";
import { Ledger } from "@/components/console/Ledger";
import { useAgentRun } from "@/components/console/useAgentRun";

export default function ConsolePage() {
  const { messages, docket, running, symbol, portfolioVersion, send, decide } =
    useAgentRun();

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-hairline-soft px-4 py-3 sm:px-6">
        <Link href="/" className="font-serif text-xl tracking-wide">
          Themis<span className="text-brass">.</span>
        </Link>
        <p className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-faint sm:block">
          court in continuous session · paper fills · live bybit evidence
        </p>
        <a
          href="/api/service/signal?tier=free"
          target="_blank"
          className="keyline rounded px-2.5 py-1 font-mono text-[10px] text-brass transition-colors hover:bg-brass hover:text-ink"
        >
          A2MCP endpoint ↗
        </a>
      </header>

      <main className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-12">
        <div className="min-h-[420px] lg:col-span-4 lg:min-h-0">
          <ChatPanel
            messages={messages}
            running={running}
            onSend={send}
            onDecide={decide}
          />
        </div>
        <div className="grid min-h-0 grid-rows-2 gap-3 lg:col-span-5">
          <CandleChart symbol={symbol} />
          <Docket entries={docket} running={running} />
        </div>
        <div className="min-h-[420px] lg:col-span-3 lg:min-h-0">
          <Ledger version={portfolioVersion} />
        </div>
      </main>
    </div>
  );
}
