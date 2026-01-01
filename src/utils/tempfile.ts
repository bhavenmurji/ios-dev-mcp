/**
 * Temporary file management utilities
 */

import { mkdtemp, writeFile, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

/**
 * Create a temporary directory
 */
export async function createTempDir(prefix: string = "ios-dev-mcp-"): Promise<string> {
  const tempPath = await mkdtemp(join(tmpdir(), prefix));
  return tempPath;
}

/**
 * Create a temporary file with the given content and extension
 */
export async function createTempFile(
  content: string,
  extension: string = ".swift"
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const tempDir = await createTempDir();
  const fileName = `code_${randomBytes(4).toString("hex")}${extension}`;
  const filePath = join(tempDir, fileName);

  await writeFile(filePath, content, "utf-8");

  const cleanup = async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  };

  return { path: filePath, cleanup };
}

/**
 * Ensure a directory exists
 */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}
