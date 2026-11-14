import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

/** Liveness + database check for uptime monitors. Reveals nothing beyond up/down. */
export async function GET(): Promise<Response> {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[health] database check failed:", err);
    return Response.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
