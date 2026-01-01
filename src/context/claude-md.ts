/**
 * CLAUDE.md Integration
 * Generates and manages iOS-specific context files for Claude Code
 */

import * as fs from "fs/promises";
import * as path from "path";
import { listSchemes, getBuildSettings } from "../xcode/builder.js";

export interface ProjectContext {
  projectPath: string;
  projectName: string;
  projectType: "workspace" | "project";
  schemes: string[];
  targets: string[];
  configurations: string[];
  bundleId?: string;
  deploymentTarget?: string;
  swiftVersion?: string;
  dependencies?: string[];
  testTargets?: string[];
}

export interface ClaudeMdOptions {
  projectPath: string;
  outputPath?: string;
  includeStructure?: boolean;
  includeDependencies?: boolean;
}

/**
 * Analyze an iOS project and extract context
 */
export async function analyzeProject(
  projectPath: string
): Promise<ProjectContext> {
  const schemesResult = await listSchemes(projectPath);

  if (!schemesResult.success) {
    throw new Error(`Failed to analyze project: ${schemesResult.error}`);
  }

  const projectName = path.basename(projectPath).replace(/\.(xcodeproj|xcworkspace)$/, "");
  const projectType = projectPath.endsWith(".xcworkspace") ? "workspace" : "project";

  // Get build settings for the first scheme to extract more info
  let bundleId: string | undefined;
  let deploymentTarget: string | undefined;
  let swiftVersion: string | undefined;

  if (schemesResult.schemes && schemesResult.schemes.length > 0) {
    const settingsResult = await getBuildSettings(projectPath, schemesResult.schemes[0]);
    if (settingsResult.success && settingsResult.settings) {
      bundleId = settingsResult.settings["PRODUCT_BUNDLE_IDENTIFIER"];
      deploymentTarget = settingsResult.settings["IPHONEOS_DEPLOYMENT_TARGET"];
      swiftVersion = settingsResult.settings["SWIFT_VERSION"];
    }
  }

  // Identify test targets
  const testTargets = (schemesResult.targets || []).filter(
    (t) => t.includes("Test") || t.includes("Tests")
  );

  return {
    projectPath,
    projectName,
    projectType,
    schemes: schemesResult.schemes || [],
    targets: schemesResult.targets || [],
    configurations: schemesResult.configurations || [],
    bundleId,
    deploymentTarget,
    swiftVersion,
    testTargets,
  };
}

/**
 * Scan for Swift Package Manager dependencies
 */
async function scanDependencies(projectDir: string): Promise<string[]> {
  const dependencies: string[] = [];

  // Check Package.swift
  const packagePath = path.join(projectDir, "Package.swift");
  try {
    const content = await fs.readFile(packagePath, "utf-8");
    const urlMatches = content.match(/url:\s*"([^"]+)"/g) || [];
    for (const match of urlMatches) {
      const url = match.match(/url:\s*"([^"]+)"/)?.[1];
      if (url) {
        const name = url.split("/").pop()?.replace(".git", "") || url;
        dependencies.push(name);
      }
    }
  } catch {
    // No Package.swift
  }

  // Check for Podfile
  const podfilePath = path.join(projectDir, "Podfile");
  try {
    const content = await fs.readFile(podfilePath, "utf-8");
    const podMatches = content.match(/pod\s+['"]([^'"]+)['"]/g) || [];
    for (const match of podMatches) {
      const name = match.match(/pod\s+['"]([^'"]+)['"]/)?.[1];
      if (name) {
        dependencies.push(name);
      }
    }
  } catch {
    // No Podfile
  }

  return [...new Set(dependencies)];
}

/**
 * Scan project structure
 */
