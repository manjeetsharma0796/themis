# Ghast AI — Feature Inventory (reconstructed from screenshots)

> Source: the user's previous product **"Ghast AI"** — a Web3-native AI assistant/agent
> desktop app. Repo + codebase were lost; this inventory is reverse-engineered from a
> product demo video's screenshots so the features can be rebuilt / folded into Themis v2.
> Items marked *(inferred)* are deductions, not text visible on screen.

## Product identity
- **Name:** Ghast AI — "Your Web3-native AI assistant."
- **Tagline in chat:** "Ask about contracts, DeFi strategies, or this page."
- **Form factor:** desktop-style app with top tabs — **Chat · Memory · Skills · Settings**.
- **Personality:** casual, human ("You have 0.202 0G in your wallet. Not much, but it's something.").
- **Chain/stack:** **0G (ZeroGravity / 0G Labs)** — native token `0G`, with **0G Storage**
  (on-chain memory) and an on-chain **model marketplace** *(inferred: 0G Compute / serving network)*.
- **Telegram bot handle seen:** `@trapezoheaibot`. Local user path seen: `/Users/songsu/`.

---

## 1. Frictionless onboarding — 5-step wizard
Steps: **Wallet → Workspace → Remote → Model → Companion** (progress dots, step N of 5).
- **Step 1 · Wallet (REQUIRED):** "the only step you truly need." Everything else optional/skippable.
- Steps 2–4 each have **"Skip for now"** and a "you can configure later in Settings" note.
- Each step explains *why it matters* + *what it unlocks* in plain language.

## 2. Wallet — auto-created, self-custody, funded by QR
- Wallet is **generated for the user** (no seed-phrase friction): "Your wallet 0xf928…AD8c is ready."
- Shows full **wallet address** + **Copy Address** button.
- **QR code** to recharge with `0G`; "Scan or copy this address to recharge, then refresh."
- **Wallet Balance** display (e.g., `5.1613 0G`) + **"I've funded it – refresh"** button.
- Balances adjustable later from Settings.

## 3. Decentralized model marketplace (pay-per-use, on-chain)
- **Step 4 · Choose a starting model (optional).** "Set the model… and fund it from the wallet."
- Models are served by **on-chain providers** (each model shows a **provider address**, e.g. `0xd996…471C`).
- **Model list (selectable):**
  - `zai-org/GLM-5-FP8` (selected/active)
  - `openai/gpt-oss-120b`
  - `qwen/qwen3-vl-30b-a3b-instruct`
  - `deepseek/deepseek-chat-v3-0324`
- **"1 active model"** kept during onboarding for simplicity; **swap models later in Settings**.
- **Funding/ledger:** "Wallet Balance 5.1613 0G · Minimum Funding 1 0G." Fund Amount input.
  "Recommended minimum for this model: 1 0G. Ledger still requires 3 0G on first funding and 1 0G on later top-ups."
- *(Inference: this is a 0G-style decentralized inference/compute network — you pay providers per use from your wallet ledger.)*

## 4. Chat interface — streaming, descriptive, tool-aware
- **Suggested prompt chips** on empty state: "Analyze this page", "Check my 0G balance", "DeFi yield strategies".
- **Streaming answers** with a live caret while generating.
- **Descriptive narration of intent** before acting: "Let me check the weather skill and get Hong Kong's forecast." / "I'll spin up Claude Code to write an Ethereum block query script for you."
- **Inline tool-call rendering** in the transcript:
  - `Tool get_skill_md ✓`
  - `Shell curl -s "wttr.in/…"` with a `Processing…` spinner
  - `Tool code_agent_status ✓` (repeated while polling)
- **Human-in-the-loop approval gate:** a **"Tool Call — Requires Approval"** card ("run local command") with **Reject / Confirm** buttons before executing shell commands.
- **Rich formatted answers** (e.g., weather with emoji, bold values, units).
- **Timestamps** on every message.
- **Page/context awareness:** "Analyze this page" implies it can read the current view/context.

## 5. Skills system — "Clawhub Skill Store"
- **Built-in skill store:** search, browse, **install with one click**, and **configure environment variables**.
- **Community skills** with author, install count, star rating, version. Examples seen:
  - `nano-banana-pro` — image gen/edit (Gemini 3 Pro Image), 1K/2K/4K, text→image + image→image. @steipete · 66.8k · ★265 · 1.0.1
  - `obsidian` — work with Obsidian vaults via obsidian-cli. @steipete · 64.5k · ★269
  - `baidu-search` — web search via Baidu AI Search. @ide-rea · 61.1k · ★165 · 1.1.3
  - `api-gateway` — connect 100+ APIs (Google Workspace, MS365, GitHub, Notion, Slack, Airtable, HubSpot) with **managed OAuth**. @byungkyu · 54.6k · ★271
  - `mcporter` — list/configure/auth/call MCP servers & tools (HTTP or stdio), ad-hoc servers, config edits, CLI/type generation. @steipete · 45.4k · ★134
  - **"Browse more"** pagination.
