/**
 * iOS Simulator Controller
 * Manages iOS Simulator devices and operations
 */

import { executeCommand } from "../utils/process.js";
import { ensureDir } from "../utils/tempfile.js";
import { dirname, join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

export interface SimulatorDevice {
  udid: string;
  name: string;
  state: "Shutdown" | "Booted" | "Shutting Down" | "Booting";
  runtime: string;
  isAvailable: boolean;
}

export interface SimulatorRuntime {
  identifier: string;
  name: string;
  version: string;
  buildVersion: string;
  isAvailable: boolean;
}

export interface SimulatorListResult {
  success: boolean;
  devices: SimulatorDevice[];
  runtimes: SimulatorRuntime[];
  error?: string;
}

export interface SimulatorResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface ScreenshotResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface AppLaunchResult {
  success: boolean;
  message: string;
  pid?: number;
  error?: string;
}

/**
 * List all available simulators
 */
export async function listSimulators(): Promise<SimulatorListResult> {
  const result = await executeCommand("xcrun", ["simctl", "list", "--json"], {
    timeout: 30000,
  });

  if (result.exitCode !== 0) {
    return {
      success: false,
      devices: [],
      runtimes: [],
      error: result.stderr || `simctl exited with code ${result.exitCode}`,
    };
  }

  try {
    const data = JSON.parse(result.stdout);

    // Parse runtimes
    const runtimes: SimulatorRuntime[] = [];
    if (data.runtimes) {
      for (const runtime of data.runtimes) {
        runtimes.push({
          identifier: runtime.identifier,
          name: runtime.name,
          version: runtime.version || "",
          buildVersion: runtime.buildversion || "",
          isAvailable: runtime.isAvailable !== false,
        });
      }
    }

    // Parse devices
    const devices: SimulatorDevice[] = [];
    if (data.devices) {
      for (const [runtimeId, deviceList] of Object.entries(data.devices)) {
        if (Array.isArray(deviceList)) {
          for (const device of deviceList) {
            devices.push({
              udid: device.udid,
              name: device.name,
              state: device.state,
              runtime: runtimeId,
              isAvailable: device.isAvailable !== false,
            });
          }
        }
      }
    }

    return {
      success: true,
      devices,
      runtimes,
    };
  } catch (error) {
    return {
      success: false,
      devices: [],
      runtimes: [],
      error: `Failed to parse simctl output: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Find a simulator by name and optional runtime
 */
export async function findSimulator(
  deviceName: string,
  osVersion?: string
): Promise<SimulatorDevice | null> {
  const list = await listSimulators();
  if (!list.success) {
    return null;
  }

  // Filter by name and optionally by runtime version
  const matching = list.devices.filter((d) => {
    const nameMatch = d.name.toLowerCase() === deviceName.toLowerCase();
    if (!nameMatch) return false;

    if (osVersion) {
      // Check if runtime contains the version
      return d.runtime.includes(osVersion.replace(".", "-"));
    }
    return true;
  });

  if (matching.length === 0) {
    return null;
  }

  // Prefer booted simulators, then available ones
  const booted = matching.find((d) => d.state === "Booted");
  if (booted) return booted;

  const available = matching.find((d) => d.isAvailable);
  if (available) return available;

  return matching[0];
}

/**
 * Boot a simulator
 */
export async function bootSimulator(udid: string): Promise<SimulatorResult> {
  // First check current state
  const list = await listSimulators();
  const device = list.devices.find((d) => d.udid === udid);

  if (!device) {
    return {
      success: false,
      message: "",
      error: `Simulator with UDID ${udid} not found`,
    };
  }

  if (device.state === "Booted") {
    return {
      success: true,
      message: `Simulator ${device.name} is already booted`,
    };
  }

  const result = await executeCommand("xcrun", ["simctl", "boot", udid], {
    timeout: 60000,
  });

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: "",
      error: result.stderr || `Failed to boot simulator`,
    };
  }

  // Open Simulator.app to show the device
  await executeCommand("open", ["-a", "Simulator"], { timeout: 10000 });

  return {
    success: true,
    message: `Successfully booted simulator ${device.name}`,
  };
}

/**
 * Shutdown a simulator
 */
export async function shutdownSimulator(udid: string): Promise<SimulatorResult> {
  const result = await executeCommand("xcrun", ["simctl", "shutdown", udid], {
    timeout: 30000,
  });

  if (result.exitCode !== 0) {
    // Check if already shutdown
    if (result.stderr.includes("Unable to shutdown device in current state: Shutdown")) {
      return {
        success: true,
        message: "Simulator is already shutdown",
      };
    }

    return {
      success: false,
      message: "",
      error: result.stderr || `Failed to shutdown simulator`,
    };
  }

  return {
    success: true,
    message: "Simulator shutdown successfully",
  };
}

/**
 * Get the currently booted simulator (first one if multiple)
 */
export async function getBootedSimulator(): Promise<SimulatorDevice | null> {
  const list = await listSimulators();
  if (!list.success) {
    return null;
  }

  return list.devices.find((d) => d.state === "Booted") || null;
}

/**
 * Install an app on a simulator
 */
export async function installApp(
  udid: string,
  appPath: string
): Promise<SimulatorResult> {
  const result = await executeCommand("xcrun", ["simctl", "install", udid, appPath], {
    timeout: 60000,
  });

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: "",
      error: result.stderr || `Failed to install app`,
    };
  }

  return {
    success: true,
    message: `Successfully installed app from ${appPath}`,
  };
}

/**
 * Uninstall an app from a simulator
 */
export async function uninstallApp(
  udid: string,
  bundleId: string
): Promise<SimulatorResult> {
  const result = await executeCommand(
    "xcrun",
    ["simctl", "uninstall", udid, bundleId],
    { timeout: 30000 }
  );

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: "",
      error: result.stderr || `Failed to uninstall app`,
    };
  }

  return {
    success: true,
    message: `Successfully uninstalled ${bundleId}`,
  };
}

/**
 * Check if an app is installed on the simulator
 */
export async function isAppInstalled(
  udid: string,
  bundleId: string
): Promise<boolean> {
  const result = await executeCommand(
    "xcrun",
    ["simctl", "get_app_container", udid, bundleId],
    { timeout: 10000 }
  );
  return result.exitCode === 0;
}

/**
 * Launch an app on a simulator
 */
export async function launchApp(
  udid: string,
  bundleId: string,
  args?: string[]
): Promise<AppLaunchResult> {
  // First check if the app is installed
  const installed = await isAppInstalled(udid, bundleId);
  if (!installed) {
    return {
      success: false,
      message: "",
      error:
        `App "${bundleId}" is not installed on this simulator.\n` +
        "Possible solutions:\n" +
        "1. Use dev_run to build, install, and launch the app\n" +
        "2. Check that the bundle ID is correct\n" +
        "3. Install the app first using simulator_install_app",
    };
  }

  const launchArgs = ["simctl", "launch", udid, bundleId];
  if (args && args.length > 0) {
    launchArgs.push(...args);
  }

  const result = await executeCommand("xcrun", launchArgs, { timeout: 30000 });

  if (result.exitCode !== 0) {
    // Provide more specific error messages based on error type
    const errorMsg = result.stderr || "";

    if (errorMsg.includes("FBSOpenApplicationServiceErrorDomain") && errorMsg.includes("code=4")) {
      return {
        success: false,
        message: "",
        error:
          `Failed to launch "${bundleId}": The app binary could not be found.\n` +
          "This usually means the app was installed but the executable is missing.\n" +
          "Try reinstalling the app using dev_run or simulator_install_app.",
      };
    }

    return {
      success: false,
      message: "",
      error: errorMsg || `Failed to launch app`,
    };
  }

  // Parse PID from output (format: "com.example.app: 12345")
  const pidMatch = result.stdout.match(/:\s*(\d+)/);
  const pid = pidMatch ? parseInt(pidMatch[1], 10) : undefined;

  return {
    success: true,
    message: `Successfully launched ${bundleId}`,
    pid,
  };
}

/**
 * Terminate an app on a simulator
 */
export async function terminateApp(
  udid: string,
  bundleId: string
): Promise<SimulatorResult> {
  const result = await executeCommand(
    "xcrun",
    ["simctl", "terminate", udid, bundleId],
    { timeout: 10000 }
  );

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: "",
      error: result.stderr || `Failed to terminate app`,
    };
  }

  return {
    success: true,
    message: `Successfully terminated ${bundleId}`,
  };
}

/**
 * Take a screenshot of a simulator
 */
export async function takeScreenshot(
  udid: string,
  outputPath?: string
): Promise<ScreenshotResult> {
  // Generate default path if not provided
  const finalPath =
    outputPath ||
    join(tmpdir(), `ios-screenshot-${randomBytes(4).toString("hex")}.png`);

  // Ensure directory exists
  await ensureDir(dirname(finalPath));

  const result = await executeCommand(
    "xcrun",
    ["simctl", "io", udid, "screenshot", finalPath],
    { timeout: 10000 }
  );

  if (result.exitCode !== 0) {
    return {
      success: false,
      error: result.stderr || `Failed to take screenshot`,
    };
  }

  return {
    success: true,
    path: finalPath,
  };
}

/**
 * Get app container path for an installed app
 */
export async function getAppContainer(
  udid: string,
  bundleId: string,
  containerType: "app" | "data" | "groups" = "app"
): Promise<{ success: boolean; path?: string; error?: string }> {
  const result = await executeCommand(
    "xcrun",
    ["simctl", "get_app_container", udid, bundleId, containerType],
    { timeout: 10000 }
  );

  if (result.exitCode !== 0) {
    return {
      success: false,
      error: result.stderr || `Failed to get app container`,
    };
  }

  return {
    success: true,
    path: result.stdout.trim(),
  };
}

/**
 * Open a URL in the simulator
 */
export async function openUrl(udid: string, url: string): Promise<SimulatorResult> {
  const result = await executeCommand("xcrun", ["simctl", "openurl", udid, url], {
    timeout: 10000,
  });

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: "",
      error: result.stderr || `Failed to open URL`,
    };
  }

  return {
    success: true,
    message: `Opened URL: ${url}`,
  };
}

/**
 * Push a notification to the simulator
 */
export async function pushNotification(
  udid: string,
  bundleId: string,
  payload: object
): Promise<SimulatorResult> {
  // Create a temporary file with the payload
  const { createTempFile } = await import("../utils/tempfile.js");
  const tempFile = await createTempFile(JSON.stringify(payload), ".json");

  try {
    const result = await executeCommand(
      "xcrun",
      ["simctl", "push", udid, bundleId, tempFile.path],
      { timeout: 10000 }
    );

    if (result.exitCode !== 0) {
      return {
        success: false,
        message: "",
        error: result.stderr || `Failed to push notification`,
      };
    }

    return {
      success: true,
      message: `Pushed notification to ${bundleId}`,
    };
  } finally {
    await tempFile.cleanup();
  }
}

/**
 * Add media (photos, videos) to the simulator
 */
export async function addMedia(udid: string, mediaPath: string): Promise<SimulatorResult> {
  const result = await executeCommand(
    "xcrun",
    ["simctl", "addmedia", udid, mediaPath],
    { timeout: 30000 }
  );

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: "",
      error: result.stderr || `Failed to add media`,
    };
  }

  return {
    success: true,
    message: `Added media: ${mediaPath}`,
  };
}

/**
 * Set simulator status bar overrides
 */
export async function setStatusBar(
  udid: string,
  options: {
    time?: string;
    batteryLevel?: number;
    batteryState?: "charging" | "charged" | "discharging";
    cellularMode?: "notSupported" | "searching" | "failed" | "active";
    cellularBars?: number;
    wifiBars?: number;
  }
): Promise<SimulatorResult> {
  const args = ["simctl", "status_bar", udid, "override"];

  if (options.time) args.push("--time", options.time);
  if (options.batteryLevel !== undefined)
    args.push("--batteryLevel", options.batteryLevel.toString());
  if (options.batteryState) args.push("--batteryState", options.batteryState);
  if (options.cellularMode) args.push("--cellularMode", options.cellularMode);
  if (options.cellularBars !== undefined)
    args.push("--cellularBars", options.cellularBars.toString());
  if (options.wifiBars !== undefined)
    args.push("--wifiBars", options.wifiBars.toString());

  const result = await executeCommand("xcrun", args, { timeout: 10000 });

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: "",
      error: result.stderr || `Failed to set status bar`,
    };
  }

  return {
    success: true,
    message: "Status bar updated",
  };
}

/**
 * Clear status bar overrides
 */
export async function clearStatusBar(udid: string): Promise<SimulatorResult> {
  const result = await executeCommand(
    "xcrun",
    ["simctl", "status_bar", udid, "clear"],
    { timeout: 10000 }
  );

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: "",
      error: result.stderr || `Failed to clear status bar`,
    };
  }

  return {
    success: true,
    message: "Status bar cleared",
  };
}

/**
 * Get simulator logs (spawns a log stream process)
 */
export async function getLogs(
  udid: string,
  options: {
    bundleId?: string;
    predicate?: string;
    timeout?: number;
  } = {}
): Promise<{ success: boolean; logs: string; error?: string }> {
  const { bundleId, predicate, timeout = 5000 } = options;

  let predicateArg = predicate;
  if (!predicateArg && bundleId) {
    predicateArg = `processImagePath contains "${bundleId}"`;
  }

  const args = ["simctl", "spawn", udid, "log", "show", "--last", "1m"];
  if (predicateArg) {
    args.push("--predicate", predicateArg);
  }

  const result = await executeCommand("xcrun", args, { timeout });

  if (result.exitCode !== 0 && !result.stdout) {
    return {
      success: false,
      logs: "",
      error: result.stderr || `Failed to get logs`,
    };
  }

  return {
    success: true,
    logs: result.stdout,
  };
}

/**
 * List installed apps on a simulator
 */
export interface InstalledApp {
  bundleId: string;
  name: string;
  version: string;
  path: string;
  applicationType: "User" | "System";
}

export interface ListAppsResult {
  success: boolean;
  apps?: InstalledApp[];
  userApps?: InstalledApp[];
  systemApps?: InstalledApp[];
  error?: string;
}

export async function listApps(
  udid: string,
  options: { includeSystem?: boolean } = {}
): Promise<ListAppsResult> {
  const { includeSystem = false } = options;

  const result = await executeCommand(
    "xcrun",
    ["simctl", "listapps", udid],
    { timeout: 30000 }
  );

  if (result.exitCode !== 0) {
    return {
      success: false,
      error: result.stderr || `Failed to list apps`,
    };
  }

  try {
    // The output is in plist format, convert to JSON
    const convertResult = await executeCommand(
      "plutil",
      ["-convert", "json", "-o", "-", "--", "-"],
      { timeout: 10000, input: result.stdout }
    );

    if (convertResult.exitCode !== 0) {
      // Fallback: try to parse the plist directly
      return parseAppsFromPlist(result.stdout, includeSystem);
    }

    const appsData = JSON.parse(convertResult.stdout);
    const apps: InstalledApp[] = [];

    for (const [bundleId, appInfo] of Object.entries(appsData)) {
      const info = appInfo as Record<string, unknown>;
      const applicationType = (info.ApplicationType as string) || "User";

      // Skip system apps if not requested
      if (!includeSystem && applicationType === "System") {
        continue;
      }

      apps.push({
        bundleId,
        name: (info.CFBundleDisplayName as string) ||
              (info.CFBundleName as string) ||
              bundleId,
        version: (info.CFBundleShortVersionString as string) ||
                 (info.CFBundleVersion as string) ||
                 "Unknown",
        path: (info.Path as string) || "",
        applicationType: applicationType as "User" | "System",
      });
    }

    const userApps = apps.filter(a => a.applicationType === "User");
    const systemApps = apps.filter(a => a.applicationType === "System");

    return {
      success: true,
      apps,
      userApps,
      systemApps,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse apps list: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Fallback parser for plist format when plutil conversion fails
 */
function parseAppsFromPlist(
  plistOutput: string,
  includeSystem: boolean
): ListAppsResult {
  const apps: InstalledApp[] = [];

  // Simple regex-based extraction for common patterns
  const bundleIdMatches = plistOutput.matchAll(/"([^"]+)" = \{/g);

  for (const match of bundleIdMatches) {
    const bundleId = match[1];
    if (!bundleId || bundleId.startsWith("{")) continue;

    // Try to find if it's a system app
    const isSystem = bundleId.startsWith("com.apple.");

    if (!includeSystem && isSystem) continue;

    apps.push({
      bundleId,
      name: bundleId.split(".").pop() || bundleId,
      version: "Unknown",
      path: "",
      applicationType: isSystem ? "System" : "User",
    });
  }

  return {
    success: true,
    apps,
    userApps: apps.filter(a => a.applicationType === "User"),
    systemApps: apps.filter(a => a.applicationType === "System"),
  };
}

/**
 * Check if simctl is available
 */
export async function isSimctlAvailable(): Promise<boolean> {
  try {
    const result = await executeCommand("xcrun", ["simctl", "help"], { timeout: 5000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
