import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/**
 * Outbound HTTP for webhooks, hardened against SSRF:
 *  - https only (http allowed only when private networks are explicitly allowed, e.g. local dev);
 *  - every address the hostname resolves to is checked *inside the connection's
 *    DNS lookup*, so a DNS-rebinding answer can't slip past an earlier check;
 *  - no redirects are followed, short timeouts, response bodies are capped.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

const V4_BLOCKS: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

/** True for loopback, private, link-local, CGNAT, documentation, multicast and reserved ranges. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const n = ipv4ToInt(ip);
    return V4_BLOCKS.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      /^f[cd][0-9a-f]{2}:/.test(lower) || // fc00::/7 unique local
      /^fe[89ab][0-9a-f]:/.test(lower) || // fe80::/10 link-local
      /^ff[0-9a-f]{2}:/.test(lower) // multicast
    );
  }
  return true; // not an IP at all → refuse
}

export function assertAllowedUrl(raw: string, allowPrivateNetwork: boolean): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }
  if (url.username || url.password) throw new UnsafeUrlError("URLs with credentials are not allowed");
  if (url.protocol !== "https:" && !(allowPrivateNetwork && url.protocol === "http:")) {
    throw new UnsafeUrlError("Webhook URLs must use https");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!allowPrivateNetwork && net.isIP(host) && isPrivateAddress(host)) {
    throw new UnsafeUrlError("Webhook URL points to a private or reserved address");
  }
  return url;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

function safeLookup(allowPrivateNetwork: boolean) {
  return (hostname: string, options: object, callback: LookupCallback) => {
    dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, []);
      const list = addresses as LookupAddress[];
      if (!allowPrivateNetwork && list.some((a) => isPrivateAddress(a.address))) {
        return callback(Object.assign(new UnsafeUrlError("Webhook host resolves to a private or reserved address"), { code: "EUNSAFE" }), []);
      }
      const wantsAll = (options as { all?: boolean }).all;
      if (wantsAll) return callback(null, list);
      const first = list[0];
      return callback(null, first.address, first.family);
    });
  };
}

export type PostResult = { status: number };

export function postJson(
  rawUrl: string,
  body: string,
  headers: Record<string, string>,
  opts: { allowPrivateNetwork: boolean; timeoutMs: number },
): Promise<PostResult> {
  const url = assertAllowedUrl(rawUrl, opts.allowPrivateNetwork);
  const client = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body).toString(), ...headers },
        lookup: safeLookup(opts.allowPrivateNetwork) as unknown as typeof dnsLookup,
        timeout: opts.timeoutMs,
      },
      (res) => {
        // Drain (and cap) the body so the socket can be reused; we only need the status.
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 64 * 1024) res.destroy();
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
        res.on("close", () => resolve({ status: res.statusCode ?? 0 }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error(`Timed out after ${opts.timeoutMs} ms`)));
    req.on("error", reject);
    req.end(body);
  });
}
