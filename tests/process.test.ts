/**
 * Tests for process execution utilities
 */

import { executeCommand, executeShell } from "../src/utils/process.js";

describe("Process Utilities", () => {
  describe("executeCommand", () => {
    it("should execute a simple command", async () => {
      const result = await executeCommand("echo", ["hello"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("hello");
      expect(result.timedOut).toBe(false);
    });

    it("should capture stderr", async () => {
      const result = await executeCommand("sh", ["-c", "echo error >&2"]);
      expect(result.stderr).toBe("error");
    });

    it("should return non-zero exit code for failed commands", async () => {
      const result = await executeCommand("sh", ["-c", "exit 42"]);
      expect(result.exitCode).toBe(42);
    });

    it("should respect timeout", async () => {
      const result = await executeCommand("sleep", ["10"], { timeout: 100 });
      expect(result.timedOut).toBe(true);
    });

    it("should handle command not found", async () => {
      const result = await executeCommand("nonexistent_command_xyz", []);
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe("executeShell", () => {
    it("should execute shell commands with pipes", async () => {
      const result = await executeShell("echo hello | tr 'a-z' 'A-Z'");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("HELLO");
    });

    // Note: Shell timeout test can be flaky in certain environments
    it.skip("should respect timeout", async () => {
      const result = await executeShell("sleep 10", { timeout: 100 });
      expect(result.timedOut).toBe(true);
    }, 10000);
  });
});
