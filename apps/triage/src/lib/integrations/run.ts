import "server-only";
import { getDb } from "@/lib/db";
import { allowPrivateWebhooks, getEnv } from "@/lib/env";
import { deliverDueWebhooks } from "./webhooks";

/** Delivers any due webhook events now. Safe to call often: claims are atomic and idempotent. */
export async function deliverWebhooksNow(): Promise<void> {
  const env = getEnv();
  try {
    await deliverDueWebhooks(getDb(), { appSecret: env.APP_SECRET, allowPrivateNetwork: allowPrivateWebhooks(env) });
  } catch (err) {
    console.error("[webhooks] delivery run failed:", err);
  }
}
