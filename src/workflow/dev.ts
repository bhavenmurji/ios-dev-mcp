/**
 * Development Workflow Module
 * Provides iterative development experience similar to Replit
 * Combines build → install → launch → screenshot into seamless workflows
 */

import { join, basename, dirname } from "path";
import { readdir, stat } from "fs/promises";
import {
  listSchemes,
  build,
  getBuildSettings,
  detectProjectType,
} from "../xcode/builder.js";
import {
  listSimulators,
  findSimulator,
  bootSimulator,
  getBootedSimulator,
  installApp,
  launchApp,
  terminateApp,
  takeScreenshot,
  SimulatorDevice,
} from "../simulator/controller.js";

/**
 * Development session state
 * Tracks the current project, simulator, and app being developed
 */
export interface DevSession {
  projectPath: string;
  projectType: "workspace" | "project";
  scheme: string;
  bundleId: string;
  simulator: {
    udid: string;
    name: string;
  };
  builtProductsDir?: string;
  appPath?: string;
  lastBuildTime?: number;
  lastScreenshotPath?: string;
}

// Global session state (persists across tool calls)
let currentSession: DevSession | null = null;

/**
 * Get the current development session
 */
export function getSession(): DevSession | null {
  return currentSession;
}

/**
 * Clear the current session
 */
export function clearSession(): void {
  currentSession = null;
}

export interface DevRunResult {
  success: boolean;
  session?: DevSession;
  buildOutput?: string;
  buildTime?: number;
  screenshotPath?: string;
  error?: string;
  steps: Array<{
    step: string;
    success: boolean;
    message: string;
    duration?: number;
  }>;
}

/**
 * Find .app bundle in build products directory
 */
