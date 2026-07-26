import Link from "next/link";

const CURL_402 = `$ curl https://themis.app/api/service/signal
HTTP/1.1 402 Payment Required
{ "x402Version": 2, "accepts": [{ "scheme": "exact",
  "network": "eip155:195", "amount": "100000",
  "asset": "0x…USDT", "payTo": "0x…asp",
  "resource": "/api/service/signal" }] }`;

const CURL_PAID = `$ curl -H "X-PAYMENT: <eip3009-auth>" https://themis.app/api/service/signal
{ "tier": "paid", "settlement": "onchain",
  "signal": { "verdict": { "ruling": "APPROVE", "confidence": 71 },
  "commitHash": "0x4be1…" }, "verify": "/api/verify/sig_mda31k2" }`;

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* drifting scales watermark */}
      <div
        aria-hidden
        className="drift pointer-events-none absolute -right-24 top-24 select-none font-serif text-[26rem] leading-none text-brass opacity-[0.045]"
      >
        ⚖
      </div>
      {/* brass meridian */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-gradient-to-b from-transparent via-hairline to-transparent"
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-12">
        <div className="font-serif text-2xl tracking-wide">
          Themis<span className="text-brass">.</span>
        </div>
        <nav className="flex items-center gap-6 font-mono text-xs text-muted">
          <a href="#doctrine" className="transition-colors hover:text-parchment">
            doctrine
          </a>
          <a href="#service" className="transition-colors hover:text-parchment">
            the service
          </a>
          <Link
            href="/console"
            className="keyline rounded px-3 py-1.5 text-brass transition-colors hover:bg-brass hover:text-ink"
          >
            open console →
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 sm:px-12">
        {/* hero */}
        <section className="pb-24 pt-20 sm:pt-28">
          <p className="rise font-mono text-xs uppercase tracking-[0.3em] text-brass">
            the trade tribunal
          </p>
          <h1
            className="rise mt-6 font-serif text-5xl leading-[1.05] sm:text-7xl"
            style={{ animationDelay: "0.08s" }}
          >
            Every trade deserves
            <br />
            <span className="italic text-brass">due process.</span>
          </h1>
          <p
            className="rise mt-8 max-w-xl text-lg leading-relaxed text-muted"
            style={{ animationDelay: "0.16s" }}
          >
            State your intent in plain words. An advocate argues it, a skeptic
            prosecutes it, and a judge rules on live market evidence — then the
            verdict is <span className="text-parchment">hash-sealed before execution</span>,
            so the record can never be rewritten.
          </p>
          <div
            className="rise mt-10 flex flex-wrap items-center gap-4"
            style={{ animationDelay: "0.24s" }}
          >
            <Link
              href="/onboarding"
              className="rounded bg-brass px-6 py-3 font-mono text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
            >
              Get started →
            </Link>
            <a
              href="#service"
              className="keyline rounded px-6 py-3 font-mono text-sm text-muted transition-colors hover:text-parchment"
            >
              curl the service
            </a>
          </div>
          <p
            className="rise mt-6 font-mono text-xs text-faint"
            style={{ animationDelay: "0.3s" }}
          >
            try: <span className="text-muted">“long BTC with $200”</span> ·{" "}
            <span className="text-muted">“short SOL 150”</span> — live Bybit
            evidence · paper fills
          </p>
        </section>

        {/* doctrine */}
        <section id="doctrine" className="border-t border-hairline-soft py-20">
          <h2 className="font-serif text-3xl">
            The doctrine<span className="text-brass">.</span>
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded border border-hairline-soft bg-hairline-soft sm:grid-cols-3">
            {[
              {
                n: "I",
                t: "The motion",
                d: "Your words become a structured intent — side, symbol, size. No forms, no tickets. The agent reads what you mean.",
              },
              {
                n: "II",
                t: "The tribunal",
                d: "Advocate and skeptic argue from the same live evidence — price, trend, RSI, volatility. The judge weighs it and rules: approve, revise, or reject.",
              },
              {
                n: "III",
                t: "The seal",
                d: "The full verdict is keccak256-committed the instant it is issued — before any fill. Anyone can recompute the hash. Doctored records don't verify.",
              },
            ].map((x) => (
              <div key={x.n} className="bg-surface p-8">
                <div className="font-serif text-4xl text-brass opacity-70">{x.n}</div>
                <h3 className="mt-4 font-serif text-xl">{x.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{x.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* the service */}
        <section id="service" className="border-t border-hairline-soft py-20">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="font-serif text-3xl">
              Verdicts as a service<span className="text-brass">.</span>
            </h2>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">
              A2MCP · x402 pay-per-call · OKX.AI ASP
            </p>
          </div>
          <p className="mt-4 max-w-2xl text-muted">
            Other agents buy Themis verdicts per call. No key exchange, no
            subscription — an x402 payment header unlocks the full transcript,
            evidence snapshot, and commit proof. Free tier returns the ruling
            alone.
          </p>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="keyline-soft rounded bg-surface p-5">
              <p className="mb-3 font-mono text-xs text-down">① unpaid → 402 + terms</p>
              <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-muted">
                {CURL_402}
              </pre>
            </div>
            <div className="keyline-soft rounded bg-surface p-5">
              <p className="mb-3 font-mono text-xs text-up">② paid → sealed verdict</p>
              <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-muted">
                {CURL_PAID}
              </pre>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-hairline-soft px-6 py-8 sm:px-12">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 font-mono text-xs text-faint">
          <span>Themis — the market is the witness; the agent is the court.</span>
          <span>
            paper fills · live Bybit evidence · commit-reveal integrity ·{" "}
            <Link href="/console" className="text-brass hover:underline">
              console
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
