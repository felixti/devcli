import type { PlatformDetector, PlatformInfo } from "@/kernel/types";

export class MockPlatformDetector implements PlatformDetector {
  private response: PlatformInfo;

  constructor(response?: PlatformInfo) {
    this.response = response ?? {
      platform: "linux",
      shell: "/bin/bash",
      packageManager: "apt",
      isWSL: false,
    };
  }

  setResponse(response: PlatformInfo): void {
    this.response = response;
  }

  async detect(): Promise<PlatformInfo> {
    return this.response;
  }
}
