/**
 * Tests for iOS Simulator control functionality
 * Note: These tests require simctl to be available on the system
 */

import {
  isSimctlAvailable,
  listSimulators,
  findSimulator,
  getBootedSimulator,
} from "../src/simulator/controller.js";

describe("Simulator Controller", () => {
  let simctlAvailable = false;

  beforeAll(async () => {
    simctlAvailable = await isSimctlAvailable();
    if (!simctlAvailable) {
      console.warn("simctl is not available - some tests will be skipped");
    }
  });

  describe("isSimctlAvailable", () => {
    it("should return a boolean", async () => {
      const result = await isSimctlAvailable();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("listSimulators", () => {
    it("should return a list result", async () => {
      if (!simctlAvailable) {
        console.log("Skipping test - simctl not available");
        return;
      }

      const result = await listSimulators();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.devices)).toBe(true);
      expect(Array.isArray(result.runtimes)).toBe(true);
    });

    it("should include device properties", async () => {
      if (!simctlAvailable) {
        console.log("Skipping test - simctl not available");
        return;
      }

      const result = await listSimulators();
      if (result.devices.length > 0) {
        const device = result.devices[0];
        expect(device).toHaveProperty("udid");
        expect(device).toHaveProperty("name");
        expect(device).toHaveProperty("state");
        expect(device).toHaveProperty("runtime");
        expect(device).toHaveProperty("isAvailable");
      }
    });
  });

  describe("findSimulator", () => {
    it("should return null for non-existent device", async () => {
      if (!simctlAvailable) {
        console.log("Skipping test - simctl not available");
        return;
      }

      const device = await findSimulator("NonExistent Device XYZ");
      expect(device).toBeNull();
    });
  });

  describe("getBootedSimulator", () => {
    it("should return null or a device", async () => {
      if (!simctlAvailable) {
        console.log("Skipping test - simctl not available");
        return;
      }

      const device = await getBootedSimulator();
      if (device) {
        expect(device.state).toBe("Booted");
        expect(device.udid).toBeTruthy();
      }
    });
  });
});
