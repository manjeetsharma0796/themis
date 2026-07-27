# Themis — the trade tribunal ⚖

**Every trade deserves due process.** State your intent in plain words. An advocate
argues it, a skeptic prosecutes it, and a judge rules on live market evidence — then
the verdict is **keccak256-sealed before execution**, so the record can never be
rewritten. Verdicts are sold to other agents per-call (x402 / A2MCP) — built for the
**OKX.AI Genesis Hackathon**.
 
## Surfaces  

| Surface | What it is |
|---|---|
| `/` | Landing — the doctrine + the service |
| `/console` | The court: motion (chat) · evidence (live candles) · docket (live agent record) · ledger (positions, PnL, sealed verdicts + verify) |
| `GET /api/service/signal` | **A2MCP endpoint (real x402 v2)** — unpaid → 402 + `PaymentRequirements` (`eip155:1952`); `X-PAYMENT` (EIP-3009) → verify → settle → sealed verdict + `X-PAYMENT-RESPONSE`; `?tier=free` for ruling-only |
| Telegram bot | Same tribunal in chat: intent → live arguments → ✅ Execute / ❌ Dismiss → receipt (`npm run bot`) |

## How it works

1. **Motion** — `lib/agent/intent.ts` parses "long BTC with $200" into a structured intent.
2. **Evidence** — `lib/market/*` pulls live Bybit ticker + 1h candles; computes RSI-14, EMA-20/50, ATR-14.
3. **Tribunal** — `lib/agent/tribunal.ts`: Advocate and Skeptic argue from the same
   snapshot; the Judge scores trend/momentum/RSI/volatility → APPROVE / REVISE (half
   size) / REJECT with a 0–100 confidence.
4. **Seal** — `lib/agent/commit.ts` canonicalizes the verdict payload and keccak256-hashes
   it **at issuance** — commit-reveal. `GET /api/verify/:id` recomputes; tampered records fail.
5. **Execution** — human confirms (web card or Telegram inline button) → `lib/exec/paper.ts`
   fills at the live price and marks PnL continuously. Honest paper receipts.

**Chain adapter:** execution is paper-mode by default. `ChainAnchor` (in
`lib/agent/commit.ts`) is the interface for anchoring seals on-chain (Mantle Sepolia
`DecisionLog` or XLayer for OKX) — swap in without touching the tribunal.

## Run

```bash
npm install
npm run dev        # web console on :3000
npm run bot        # Telegram client (needs TELEGRAM_BOT_TOKEN in .env)
```

No API keys required for the core demo — Bybit public REST is keyless.

## Env (optional)

See `.env.example`. `TELEGRAM_BOT_TOKEN` enables the bot.

## x402 settlement (X Layer)

`GET /api/service/signal` speaks **real x402 v2** (`exact` scheme, network `eip155:1952`):
unpaid returns `402` with `accepts: [PaymentRequirements]`; an `X-PAYMENT` header
(base64 EIP-3009 authorization) is decoded → **verified** → **settled**, and the
resource returns with an `X-PAYMENT-RESPONSE` header.

Settlement runs through a **facilitator**. Set `X402_FACILITATOR_URL`, `X402_PAY_TO`,
and `X402_ASSET` (see `.env.example`) and it settles **on X Layer for real**; with none
set it runs in **demo mode** — structurally validated, receipt labelled
`settlement:"demo"` (never faked as on-chain). Code: `lib/x402/*`, `lib/chain/xlayer.ts`.

## OKX.AI ASP submission (manual steps)

1. `npx skills add okx/onchainos-skills --yes -g` · log in to Agentic Wallet (email)
2. Register + list as **A2MCP** ASP pointing at `/api/service/signal` (review ≤24h)
3. Copy the assigned `payTo` + facilitator into `.env` → the endpoint goes **live** (real settle)
4. X post with `#OKXAI` + ≤90s demo · Google form before **Jul 27, 23:59 UTC**
