# iOS Development MCP Server

> **The complete iOS development toolkit for Claude** — 53 tools for Swift execution, Xcode builds, simulator control, UI automation, testing, web-to-iOS conversion, and more.

A unified Model Context Protocol (MCP) server that brings together everything you need for iOS development into one seamless workflow with Claude. No more juggling multiple tools — just conversational development from code to build to test to debug.

## ✨ Key Features

| Category | Tools | Capabilities |
|----------|-------|--------------|
| **Iterative Development** | 6 | Replit-like live preview workflow |
| **Swift Execution** | 1 | Run Swift code snippets instantly |
| **Xcode Building** | 3 | Build projects, list schemes, get settings |
| **Simulator Control** | 9 | Boot, install, launch, screenshot, logs |
| **Advanced Simulator** | 8 | Video, push notifications, network, location |
| **UI Automation** | 11 | Tap, swipe, type, gestures, buttons |
| **Accessibility** | 2 | Describe screens, find elements |
| **XCTest Integration** | 3 | Run tests, coverage reports |
| **Web Integration** | 6 | Web-to-iOS conversion, UI analysis |
| **Project Context** | 1 | Generate CLAUDE.md files |
| **Error Diagnostics** | 2 | Parse errors, suggest fixes |
| **System Info** | 1 | Check development environment |

## 🚀 Iterative Development (Replit-like Experience)

The standout feature of this MCP server is the **iterative development workflow** — similar to Replit's live preview. Instead of manually building, installing, and launching your app:

```
1. "Start a dev session for my app at ~/MyApp/MyApp.xcodeproj"
2. Make code changes
3. "Rebuild and show me the result"
4. See screenshot of your running app
5. Repeat!
```

This combines **build → install → launch → screenshot** into one seamless step, giving you immediate visual feedback on your changes.

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/bhavenmurji/ios-dev-mcp.git
cd ios-dev-mcp

# Install dependencies
npm install

# Build the server
npm run build
```

## ⚙️ Configuration

### Claude Desktop

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

### Claude Code (CLI)

```bash
claude mcp add ios-dev --scope user \
  --command "node" \
  --args "/path/to/ios-dev-mcp/build/index.js"
