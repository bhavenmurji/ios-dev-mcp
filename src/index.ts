#!/usr/bin/env node

/**
 * iOS Development MCP Server
 * Unified server for Swift execution, Xcode building, and iOS Simulator control
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Import tool implementations
import { executeSwift, getSwiftVersion, isSwiftAvailable } from "./swift/executor.js";
import {
  listSchemes,
  build,
  getBuildSettings,
  getXcodeVersion,
  isXcodeAvailable,
} from "./xcode/builder.js";
import {
  listSimulators,
  findSimulator,
  bootSimulator,
  shutdownSimulator,
  getBootedSimulator,
  installApp,
  uninstallApp,
  launchApp,
  terminateApp,
  takeScreenshot,
  getAppContainer,
  openUrl,
  getLogs,
  isSimctlAvailable,
} from "./simulator/controller.js";

// Import workflow tools
import {
  startSession,
  devRun,
  devRestart,
  devPreview,
  getSession,
  getSessionInfo,
  clearSession,
} from "./workflow/dev.js";

// Import UI automation tools
import {
  tap,
  swipe,
  typeText,
  pressKey,
  pressButton,
  dismissKeyboard,
  scroll,
  longPress,
  doubleTap,
  setAppearance,
  checkUIAutomationAvailable,
} from "./ui/automation.js";

// Import testing tools
import {
  runTests,
  listTests,
  buildForTesting,
  formatTestResults,
  getCoverage,
} from "./xcode/testing.js";

// Import CLAUDE.md integration
import {
  generateClaudeMd,
  writeClaudeMd,
  readClaudeMd,
  analyzeProject,
} from "./context/claude-md.js";

// Import accessibility tools
import {
  getAccessibilityTree,
  findElement,
  getInteractiveElements,
  describeScreen,
} from "./ui/accessibility.js";

// Import error fixer and diagnostics
import {
  parseBuildErrors,
  suggestFixes,
  analyzeErrors,
  recordFixAttempt,
  getSessionStats,
  clearHistory,
} from "./diagnostics/error-fixer.js";

// Import advanced simulator features
import {
  startRecording,
  stopRecording,
  getRecordingStatus,
  sendPushNotification,
  sendSimplePush,
  setNetworkCondition,
  setStatusBar,
  clearStatusBar,
  setLocation,
  setNamedLocation,
  triggerMemoryWarning,
  simulateBiometric,
} from "./simulator/advanced.js";

// Tool definitions
const TOOLS: Tool[] = [
  // Swift execution tool
  {
    name: "swift_execute",
    description:
      "Execute Swift code and return the output. Useful for testing code snippets, algorithms, or learning Swift.",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description: "Swift code to execute",
        },
        timeout: {
          type: "number",
          description: "Execution timeout in milliseconds (default: 30000)",
        },
      },
      required: ["code"],
    },
  },

  // Xcode build tools
  {
    name: "xcode_list_schemes",
    description:
      "List all available schemes, configurations, and targets in an Xcode project or workspace.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectPath: {
          type: "string",
          description: "Path to .xcodeproj or .xcworkspace",
        },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "xcode_build",
    description:
      "Build an Xcode project or workspace. Returns build status, warnings, and errors.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectPath: {
          type: "string",
          description: "Path to .xcodeproj or .xcworkspace",
        },
        scheme: {
          type: "string",
          description: "Xcode scheme to build",
        },
        configuration: {
          type: "string",
          description: "Build configuration",
          enum: ["Debug", "Release"],
        },
        sdk: {
          type: "string",
          description: "SDK to build for (e.g., iphonesimulator, iphoneos)",
        },
        destination: {
          type: "string",
          description: "Build destination (e.g., 'platform=iOS Simulator,name=iPhone 15')",
        },
        clean: {
          type: "boolean",
          description: "Clean before building",
        },
      },
      required: ["projectPath", "scheme"],
    },
  },
  {
    name: "xcode_get_build_settings",
    description: "Get build settings for an Xcode project scheme.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectPath: {
          type: "string",
          description: "Path to .xcodeproj or .xcworkspace",
        },
        scheme: {
          type: "string",
          description: "Xcode scheme",
        },
      },
      required: ["projectPath", "scheme"],
    },
  },

  // Simulator control tools
  {
    name: "simulator_list",
    description:
      "List all available iOS simulators with their states and runtimes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        onlyBooted: {
          type: "boolean",
          description: "Only return booted simulators",
        },
        onlyAvailable: {
          type: "boolean",
          description: "Only return available simulators",
        },
      },
    },
  },
  {
    name: "simulator_boot",
    description:
      "Boot an iOS simulator. Can specify by UDID or by device name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        udid: {
          type: "string",
          description: "Simulator UDID (takes precedence over deviceName)",
        },
        deviceName: {
          type: "string",
          description: "Device name (e.g., 'iPhone 15 Pro')",
        },
        osVersion: {
          type: "string",
          description: "iOS version (e.g., '17.2') - used with deviceName",
        },
      },
    },
  },
  {
    name: "simulator_shutdown",
    description: "Shutdown an iOS simulator.",
    inputSchema: {
      type: "object" as const,
      properties: {
        udid: {
          type: "string",
          description: "Simulator UDID (if not provided, shuts down booted simulator)",
        },
      },
    },
  },
  {
    name: "simulator_install_app",
    description: "Install an app bundle (.app) on an iOS simulator.",
    inputSchema: {
      type: "object" as const,
      properties: {
        appPath: {
          type: "string",
          description: "Path to .app bundle",
        },
        udid: {
          type: "string",
          description: "Simulator UDID (if not provided, uses booted simulator)",
        },
      },
      required: ["appPath"],
    },
  },
  {
    name: "simulator_uninstall_app",
    description: "Uninstall an app from an iOS simulator.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bundleId: {
          type: "string",
          description: "App bundle identifier",
        },
        udid: {
          type: "string",
          description: "Simulator UDID (if not provided, uses booted simulator)",
        },
      },
      required: ["bundleId"],
    },
  },
  {
    name: "simulator_launch_app",
    description: "Launch an installed app on an iOS simulator.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bundleId: {
          type: "string",
          description: "App bundle identifier",
        },
        udid: {
          type: "string",
          description: "Simulator UDID (if not provided, uses booted simulator)",
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "Command-line arguments to pass to the app",
        },
      },
      required: ["bundleId"],
    },
  },
  {
    name: "simulator_terminate_app",
    description: "Terminate a running app on an iOS simulator.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bundleId: {
          type: "string",
          description: "App bundle identifier",
        },
        udid: {
          type: "string",
          description: "Simulator UDID (if not provided, uses booted simulator)",
        },
      },
      required: ["bundleId"],
    },
  },
  {
    name: "simulator_screenshot",
    description: "Take a screenshot of an iOS simulator.",
    inputSchema: {
      type: "object" as const,
      properties: {
        outputPath: {
          type: "string",
          description: "Where to save the screenshot (PNG format)",
        },
        udid: {
          type: "string",
          description: "Simulator UDID (if not provided, uses booted simulator)",
        },
      },
    },
  },
  {
    name: "simulator_open_url",
    description: "Open a URL in an iOS simulator (deep link or web URL).",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "URL to open",
        },
        udid: {
          type: "string",
          description: "Simulator UDID (if not provided, uses booted simulator)",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "simulator_get_app_container",
    description: "Get the container path for an installed app.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bundleId: {
          type: "string",
          description: "App bundle identifier",
        },
        containerType: {
          type: "string",
          description: "Container type",
          enum: ["app", "data", "groups"],
        },
        udid: {
          type: "string",
          description: "Simulator UDID (if not provided, uses booted simulator)",
        },
      },
      required: ["bundleId"],
    },
  },
  {
    name: "simulator_get_logs",
    description: "Get recent logs from an iOS simulator, optionally filtered by app.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bundleId: {
          type: "string",
          description: "Filter logs by app bundle identifier",
        },
        predicate: {
          type: "string",
          description: "Custom predicate for log filtering",
        },
        udid: {
          type: "string",
          description: "Simulator UDID (if not provided, uses booted simulator)",
        },
      },
    },
  },

  // ==========================================
  // WORKFLOW TOOLS - Iterative Development
  // ==========================================

  {
    name: "dev_session_start",
    description:
      "Start a development session for iterative iOS development. This sets up the project, scheme, and simulator for rapid iteration. After starting a session, use dev_run to build and run, or dev_restart for quick rebuilds. RECOMMENDED: Start here before using other dev_ tools.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectPath: {
          type: "string",
          description: "Path to .xcodeproj or .xcworkspace",
        },
        scheme: {
          type: "string",
          description: "Xcode scheme to use (auto-detected if not specified)",
        },
        simulatorName: {
          type: "string",
          description: "Simulator device name (e.g., 'iPhone 15 Pro'). Uses booted simulator or auto-selects if not specified.",
        },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "dev_run",
    description:
      "Build, install, launch, and screenshot the app in one step. This is the main command for iterative development - like pressing 'Run' in Xcode but with automatic screenshots. Requires an active session (use dev_session_start first).",
    inputSchema: {
      type: "object" as const,
      properties: {
        clean: {
          type: "boolean",
          description: "Clean build before building (default: false)",
        },
      },
    },
  },
  {
    name: "dev_restart",
    description:
      "Quick rebuild and relaunch for rapid iteration. Faster than dev_run as it skips clean build. Use after making code changes to see results immediately. Requires an active session.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "dev_preview",
    description:
      "Take a screenshot of the current app state without rebuilding. Useful for checking UI state or capturing specific screens. Requires an active session with a running app.",
    inputSchema: {
      type: "object" as const,
      properties: {
        outputPath: {
          type: "string",
          description: "Custom path to save the screenshot",
        },
      },
    },
  },
  {
    name: "dev_session_info",
    description:
      "Show the current development session details including project, scheme, simulator, and last build info.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "dev_session_end",
    description:
      "End the current development session and clear session state.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },

  // ==========================================
  // UI AUTOMATION TOOLS
  // ==========================================

  {
    name: "ui_tap",
    description:
      "Tap at specific coordinates on the simulator screen. Coordinates are relative to the Simulator window.",
    inputSchema: {
      type: "object" as const,
      properties: {
        x: {
          type: "number",
          description: "X coordinate",
        },
        y: {
          type: "number",
          description: "Y coordinate",
        },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "ui_double_tap",
    description: "Double tap at specific coordinates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        x: {
          type: "number",
          description: "X coordinate",
        },
        y: {
          type: "number",
          description: "Y coordinate",
        },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "ui_long_press",
    description: "Long press at specific coordinates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        x: {
          type: "number",
          description: "X coordinate",
        },
        y: {
          type: "number",
          description: "Y coordinate",
        },
        duration: {
          type: "number",
          description: "Duration in milliseconds (default: 1000)",
        },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "ui_swipe",
    description: "Swipe from one point to another on the simulator.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fromX: {
          type: "number",
          description: "Start X coordinate",
        },
        fromY: {
          type: "number",
          description: "Start Y coordinate",
        },
        toX: {
          type: "number",
          description: "End X coordinate",
        },
        toY: {
          type: "number",
          description: "End Y coordinate",
        },
        duration: {
          type: "number",
          description: "Duration in milliseconds (default: 300)",
        },
      },
      required: ["fromX", "fromY", "toX", "toY"],
    },
  },
  {
    name: "ui_type",
    description:
      "Type text into the currently focused text field in the simulator.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description: "Text to type",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "ui_press_key",
    description:
      "Press a key or key combination (e.g., 'return', 'escape', 'tab').",
    inputSchema: {
      type: "object" as const,
      properties: {
        key: {
          type: "string",
          description: "Key to press (e.g., 'return', 'escape', 'tab', 'delete', 'up', 'down', 'left', 'right')",
        },
        modifiers: {
          type: "array",
          items: {
            type: "string",
            enum: ["command", "control", "option", "shift"],
          },
          description: "Modifier keys to hold",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "ui_press_button",
    description:
      "Press a hardware button on the simulator (home, lock, volume, shake).",
    inputSchema: {
      type: "object" as const,
      properties: {
        button: {
          type: "string",
          enum: ["home", "lock", "volume_up", "volume_down", "shake"],
          description: "Hardware button to press",
        },
      },
      required: ["button"],
    },
  },
  {
    name: "ui_scroll",
    description: "Scroll in a direction.",
    inputSchema: {
      type: "object" as const,
      properties: {
        direction: {
          type: "string",
          enum: ["up", "down", "left", "right"],
          description: "Direction to scroll",
        },
        amount: {
          type: "number",
          description: "Amount to scroll in pixels (default: 100)",
        },
      },
      required: ["direction"],
    },
  },
  {
    name: "ui_dismiss_keyboard",
    description: "Dismiss the on-screen keyboard.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "ui_set_appearance",
    description: "Set the simulator appearance mode (light/dark).",
    inputSchema: {
      type: "object" as const,
      properties: {
        mode: {
          type: "string",
          enum: ["light", "dark"],
          description: "Appearance mode",
        },
      },
      required: ["mode"],
    },
  },

  // ==========================================
  // TESTING TOOLS
  // ==========================================

  {
    name: "xcode_test",
    description:
      "Run XCTest unit tests or UI tests for an Xcode project. Returns test results with pass/fail status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectPath: {
          type: "string",
          description: "Path to .xcodeproj or .xcworkspace",
        },
        scheme: {
          type: "string",
          description: "Xcode scheme containing tests",
        },
        testPlan: {
          type: "string",
          description: "Test plan to use (optional)",
        },
        onlyTesting: {
          type: "array",
          items: { type: "string" },
          description: "Specific tests to run (e.g., ['MyTests/testLogin'])",
        },
        skipTesting: {
          type: "array",
          items: { type: "string" },
          description: "Tests to skip",
        },
      },
      required: ["projectPath", "scheme"],
    },
  },
  {
    name: "xcode_test_list",
    description: "List available tests in an Xcode project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectPath: {
          type: "string",
          description: "Path to .xcodeproj or .xcworkspace",
        },
        scheme: {
          type: "string",
          description: "Xcode scheme",
        },
      },
      required: ["projectPath", "scheme"],
    },
  },
  {
    name: "xcode_coverage",
    description:
      "Get code coverage report from the most recent test run.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectPath: {
          type: "string",
          description: "Path to .xcodeproj or .xcworkspace",
        },
        scheme: {
          type: "string",
          description: "Xcode scheme",
        },
      },
      required: ["projectPath", "scheme"],
    },
  },

  // System info tools
  {
    name: "ios_dev_info",
    description:
      "Get information about available iOS development tools (Swift, Xcode, simctl).",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },

  // ==========================================
  // CLAUDE.MD INTEGRATION
  // ==========================================

  {
    name: "generate_claude_md",
    description:
      "Generate a CLAUDE.md context file for an iOS project. This file helps Claude understand your project structure, build configuration, and common commands.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectPath: {
          type: "string",
          description: "Path to .xcodeproj or .xcworkspace",
        },
        outputPath: {
          type: "string",
          description: "Where to save CLAUDE.md (default: project directory)",
        },
      },
      required: ["projectPath"],
    },
  },

  // ==========================================
  // ACCESSIBILITY INSPECTION
  // ==========================================

  {
    name: "ui_describe_screen",
    description:
      "Describe the current screen's interactive elements (buttons, text fields, etc.). Useful for understanding what can be tapped or interacted with.",
    inputSchema: {
      type: "object" as const,
      properties: {
        udid: {
          type: "string",
          description: "Simulator UDID (optional)",
        },
      },
    },
  },
  {
    name: "ui_find_element",
    description:
      "Find a UI element by label, identifier, or type. Returns its location for tapping.",
    inputSchema: {
      type: "object" as const,
      properties: {
        label: {
          type: "string",
          description: "Element accessibility label",
        },
        identifier: {
          type: "string",
          description: "Element accessibility identifier",
        },
        type: {
          type: "string",
          description: "Element type (button, textField, etc.)",
        },
      },
    },
  },

  // ==========================================
  // BUILD ERROR DIAGNOSTICS
  // ==========================================

  {
    name: "analyze_build_errors",
    description:
      "Analyze build errors and suggest fixes. Tracks recurring issues to prevent debugging loops. Use this after a build failure to get smart fix suggestions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        buildOutput: {
          type: "string",
          description: "The raw build output containing errors",
        },
      },
      required: ["buildOutput"],
    },
  },
  {
    name: "get_error_stats",
    description:
      "Get statistics about errors encountered in this session. Helps identify patterns and recurring issues.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },

  // ==========================================
  // VIDEO RECORDING
  // ==========================================

  {
    name: "simulator_start_recording",
    description:
      "Start recording video of the simulator screen. Useful for capturing UI interactions and debugging.",
    inputSchema: {
      type: "object" as const,
      properties: {
        udid: {
          type: "string",
          description: "Simulator UDID (optional)",
        },
        outputPath: {
          type: "string",
          description: "Where to save the video (optional, defaults to temp directory)",
        },
      },
    },
  },
  {
    name: "simulator_stop_recording",
    description: "Stop the current video recording and save the file.",
    inputSchema: {
      type: "object" as const,
      properties: {
        udid: {
          type: "string",
          description: "Simulator UDID (optional)",
        },
      },
    },
  },

  // ==========================================
  // PUSH NOTIFICATIONS
  // ==========================================

  {
    name: "send_push",
    description:
      "Send a push notification to an app in the simulator. Great for testing notification handling.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bundleId: {
          type: "string",
          description: "App bundle identifier",
        },
        title: {
          type: "string",
          description: "Notification title",
        },
        body: {
          type: "string",
          description: "Notification body text",
        },
        badge: {
          type: "number",
          description: "Badge number (optional)",
        },
        udid: {
          type: "string",
          description: "Simulator UDID (optional)",
        },
      },
      required: ["bundleId", "title", "body"],
    },
  },

  // ==========================================
  // NETWORK & ENVIRONMENT
  // ==========================================

  {
    name: "set_network_condition",
    description:
      "Simulate different network conditions (3G, LTE, WiFi, bad network, etc.). Useful for testing offline behavior and network error handling.",
    inputSchema: {
      type: "object" as const,
      properties: {
        condition: {
          type: "string",
          enum: ["100% Loss", "3G", "DSL", "Edge", "High Latency DNS", "LTE", "Very Bad Network", "WiFi", "WiFi 802.11ac", "reset"],
          description: "Network condition to simulate",
        },
        udid: {
          type: "string",
          description: "Simulator UDID (optional)",
        },
      },
      required: ["condition"],
    },
  },
  {
    name: "set_location",
    description:
      "Set the simulated GPS location for the simulator.",
    inputSchema: {
      type: "object" as const,
      properties: {
        latitude: {
          type: "number",
          description: "Latitude coordinate",
        },
        longitude: {
          type: "number",
          description: "Longitude coordinate",
        },
        preset: {
          type: "string",
          enum: ["apple", "london", "tokyo", "newyork", "sydney", "sanfrancisco"],
          description: "Use a preset location instead of coordinates",
        },
        udid: {
          type: "string",
          description: "Simulator UDID (optional)",
        },
      },
    },
  },
  {
    name: "trigger_memory_warning",
    description:
      "Trigger a memory warning in the running app. Useful for testing memory handling.",
    inputSchema: {
      type: "object" as const,
      properties: {
        udid: {
          type: "string",
          description: "Simulator UDID (optional)",
        },
      },
    },
  },
  {
    name: "simulate_biometric",
    description:
      "Simulate Face ID or Touch ID authentication (match or fail).",
    inputSchema: {
      type: "object" as const,
      properties: {
        match: {
          type: "boolean",
          description: "Whether the biometric should match (true) or fail (false)",
        },
        udid: {
          type: "string",
          description: "Simulator UDID (optional)",
        },
      },
      required: ["match"],
    },
  },
];

/**
 * iOS Development MCP Server
 */
class IOSDevServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "ios-dev-mcp",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.executeTool(name, args || {});
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error executing ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    switch (name) {
      // Swift execution
      case "swift_execute":
        return await this.handleSwiftExecute(args);

      // Xcode tools
      case "xcode_list_schemes":
        return await this.handleXcodeListSchemes(args);
      case "xcode_build":
        return await this.handleXcodeBuild(args);
      case "xcode_get_build_settings":
        return await this.handleXcodeGetBuildSettings(args);

      // Simulator tools
      case "simulator_list":
        return await this.handleSimulatorList(args);
      case "simulator_boot":
        return await this.handleSimulatorBoot(args);
      case "simulator_shutdown":
        return await this.handleSimulatorShutdown(args);
      case "simulator_install_app":
        return await this.handleSimulatorInstallApp(args);
      case "simulator_uninstall_app":
        return await this.handleSimulatorUninstallApp(args);
      case "simulator_launch_app":
        return await this.handleSimulatorLaunchApp(args);
      case "simulator_terminate_app":
        return await this.handleSimulatorTerminateApp(args);
      case "simulator_screenshot":
        return await this.handleSimulatorScreenshot(args);
      case "simulator_open_url":
        return await this.handleSimulatorOpenUrl(args);
      case "simulator_get_app_container":
        return await this.handleSimulatorGetAppContainer(args);
      case "simulator_get_logs":
        return await this.handleSimulatorGetLogs(args);

      // Workflow tools
      case "dev_session_start":
        return await this.handleDevSessionStart(args);
      case "dev_run":
        return await this.handleDevRun(args);
      case "dev_restart":
        return await this.handleDevRestart(args);
      case "dev_preview":
        return await this.handleDevPreview(args);
      case "dev_session_info":
        return await this.handleDevSessionInfo();
      case "dev_session_end":
        return await this.handleDevSessionEnd();

      // UI Automation tools
      case "ui_tap":
        return await this.handleUITap(args);
      case "ui_double_tap":
        return await this.handleUIDoubleTap(args);
      case "ui_long_press":
        return await this.handleUILongPress(args);
      case "ui_swipe":
        return await this.handleUISwipe(args);
      case "ui_type":
        return await this.handleUIType(args);
      case "ui_press_key":
        return await this.handleUIPressKey(args);
      case "ui_press_button":
        return await this.handleUIPressButton(args);
      case "ui_scroll":
        return await this.handleUIScroll(args);
      case "ui_dismiss_keyboard":
        return await this.handleUIDismissKeyboard();
      case "ui_set_appearance":
        return await this.handleUISetAppearance(args);

      // Testing tools
      case "xcode_test":
        return await this.handleXcodeTest(args);
      case "xcode_test_list":
        return await this.handleXcodeTestList(args);
      case "xcode_coverage":
        return await this.handleXcodeCoverage(args);

      // System info
      case "ios_dev_info":
        return await this.handleIOSDevInfo();

      // CLAUDE.md integration
      case "generate_claude_md":
        return await this.handleGenerateClaudeMd(args);

      // Accessibility inspection
      case "ui_describe_screen":
        return await this.handleUIDescribeScreen(args);
      case "ui_find_element":
        return await this.handleUIFindElement(args);

      // Build error diagnostics
      case "analyze_build_errors":
        return await this.handleAnalyzeBuildErrors(args);
      case "get_error_stats":
        return await this.handleGetErrorStats();

      // Video recording
      case "simulator_start_recording":
        return await this.handleStartRecording(args);
      case "simulator_stop_recording":
        return await this.handleStopRecording(args);

      // Push notifications
      case "send_push":
        return await this.handleSendPush(args);

      // Network & environment
      case "set_network_condition":
        return await this.handleSetNetworkCondition(args);
      case "set_location":
        return await this.handleSetLocation(args);
      case "trigger_memory_warning":
        return await this.handleTriggerMemoryWarning(args);
      case "simulate_biometric":
        return await this.handleSimulateBiometric(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // Swift execution handler
  private async handleSwiftExecute(args: Record<string, unknown>) {
    const code = args.code as string;
    const timeout = args.timeout as number | undefined;

    const result = await executeSwift(code, { timeout });

    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Swift Execution Error:\n${result.error}\n\n${result.output ? `Output:\n${result.output}` : ""}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: result.output || "(no output)",
        },
      ],
    };
  }

  // Xcode handlers
  private async handleXcodeListSchemes(args: Record<string, unknown>) {
    const projectPath = args.projectPath as string;

    const result = await listSchemes(projectPath);

    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to list schemes: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    const output = [
      `Schemes: ${result.schemes.join(", ") || "(none)"}`,
      `Configurations: ${result.configurations.join(", ") || "(none)"}`,
      `Targets: ${result.targets.join(", ") || "(none)"}`,
    ].join("\n");

    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  }

  private async handleXcodeBuild(args: Record<string, unknown>) {
    const projectPath = args.projectPath as string;
    const scheme = args.scheme as string;
    const configuration = (args.configuration as string) || "Debug";
    const sdk = args.sdk as string | undefined;
    const destination = args.destination as string | undefined;
    const clean = args.clean as boolean | undefined;

    const result = await build(projectPath, {
      scheme,
      configuration,
      sdk,
      destination,
      clean,
    });

    if (!result.success) {
      const errorOutput = [
        `Build Failed`,
        `Error: ${result.error}`,
        result.errors.length > 0 ? `\nErrors:\n${result.errors.join("\n")}` : "",
        result.warnings.length > 0 ? `\nWarnings:\n${result.warnings.join("\n")}` : "",
      ].join("\n");

      return {
        content: [
          {
            type: "text",
            text: errorOutput,
          },
        ],
        isError: true,
      };
    }

    const successOutput = [
      `Build Succeeded`,
      `Time: ${(result.buildTime / 1000).toFixed(2)}s`,
      result.warnings.length > 0 ? `\nWarnings (${result.warnings.length}):\n${result.warnings.slice(0, 10).join("\n")}` : "",
    ].join("\n");

    return {
      content: [
        {
          type: "text",
          text: successOutput,
        },
      ],
    };
  }

  private async handleXcodeGetBuildSettings(args: Record<string, unknown>) {
    const projectPath = args.projectPath as string;
    const scheme = args.scheme as string;

    const result = await getBuildSettings(projectPath, scheme);

    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to get build settings: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    // Show key settings
    const keySettings = [
      "PRODUCT_NAME",
      "PRODUCT_BUNDLE_IDENTIFIER",
      "INFOPLIST_FILE",
      "CONFIGURATION_BUILD_DIR",
      "BUILT_PRODUCTS_DIR",
      "SDKROOT",
      "DEPLOYMENT_TARGET_SETTING_NAME",
      "IPHONEOS_DEPLOYMENT_TARGET",
    ];

    const output = keySettings
      .filter((key) => result.settings[key])
      .map((key) => `${key} = ${result.settings[key]}`)
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: output || "(no settings found)",
        },
      ],
    };
  }

  // Simulator handlers
  private async handleSimulatorList(args: Record<string, unknown>) {
    const onlyBooted = args.onlyBooted as boolean | undefined;
    const onlyAvailable = args.onlyAvailable as boolean | undefined;

    const result = await listSimulators();

    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to list simulators: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    let devices = result.devices;
    if (onlyBooted) {
      devices = devices.filter((d) => d.state === "Booted");
    }
    if (onlyAvailable) {
      devices = devices.filter((d) => d.isAvailable);
    }

    if (devices.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No simulators found matching the criteria",
          },
        ],
      };
    }

    const output = devices
      .map((d) => `${d.name} (${d.state}) - ${d.runtime}\n  UDID: ${d.udid}`)
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: `Found ${devices.length} simulator(s):\n\n${output}`,
        },
      ],
    };
  }

  private async handleSimulatorBoot(args: Record<string, unknown>) {
    let udid = args.udid as string | undefined;
    const deviceName = args.deviceName as string | undefined;
    const osVersion = args.osVersion as string | undefined;

    if (!udid && !deviceName) {
      return {
        content: [
          {
            type: "text",
            text: "Either 'udid' or 'deviceName' is required",
          },
        ],
        isError: true,
      };
    }

    // Find by name if UDID not provided
    if (!udid && deviceName) {
      const device = await findSimulator(deviceName, osVersion);
      if (!device) {
        return {
          content: [
            {
              type: "text",
              text: `Simulator not found: ${deviceName}${osVersion ? ` (iOS ${osVersion})` : ""}`,
            },
          ],
          isError: true,
        };
      }
      udid = device.udid;
    }

    const result = await bootSimulator(udid!);

    return {
      content: [
        {
          type: "text",
          text: result.success ? result.message : `Failed: ${result.error}`,
        },
      ],
      isError: !result.success,
    };
  }

  private async handleSimulatorShutdown(args: Record<string, unknown>) {
    let udid = args.udid as string | undefined;

    if (!udid) {
      const booted = await getBootedSimulator();
      if (!booted) {
        return {
          content: [
            {
              type: "text",
              text: "No booted simulator found",
            },
          ],
          isError: true,
        };
      }
      udid = booted.udid;
    }

    const result = await shutdownSimulator(udid);

    return {
      content: [
        {
          type: "text",
          text: result.success ? result.message : `Failed: ${result.error}`,
        },
      ],
      isError: !result.success,
    };
  }

  private async handleSimulatorInstallApp(args: Record<string, unknown>) {
    const appPath = args.appPath as string;
    let udid = args.udid as string | undefined;

    if (!udid) {
      const booted = await getBootedSimulator();
      if (!booted) {
        return {
          content: [
            {
              type: "text",
              text: "No booted simulator found. Boot a simulator first or provide a UDID.",
            },
          ],
          isError: true,
        };
      }
      udid = booted.udid;
    }

    const result = await installApp(udid, appPath);

    return {
      content: [
        {
          type: "text",
          text: result.success ? result.message : `Failed: ${result.error}`,
        },
      ],
      isError: !result.success,
    };
  }

  private async handleSimulatorUninstallApp(args: Record<string, unknown>) {
    const bundleId = args.bundleId as string;
    let udid = args.udid as string | undefined;

    if (!udid) {
      const booted = await getBootedSimulator();
      if (!booted) {
        return {
          content: [
            {
              type: "text",
              text: "No booted simulator found. Boot a simulator first or provide a UDID.",
            },
          ],
          isError: true,
        };
      }
      udid = booted.udid;
    }

    const result = await uninstallApp(udid, bundleId);

    return {
      content: [
        {
          type: "text",
          text: result.success ? result.message : `Failed: ${result.error}`,
        },
      ],
      isError: !result.success,
    };
  }

  private async handleSimulatorLaunchApp(args: Record<string, unknown>) {
    const bundleId = args.bundleId as string;
    let udid = args.udid as string | undefined;
    const appArgs = args.args as string[] | undefined;

    if (!udid) {
      const booted = await getBootedSimulator();
      if (!booted) {
        return {
          content: [
            {
              type: "text",
              text: "No booted simulator found. Boot a simulator first or provide a UDID.",
            },
          ],
          isError: true,
        };
      }
      udid = booted.udid;
    }

    const result = await launchApp(udid, bundleId, appArgs);

    return {
      content: [
        {
          type: "text",
          text: result.success
            ? `${result.message}${result.pid ? ` (PID: ${result.pid})` : ""}`
            : `Failed: ${result.error}`,
        },
      ],
      isError: !result.success,
    };
  }

  private async handleSimulatorTerminateApp(args: Record<string, unknown>) {
    const bundleId = args.bundleId as string;
    let udid = args.udid as string | undefined;

    if (!udid) {
      const booted = await getBootedSimulator();
      if (!booted) {
        return {
          content: [
            {
              type: "text",
              text: "No booted simulator found.",
            },
          ],
          isError: true,
        };
      }
      udid = booted.udid;
    }

    const result = await terminateApp(udid, bundleId);

    return {
      content: [
        {
          type: "text",
          text: result.success ? result.message : `Failed: ${result.error}`,
        },
      ],
      isError: !result.success,
    };
  }

  private async handleSimulatorScreenshot(args: Record<string, unknown>) {
    const outputPath = args.outputPath as string | undefined;
    let udid = args.udid as string | undefined;

    if (!udid) {
      const booted = await getBootedSimulator();
      if (!booted) {
        return {
          content: [
            {
              type: "text",
              text: "No booted simulator found. Boot a simulator first or provide a UDID.",
            },
          ],
          isError: true,
        };
      }
      udid = booted.udid;
    }

    const result = await takeScreenshot(udid, outputPath);

    return {
      content: [
        {
          type: "text",
          text: result.success
            ? `Screenshot saved to: ${result.path}`
            : `Failed: ${result.error}`,
        },
      ],
      isError: !result.success,
    };
  }

  private async handleSimulatorOpenUrl(args: Record<string, unknown>) {
    const url = args.url as string;
    let udid = args.udid as string | undefined;

    if (!udid) {
      const booted = await getBootedSimulator();
      if (!booted) {
        return {
          content: [
            {
              type: "text",
              text: "No booted simulator found. Boot a simulator first or provide a UDID.",
            },
          ],
          isError: true,
        };
      }
      udid = booted.udid;
    }

    const result = await openUrl(udid, url);

    return {
      content: [
        {
          type: "text",
          text: result.success ? result.message : `Failed: ${result.error}`,
        },
      ],
      isError: !result.success,
    };
  }

  private async handleSimulatorGetAppContainer(args: Record<string, unknown>) {
    const bundleId = args.bundleId as string;
    const containerType = (args.containerType as "app" | "data" | "groups") || "app";
    let udid = args.udid as string | undefined;

    if (!udid) {
      const booted = await getBootedSimulator();
      if (!booted) {
        return {
          content: [
            {
              type: "text",
              text: "No booted simulator found.",
            },
          ],
          isError: true,
        };
      }
      udid = booted.udid;
    }

    const result = await getAppContainer(udid, bundleId, containerType);

    return {
      content: [
        {
          type: "text",
          text: result.success
            ? `${containerType} container: ${result.path}`
            : `Failed: ${result.error}`,
        },
      ],
      isError: !result.success,
    };
  }

  private async handleSimulatorGetLogs(args: Record<string, unknown>) {
    const bundleId = args.bundleId as string | undefined;
    const predicate = args.predicate as string | undefined;
    let udid = args.udid as string | undefined;

    if (!udid) {
      const booted = await getBootedSimulator();
      if (!booted) {
        return {
          content: [
            {
              type: "text",
              text: "No booted simulator found.",
            },
          ],
          isError: true,
        };
      }
      udid = booted.udid;
    }

    const result = await getLogs(udid, { bundleId, predicate });

    return {
      content: [
        {
          type: "text",
          text: result.success
            ? result.logs || "(no logs found)"
            : `Failed: ${result.error}`,
        },
      ],
      isError: !result.success,
    };
  }

  // System info handler
  private async handleIOSDevInfo() {
    const [swiftAvailable, xcodeAvailable, simctlAvailable] = await Promise.all([
      isSwiftAvailable(),
      isXcodeAvailable(),
      isSimctlAvailable(),
    ]);

    const results: string[] = ["iOS Development Tools Status:", ""];

    if (swiftAvailable) {
      const version = await getSwiftVersion();
      results.push(`Swift: Available (${version || "version unknown"})`);
    } else {
      results.push("Swift: Not available");
    }

    if (xcodeAvailable) {
      const version = await getXcodeVersion();
      results.push(`Xcode: Available (${version || "version unknown"})`);
    } else {
      results.push("Xcode: Not available");
    }

    if (simctlAvailable) {
      results.push("simctl: Available");

      // Show booted simulators
      const booted = await getBootedSimulator();
      if (booted) {
        results.push(`  Booted: ${booted.name} (${booted.udid})`);
      } else {
        results.push("  No simulators booted");
      }
    } else {
      results.push("simctl: Not available");
    }

    return {
      content: [
        {
          type: "text",
          text: results.join("\n"),
        },
      ],
    };
  }

  // ==========================================
  // WORKFLOW HANDLERS - Iterative Development
  // ==========================================

  private async handleDevSessionStart(args: Record<string, unknown>) {
    const projectPath = args.projectPath as string;
    const scheme = args.scheme as string | undefined;
    const simulatorName = args.simulatorName as string | undefined;

    const result = await startSession({
      projectPath,
      scheme,
      simulatorName,
    });

    if (!result.success) {
      const stepsOutput = result.steps
        .map((s) => `${s.success ? "✓" : "✗"} ${s.step}: ${s.message}`)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Failed to start development session:\n${result.error}\n\nSteps:\n${stepsOutput}`,
          },
        ],
        isError: true,
      };
    }

    const stepsOutput = result.steps
      .map((s) => `✓ ${s.step}: ${s.message}`)
      .join("\n");

    const sessionInfo = result.session
      ? `\n\nSession Ready:\n- Project: ${result.session.scheme}\n- Bundle ID: ${result.session.bundleId}\n- Simulator: ${result.session.simulator.name}\n\nUse 'dev_run' to build and run your app!`
      : "";

    return {
      content: [
        {
          type: "text",
          text: `Development session started!\n\n${stepsOutput}${sessionInfo}`,
        },
      ],
    };
  }

  private async handleDevRun(args: Record<string, unknown>) {
    const clean = args.clean as boolean | undefined;

    const result = await devRun({ clean });

    if (!result.success) {
      const stepsOutput = result.steps
        .map(
          (s) =>
            `${s.success ? "✓" : "✗"} ${s.step}: ${s.message}${s.duration ? ` (${(s.duration / 1000).toFixed(1)}s)` : ""}`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Build/Run Failed:\n${result.error}\n\nSteps:\n${stepsOutput}`,
          },
        ],
        isError: true,
      };
    }

    const stepsOutput = result.steps
      .map(
        (s) =>
          `✓ ${s.step}: ${s.message}${s.duration ? ` (${(s.duration / 1000).toFixed(1)}s)` : ""}`
      )
      .join("\n");

    const output = [
      "App is running!",
      "",
      stepsOutput,
      "",
      result.buildTime
        ? `Total build time: ${(result.buildTime / 1000).toFixed(2)}s`
        : "",
      result.screenshotPath ? `Screenshot: ${result.screenshotPath}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  }

  private async handleDevRestart(args: Record<string, unknown>) {
    const result = await devRestart();

    if (!result.success) {
      const stepsOutput = result.steps
        .map(
          (s) =>
            `${s.success ? "✓" : "✗"} ${s.step}: ${s.message}${s.duration ? ` (${(s.duration / 1000).toFixed(1)}s)` : ""}`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Restart Failed:\n${result.error}\n\nSteps:\n${stepsOutput}`,
          },
        ],
        isError: true,
      };
    }

    const stepsOutput = result.steps
      .map(
        (s) =>
          `✓ ${s.step}: ${s.message}${s.duration ? ` (${(s.duration / 1000).toFixed(1)}s)` : ""}`
      )
      .join("\n");

    const output = [
      "App restarted!",
      "",
      stepsOutput,
      "",
      result.buildTime
        ? `Build time: ${(result.buildTime / 1000).toFixed(2)}s`
        : "",
      result.screenshotPath ? `Screenshot: ${result.screenshotPath}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  }

  private async handleDevPreview(args: Record<string, unknown>) {
    const outputPath = args.outputPath as string | undefined;

    const result = await devPreview({ outputPath });

    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Screenshot failed: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Screenshot captured: ${result.path}`,
        },
      ],
    };
  }

  private async handleDevSessionInfo() {
    return {
      content: [
        {
          type: "text",
          text: getSessionInfo(),
        },
      ],
    };
  }

  private async handleDevSessionEnd() {
    const session = getSession();
    clearSession();

    return {
      content: [
        {
          type: "text",
          text: session
            ? `Development session ended for ${session.scheme}.`
            : "No active session to end.",
        },
      ],
    };
  }

  // ==========================================
  // UI AUTOMATION HANDLERS
  // ==========================================

  private async handleUITap(args: Record<string, unknown>) {
    const x = args.x as number;
    const y = args.y as number;

    const result = await tap(x, y);

    return {
      content: [{ type: "text", text: result.success ? result.message : `Failed: ${result.error}` }],
      isError: !result.success,
    };
  }

  private async handleUIDoubleTap(args: Record<string, unknown>) {
    const x = args.x as number;
    const y = args.y as number;

    const result = await doubleTap(x, y);

    return {
      content: [{ type: "text", text: result.success ? result.message : `Failed: ${result.error}` }],
      isError: !result.success,
    };
  }

  private async handleUILongPress(args: Record<string, unknown>) {
    const x = args.x as number;
    const y = args.y as number;
    const duration = (args.duration as number) || 1000;

    const result = await longPress(x, y, duration);

    return {
      content: [{ type: "text", text: result.success ? result.message : `Failed: ${result.error}` }],
      isError: !result.success,
    };
  }

  private async handleUISwipe(args: Record<string, unknown>) {
    const fromX = args.fromX as number;
    const fromY = args.fromY as number;
    const toX = args.toX as number;
    const toY = args.toY as number;
    const duration = (args.duration as number) || 300;

    const result = await swipe({ x: fromX, y: fromY }, { x: toX, y: toY }, duration);

    return {
      content: [{ type: "text", text: result.success ? result.message : `Failed: ${result.error}` }],
      isError: !result.success,
    };
  }

  private async handleUIType(args: Record<string, unknown>) {
    const text = args.text as string;

    const result = await typeText(text);

    return {
      content: [{ type: "text", text: result.success ? result.message : `Failed: ${result.error}` }],
      isError: !result.success,
    };
  }

  private async handleUIPressKey(args: Record<string, unknown>) {
    const key = args.key as string;
    const modifiers = args.modifiers as Array<"command" | "control" | "option" | "shift"> | undefined;

    const result = await pressKey(key, modifiers);

    return {
      content: [{ type: "text", text: result.success ? result.message : `Failed: ${result.error}` }],
      isError: !result.success,
    };
  }

  private async handleUIPressButton(args: Record<string, unknown>) {
    const button = args.button as "home" | "lock" | "volume_up" | "volume_down" | "shake";

    const result = await pressButton(button);

    return {
      content: [{ type: "text", text: result.success ? result.message : `Failed: ${result.error}` }],
      isError: !result.success,
    };
  }

  private async handleUIScroll(args: Record<string, unknown>) {
    const direction = args.direction as "up" | "down" | "left" | "right";
    const amount = (args.amount as number) || 100;

    const result = await scroll(direction, amount);

    return {
      content: [{ type: "text", text: result.success ? result.message : `Failed: ${result.error}` }],
      isError: !result.success,
    };
  }

  private async handleUIDismissKeyboard() {
    const result = await dismissKeyboard();

    return {
      content: [{ type: "text", text: result.success ? result.message : `Failed: ${result.error}` }],
      isError: !result.success,
    };
  }

  private async handleUISetAppearance(args: Record<string, unknown>) {
    const mode = args.mode as "light" | "dark";

    const result = await setAppearance(mode);

    return {
      content: [{ type: "text", text: result.success ? result.message : `Failed: ${result.error}` }],
      isError: !result.success,
    };
  }

  // ==========================================
  // TESTING HANDLERS
  // ==========================================

  private async handleXcodeTest(args: Record<string, unknown>) {
    const projectPath = args.projectPath as string;
    const scheme = args.scheme as string;
    const testPlan = args.testPlan as string | undefined;
    const onlyTesting = args.onlyTesting as string[] | undefined;
    const skipTesting = args.skipTesting as string[] | undefined;

    const result = await runTests(projectPath, {
      scheme,
      testPlan,
      onlyTesting,
      skipTesting,
    });

    const formattedResults = formatTestResults(result);

    return {
      content: [{ type: "text", text: formattedResults }],
      isError: !result.success,
    };
  }

  private async handleXcodeTestList(args: Record<string, unknown>) {
    const projectPath = args.projectPath as string;
    const scheme = args.scheme as string;

    const result = await listTests(projectPath, scheme);

    if (!result.success) {
      return {
        content: [{ type: "text", text: `Failed to list tests: ${result.error}` }],
        isError: true,
      };
    }

    const output = result.testTargets.length > 0
      ? result.testTargets
          .map((t) => `${t.name}:\n${t.tests.map((test) => `  - ${test}`).join("\n")}`)
          .join("\n\n")
      : "No tests found";

    return {
      content: [{ type: "text", text: output }],
    };
  }

  private async handleXcodeCoverage(args: Record<string, unknown>) {
    const projectPath = args.projectPath as string;
    const scheme = args.scheme as string;

    const result = await getCoverage(projectPath, scheme);

    if (!result.success) {
      return {
        content: [{ type: "text", text: `Failed to get coverage: ${result.error}` }],
        isError: true,
      };
    }

    const coverage = result.coverage!;
    const output = [
      `Code Coverage: ${coverage.lineCoverage.toFixed(1)}%`,
      "",
      "Top Files:",
      ...coverage.files.slice(0, 10).map(
        (f) => `  ${f.lineCoverage.toFixed(1)}% - ${f.path} (${f.coveredLines}/${f.executableLines})`
      ),
    ].join("\n");

    return {
      content: [{ type: "text", text: output }],
    };
  }

  // ==========================================
  // CLAUDE.MD INTEGRATION HANDLERS
  // ==========================================

  private async handleGenerateClaudeMd(args: Record<string, unknown>) {
    const projectPath = args.projectPath as string;
    const outputPath = args.outputPath as string | undefined;

    const result = await writeClaudeMd({ projectPath, outputPath });

    if (!result.success) {
      return {
        content: [{ type: "text", text: `Failed to generate CLAUDE.md: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: `CLAUDE.md generated at: ${result.path}\n\nThis file provides context about your iOS project for Claude.` }],
    };
  }

  // ==========================================
  // ACCESSIBILITY HANDLERS
  // ==========================================

  private async handleUIDescribeScreen(args: Record<string, unknown>) {
    const udid = args.udid as string | undefined;

    const result = await describeScreen({ udid });

    return {
      content: [{ type: "text", text: result.description || result.error || "Unable to describe screen" }],
      isError: !result.success,
    };
  }

  private async handleUIFindElement(args: Record<string, unknown>) {
    const query = {
      label: args.label as string | undefined,
      identifier: args.identifier as string | undefined,
      type: args.type as string | undefined,
    };

    const result = await findElement(query);

    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error || "Element not found" }],
        isError: true,
      };
    }

    const output = [
      `Element found: ${result.element?.type}`,
      result.element?.label ? `Label: ${result.element.label}` : "",
      result.tapPoint ? `Tap at: (${result.tapPoint.x}, ${result.tapPoint.y})` : "",
    ].filter(Boolean).join("\n");

    return {
      content: [{ type: "text", text: output }],
    };
  }

  // ==========================================
  // BUILD ERROR DIAGNOSTICS HANDLERS
  // ==========================================

  private async handleAnalyzeBuildErrors(args: Record<string, unknown>) {
    const buildOutput = args.buildOutput as string;

    const errors = parseBuildErrors(buildOutput);

    if (errors.length === 0) {
      return {
        content: [{ type: "text", text: "No errors found in build output." }],
      };
    }

    const analysis = analyzeErrors(errors);

    let output = analysis.summary + "\n\nDetailed Fixes:\n";

    for (const { error, suggestions } of analysis.fixes.slice(0, 5)) {
      output += `\n--- ${error.file}:${error.line} ---\n`;
      output += `Error: ${error.message}\n`;
      for (const fix of suggestions) {
        output += `\n[${fix.confidence}] ${fix.description}\n`;
        output += `${fix.explanation}\n`;
      }
    }

    if (analysis.recurringIssues.length > 0) {
      output += "\n\n⚠️ RECURRING ISSUES - Consider changing approach:\n";
      for (const issue of analysis.recurringIssues) {
        output += `- ${issue.errorType}: seen ${issue.count} times\n`;
      }
    }

    return {
      content: [{ type: "text", text: output }],
    };
  }

  private async handleGetErrorStats() {
    const stats = getSessionStats();

    const output = [
      "Session Error Statistics:",
      "",
      `Total errors encountered: ${stats.totalErrors}`,
      `Resolved: ${stats.resolvedErrors}`,
      `Recurring issues: ${stats.recurringErrors}`,
      "",
      "Top Issue Types:",
      ...stats.topIssueTypes.map(t => `  - ${t.type}: ${t.count}`),
    ].join("\n");

    return {
      content: [{ type: "text", text: output }],
    };
  }

  // ==========================================
  // VIDEO RECORDING HANDLERS
  // ==========================================

  private async handleStartRecording(args: Record<string, unknown>) {
    const udid = args.udid as string | undefined;
    const outputPath = args.outputPath as string | undefined;

    const result = await startRecording({ udid, outputPath });

    if (!result.success) {
      return {
        content: [{ type: "text", text: `Failed to start recording: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: `Recording started. Output will be saved to: ${result.outputPath}\n\nUse simulator_stop_recording when done.` }],
    };
  }

  private async handleStopRecording(args: Record<string, unknown>) {
    const udid = args.udid as string | undefined;

    const result = await stopRecording({ udid });

    if (!result.success) {
      return {
        content: [{ type: "text", text: `Failed to stop recording: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: `Recording saved to: ${result.outputPath}\nDuration: ${result.duration?.toFixed(1)}s` }],
    };
  }

  // ==========================================
  // PUSH NOTIFICATION HANDLERS
  // ==========================================

  private async handleSendPush(args: Record<string, unknown>) {
    const bundleId = args.bundleId as string;
    const title = args.title as string;
    const body = args.body as string;
    const badge = args.badge as number | undefined;
    const udid = args.udid as string | undefined;

    const result = await sendSimplePush(bundleId, title, body, { udid, badge });

    if (!result.success) {
      return {
        content: [{ type: "text", text: `Failed to send push: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: `Push notification sent to ${bundleId}:\n"${title}"\n${body}` }],
    };
  }

  // ==========================================
  // NETWORK & ENVIRONMENT HANDLERS
  // ==========================================

  private async handleSetNetworkCondition(args: Record<string, unknown>) {
    const condition = args.condition as string;
    const udid = args.udid as string | undefined;

    const result = await setNetworkCondition(condition as any, { udid });

    if (!result.success) {
      return {
        content: [{ type: "text", text: `Failed to set network condition: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: condition === "reset"
        ? "Network conditions reset to normal."
        : `Network condition set to: ${condition}` }],
    };
  }

  private async handleSetLocation(args: Record<string, unknown>) {
    const latitude = args.latitude as number | undefined;
    const longitude = args.longitude as number | undefined;
    const preset = args.preset as string | undefined;
    const udid = args.udid as string | undefined;

    let result;
    if (preset) {
      result = await setNamedLocation(preset as any, { udid });
    } else if (latitude !== undefined && longitude !== undefined) {
      result = await setLocation(latitude, longitude, { udid });
    } else {
      return {
        content: [{ type: "text", text: "Provide either latitude/longitude or a preset location." }],
        isError: true,
      };
    }

    if (!result.success) {
      return {
        content: [{ type: "text", text: `Failed to set location: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: preset
        ? `Location set to: ${preset}`
        : `Location set to: ${latitude}, ${longitude}` }],
    };
  }

  private async handleTriggerMemoryWarning(args: Record<string, unknown>) {
    const udid = args.udid as string | undefined;

    const result = await triggerMemoryWarning({ udid });

    if (!result.success) {
      return {
        content: [{ type: "text", text: `Failed to trigger memory warning: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: "Memory warning triggered. Check how your app handles it." }],
    };
  }

  private async handleSimulateBiometric(args: Record<string, unknown>) {
    const match = args.match as boolean;
    const udid = args.udid as string | undefined;

    const result = await simulateBiometric(match, { udid });

    if (!result.success) {
      return {
        content: [{ type: "text", text: `Failed to simulate biometric: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: match
        ? "Biometric authentication succeeded (simulated)."
        : "Biometric authentication failed (simulated)." }],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("iOS Development MCP Server running on stdio");
  }
}

// Start the server
const server = new IOSDevServer();
server.run().catch(console.error);
