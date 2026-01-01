# iOS Development MCP Server

A unified Model Context Protocol (MCP) server that brings together Swift code execution, Xcode project building, iOS Simulator control, and device testing into one seamless development workflow with Claude.

## Iterative Development (Replit-like Experience)

The standout feature of this MCP server is the **iterative development workflow** - similar to Replit's live preview. Instead of manually building, installing, and launching your app, just use:

```
1. "Start a dev session for my app at ~/MyApp/MyApp.xcodeproj"
2. Make code changes
3. "Rebuild and show me the result"
4. See screenshot of your running app
5. Repeat!
```

This combines build → install → launch → screenshot into one seamless step, giving you immediate visual feedback on your changes.

## Features

### Iterative Development Workflow (NEW!)
- **Session-based development** - Set up once, iterate quickly
- **One-command build & run** - Build, install, launch, and screenshot automatically
- **Quick restart** - Rapid rebuilds for small changes
- **Live preview** - Take screenshots at any time to see current state

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

### UI Automation
- Tap, double-tap, and long press at coordinates
- Swipe gestures in any direction
- Type text and press keys
- Hardware button simulation (home, lock, volume)
- Scroll in any direction
- Rotate device
- Light/dark mode switching

### XCTest Integration
- Run unit and UI tests
- List available test targets and methods
- Code coverage reports
- Detailed test results with failure messages

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

## Configure with Claude Code (CLI)

```bash
claude mcp add ios-dev --scope user \
  --command "node" \
  --args "/path/to/ios-dev-mcp/build/index.js"
```

Or create/edit `~/.claude.json`:

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

## Available Tools

### Iterative Development (Recommended!)

These tools provide a Replit-like experience for iOS development.

#### `dev_session_start`
Start a development session for iterative iOS development. **Start here!**

**Parameters:**
- `projectPath` (required): Path to .xcodeproj or .xcworkspace
- `scheme` (optional): Xcode scheme (auto-detected if not specified)
- `simulatorName` (optional): Simulator device name (e.g., 'iPhone 15 Pro')

**Example:**
```
"Start a dev session for ~/MyApp/MyApp.xcodeproj"
```

#### `dev_run`
Build, install, launch, and screenshot in one step. The main iteration command.

**Parameters:**
- `clean` (optional): Clean build before building

**Example:**
```
"Build and run my app" or "dev_run"
```

#### `dev_restart`
Quick rebuild and relaunch. Faster than dev_run for small changes.

**Example:**
```
"Rebuild and show me the result" or "Restart the app"
```

#### `dev_preview`
Take a screenshot without rebuilding.

**Parameters:**
- `outputPath` (optional): Custom screenshot path

#### `dev_session_info`
Show current session details (project, scheme, simulator, last build).

#### `dev_session_end`
End the current development session.

---

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

### UI Automation

These tools enable automated UI interactions with the iOS Simulator.

#### `ui_tap`
Tap at specific screen coordinates.

**Parameters:**
- `x` (required): X coordinate
- `y` (required): Y coordinate
- `udid` (optional): Simulator UDID

#### `ui_double_tap`
Double tap at coordinates.

**Parameters:**
- `x` (required): X coordinate
- `y` (required): Y coordinate
- `udid` (optional): Simulator UDID

#### `ui_long_press`
Long press at coordinates.

**Parameters:**
- `x` (required): X coordinate
- `y` (required): Y coordinate
- `duration` (optional): Duration in milliseconds (default: 1000)
- `udid` (optional): Simulator UDID

#### `ui_swipe`
Swipe from one point to another.

**Parameters:**
- `fromX` (required): Starting X coordinate
- `fromY` (required): Starting Y coordinate
- `toX` (required): Ending X coordinate
- `toY` (required): Ending Y coordinate
- `duration` (optional): Swipe duration in milliseconds
- `udid` (optional): Simulator UDID

#### `ui_type`
Type text into the focused field.

**Parameters:**
- `text` (required): Text to type
- `udid` (optional): Simulator UDID

#### `ui_press_key`
Press a key or key combination.

**Parameters:**
- `key` (required): Key to press (e.g., "enter", "tab", "escape", "up", "down")
- `modifiers` (optional): Array of modifiers ["command", "control", "option", "shift"]

#### `ui_press_button`
Press a hardware button.

**Parameters:**
- `button` (required): Button name ("home", "lock", "volume_up", "volume_down", "shake")
- `udid` (optional): Simulator UDID

#### `ui_scroll`
Scroll in a direction.

**Parameters:**
- `direction` (required): "up", "down", "left", or "right"
- `amount` (optional): Scroll amount in pixels (default: 100)
- `udid` (optional): Simulator UDID

#### `ui_dismiss_keyboard`
Dismiss the on-screen keyboard.

**Parameters:**
- `udid` (optional): Simulator UDID

#### `ui_set_appearance`
Set light or dark mode.

**Parameters:**
- `mode` (required): "light" or "dark"
- `udid` (optional): Simulator UDID

---

### XCTest Integration

Tools for running and analyzing tests.

#### `xcode_test`
Run XCTest unit or UI tests.

**Parameters:**
- `projectPath` (required): Path to .xcodeproj or .xcworkspace
- `scheme` (required): Xcode scheme to test
- `testPlan` (optional): Test plan name
- `testTarget` (optional): Specific test target
- `testClass` (optional): Specific test class
- `testMethod` (optional): Specific test method
- `configuration` (optional): Build configuration (default: "Debug")
- `destination` (optional): Test destination
- `enableCoverage` (optional): Enable code coverage

**Example:**
```
"Run tests for MyApp scheme"
"Run only the LoginTests class"
```

#### `xcode_test_list`
List all available test targets and test methods.

**Parameters:**
- `projectPath` (required): Path to .xcodeproj or .xcworkspace
- `scheme` (required): Xcode scheme

#### `xcode_coverage`
Get code coverage report after running tests with coverage enabled.

**Parameters:**
- `projectPath` (required): Path to .xcodeproj or .xcworkspace
- `scheme` (required): Xcode scheme

---

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

### UI Automation Testing
```
User: Tap on the login button and enter my credentials

Claude:
1. Uses ui_tap to tap the login button at coordinates
2. Uses ui_type to enter username
3. Uses ui_tap to move to password field
4. Uses ui_type to enter password
5. Uses ui_tap to submit
6. Uses simulator_screenshot to capture result
```

### Run Unit Tests
```
User: Run the tests for my app and show me the results

Claude:
1. Uses xcode_test to run tests with coverage enabled
2. Parses test results showing passed/failed tests
3. Uses xcode_coverage to get code coverage report
4. Provides summary of test results and coverage
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
│   │   ├── builder.ts        # Xcode build tools
│   │   └── testing.ts        # XCTest execution
│   ├── simulator/
│   │   └── controller.ts     # iOS Simulator control
│   ├── ui/
│   │   └── automation.ts     # UI automation (tap, swipe, type)
│   ├── workflow/
│   │   └── dev.ts            # Iterative development session
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
