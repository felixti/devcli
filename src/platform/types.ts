export type Platform = 'macos' | 'windows' | 'wsl2' | 'wsl1' | 'linux';

export interface PlatformInfo {
  platform: Platform;
  shell: string;
  packageManager: string;
  isWSL: boolean;
}

export interface DetectorDeps {
  env: Record<string, string>;
  readFile: (path: string) => Promise<string>;
}