async function findAppBundle(buildDir: string): Promise<string | null> {
  try {
    const entries = await readdir(buildDir);
    for (const entry of entries) {
      if (entry.endsWith(".app")) {
        return join(buildDir, entry);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Initialize or update a development session
 */
export async function startSession(options: {
  projectPath: string;
  scheme?: string;
  simulatorName?: string;
  simulatorUdid?: string;
}): Promise<DevRunResult> {
  const steps: DevRunResult["steps"] = [];
  const startTime = Date.now();

  try {
    // Step 1: Validate project
    const projectType = await detectProjectType(options.projectPath);
    if (!projectType) {
      return {
        success: false,
        error: `Invalid project path: ${options.projectPath}`,
        steps: [
          {
            step: "Validate project",
            success: false,
            message: `Path must be a .xcodeproj or .xcworkspace`,
          },
        ],
      };
    }

    steps.push({
      step: "Validate project",
      success: true,
      message: `Found ${projectType}: ${basename(options.projectPath)}`,
    });

    // Step 2: Get or detect scheme
    let scheme = options.scheme;
    if (!scheme) {
      const schemeResult = await listSchemes(options.projectPath);
      if (!schemeResult.success || schemeResult.schemes.length === 0) {
        return {
          success: false,
          error: "No schemes found in project",
          steps: [
            ...steps,
            {
              step: "Detect scheme",
              success: false,
              message: schemeResult.error || "No schemes available",
            },
          ],
        };
      }
      // Use first scheme (usually the main app)
      scheme = schemeResult.schemes[0];
    }

    steps.push({
      step: "Detect scheme",
      success: true,
      message: `Using scheme: ${scheme}`,
    });

    // Step 3: Get build settings to find bundle ID
    const settingsResult = await getBuildSettings(options.projectPath, scheme);
    let bundleId = "unknown";
    let builtProductsDir = "";

    if (settingsResult.success) {
      bundleId =
        settingsResult.settings["PRODUCT_BUNDLE_IDENTIFIER"] || "unknown";
      builtProductsDir = settingsResult.settings["BUILT_PRODUCTS_DIR"] || "";
    }

    steps.push({
      step: "Get build settings",
      success: true,
      message: `Bundle ID: ${bundleId}`,
    });

    // Step 4: Find or boot simulator
    let simulator: SimulatorDevice | null = null;

    if (options.simulatorUdid) {
      const list = await listSimulators();
      simulator =
        list.devices.find((d) => d.udid === options.simulatorUdid) || null;
    } else if (options.simulatorName) {
      simulator = await findSimulator(options.simulatorName);
    } else {
      // Try to use currently booted simulator, or find iPhone 15 Pro
      simulator = await getBootedSimulator();
      if (!simulator) {
        simulator = await findSimulator("iPhone 15 Pro");
        if (!simulator) {
          // Fall back to any available iPhone
          const list = await listSimulators();
          simulator =
            list.devices.find(
              (d) => d.isAvailable && d.name.includes("iPhone")
            ) || null;
        }
      }
    }

    if (!simulator) {
      return {
        success: false,
        error: "No suitable simulator found",
        steps: [
          ...steps,
          {
            step: "Find simulator",
            success: false,
            message: "Could not find an available iOS simulator",
          },
        ],
      };
    }

    // Boot if not already booted
    if (simulator.state !== "Booted") {
      const bootResult = await bootSimulator(simulator.udid);
      if (!bootResult.success) {
        return {
          success: false,
          error: `Failed to boot simulator: ${bootResult.error}`,
          steps: [
            ...steps,
            {
              step: "Boot simulator",
              success: false,
              message: bootResult.error || "Boot failed",
            },
          ],
        };
      }
    }

    steps.push({
      step: "Prepare simulator",
      success: true,
      message: `${simulator.name} (${simulator.state === "Booted" ? "already booted" : "booted"})`,
    });

    // Create session
    currentSession = {
      projectPath: options.projectPath,
      projectType,
      scheme,
      bundleId,
      simulator: {
        udid: simulator.udid,
        name: simulator.name,
      },
      builtProductsDir,
    };

    return {
      success: true,
      session: currentSession,
      steps,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      steps,
    };
  }
}

/**
 * Full development workflow: build → install → launch → screenshot
 * This is the main "run" command for iterative development
 */
export async function devRun(options?: {
  clean?: boolean;
  screenshotPath?: string;
}): Promise<DevRunResult> {
  const steps: DevRunResult["steps"] = [];

  if (!currentSession) {
    return {
      success: false,
      error:
        "No active development session. Use dev_session_start first to initialize a session.",
      steps: [],
    };
  }

  const session = currentSession;
  const buildStartTime = Date.now();

  try {
    // Step 1: Build the project
    steps.push({
      step: "Building",
      success: true,
      message: `Building ${session.scheme}...`,
    });

    const buildResult = await build(session.projectPath, {
      scheme: session.scheme,
      configuration: "Debug",
      sdk: "iphonesimulator",
      destination: `platform=iOS Simulator,id=${session.simulator.udid}`,
      clean: options?.clean,
    });

    const buildDuration = Date.now() - buildStartTime;

    if (!buildResult.success) {
      // Extract key errors for display
      const keyErrors = buildResult.errors.slice(0, 5);
      return {
        success: false,
        error: "Build failed",
        buildOutput: buildResult.output,
        steps: [
          ...steps,
          {
            step: "Build",
            success: false,
            message:
              keyErrors.length > 0 ? keyErrors.join("\n") : buildResult.error!,
            duration: buildDuration,
          },
        ],
      };
    }

    steps.push({
      step: "Build",
      success: true,
      message: `Build succeeded${buildResult.warnings.length > 0 ? ` (${buildResult.warnings.length} warnings)` : ""}`,
      duration: buildDuration,
    });

    // Update built products dir from build settings
    const settingsResult = await getBuildSettings(
      session.projectPath,
      session.scheme
    );
    if (settingsResult.success) {
      session.builtProductsDir = settingsResult.settings["BUILT_PRODUCTS_DIR"];
      session.bundleId =
        settingsResult.settings["PRODUCT_BUNDLE_IDENTIFIER"] || session.bundleId;
    }

    // Step 2: Find the .app bundle
    let appPath: string | null = null;
    if (session.builtProductsDir) {
      appPath = await findAppBundle(session.builtProductsDir);
    }

    if (!appPath) {
      return {
        success: false,
        error: "Could not find built .app bundle",
        steps: [
          ...steps,
          {
            step: "Find app",
            success: false,
            message: `No .app found in ${session.builtProductsDir}`,
          },
        ],
      };
    }

    session.appPath = appPath;
    steps.push({
      step: "Find app",
      success: true,
      message: basename(appPath),
    });

    // Step 3: Terminate any existing instance
    await terminateApp(session.simulator.udid, session.bundleId);

    // Step 4: Install the app
    const installResult = await installApp(session.simulator.udid, appPath);
    if (!installResult.success) {
      return {
        success: false,
        error: `Install failed: ${installResult.error}`,
        steps: [
          ...steps,
          {
            step: "Install",
            success: false,
            message: installResult.error || "Installation failed",
          },
        ],
      };
    }

    steps.push({
      step: "Install",
      success: true,
      message: "App installed",
    });

    // Step 5: Launch the app
    const launchResult = await launchApp(
      session.simulator.udid,
      session.bundleId
    );
    if (!launchResult.success) {
      return {
        success: false,
        error: `Launch failed: ${launchResult.error}`,
        steps: [
          ...steps,
          {
            step: "Launch",
            success: false,
            message: launchResult.error || "Launch failed",
          },
        ],
      };
    }

    steps.push({
      step: "Launch",
      success: true,
      message: `Running (PID: ${launchResult.pid})`,
    });

    // Step 6: Wait briefly for app to render, then take screenshot
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const screenshotResult = await takeScreenshot(
      session.simulator.udid,
      options?.screenshotPath
    );

    if (screenshotResult.success) {
      session.lastScreenshotPath = screenshotResult.path;
      steps.push({
        step: "Screenshot",
        success: true,
        message: screenshotResult.path!,
      });
    } else {
      steps.push({
        step: "Screenshot",
        success: false,
        message: screenshotResult.error || "Screenshot failed",
      });
    }

    session.lastBuildTime = buildDuration;

    return {
      success: true,
      session,
      buildTime: buildDuration,
      screenshotPath: screenshotResult.path,
      steps,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      steps,
    };
  }
}

/**
 * Quick restart: terminate → rebuild → reinstall → relaunch → screenshot
 * Faster iteration for small changes
 */
export async function devRestart(options?: {
  screenshotPath?: string;
}): Promise<DevRunResult> {
  // devRestart is essentially devRun without clean build
  return devRun({ clean: false, screenshotPath: options?.screenshotPath });
}

/**
 * Just take a screenshot of the current state
 */
export async function devPreview(options?: {
  outputPath?: string;
}): Promise<{ success: boolean; path?: string; error?: string }> {
  if (!currentSession) {
    return {
      success: false,
      error: "No active development session",
    };
  }

  const result = await takeScreenshot(
    currentSession.simulator.udid,
    options?.outputPath
  );

  if (result.success) {
    currentSession.lastScreenshotPath = result.path;
  }

  return result;
}

/**
 * Get formatted session info
 */
export function getSessionInfo(): string {
  if (!currentSession) {
    return "No active development session.\n\nUse dev_session_start to initialize a session with your Xcode project.";
  }

  const s = currentSession;
  return [
    "=== Development Session ===",
    "",
    `Project: ${basename(s.projectPath)}`,
    `Type: ${s.projectType}`,
    `Scheme: ${s.scheme}`,
    `Bundle ID: ${s.bundleId}`,
    "",
    `Simulator: ${s.simulator.name}`,
    `UDID: ${s.simulator.udid}`,
    "",
    s.appPath ? `App: ${basename(s.appPath)}` : "App: (not built yet)",
    s.lastBuildTime ? `Last build: ${(s.lastBuildTime / 1000).toFixed(2)}s` : "",
    s.lastScreenshotPath ? `Last screenshot: ${s.lastScreenshotPath}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
