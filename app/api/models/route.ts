import { guard } from "../../lib/guard";
import { listConfiguredProviders } from "../../lib/providers";

export const runtime = "nodejs";

// Which providers are configured on the server — names only, never keys or models.
export async function GET(req: Request): Promise<Response> {
  const denied = guard(req);
  if (denied) return denied;
  return Response.json({ providers: listConfiguredProviders() });
}
