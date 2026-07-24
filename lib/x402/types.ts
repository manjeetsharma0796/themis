// x402 v2 wire types — exact scheme on EVM. Mirrors the coinbase/x402 spec
// (specs/x402-specification-v2.md, scheme_exact). Used to speak x402 to OKX's
// facilitator on X Layer without pulling the whole SDK.

export type PaymentRequirements = {
  scheme: "exact";
  network: string; // CAIP-2, e.g. "eip155:195"
  amount: string; // atomic units of `asset`, as a string
  asset: string; // ERC-20 token contract
  payTo: string; // recipient (the ASP's Agentic Wallet address)
  maxTimeoutSeconds: number;
  resource?: string;
  description?: string;
  mimeType?: string;
  extra?: { name?: string; version?: string } & Record<string, unknown>; // EIP-712 domain
};

// EIP-3009 transferWithAuthorization payload
export type ExactEvmPayload = {
  signature: `0x${string}`;
  authorization: {
    from: `0x${string}`;
    to: `0x${string}`;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: `0x${string}`;
  };
};

export type PaymentPayload = {
  x402Version: 2;
  resource?: { url: string; description?: string; mimeType?: string };
  accepted: PaymentRequirements;
  payload: ExactEvmPayload;
};

export type VerifyResponse = {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
};

export type SettleResponse = {
  success: boolean;
  transaction?: string; // settlement tx hash on X Layer
  network?: string;
  payer?: string;
  errorReason?: string;
  settlement?: "onchain" | "demo"; // never claim "onchain" unless a facilitator settled it
};
