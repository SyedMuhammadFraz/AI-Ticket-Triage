import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Authenticated encryption (AES-256-GCM) for secrets that must be recoverable,
 * like webhook signing secrets. The key is derived from APP_SECRET with HKDF,
 * so rotating APP_SECRET means re-registering webhook endpoints.
 * Format: "v1.<iv>.<tag>.<ciphertext>" (base64url parts).
 */
function deriveKey(appSecret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", appSecret, "triage-desk", "webhook-endpoint-secrets/v1", 32));
}

export function sealSecret(plaintext: string, appSecret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(appSecret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function openSecret(sealed: string, appSecret: string): string {
  const [version, iv, tag, ciphertext] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || ciphertext === undefined) throw new Error("Unrecognised sealed secret format");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(appSecret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
