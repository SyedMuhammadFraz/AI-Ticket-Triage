import { describe, expect, it } from "vitest";
import { assertAllowedUrl, isPrivateAddress, UnsafeUrlError } from "./outbound";

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "not-an-ip"])(
    "blocks %s",
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(true);
    },
  );

  it.each(["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111", "172.32.0.1"])("allows public %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("assertAllowedUrl", () => {
  it("requires https unless private networks are explicitly allowed", () => {
    expect(() => assertAllowedUrl("http://store.example/hook", false)).toThrow(UnsafeUrlError);
    expect(assertAllowedUrl("http://localhost:3000/hook", true).port).toBe("3000");
    expect(assertAllowedUrl("https://store.example/hook", false).hostname).toBe("store.example");
  });

  it("rejects private IP literals, credentials and garbage", () => {
    expect(() => assertAllowedUrl("https://169.254.169.254/latest/meta-data", false)).toThrow(/private/);
    expect(() => assertAllowedUrl("https://[::1]/hook", false)).toThrow(/private/);
    expect(() => assertAllowedUrl("https://user:pass@store.example/hook", false)).toThrow(/credentials/);
    expect(() => assertAllowedUrl("not a url", false)).toThrow(/Invalid/);
    expect(() => assertAllowedUrl("file:///etc/passwd", true)).toThrow(/https/);
  });
});
