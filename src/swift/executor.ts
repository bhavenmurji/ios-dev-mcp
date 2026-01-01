/**
 * Swift Code Execution Engine
 * Executes Swift code snippets and returns the output
 */

import { executeCommand } from "../utils/process.js";
import { createTempFile } from "../utils/tempfile.js";

export interface SwiftExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  timedOut: boolean;
}

export interface SwiftExecutorOptions {
  timeout?: number; // in milliseconds, default 30000
  swiftPath?: string; // path to swift binary
}

const DEFAULT_TIMEOUT = 30000;

/**
 * Execute Swift code and return the result
 */
export async function executeSwift(
  code: string,
  options: SwiftExecutorOptions = {}
): Promise<SwiftExecutionResult> {
  const { timeout = DEFAULT_TIMEOUT, swiftPath = "swift" } = options;

  const startTime = Date.now();
  let tempFile: { path: string; cleanup: () => Promise<void> } | null = null;

  try {
    // Create a temporary file with the Swift code
    tempFile = await createTempFile(code, ".swift");

    // Execute the Swift code
    const result = await executeCommand(swiftPath, [tempFile.path], {
      timeout,
    });

    const executionTime = Date.now() - startTime;

    if (result.timedOut) {
      return {
        success: false,
        output: "",
        error: `Execution timed out after ${timeout / 1000} seconds`,
        executionTime,
        timedOut: true,
      };
    }

    if (result.exitCode !== 0) {
      // Swift compilation or runtime error
      return {
        success: false,
        output: result.stdout,
        error: result.stderr || `Swift exited with code ${result.exitCode}`,
        executionTime,
        timedOut: false,
      };
    }

    return {
      success: true,
      output: result.stdout,
      executionTime,
      timedOut: false,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      output: "",
      error: `Failed to execute Swift code: ${errorMessage}`,
      executionTime,
      timedOut: false,
    };
  } finally {
    // Clean up temp file
    if (tempFile) {
      await tempFile.cleanup();
    }
  }
}

/**
 * Check if Swift is available on the system
 */
export async function isSwiftAvailable(): Promise<boolean> {
  try {
    const result = await executeCommand("swift", ["--version"], { timeout: 5000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Get Swift version information
 */
export async function getSwiftVersion(): Promise<string | null> {
  try {
    const result = await executeCommand("swift", ["--version"], { timeout: 5000 });
    if (result.exitCode === 0) {
      // Parse the first line of version output
      const firstLine = result.stdout.split("\n")[0];
      return firstLine || result.stdout;
    }
    return null;
  } catch {
    return null;
  }
}
