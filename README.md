# VibeQuant

<video src="vibequant.mp4" autoplay loop muted playsinline controls width="100%"></video>

https://github.com/techMellouk/VibeQuant/raw/main/vibequant.mp4

Natural language trading on [Alpha Arcade](https://alphaarcade.com) prediction markets, with optional paid signals over **x402 on Algorand**.

## What it does

You describe a belief in plain English. VibeQuant finds relevant markets, proposes a sized strategy, and executes only after you approve. An LLM drives discovery and strategy; heuristics run if no API key is set.

**Flow:** thesis → market discovery → strategy card → approve → on chain orders on Alpha Arcade.

## x402

Before building a strategy, the agent may buy an external signal via **HTTP 402 payment** on Algorand (`@x402-avm/fetch` + `@x402-avm/avm`). The signal cost appears on the strategy card. Demo mode simulates a $0.02 sentiment signal; live mode pays from the configured wallet when `X402_SIGNAL_URL` is set.

## Architecture

| Layer | Role |
|-------|------|
| `apps/web` | Next.js chat UI and API routes |
| `packages/sdk` | `@vibequant/sdk` wrapper around `@alpha-arcade/sdk` (markets, wallet, orders) |

All Alpha Arcade access goes through the SDK. Secrets stay server side in `.env.local`.

## Run locally

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
# Fill ALPHA_WALLET_ADDRESS, ALPHA_ARCADE_API_KEY, LLM_API_KEY, ALPHA_MNEMONIC for live trading
npm run dev -w web
```

Open http://localhost:3000

**Live trading:** fund the wallet with Algorand USDC (ASA 31566704) and ~2 ALGO for fees/escrow. Set `ALPHA_MNEMONIC` to a 25 word Algorand passphrase matching the wallet address.

**Paper mode:** leave `ALPHA_MNEMONIC` empty. Approvals simulate fills on live prices.

## Hackathon stack

Algorand mainnet · Alpha Arcade · x402 AVM · USDC · Next.js · OpenAI compatible LLM
