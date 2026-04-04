export type { Platform, PlatformInfo } from "@/kernel/types";

export interface DetectorDeps {
  env: Record<string, string>;
  readFile: (path: string) => Promise<string>;
}
