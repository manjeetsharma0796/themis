"use client";
// The Themis console — motion, evidence + docket, ledger. One court, one screen.
// Panels are draggable: resize any split, layout persists via autoSaveId.
import Link from "next/link";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ChatPanel } from "@/components/console/ChatPanel";
import { Docket } from "@/components/console/Docket";
import { CandleChart } from "@/components/console/CandleChart";
import { Ledger } from "@/components/console/Ledger";
import { useAgentRun } from "@/components/console/useAgentRun";

export default function ConsolePage() {
  const { messages, docket, running, symbol, portfolioVersion, send, decide } =
    useAgentRun();

  return (
    <div className="flex h-screen flex-col bg-ink">
      <header className="flex items-center justify-between border-b border-hairline px-4 py-3 sm:px-6">
        <Link href="/" className="font-serif text-xl font-semibold tracking-wide">
          Themis<span className="text-brass">.</span>
        </Link>
        <p className="hidden font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-muted md:block">
          court in continuous session · paper fills · live bybit evidence
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
        autoSaveId="themis-console-h"
        className="min-h-0 flex-1 p-2"
      >
        <Panel defaultSize={30} minSize={22} className="overflow-hidden">
          <ChatPanel
            messages={messages}
            running={running}
            onSend={send}
            onDecide={decide}
          />
        </Panel>

        <PanelResizeHandle />

        <Panel defaultSize={44} minSize={28} className="overflow-hidden">
          <PanelGroup direction="vertical" autoSaveId="themis-console-v">
            <Panel defaultSize={54} minSize={22} className="overflow-hidden">
              <CandleChart symbol={symbol} />
            </Panel>
            <PanelResizeHandle />
            <Panel defaultSize={46} minSize={18} className="overflow-hidden">
              <Docket entries={docket} running={running} />
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle />

        <Panel defaultSize={26} minSize={19} className="overflow-hidden">
          <Ledger version={portfolioVersion} />
        </Panel>
      </PanelGroup>
    </div>
  );
}
