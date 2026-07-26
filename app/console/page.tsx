"use client";
// The Themis console — copilot chat, live evidence chart, ledger. One court, one screen.
// Panels are draggable: resize any split, layout persists via autoSaveId.
import Link from "next/link";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ChatPanel } from "@/components/console/ChatPanel";
import { CandleChart } from "@/components/console/CandleChart";
import { Ledger } from "@/components/console/Ledger";
import { useCopilot } from "@/components/console/useCopilot";

export default function ConsolePage() {
  const { items, chips, running, provider, symbol, portfolioVersion, send, decide } =
    useCopilot();

  return (
    <div className="flex h-screen flex-col bg-ink">
      <header className="flex items-center justify-between border-b border-hairline px-4 py-3 sm:px-6">
        <Link href="/" className="font-serif text-xl font-semibold tracking-wide">
          Themis<span className="text-brass">.</span>
        </Link>
        <p className="hidden font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-muted md:block">
          trading copilot · paper fills · live okx evidence
        </p>
        <a
          href="/api/service/signal?tier=free"
          target="_blank"
          className="keyline rounded px-2.5 py-1 font-mono text-[10px] font-medium text-brass transition-colors hover:bg-brass hover:text-ink"
        >
          A2MCP endpoint ↗
        </a>
      </header>

      <PanelGroup
        direction="horizontal"
        autoSaveId="themis-console-v2"
        className="min-h-0 flex-1 p-2"
      >
        <Panel defaultSize={36} minSize={26} className="overflow-hidden">
          <ChatPanel
            items={items}
            chips={chips}
            running={running}
            provider={provider}
            onSend={send}
            onDecide={decide}
          />
        </Panel>

        <PanelResizeHandle />

        <Panel defaultSize={40} minSize={26} className="overflow-hidden">
          <CandleChart symbol={symbol} />
        </Panel>

        <PanelResizeHandle />

        <Panel defaultSize={24} minSize={19} className="overflow-hidden">
          <Ledger version={portfolioVersion} />
        </Panel>
      </PanelGroup>
    </div>
  );
}
