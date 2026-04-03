import { access, readFile, writeFile, mkdir } from "node:fs/promises";
import type { FileSystem } from "@/kernel/types";

/**
 * RealFileSystem uses Node.js fs.promises for file operations.
 * Supports:
 * - exists: check if file/directory exists
 * - readFile: read file contents as string
 * - writeFile: write string content to file
 * - mkdirp: create directory recursively
 */
export class RealFileSystem implements FileSystem {
  /**
   * Check if a path exists.
   */
  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read file contents as string.
   * @throws Error if file does not exist
   */
  async readFile(path: string): Promise<string> {
    return await readFile(path, "utf-8");
  }

  /**
   * Write string content to file.
   * Creates parent directories if they don't exist.
   */
  async writeFile(path: string, content: string): Promise<void> {
    // Ensure parent directory exists
    const parent = this.parentDir(path);
    if (parent) {
      await this.mkdirp(parent);
    }
    await writeFile(path, content, "utf-8");
  }

  /**
   * Create directory recursively (like `mkdir -p`).
   */
  async mkdirp(path: string): Promise<void> {
    try {
      await mkdir(path, { recursive: true });
    } catch (error: unknown) {
      // Ignore if already exists
      if (error instanceof Error && "code" in error && error.code !== "EEXIST") {
        throw error;
      }
    }
  }

  /**
   * Extract parent directory from a path.
   */
  private parentDir(path: string): string | null {
    const normalized = path.replace(/\\/g, "/");
    const lastSlash = normalized.lastIndexOf("/");
    if (lastSlash === -1) return null;
    return normalized.slice(0, lastSlash);
  }
}