```

Or add to `~/.claude.json`:

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

---

## 🛠️ Complete Tool Reference

### Iterative Development Workflow

Start here for the best development experience!

| Tool | Description |
|------|-------------|
| `dev_session_start` | Start a development session for rapid iteration |
| `dev_run` | Build, install, launch, and screenshot in one step |
| `dev_restart` | Quick rebuild and relaunch for small changes |
| `dev_preview` | Take a screenshot without rebuilding |
| `dev_session_info` | Show current session details |
| `dev_session_end` | End the development session |

**Example:**
```
"Start a dev session for ~/MyApp/MyApp.xcodeproj on iPhone 15 Pro"
"Build and run" → See screenshot
"I changed the button color, rebuild" → See updated screenshot
```

---

### Swift Execution

| Tool | Description |
|------|-------------|
| `swift_execute` | Execute Swift code snippets with timeout handling |

**Parameters:**
- `code` (required): Swift code to execute
- `timeout` (optional): Timeout in ms (default: 30000)

**Example:**
```
"Run this Swift: print([1,2,3,4,5].reduce(0, +))"
```

---

### Xcode Building

| Tool | Description |
|------|-------------|
| `xcode_list_schemes` | List schemes, configurations, and targets |
| `xcode_build` | Build projects/workspaces (Debug/Release) |
| `xcode_get_build_settings` | Get build settings for a scheme |

**Parameters for `xcode_build`:**
- `projectPath` (required): Path to .xcodeproj or .xcworkspace
- `scheme` (required): Xcode scheme to build
- `configuration` (optional): "Debug" or "Release"
- `sdk` (optional): SDK (e.g., "iphonesimulator")
- `destination` (optional): Build destination
- `clean` (optional): Clean before building

---

### iOS Simulator Control

| Tool | Description |
|------|-------------|
| `simulator_list` | List all available simulators |
| `simulator_boot` | Boot a simulator by UDID or name |
| `simulator_shutdown` | Shutdown a simulator |
| `simulator_install_app` | Install .app bundles |
| `simulator_uninstall_app` | Uninstall apps |
| `simulator_launch_app` | Launch installed apps |
| `simulator_terminate_app` | Terminate running apps |
| `simulator_screenshot` | Capture screenshots |
| `simulator_open_url` | Open URLs/deep links |

**Example:**
```
"Boot iPhone 15 Pro"
"Install my app from ~/Build/MyApp.app"
"Launch com.example.myapp and take a screenshot"
```

---

### Advanced Simulator Features

| Tool | Description |
|------|-------------|
| `simulator_get_app_container` | Get app container paths (data, groups) |
| `simulator_get_logs` | Retrieve simulator logs |
| `simulator_start_recording` | Start video recording |
| `simulator_stop_recording` | Stop and save video |
| `send_push` | Send push notifications |
| `set_network_condition` | Simulate network (3G, LTE, offline) |
| `set_location` | Simulate GPS location |
| `trigger_memory_warning` | Trigger memory warnings |

**Network Conditions:** `100% Loss`, `3G`, `DSL`, `Edge`, `LTE`, `Very Bad Network`, `WiFi`, `reset`

**Location Presets:** `apple`, `london`, `tokyo`, `newyork`, `sydney`, `sanfrancisco`

---

### UI Automation

| Tool | Description |
|------|-------------|
| `ui_tap` | Tap at coordinates |
| `ui_double_tap` | Double tap |
| `ui_long_press` | Long press (configurable duration) |
| `ui_swipe` | Swipe gestures |
| `ui_type` | Type text into focused fields |
| `ui_press_key` | Press keys with modifiers |
| `ui_press_button` | Hardware buttons (home, lock, volume, shake) |
| `ui_scroll` | Scroll in directions |
| `ui_dismiss_keyboard` | Dismiss on-screen keyboard |
| `ui_set_appearance` | Switch light/dark mode |
| `simulate_biometric` | Simulate Face ID/Touch ID |

**Example:**
```
"Tap at 200, 400"
"Type 'hello@example.com' then press enter"
"Swipe up from the bottom"
"Switch to dark mode"
```

---

### Accessibility Inspection

| Tool | Description |
|------|-------------|
| `ui_describe_screen` | Describe interactive elements on screen |
| `ui_find_element` | Find UI elements by label/identifier/type |

**Example:**
```
"Describe what's on the current screen"
"Find the Login button"
```

---

### XCTest Integration

| Tool | Description |
|------|-------------|
| `xcode_test` | Run unit and UI tests |
| `xcode_test_list` | List test targets and methods |
| `xcode_coverage` | Get code coverage reports |

**Parameters for `xcode_test`:**
- `projectPath` (required): Path to project
- `scheme` (required): Scheme to test
- `testPlan` (optional): Test plan name
- `testTarget` (optional): Specific test target
- `testClass` (optional): Specific test class
- `testMethod` (optional): Specific test method
- `enableCoverage` (optional): Enable coverage

**Example:**
```
"Run all tests for MyApp"
"Run only LoginTests with coverage"
"Show me the test coverage report"
```

---

### Web Integration

These tools enable web-to-iOS development workflows.

| Tool | Description |
|------|-------------|
| `web_fetch` | Fetch and analyze web content |
| `web_to_ios` | Convert web content to iOS app structure |
| `web_analyze_ui` | Analyze webpage for UI/UX patterns |
| `web_download_image` | Download images from web |
| `web_extract_colors` | Extract color schemes from web |
| `text_to_swiftui` | Convert text/designs to SwiftUI code |

**Example:**
```
"Analyze the UI at https://example.com/dashboard"
"Extract the color scheme from that website"
"Convert this design description to SwiftUI"
```

---

### Project Context

| Tool | Description |
|------|-------------|
| `generate_claude_md` | Generate CLAUDE.md context files |

Creates a context file that helps Claude understand your project structure, making future conversations more productive.

---

### Error Diagnostics

| Tool | Description |
|------|-------------|
| `analyze_build_errors` | Parse build errors and suggest fixes |
| `get_error_stats` | Get session error statistics |

Tracks recurring issues to prevent debugging loops and provides intelligent fix suggestions.

---

### System Info

| Tool | Description |
|------|-------------|
| `ios_dev_info` | Check iOS development tools availability |

---

## 📖 Example Workflows

### Quick Iteration Loop

```
User: Start a dev session for ~/MyApp/MyApp.xcodeproj

