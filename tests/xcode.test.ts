/**
 * Tests for Xcode build functionality
 * Note: These tests require Xcode to be installed on the system
 */

import {
  isXcodeAvailable,
  getXcodeVersion,
  detectProjectType,
  listSchemes,
} from "../src/xcode/builder.js";

describe("Xcode Builder", () => {
  let xcodeAvailable = false;

  beforeAll(async () => {
    xcodeAvailable = await isXcodeAvailable();
    if (!xcodeAvailable) {
      console.warn("Xcode is not available - some tests will be skipped");
    }
  });

  describe("isXcodeAvailable", () => {
    it("should return a boolean", async () => {
      const result = await isXcodeAvailable();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("getXcodeVersion", () => {
    it("should return version string or null", async () => {
      const version = await getXcodeVersion();
      if (xcodeAvailable) {
        expect(version).toBeTruthy();
        expect(typeof version).toBe("string");
        expect(version).toContain("Xcode");
      } else {
        expect(version).toBeNull();
      }
    });
  });

  describe("detectProjectType", () => {
    it("should return null for non-existent path", async () => {
      const result = await detectProjectType("/nonexistent/path.xcodeproj");
      expect(result).toBeNull();
    });

    it("should return null for non-Xcode directory", async () => {
      const result = await detectProjectType("/tmp");
      expect(result).toBeNull();
    });
  });

  describe("listSchemes", () => {
    it("should return error for invalid project path", async () => {
      const result = await listSchemes("/nonexistent/path.xcodeproj");
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
