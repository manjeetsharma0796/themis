// Regression guards for the OKX.AI ASP listing contract.
// Every assertion here maps to something an OKX reviewer checks (or rejected us
// for). If one breaks, the listing would be rejected — so these must stay green.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { x402Config, atomicAmount } from "@/lib/x402/config";
import { buildRequirements, encodePaymentChallenge, decodePaymentHeader } from "@/lib/x402/server";

const USDT0 = "0x779ded0c9e1022225f8e0630b35a9b54be713736"; // OKX-mandated settlement token
const PAY_TO = "0x0a639366f692be6af826582018e3c02f1296592b";
const RESOURCE = "/api/service/signal";
// The exact accept-item keys OKX's review requires — no more, no less.
const REQUIRED_ACCEPT_KEYS = ["scheme", "network", "asset", "amount", "payTo", "maxTimeoutSeconds", "extra"].sort();

describe("x402 OKX ASP challenge contract", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.X402_NETWORK;
    delete process.env.X402_ASSET;
    delete process.env.X402_ASSET_NAME;
    delete process.env.X402_FACILITATOR_URL;
    process.env.X402_PAY_TO = PAY_TO;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  describe("network — must be X Layer mainnet (rejection #1)", () => {
    it("defaults to eip155:196", () => {
      expect(x402Config().network).toBe("eip155:196");
    });
    it("ignores a stale testnet/deprecated env (anti-downgrade)", () => {
      process.env.X402_NETWORK = "eip155:1952";
      expect(x402Config().network).toBe("eip155:196");
      process.env.X402_NETWORK = "eip155:195";
      expect(x402Config().network).toBe("eip155:196");
    });
    it("honors an explicit eip155:196 override", () => {
      process.env.X402_NETWORK = "eip155:196";
      expect(x402Config().network).toBe("eip155:196");
    });
  });

  describe("asset — must be USDT0 (rejection #2)", () => {
    it("defaults to the USDT0 contract, lowercase + valid length", () => {
      const a = x402Config().asset;
      expect(a).toBe(USDT0);
      expect(a).toMatch(/^0x[0-9a-f]{40}$/);
    });
    it("uses the exact on-chain EIP-712 name USD₮0 (₮ = U+20AE, not ASCII T)", () => {
      expect(x402Config().assetName).toBe("USD₮0");
    });
    it("prices 0.10 at 6 decimals → 100000 atomic units", () => {
      expect(atomicAmount(x402Config())).toBe("100000");
    });
  });

  describe("payTo", () => {
    it("is a valid, non-zero address when configured", () => {
      const r = buildRequirements(RESOURCE, "desc");
      expect(r.payTo).toBe(PAY_TO);
      expect(r.payTo).not.toBe("0x0000000000000000000000000000000000000000");
    });
  });

  describe("buildRequirements — every required field present", () => {
    it("has scheme/network/asset/amount/payTo/maxTimeoutSeconds/extra", () => {
      const r = buildRequirements(RESOURCE, "desc");
      expect(r.scheme).toBe("exact");
      expect(r.network).toBe("eip155:196");
      expect(r.asset).toBe(USDT0);
      expect(r.amount).toBe("100000");
      expect(r.payTo).toBe(PAY_TO);
      expect(r.maxTimeoutSeconds).toBe(60);
      expect(r.extra).toEqual({ name: "USD₮0", version: "1" });
    });
  });

  describe("PAYMENT-REQUIRED header — base64 x402 challenge (rejection #0)", () => {
    const decode = () =>
      JSON.parse(
        Buffer.from(encodePaymentChallenge(RESOURCE, [buildRequirements(RESOURCE, "d")]), "base64").toString("utf-8")
      );

    it("is valid base64 that decodes to JSON", () => {
      expect(() => decode()).not.toThrow();
    });
    it("top level is exactly {x402Version, resource, accepts}", () => {
      const c = decode();
      expect(c.x402Version).toBe(2);
      expect(c.resource).toBe(RESOURCE);
      expect(Array.isArray(c.accepts)).toBe(true);
      expect(Object.keys(c).sort()).toEqual(["accepts", "resource", "x402Version"]);
    });
    it("each accept has EXACTLY OKX's 7 required keys (no stray description/mimeType/resource)", () => {
      const c = decode();
      expect(Object.keys(c.accepts[0]).sort()).toEqual(REQUIRED_ACCEPT_KEYS);
    });
    it("advertises mainnet + USDT0 inside the header", () => {
      const c = decode();
      expect(c.accepts[0].network).toBe("eip155:196");
      expect(c.accepts[0].asset).toBe(USDT0);
      expect(c.accepts[0].amount).toBe("100000");
    });
  });

  describe("decodePaymentHeader — inbound X-PAYMENT round-trip", () => {
    it("decodes a base64 payment payload back to its object", () => {
      const payload = {
        x402Version: 2,
        accepted: { scheme: "exact", network: "eip155:196" },
        payload: { authorization: { from: "0xabc", value: "100000" }, signature: "0xsig" },
      };
      const enc = Buffer.from(JSON.stringify(payload)).toString("base64");
      expect(decodePaymentHeader(enc)).toEqual(payload);
    });
    it("throws on malformed base64/JSON (endpoint turns this into a clean 402)", () => {
      expect(() => decodePaymentHeader("!!!not-base64-json!!!")).toThrow();
    });
  });

  describe("demo vs live mode", () => {
    it("stays in demo mode until a facilitator + payTo + asset are all set", () => {
      expect(x402Config().live).toBe(false); // no X402_FACILITATOR_URL
    });
    it("flips to live only with a facilitator configured", () => {
      process.env.X402_FACILITATOR_URL = "https://facilitator.example";
      expect(x402Config().live).toBe(true);
    });
  });
});
