/**
 * Xcode Build Tools
 * Handles building Xcode projects and workspaces
 */

import { executeCommand } from "../utils/process.js";
import { stat } from "fs/promises";
import { basename } from "path";

export interface XcodeScheme {
  name: string;
  workspace?: string;
  project?: string;
}

export interface XcodeBuildResult {
  success: boolean;
  output: string;
  error?: string;
  warnings: string[];
  errors: string[];
  buildTime: number;
  derivedDataPath?: string;
}

export interface XcodeBuildSettings {
  [key: string]: string;
}

export interface ListSchemesResult {
  success: boolean;
  schemes: string[];
  configurations: string[];
  targets: string[];
  error?: string;
}

export interface BuildOptions {
  scheme: string;
  configuration?: string; // Debug or Release
  sdk?: string; // iphonesimulator, iphoneos, etc.
  destination?: string;
  derivedDataPath?: string;
  clean?: boolean;
  timeout?: number;
}

const DEFAULT_BUILD_TIMEOUT = 600000; // 10 minutes

/**
 * Detect if path is a workspace or project
 */
export async function detectProjectType(
  path: string
): Promise<"workspace" | "project" | null> {
  try {
    const stats = await stat(path);
    if (!stats.isDirectory()) {
      return null;
    }

    if (path.endsWith(".xcworkspace")) {
      return "workspace";
    } else if (path.endsWith(".xcodeproj")) {
      return "project";
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * List available schemes in a project or workspace
 */
export async function listSchemes(projectPath: string): Promise<ListSchemesResult> {
  const projectType = await detectProjectType(projectPath);

  if (!projectType) {
    return {
      success: false,
      schemes: [],
      configurations: [],
      targets: [],
      error: `Invalid path: ${projectPath}. Must be a .xcodeproj or .xcworkspace`,
    };
  }

  const args =
    projectType === "workspace"
      ? ["-workspace", projectPath, "-list"]
      : ["-project", projectPath, "-list"];

  const result = await executeCommand("xcodebuild", args, { timeout: 30000 });

  if (result.exitCode !== 0) {
    return {
      success: false,
      schemes: [],
      configurations: [],
      targets: [],
      error: result.stderr || `xcodebuild exited with code ${result.exitCode}`,
    };
  }

  // Parse the output to extract schemes, configurations, and targets
  const output = result.stdout;
  const schemes: string[] = [];
  const configurations: string[] = [];
  const targets: string[] = [];

  let currentSection: "schemes" | "configurations" | "targets" | null = null;

  for (const line of output.split("\n")) {
    const trimmed = line.trim();

    if (trimmed === "Schemes:") {
      currentSection = "schemes";
    } else if (trimmed === "Build Configurations:") {
      currentSection = "configurations";
    } else if (trimmed === "Targets:") {
      currentSection = "targets";
    } else if (trimmed && currentSection) {
      switch (currentSection) {
        case "schemes":
          schemes.push(trimmed);
          break;
        case "configurations":
          configurations.push(trimmed);
          break;
        case "targets":
          targets.push(trimmed);
          break;
      }
    } else if (trimmed === "" || trimmed.includes(":")) {
      // Empty line or new section header ends current section
      if (trimmed.includes(":") && !["Schemes:", "Build Configurations:", "Targets:"].includes(trimmed)) {
        currentSection = null;
      }
    }
  }

  return {
    success: true,
    schemes,
    configurations,
    targets,
  };
}

/**
 * Build an Xcode project or workspace
 */
export async function build(
  projectPath: string,
  options: BuildOptions
): Promise<XcodeBuildResult> {
  const startTime = Date.now();
  const projectType = await detectProjectType(projectPath);

  if (!projectType) {
    return {
      success: false,
      output: "",
      error: `Invalid path: ${projectPath}. Must be a .xcodeproj or .xcworkspace`,
      warnings: [],
      errors: [`Invalid project path: ${projectPath}`],
      buildTime: 0,
    };
  }

  const {
    scheme,
    configuration = "Debug",
    sdk = "iphonesimulator",
    destination,
    derivedDataPath,
    clean = false,
    timeout = DEFAULT_BUILD_TIMEOUT,
  } = options;

  const args: string[] = [];

  // Add project or workspace
  if (projectType === "workspace") {
    args.push("-workspace", projectPath);
  } else {
    args.push("-project", projectPath);
  }

  // Add scheme and configuration
  args.push("-scheme", scheme);
  args.push("-configuration", configuration);
  args.push("-sdk", sdk);

  // Add destination if specified
  if (destination) {
    args.push("-destination", destination);
  } else {
    // Default to generic iOS Simulator destination
    args.push("-destination", "generic/platform=iOS Simulator");
  }

  // Add derived data path if specified
  if (derivedDataPath) {
    args.push("-derivedDataPath", derivedDataPath);
  }

  // Add clean action if requested
  if (clean) {
    args.push("clean");
  }

  // Add build action
  args.push("build");

  // Add CODE_SIGNING_ALLOWED=NO for simulator builds to avoid signing issues
  if (sdk.includes("simulator")) {
    args.push("CODE_SIGNING_ALLOWED=NO");
  }

  const result = await executeCommand("xcodebuild", args, { timeout });

  const buildTime = Date.now() - startTime;

  // Parse warnings and errors from output
  const warnings: string[] = [];
  const errors: string[] = [];

  const combinedOutput = result.stdout + "\n" + result.stderr;
  for (const line of combinedOutput.split("\n")) {
    if (line.includes(": warning:") || line.includes("⚠️")) {
      warnings.push(line.trim());
    }
    if (line.includes(": error:") || line.includes("❌")) {
      errors.push(line.trim());
    }
  }

  if (result.timedOut) {
    return {
      success: false,
      output: result.stdout,
      error: `Build timed out after ${timeout / 1000} seconds`,
      warnings,
      errors,
      buildTime,
    };
  }

  if (result.exitCode !== 0) {
    return {
      success: false,
      output: result.stdout,
      error: result.stderr || `xcodebuild exited with code ${result.exitCode}`,
      warnings,
      errors,
      buildTime,
    };
  }

  return {
    success: true,
    output: result.stdout,
    warnings,
    errors,
    buildTime,
    derivedDataPath,
  };
}

/**
 * Get build settings for a project
 */
export async function getBuildSettings(
  projectPath: string,
  scheme: string,
  options?: {
    sdk?: string;
    destination?: string;
  }
): Promise<{ success: boolean; settings: XcodeBuildSettings; error?: string }> {
  const projectType = await detectProjectType(projectPath);

  if (!projectType) {
    return {
      success: false,
      settings: {},
      error: `Invalid path: ${projectPath}. Must be a .xcodeproj or .xcworkspace`,
    };
  }

  const args: string[] = [];

  if (projectType === "workspace") {
    args.push("-workspace", projectPath);
  } else {
    args.push("-project", projectPath);
  }

  args.push("-scheme", scheme);

  // Add SDK if specified (important for getting correct BUILT_PRODUCTS_DIR)
  if (options?.sdk) {
    args.push("-sdk", options.sdk);
  }

  // Add destination if specified
  if (options?.destination) {
    args.push("-destination", options.destination);
  }

  args.push("-showBuildSettings");

  const result = await executeCommand("xcodebuild", args, { timeout: 30000 });

  if (result.exitCode !== 0) {
    return {
      success: false,
      settings: {},
      error: result.stderr || `xcodebuild exited with code ${result.exitCode}`,
    };
  }

  // Parse build settings
  const settings: XcodeBuildSettings = {};
  for (const line of result.stdout.split("\n")) {
    const match = line.match(/^\s+(\w+)\s*=\s*(.*)$/);
    if (match) {
      settings[match[1]] = match[2].trim();
    }
  }

  return {
    success: true,
    settings,
  };
}

/**
 * Check if xcodebuild is available
 */
export async function isXcodeAvailable(): Promise<boolean> {
  try {
    const result = await executeCommand("xcodebuild", ["-version"], { timeout: 5000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Get Xcode version
 */
export async function getXcodeVersion(): Promise<string | null> {
  try {
    const result = await executeCommand("xcodebuild", ["-version"], { timeout: 5000 });
    if (result.exitCode === 0) {
      return result.stdout.split("\n")[0] || result.stdout;
    }
    return null;
  } catch {
    return null;
  }
}
