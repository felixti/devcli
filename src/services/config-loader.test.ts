import { test, expect, describe } from "bun:test";
import { RealConfigLoader } from "./config-loader.impl";
import { MockConfigLoader } from "./config-loader.mock";
import { defaults } from "@/config/defaults";
import type { RemoteConfig } from "@/config/schema";

const mockRemoteConfig: RemoteConfig = {
  version: "2.0.0",
  tools: [
    {
      name: "test-tool",
      displayName: "Test Tool",
      minVersion: "1.0.0",
    },
  ],
};

describe("ConfigLoader", () => {
  describe("RealConfigLoader", () => {
    test("remote fetch success returns valid config", async () => {
      const mockFetch = async (): Promise<Response> =>
        new Response(JSON.stringify(mockRemoteConfig), { status: 200 });

      const loader = new RealConfigLoader({
        fetch: mockFetch,
        cachePath: "/tmp/test-cache-1.json",
        ttlMs: 3600000,
      });

      const config = await loader.load();

      expect(config.version).toBe("2.0.0");
      expect(config.tools).toHaveLength(1);
      expect(config.tools[0]!.name).toBe("test-tool");
    });

    test("remote fetch fails falls back to cached config", async () => {
      const cachePath = "/tmp/test-cache-2.json";
      const cachedConfig: RemoteConfig = {
        version: "1.5.0",
        tools: [{ name: "cached-tool", displayName: "Cached Tool" }],
      };
      const cacheEntry = { config: cachedConfig, timestamp: Date.now() };

      await Bun.write(cachePath, JSON.stringify(cacheEntry));

      const mockFetch = async (): Promise<Response> =>
        new Response(null, { status: 500 });

      const loader = new RealConfigLoader({
        fetch: mockFetch,
        cachePath,
        ttlMs: 3600000,
      });

      const config = await loader.load();

      expect(config.version).toBe("1.5.0");
      expect(config.tools[0]!.name).toBe("cached-tool");

      await Bun.file(cachePath).delete();
    });

    test("cache miss falls back to bundled defaults", async () => {
      const cachePath = "/tmp/test-cache-3.json";

      try {
        await Bun.file(cachePath).delete();
      } catch {
        // ignore if doesn't exist
      }

      const mockFetch = async (): Promise<Response> =>
        new Response(null, { status: 500 });

      const loader = new RealConfigLoader({
        fetch: mockFetch,
        cachePath,
        ttlMs: 3600000,
      });

      const config = await loader.load();

      expect(config.version).toBe(defaults.version);
      expect(config.tools).toHaveLength(defaults.tools.length);
      expect(config.tools.map((t: { name: string }) => t.name).sort()).toEqual(
        defaults.tools.map((t: { name: string }) => t.name).sort()
      );
    });

    test("invalid remote config falls back to cache", async () => {
      const cachePath = "/tmp/test-cache-4.json";
      const cachedConfig: RemoteConfig = {
        version: "1.5.0",
        tools: [{ name: "cached-tool", displayName: "Cached Tool" }],
      };
      const cacheEntry = { config: cachedConfig, timestamp: Date.now() };

      await Bun.write(cachePath, JSON.stringify(cacheEntry));

      const mockFetch = async (): Promise<Response> =>
        new Response(JSON.stringify({ invalid: "data" }), { status: 200 });

      const loader = new RealConfigLoader({
        fetch: mockFetch,
        cachePath,
        ttlMs: 3600000,
      });

      const config = await loader.load();

      expect(config.version).toBe("1.5.0");

      await Bun.file(cachePath).delete();
    });

    test("successful fetch writes to cache", async () => {
      const cachePath = "/tmp/test-cache-5.json";

      try {
        await Bun.file(cachePath).delete();
      } catch {
        // ignore
      }

      const mockFetch = async (): Promise<Response> =>
        new Response(JSON.stringify(mockRemoteConfig), { status: 200 });

      const loader = new RealConfigLoader({
        fetch: mockFetch,
        cachePath,
        ttlMs: 3600000,
      });

      await loader.load();

      const cached = await Bun.file(cachePath).text();
      const parsed = JSON.parse(cached);

      expect(parsed.config.version).toBe("2.0.0");
      expect(parsed.config.tools[0].name).toBe("test-tool");
      expect(parsed.timestamp).toBeNumber();

      await Bun.file(cachePath).delete();
    });
  });

  describe("MockConfigLoader", () => {
    test("returns configured config", async () => {
      const loader = new MockConfigLoader(mockRemoteConfig);

      const config = await loader.load();

      expect(config.version).toBe("2.0.0");
      expect(config.tools).toHaveLength(1);
    });

    test("setConfig updates the returned config", async () => {
      const loader = new MockConfigLoader(defaults);

      loader.setConfig(mockRemoteConfig);

      const config = await loader.load();

      expect(config.version).toBe("2.0.0");
    });
  });
});
