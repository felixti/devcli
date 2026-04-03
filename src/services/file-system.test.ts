import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RealFileSystem } from "./file-system.impl";

test("RealFileSystem: write→read roundtrip", async () => {
	const fs = new RealFileSystem();
	const path = join(tmpdir(), `test-${Date.now()}-roundtrip.txt`);
	const content = "Hello, FileSystem!";

	try {
		await fs.writeFile(path, content);
		const readContent = await fs.readFile(path);
		expect(readContent).toBe(content);
	} finally {
		// Cleanup
		try {
			const { unlink } = await import("node:fs/promises");
			await unlink(path);
		} catch {
			// Ignore cleanup errors
		}
	}
});

test("RealFileSystem: exists returns false for missing file", async () => {
	const fs = new RealFileSystem();
	const path = join(tmpdir(), `nonexistent-${Date.now()}.txt`);

	const result = await fs.exists(path);
	expect(result).toBe(false);
});

test("RealFileSystem: mkdirp creates nested directories", async () => {
	const fs = new RealFileSystem();
	const baseDir = join(tmpdir(), `test-mkdirp-${Date.now()}`);
	const nestedDir = join(baseDir, "a", "b", "c");
	const testFile = join(nestedDir, "file.txt");

	try {
		await fs.mkdirp(nestedDir);
		await fs.writeFile(testFile, "nested content");

		const exists = await fs.exists(nestedDir);
		expect(exists).toBe(true);

		const content = await fs.readFile(testFile);
		expect(content).toBe("nested content");
	} finally {
		// Cleanup - remove in reverse order
		try {
			const { unlink, rm } = await import("node:fs/promises");
			await unlink(testFile).catch(() => {});
			await rm(baseDir, { recursive: true }).catch(() => {});
		} catch {
			// Ignore cleanup errors
		}
	}
});

test("RealFileSystem: readFile throws for non-existent file", async () => {
	const fs = new RealFileSystem();
	const path = join(tmpdir(), `nonexistent-${Date.now()}.txt`);

	await expect(fs.readFile(path)).rejects.toThrow();
});