Claude: ✅ Session started with scheme "MyApp" on iPhone 15 Pro

User: Build and run

Claude: ✅ Built in 8.3s, installed, launched. [Shows screenshot]

User: Change the button background to blue

Claude: [Makes the change]

User: Rebuild

Claude: ✅ Rebuilt in 2.1s. [Shows updated screenshot]
```

### Debug a Crash

```
User: My app keeps crashing, can you help?

Claude:
1. Gets simulator logs filtered by app
2. Analyzes crash and identifies: "Force unwrap of nil in AppDelegate:23"
3. Suggests fix with code example
```

### Test Deep Links

```
User: Test myapp://profile/123

Claude:
1. Opens URL in simulator
2. Takes screenshot showing the result
3. Confirms deep link handled correctly
```

### UI Automation Testing

```
User: Test the login flow

Claude:
1. Taps email field, types test@example.com
2. Taps password field, types password
3. Taps Login button
4. Takes screenshot of result
5. Describes what's on screen
```

### Web-to-iOS Conversion

```
User: Analyze the UI at https://dribbble.com/shots/example

Claude:
1. Fetches and analyzes the design
2. Extracts color scheme
3. Identifies UI patterns
4. Generates SwiftUI code matching the design
```

---

## 📋 Requirements

- **macOS 13.0+** (for Xcode and Simulator)
- **Xcode 15.0+** with command-line tools
- **Node.js 18+**
- **Swift 5.9+**

---

## 🏗️ Architecture

```
ios-dev-mcp/
├── src/
│   ├── index.ts              # MCP server + 53 tool definitions
│   ├── swift/
│   │   └── executor.ts       # Swift code execution
│   ├── xcode/
│   │   ├── builder.ts        # Xcode building
│   │   └── testing.ts        # XCTest execution
│   ├── simulator/
│   │   ├── controller.ts     # Simulator lifecycle
│   │   └── advanced.ts       # Video, push, network, location
│   ├── ui/
│   │   ├── automation.ts     # Tap, swipe, type, gestures
│   │   └── accessibility.ts  # Element inspection
│   ├── workflow/
│   │   └── dev.ts            # Iterative dev sessions
│   ├── context/
│   │   └── claude-md.ts      # CLAUDE.md generation
│   ├── diagnostics/
│   │   └── error-fixer.ts    # Smart error analysis
│   ├── web/
│   │   └── browser.ts        # Web fetching & conversion
│   └── utils/
│       ├── process.ts        # Command utilities
│       └── tempfile.ts       # Temp file management
├── tests/                    # Test suites
├── examples/                 # Example workflows
└── docs/                     # Documentation
```

---

## 🧑‍💻 Development

```bash
# Run tests
npm test

# Build in watch mode
npm run watch

# Lint code
npm run lint

# Run in development mode
npm run dev
```

---

## 🤝 Contributing

Contributions are welcome! This project consolidates ideas from several excellent projects:

- [SwiftClaude](https://github.com/GeorgeLyon/SwiftClaude) — Swift execution
- [ios-simulator-mcp](https://github.com/joshuayoes/ios-simulator-mcp) — UI automation
- [XcodeBuildMCP](https://github.com/cameroncooke/XcodeBuildMCP) — Build tools
- [xcode-mcp-server](https://github.com/r-huijts/xcode-mcp-server) — Comprehensive tools

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

Built on the shoulders of giants. Special thanks to:

- **George Lyon** (SwiftClaude)
- **Joshua Yoes** (ios-simulator-mcp)
- **Cameron Cooke** (XcodeBuildMCP)
- **R. Huijts** (xcode-mcp-server)
- The **Anthropic team** for MCP
- The **iOS development community**
