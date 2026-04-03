import type { FileSystem } from "@/kernel/types";

/**
 * MockFileSystem provides an in-memory implementation of FileSystem for testing.
 * Uses a Map to store file contents.
 */
export class MockFileSystem implements FileSystem {
	private files: Map<string, string> = new Map();
	private directories: Set<string> = new Set();

	/**
	 * Clear all stored files and directories.
	 */
	clear(): void {
		this.files.clear();
		this.directories.clear();
	}

	/**
	 * Check if a path exists (file or directory).
	 */
	async exists(path: string): Promise<boolean> {
		return this.files.has(path) || this.directories.has(path);
	}

	/**
	 * Read file contents.
	 * @throws Error if file does not exist
	 */
	async readFile(path: string): Promise<string> {
		const content = this.files.get(path);
		if (content === undefined) {
			throw new Error(`ENOENT: no such file or directory '${path}'`);
		}
		return content;
	}

	/**
	 * Write content to file.
	 */
	async writeFile(path: string, content: string): Promise<void> {
		this.files.set(path, content);
	}

	/**
	 * Create directory (marks path as a directory).
	 * For nested paths, creates all intermediate directories.
	 */
	async mkdirp(path: string): Promise<void> {
		// Add the directory itself
		this.directories.add(path);

		// For nested paths, also add parent directories
		const parts = path.replace(/\\/g, "/").split("/");
		for (let i = 1; i < parts.length; i++) {
			const parent = parts.slice(0, i).join("/");
			this.directories.add(parent);
		}
	}

	/**
	 * Get all stored file paths (for debugging/testing).
	 */
	getFilePaths(): string[] {
		return Array.from(this.files.keys());
	}

	/**
	 * Get all stored directory paths (for debugging/testing).
	 */
	getDirectoryPaths(): string[] {
		return Array.from(this.directories);
	}
}
