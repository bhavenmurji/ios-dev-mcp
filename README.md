# iOS Development MCP Server

A unified Model Context Protocol (MCP) server that brings together Swift code execution, Xcode project building, iOS Simulator control, and device testing into one seamless development workflow with Claude.

## Features

### Swift Code Execution
- Execute Swift code snippets directly
- Automatic temp file management
- Timeout handling (configurable, default 30s)
- Compilation and runtime error capture

### Xcode Building
- Build projects (.xcodeproj) and workspaces (.xcworkspace)
- List schemes, configurations, and targets
- Get build settings
- Parse build warnings and errors
- Support for Debug/Release configurations

### iOS Simulator Control
- List all available simulators and runtimes
- Boot and shutdown simulators
- Install and uninstall apps
- Launch and terminate apps
- Take screenshots
- Open URLs (deep links)
- Get app container paths
- Retrieve simulator logs

## Installation

```bash
# Clone the repository
git clone https://github.com/bhavenmurji/ios-dev-mcp.git
cd ios-dev-mcp

# Install dependencies
npm install

# Build the server
npm run build
```

## Configure with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ios-dev": {
      "command": "node",
      "args": ["/path/to/ios-dev-mcp/build/index.js"]
    }
  }
}
```

Replace `/path/to/ios-dev-mcp` with the actual path to your cloned repository.

## Available Tools

### Swift Execution

#### `swift_execute`
Execute Swift code and return the output.

**Parameters:**
- `code` (required): Swift code to execute
- `timeout` (optional): Execution timeout in milliseconds (default: 30000)

**Example:**
```
swift_execute with code: "print(\"Hello, World!\")"
```

### Xcode Building

#### `xcode_list_schemes`
List all available schemes, configurations, and targets in an Xcode project.

**Parameters:**
- `projectPath` (required): Path to .xcodeproj or .xcworkspace

#### `xcode_build`
Build an Xcode project or workspace.

**Parameters:**
- `projectPath` (required): Path to .xcodeproj or .xcworkspace
- `scheme` (required): Xcode scheme to build
- `configuration` (optional): "Debug" or "Release" (default: "Debug")
- `sdk` (optional): SDK to build for (e.g., "iphonesimulator", "iphoneos")
- `destination` (optional): Build destination
- `clean` (optional): Clean before building

#### `xcode_get_build_settings`
Get build settings for a project scheme.

**Parameters:**
- `projectPath` (required): Path to .xcodeproj or .xcworkspace
- `scheme` (required): Xcode scheme

### Simulator Control

#### `simulator_list`
List all available iOS simulators.

**Parameters:**
- `onlyBooted` (optional): Only return booted simulators
- `onlyAvailable` (optional): Only return available simulators

#### `simulator_boot`
Boot an iOS simulator.

**Parameters:**
- `udid` (optional): Simulator UDID
- `deviceName` (optional): Device name (e.g., "iPhone 15 Pro")
- `osVersion` (optional): iOS version (e.g., "17.2")

#### `simulator_shutdown`
Shutdown an iOS simulator.

**Parameters:**
- `udid` (optional): Simulator UDID (if not provided, shuts down booted simulator)

#### `simulator_install_app`
Install an app on a simulator.

**Parameters:**
- `appPath` (required): Path to .app bundle
- `udid` (optional): Simulator UDID (uses booted simulator if not provided)

#### `simulator_uninstall_app`
Uninstall an app from a simulator.

**Parameters:**
- `bundleId` (required): App bundle identifier
- `udid` (optional): Simulator UDID

#### `simulator_launch_app`
Launch an app on a simulator.

**Parameters:**
- `bundleId` (required): App bundle identifier
- `udid` (optional): Simulator UDID
- `args` (optional): Command-line arguments to pass

#### `simulator_terminate_app`
Terminate a running app.

**Parameters:**
- `bundleId` (required): App bundle identifier
- `udid` (optional): Simulator UDID

#### `simulator_screenshot`
Take a screenshot of a simulator.

**Parameters:**
- `outputPath` (optional): Where to save the screenshot
- `udid` (optional): Simulator UDID

#### `simulator_open_url`
Open a URL in a simulator.

**Parameters:**
- `url` (required): URL to open (can be deep link)
- `udid` (optional): Simulator UDID

#### `simulator_get_app_container`
Get the container path for an installed app.

**Parameters:**
- `bundleId` (required): App bundle identifier
- `containerType` (optional): "app", "data", or "groups" (default: "app")
- `udid` (optional): Simulator UDID

#### `simulator_get_logs`
Get recent logs from a simulator.

**Parameters:**
- `bundleId` (optional): Filter logs by app
- `predicate` (optional): Custom log predicate
- `udid` (optional): Simulator UDID

### System Info

#### `ios_dev_info`
Get information about available iOS development tools.

## Example Workflows

### Run Swift Code
```
User: Can you run this Swift code: let numbers = [1, 2, 3, 4, 5]; print(numbers.reduce(0, +))

Claude uses swift_execute to run the code and returns: 15
```

### Build and Run App
```
User: Build my app and run it on the simulator

Claude:
1. Uses xcode_list_schemes to find available schemes
2. Uses xcode_build to build the project
3. Uses simulator_list to find available simulators
4. Uses simulator_boot to start a simulator
5. Uses simulator_install_app to install the built app
6. Uses simulator_launch_app to run the app
7. Uses simulator_screenshot to capture the result
```

### Debug App Issues
```
User: My app is crashing, can you check the logs?

Claude:
1. Uses simulator_get_logs to retrieve recent logs
2. Analyzes the crash logs and provides debugging suggestions
```

## Requirements

- macOS 13.0+ (for Xcode and Simulator support)
- Xcode 15.0+ with command-line tools
- Node.js 18+
- Swift 5.9+

## Development

```bash
# Run tests
npm test

# Build in watch mode
npm run watch

# Lint code
npm run lint
```

## Architecture

```
ios-dev-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── swift/
│   │   └── executor.ts       # Swift code execution
│   ├── xcode/
│   │   └── builder.ts        # Xcode build tools
│   ├── simulator/
│   │   └── controller.ts     # iOS Simulator control
│   └── utils/
│       ├── process.ts        # Command execution utilities
│       └── tempfile.ts       # Temp file management
├── tests/                    # Test suites
├── examples/                 # Example usage
└── docs/                     # Documentation
```

## Contributing

Contributions are welcome! This project builds on ideas from:
- [SwiftClaude](https://github.com/GeorgeLyon/SwiftClaude)
- [ios-simulator-mcp](https://github.com/joshuayoes/ios-simulator-mcp)
- [XcodeBuildMCP](https://github.com/cameroncooke/XcodeBuildMCP)
- [xcode-mcp-server](https://github.com/r-huijts/xcode-mcp-server)

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

Built on the shoulders of giants. Special thanks to:
- George Lyon (SwiftClaude)
- Joshua Yoes (ios-simulator-mcp)
- Cameron Cooke (XcodeBuildMCP)
- R. Huijts (xcode-mcp-server)
- The Anthropic team for MCP
- The iOS development community
