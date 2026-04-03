import { readFile } from "node:fs/promises";
import type { PlatformDetector, PlatformInfo } from "@/kernel/types";
import { detectPlatform } from "@/platform/detector";

/**
 * RealPlatformDetector implements PlatformDetector using the platform detection logic.
 * Uses environment variables and filesystem checks to determine the current platform.
 */
export class RealPlatformDetector implements PlatformDetector {
  async detect(): Promise<PlatformInfo> {
    return detectPlatform({
      env: process.env as Record<string, string>,
      readFile: async (path: string) => readFile(path, "utf-8"),
    });
  }
}
