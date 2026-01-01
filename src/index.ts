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

      // System info
      case "ios_dev_info":
        return await this.handleIOSDevInfo();

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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("iOS Development MCP Server running on stdio");
  }
}

// Start the server
const server = new IOSDevServer();
server.run().catch(console.error);
