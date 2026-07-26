// GET /api/wallet/balance?address=0x… — native OKB balance on X Layer testnet.
import { createPublicClient, formatEther, http, isAddress } from "viem";
import { xlayerTestnet } from "@/lib/chain/xlayer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (!address || !isAddress(address)) {
    return Response.json({ error: "valid address required" }, { status: 400 });
  }
  try {
    const client = createPublicClient({ chain: xlayerTestnet, transport: http() });
    const wei = await client.getBalance({ address });
    return Response.json({ address, balance: formatEther(wei), symbol: "OKB" });
  } catch (err) {
    // RPC hiccup — return zero rather than erroring the UI
    return Response.json({
      address,
      balance: "0",
      symbol: "OKB",
      note: err instanceof Error ? err.message : "rpc error",
    });
  }
}
