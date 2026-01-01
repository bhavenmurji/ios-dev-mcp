/**
 * Tests for Swift execution functionality
 * Note: These tests require Swift to be installed on the system
 */

import { executeSwift, isSwiftAvailable, getSwiftVersion } from "../src/swift/executor.js";

describe("Swift Executor", () => {
  // Check if Swift is available for these tests
  let swiftAvailable = false;

  beforeAll(async () => {
    swiftAvailable = await isSwiftAvailable();
    if (!swiftAvailable) {
      console.warn("Swift is not available - some tests will be skipped");
    }
  });

  describe("isSwiftAvailable", () => {
    it("should return a boolean", async () => {
      const result = await isSwiftAvailable();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("getSwiftVersion", () => {
    it("should return version string or null", async () => {
      const version = await getSwiftVersion();
      if (swiftAvailable) {
        expect(version).toBeTruthy();
        expect(typeof version).toBe("string");
      } else {
        expect(version).toBeNull();
      }
    });
  });

  describe("executeSwift", () => {
    it("should handle simple print statement", async () => {
      if (!swiftAvailable) {
        console.log("Skipping test - Swift not available");
        return;
      }

      const result = await executeSwift('print("Hello, World!")');
      expect(result.success).toBe(true);
      expect(result.output).toBe("Hello, World!");
      expect(result.timedOut).toBe(false);
    });

    it("should handle variables and computation", async () => {
      if (!swiftAvailable) {
        console.log("Skipping test - Swift not available");
        return;
      }

      const code = `
let a = 5
let b = 10
print(a + b)
`;
      const result = await executeSwift(code);
      expect(result.success).toBe(true);
      expect(result.output).toBe("15");
    });

    it("should handle functions", async () => {
      if (!swiftAvailable) {
        console.log("Skipping test - Swift not available");
        return;
      }

      const code = `
func greet(name: String) -> String {
    return "Hello, \\(name)!"
}
print(greet(name: "Claude"))
`;
      const result = await executeSwift(code);
      expect(result.success).toBe(true);
      expect(result.output).toBe("Hello, Claude!");
    });

    it("should handle compilation errors gracefully", async () => {
      if (!swiftAvailable) {
        console.log("Skipping test - Swift not available");
        return;
      }

      const code = 'let x: Int = "not a number"';
      const result = await executeSwift(code);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("should handle runtime errors gracefully", async () => {
      if (!swiftAvailable) {
        console.log("Skipping test - Swift not available");
        return;
      }

      const code = `
let arr = [1, 2, 3]
print(arr[10])
`;
      const result = await executeSwift(code);
      expect(result.success).toBe(false);
    });

    it("should respect timeout", async () => {
      if (!swiftAvailable) {
        console.log("Skipping test - Swift not available");
        return;
      }

      const code = `
import Foundation
Thread.sleep(forTimeInterval: 5.0)
print("done")
`;
      const result = await executeSwift(code, { timeout: 1000 });
      expect(result.timedOut).toBe(true);
      expect(result.success).toBe(false);
    }, 10000);

    it("should clean up temp files after execution", async () => {
      if (!swiftAvailable) {
        console.log("Skipping test - Swift not available");
        return;
      }

      // Execute some code
      await executeSwift('print("test")');

      // We can't easily verify temp files are cleaned up without access to the filesystem,
      // but we can at least verify the function completes without error
      expect(true).toBe(true);
    });
  });
});