- **Installed Skills** management (with **Remove**), tagged `Local` + version. Installed set seen is
  the **superpowers** family: `brainstorming`, `writing-plans`, `requesting-code-review`,
  `receiving-code-review`, `writing-skills` — i.e. Claude-style skills run inside the agent.
- The agent **loads a skill's instructions on demand** (`get_skill_md` tool) before using it.

## 6. Local agent orchestration — MCP + ACP protocols
- **Supports local MCP and ACP** ("Agent Client Protocol"). Users can **directly invoke local
  Claude Code, Codex, and Gemini** to complete tasks (code writing + execution).
- **`run_code_agent`** tool → launches e.g. `claude-code` **in the background**.
  Seen: "claude-code is running in background ✓", model `claude-sonnet-4-5-20250929`, a `session_id`.
- **Lifecycle tools:** `code_agent_status` (poll progress), `code_agent_stop` (cancel).
- **Live embedded terminal panel** ("Claude Code · running", elapsed timer, **Stop** button) streaming
  the sub-agent's raw output: TodoWrite, Write file, Bash, tool_result/tool_error lines.
- **Persistent session** for follow-ups: "Waiting for follow-up requests in same session…".
- **Autonomous iteration:** the agent narrates as the sub-agent self-heals — "hit an import error —
  actively fixing it" → "RPC endpoint flaky, finding a working one" → "works with longer timeouts" →
  "Successfully queried block 18000000." Then runs the program and reports results.

## 7. Shell / command execution
- Can run arbitrary local shell commands (e.g. `curl wttr.in`, `chmod +x … && python3 …`) —
  **gated behind the Requires-Approval card**.

## 8. Workspace (optional local file access)
- **Step 2 · Connect a workspace:** pick **one project folder** the assistant can **read and edit**.
- Scoped: "Only that folder is shared, not the rest of your computer." Changeable/disconnectable in Settings.

## 9. Telegram remote control (optional)
- **Step 3 · Connect Telegram:** paste a **@BotFather bot token** → "we turn on remote mode automatically."
- **Live linking flow with status chips:** `Bot saved` · `Remote on` · `Waiting for /start`.
- "Open @<bot> in Telegram, send `/start` once, we continue automatically once the chat is linked."
- **"Open Telegram Bot"** (deep link) + **"Check Again"** buttons. Configurable in Settings > Remote Control.
- Purpose: "message the assistant away from the browser."

## 10. Memory (on-chain, 0G Storage)
- Dedicated **Memory** tab.
- "If the user has memory data stored on **0G Storage**, they can **synchronize** it, syncing the
  **on-chain memory to the local device for one-click recovery**." → portable, recoverable agent memory.

## 11. Settings
- Central place to: adjust wallet balances, swap models, connect/disconnect workspace,
  configure Telegram/Remote Control, manage skills.

## 12. Misc / polish
- Language selector (US flag, top-right).
- Clean light-theme UI, gradient primary buttons, rounded cards, status pill chips.
- Step-gating with clear REQUIRED vs OPTIONAL badges.

---

## Rebuild map → Themis v2
What Ghast had that Themis v2 (conversational tribunal copilot) should borrow, and where it already overlaps:

| Ghast AI feature | Themis v2 status | Notes |
|---|---|---|
| Streaming descriptive chat + inline tool calls | **Planned (Phase 1)** | Themis docket already renders tool calls; upgrade chat to stream narration |
| Suggested prompt chips | **Planned (Phase 1)** | Already in the v2 design |
| Human-approval gate on actions | **Have it** | Themis "Confirm/Execute" ruling card = same pattern |
| Multi-model with fallback | **Planned (Phase 1)** | Themis = Mistral→NVIDIA→Gemini router; Ghast = on-chain 0G providers (alt model) |
| Auto-created wallet + QR funding + balance | **Not yet** | Ghast's frictionless onboarding is worth copying |
| Skills store (browse/install/env-vars) | **Not yet** | Big feature; likely out of Themis scope, but powerful |
| Local agent orchestration (Claude Code/Codex via MCP+ACP) | **Not yet** | Ghast's standout; probably beyond Themis's trading focus |
| On-chain memory (0G Storage) | **Not yet** | Maps to Themis's on-chain seal/verified-record idea |
| Telegram remote | **Have a bot** | Themis already ships a grammY bot |
| Workspace/file access | **Not applicable** | Ghast is a general dev-assistant; Themis is a trading vertical |

**Key strategic note:** Ghast AI was a **broad, general Web3 agent platform** (crypto-native
Cursor/Claude-Desktop with wallet + decentralized models + skills + local coding agents).
Themis is a **focused trading vertical**. Deciding *how much of Ghast's breadth to fold into
Themis* (vs. keep Themis sharp) is the next product decision.
