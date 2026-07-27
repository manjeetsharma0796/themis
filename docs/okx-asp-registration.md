# Registering Themis as an OKX.AI ASP (Agent Service Provider)

Themis sells **verified trade verdicts** as a paid **A2MCP** service on the OKX.AI
marketplace. This is the step-by-step to list it, plus the exact metadata to paste.

> Note: the OKX.AI Genesis Hackathon deadline (Jul 27) has passed, but the ASP
> **listing itself** is still valid — this gets Themis live on the okx.ai marketplace.

---

## Prerequisites
- An OKX account + the email you'll register the **Agentic Wallet** under.
- An agent runtime that supports **Onchain OS** — **Claude Code** works (also Cursor/Codex/OpenClaw).
- Themis deployed to a **public URL** (the A2MCP endpoint must be reachable for review).
  → Deploy to Vercel first: `vercel deploy` (or option B in chat). Your endpoint becomes
  `https://trythemis.vercel.app/api/service/signal`.

## Steps (run the prompts inside your agent)
1. **Install Onchain OS skills**
   ```bash
   npx skills add okx/onchainos-skills --yes -g
   ```
2. **Log in to the Agentic Wallet** — send to your agent:
   > `Log in to Agentic Wallet on Onchain OS with my email`
   (Review results are emailed to this address.)
3. **Register as an A2MCP ASP** — send:
   > `Help me register an A2MCP ASP on OKX.AI using OKX Agent Identity from Onchain OS`
   Then provide the metadata below. The paid endpoint must be **x402-compliant**
   (OKX Payment SDK) or free.
4. **List it** — send:
   > `Help me list my ASP on OKX.AI using Onchain OS`
   Review completes within **24h** (result to your Agentic Wallet email + agent window).
   If not yet approved, it's still callable via its **Agent ID**.
5. **Go live** — once approved, A2MCP is fully automatic: when another agent calls your
   service, paid calls are billed + settled in real time (free calls just return).

## Themis — ASP listing metadata (paste these)
| Field | Value |
|---|---|
| **Name** | Themis — Verified Trade Tribunal |
| **Type** | A2MCP (standardized, pay-per-call) |
| **Short description** | Submit a trade intent; get an adversarial tribunal ruling (Advocate vs Skeptic, Judge) on live OKX market evidence — hash-sealed (commit-reveal) and anchored on X Layer. Provable, tamper-evident trading intelligence. |
| **Endpoint** | `https://trythemis.vercel.app/api/service/signal` |
| **Free tier** | `GET …/api/service/signal?tier=free` → ruling + confidence + commit hash |
| **Paid call** | `GET …/api/service/signal` with `X-PAYMENT` (x402) → full transcript + evidence + sealed verdict + verify link |
| **Price** | 0.10 USDT / call (x402 `exact` scheme) |
| **Network** | X Layer — `eip155:1952` (testnet) / `eip155:196` (mainnet) |
| **Category fit** | Finance Copilot · Creative Genius (research→execute→validate = the tribunal) |
| **Differentiator** | Every verdict ships with an on-chain, recomputable keccak256 seal — provable performance, rare in the marketplace. |

## After listing — flip Themis to live settlement
The listing assigns your **payTo** + the facilitator/asset. Put them in `.env`:
```bash
X402_FACILITATOR_URL=<from OKX>
X402_PAY_TO=<your ASP Agentic Wallet address>
X402_ASSET=<accepted stablecoin contract on X Layer>
X402_NETWORK=eip155:1952
```
With these set, `/api/service/signal` performs **real x402 verify + settle**; without them
it stays in labelled demo mode. (Code: `lib/x402/*`.)

## Optional: hackathon-style submission (if a future round opens)
- X post with `#OKXAI` + a ≤90s demo of the ASP.
- Google form with the ASP details + X post link.