async function scanStructure(projectDir: string): Promise<string[]> {
  const structure: string[] = [];
  const importantDirs = ["Sources", "Source", "src", "App", "Views", "Models", "ViewModels", "Services", "Networking", "Utils", "Helpers", "Extensions", "Tests", "UITests"];

  for (const dir of importantDirs) {
    const dirPath = path.join(projectDir, dir);
    try {
      await fs.access(dirPath);
      structure.push(dir);
    } catch {
      // Dir doesn't exist
    }
  }

  // Also check for common files
  const importantFiles = ["AppDelegate.swift", "SceneDelegate.swift", "ContentView.swift", "App.swift"];
  for (const file of importantFiles) {
    try {
      // Search in common locations
      const locations = [projectDir, path.join(projectDir, path.basename(projectDir).replace(/\.(xcodeproj|xcworkspace)$/, ""))];
      for (const loc of locations) {
        try {
          await fs.access(path.join(loc, file));
          structure.push(file);
          break;
        } catch {
          // Not in this location
        }
      }
    } catch {
      // File doesn't exist
    }
  }

  return structure;
}

/**
 * Generate CLAUDE.md content for an iOS project
 */
export async function generateClaudeMd(
  options: ClaudeMdOptions
): Promise<string> {
  const { projectPath, includeStructure = true, includeDependencies = true } = options;

  const context = await analyzeProject(projectPath);
  const projectDir = path.dirname(projectPath);

  let content = `# ${context.projectName}

## Project Overview

This is an iOS ${context.projectType === "workspace" ? "workspace" : "project"} built with Swift.

## Build Configuration

- **Project Type**: ${context.projectType}
- **Main Scheme**: ${context.schemes[0] || "Unknown"}
- **Bundle ID**: ${context.bundleId || "Unknown"}
- **Deployment Target**: iOS ${context.deploymentTarget || "Unknown"}
- **Swift Version**: ${context.swiftVersion || "Unknown"}

## Available Schemes

${context.schemes.map((s) => `- ${s}`).join("\n")}

## Build Configurations

${context.configurations.map((c) => `- ${c}`).join("\n")}

## Targets

${context.targets.map((t) => `- ${t}${context.testTargets?.includes(t) ? " (Tests)" : ""}`).join("\n")}
`;

  if (includeDependencies) {
    const deps = await scanDependencies(projectDir);
    if (deps.length > 0) {
      content += `
## Dependencies

${deps.map((d) => `- ${d}`).join("\n")}
`;
    }
  }

  if (includeStructure) {
    const structure = await scanStructure(projectDir);
    if (structure.length > 0) {
      content += `
## Project Structure

${structure.map((s) => `- ${s}`).join("\n")}
`;
    }
  }

  content += `
## Development Commands

### Build & Run
\`\`\`
# Start iterative development session
"Start a dev session for ${projectPath}"

# Build and run
"Build and run my app"

# Quick rebuild
"Rebuild and show me the result"
\`\`\`

### Testing
\`\`\`
# Run all tests
"Run tests for ${context.schemes[0] || "MyApp"} scheme"

# Run specific test class
"Run LoginTests"

# Get coverage report
"Show code coverage"
\`\`\`

### Debugging
\`\`\`
# Check simulator logs
"Show me the app logs"

# Take screenshot
"Take a screenshot"

# Check for crashes
"Are there any crashes in the logs?"
\`\`\`

## Architecture Notes

<!-- Add notes about your app's architecture here -->
<!-- e.g., MVVM, Clean Architecture, etc. -->

## Common Tasks

<!-- Add project-specific commands and workflows here -->
`;

  return content;
}

/**
 * Write CLAUDE.md to a project directory
 */
export async function writeClaudeMd(
  options: ClaudeMdOptions
): Promise<{ success: boolean; path: string; error?: string }> {
  try {
    const content = await generateClaudeMd(options);
    const outputPath = options.outputPath || path.join(path.dirname(options.projectPath), "CLAUDE.md");

    await fs.writeFile(outputPath, content, "utf-8");

    return { success: true, path: outputPath };
  } catch (error) {
    return {
      success: false,
      path: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Read existing CLAUDE.md if it exists
 */
export async function readClaudeMd(
  projectPath: string
): Promise<{ exists: boolean; content?: string; path?: string }> {
  const claudeMdPath = path.join(path.dirname(projectPath), "CLAUDE.md");

  try {
    const content = await fs.readFile(claudeMdPath, "utf-8");
    return { exists: true, content, path: claudeMdPath };
  } catch {
    return { exists: false };
  }
}
