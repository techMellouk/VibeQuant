/** Base error for all VibeQuant SDK failures. */
export class VibeQuantError extends Error {
  override readonly name: string = "VibeQuantError";
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** Thrown when a trading action is attempted without a configured signer. */
export class NoSignerError extends VibeQuantError {
  override readonly name = "NoSignerError";
  constructor() {
    super(
      "Trading is disabled: this client was created in read-only mode. " +
        "Provide a `signer` or `mnemonic` in the config to enable trading.",
    );
  }
}

/** Thrown when the client is used before `connect()` has completed. */
export class NotConnectedError extends VibeQuantError {
  override readonly name = "NotConnectedError";
  constructor() {
    super("Client is not connected. Call `await client.connect()` first.");
  }
}
