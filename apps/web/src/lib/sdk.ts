/**
 * Server-side VibeQuant SDK singleton.
 *
 * This module must only be imported from server code (route handlers / server
 * components). It owns the persistent, connected client and is the only place
 * Alpha Arcade is touched. When no wallet is configured, the app runs in
 * "demo mode" and routes serve mock data.
 */

import { VibeQuantClient, configFromEnv } from "@vibequant/sdk";

let clientPromise: Promise<VibeQuantClient | null> | null = null;

/** Whether a wallet address is configured (i.e. not demo mode). */
export function isConfigured(): boolean {
  return Boolean(process.env.ALPHA_WALLET_ADDRESS?.trim());
}

async function init(): Promise<VibeQuantClient | null> {
  if (!isConfigured()) return null;
  const client = new VibeQuantClient(configFromEnv());
  await client.connect();
  return client;
}

/**
 * Returns the connected client, or null in demo mode / on connection failure.
 * The connection is established once and cached for the process lifetime.
 */
export function getClient(): Promise<VibeQuantClient | null> {
  if (!clientPromise) {
    clientPromise = init().catch((error) => {
      console.error("[vibequant] SDK connect failed, falling back to demo mode:", error);
      clientPromise = null;
      return null;
    });
  }
  return clientPromise;
}
