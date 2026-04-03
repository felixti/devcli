import { test, expect, describe } from 'bun:test';
import { detectPlatform } from './detector';
import type { PlatformInfo } from './types';

const mockReadFile = (files: Record<string, string>) => {
  return async (path: string): Promise<string> => {
    if (files[path] !== undefined) {
      return files[path];
    }
    throw new Error(`File not found: ${path}`);
  };
};

describe('detectPlatform', () => {
  test('detects macOS correctly', async () => {
    const deps = {
      env: {
        SHELL: '/bin/bash',
        Platform: 'darwin',
      },
      readFile: mockReadFile({}),
    };

    const result = await detectPlatform(deps);

    expect(result.platform).toBe('macos');
    expect(result.shell).toBe('bash');
    expect(result.packageManager).toBe('brew');
    expect(result.isWSL).toBe(false);
  });

  test('detects Windows native correctly', async () => {
    const deps = {
      env: {
        OS: 'Windows_NT',
        PSModulePath: 'C:\\Program Files\\PowerShell\\Modules',
      },
      readFile: mockReadFile({}),
    };

    const result = await detectPlatform(deps);

    expect(result.platform).toBe('windows');
    expect(result.shell).toBe('powershell');
    expect(result.packageManager).toBe('winget');
    expect(result.isWSL).toBe(false);
  });

  test('detects WSL2 correctly via WSL_DISTRO_NAME', async () => {
    const deps = {
      env: {
        SHELL: '/bin/bash',
        WSL_DISTRO_NAME: 'Ubuntu',
        OS: 'Linux',
      },
      readFile: mockReadFile({}),
    };

    const result = await detectPlatform(deps);

    expect(result.platform).toBe('wsl2');
    expect(result.shell).toBe('bash');
    expect(result.packageManager).toBe('apt');
    expect(result.isWSL).toBe(true);
  });

  test('detects WSL1 correctly via /proc/version', async () => {
    const deps = {
      env: {
        SHELL: '/bin/bash',
        OS: 'Linux',
      },
      readFile: mockReadFile({
        '/proc/version': 'Linux version 5.4.72 Microsoft',
      }),
    };

    const result = await detectPlatform(deps);

    expect(result.platform).toBe('wsl1');
    expect(result.shell).toBe('bash');
    expect(result.packageManager).toBe('apt');
    expect(result.isWSL).toBe(true);
  });

  test('detects Linux correctly', async () => {
    const deps = {
      env: {
        SHELL: '/bin/zsh',
        Platform: 'linux',
      },
      readFile: mockReadFile({
        '/proc/version': 'Linux version 5.15.0-generic',
      }),
    };

    const result = await detectPlatform(deps);

    expect(result.platform).toBe('linux');
    expect(result.shell).toBe('zsh');
    expect(result.packageManager).toBe('apt');
    expect(result.isWSL).toBe(false);
  });
});
