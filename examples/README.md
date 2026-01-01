# iOS Dev MCP — Example Workflows

Comprehensive examples showing the full capabilities of the iOS Development MCP server. These workflows demonstrate how to use the 53 available tools for everything from quick Swift experiments to full web-to-iOS conversion.

---

## Table of Contents

1. [Iterative Development (Replit-like)](#1-iterative-development-replit-like)
2. [Swift Code Execution](#2-swift-code-execution)
3. [Xcode Project Management](#3-xcode-project-management)
4. [Simulator Control](#4-simulator-control)
5. [UI Automation](#5-ui-automation)
6. [Testing Workflows](#6-testing-workflows)
7. [Environment Simulation](#7-environment-simulation)
8. [Web-to-iOS Development](#8-web-to-ios-development)
9. [Debugging & Diagnostics](#9-debugging--diagnostics)
10. [Complete Project Workflows](#10-complete-project-workflows)

---

## 1. Iterative Development (Replit-like)

The standout feature — build, run, and see results in one step.

### Start a Development Session

```
User: Start a dev session for ~/Projects/MyApp/MyApp.xcodeproj

Claude:
✅ Development session started
   Project: MyApp.xcodeproj
   Scheme: MyApp (auto-detected)
   Simulator: iPhone 15 Pro (iOS 17.2)

Ready for iteration! Use "build and run" to see your app.
```

### Build, Run, and Screenshot

```
User: Build and run

Claude:
1. Uses dev_run tool
2. Builds project (8.3s)
3. Installs on simulator
4. Launches app
5. Takes screenshot

✅ Build succeeded (8.3s)
   [Shows screenshot of running app]
```

### Quick Iteration Loop

```
User: Change the login button to use a blue gradient

Claude: [Makes the code change]

User: Rebuild

Claude:
1. Uses dev_restart (faster than full build)
2. Rebuilds (2.1s)
3. Relaunches
4. Screenshots

✅ Rebuilt in 2.1s
   [Shows screenshot with blue gradient button]
```

### Preview Without Rebuilding

```
User: Show me the current state

Claude:
1. Uses dev_preview
2. Takes screenshot without rebuilding

[Shows current simulator screenshot]
```

### Session Management

```
User: What's my current dev session?

Claude:
📋 Development Session Info:
   Project: ~/Projects/MyApp/MyApp.xcodeproj
   Scheme: MyApp
   Simulator: iPhone 15 Pro (UDID: ABC123...)
   Last build: 2 minutes ago (successful)
   App bundle: com.example.MyApp
```

```
User: End the session

Claude:
✅ Development session ended
   Simulator kept running (use simulator_shutdown to stop)
```

---

## 2. Swift Code Execution

### Simple Computation

```
User: Run this Swift code:
let numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
print("Sum: \(numbers.reduce(0, +))")
print("Average: \(Double(numbers.reduce(0, +)) / Double(numbers.count))")

Claude uses swift_execute:

Output:
Sum: 55
Average: 5.5
```

### Test a Function

```
User: Test this function for me:

func isPrime(_ n: Int) -> Bool {
    guard n > 1 else { return false }
    guard n > 3 else { return true }
    for i in 2...Int(Double(n).squareRoot()) {
        if n % i == 0 { return false }
    }
    return true
}

// Test cases
for n in [2, 3, 4, 17, 18, 97, 100] {
    print("\(n): \(isPrime(n))")
}

Output:
2: true
3: true
4: false
17: true
18: false
97: true
100: false
```

### Data Structure Implementation

```swift
// Binary Search Tree
class BinarySearchTree<T: Comparable> {
    var value: T
    var left: BinarySearchTree?
    var right: BinarySearchTree?

    init(_ value: T) {
        self.value = value
    }

    func insert(_ newValue: T) {
        if newValue < value {
            if let left = left {
                left.insert(newValue)
            } else {
                left = BinarySearchTree(newValue)
            }
        } else {
            if let right = right {
                right.insert(newValue)
            } else {
                right = BinarySearchTree(newValue)
            }
        }
    }

    func inOrder() -> [T] {
        var result: [T] = []
        if let left = left { result += left.inOrder() }
        result.append(value)
        if let right = right { result += right.inOrder() }
        return result
    }
}

let bst = BinarySearchTree(5)
[3, 7, 1, 4, 6, 8].forEach { bst.insert($0) }
print(bst.inOrder())  // [1, 3, 4, 5, 6, 7, 8]
```

---

## 3. Xcode Project Management

### Explore Project Structure

```
User: What schemes are in ~/Projects/MyApp/MyApp.xcodeproj?

Claude uses xcode_list_schemes:

📋 Project: MyApp.xcodeproj

Schemes:
  • MyApp
  • MyAppTests
  • MyAppUITests

Configurations:
  • Debug
  • Release

Targets:
  • MyApp (application)
  • MyAppTests (unit tests)
  • MyAppUITests (UI tests)
```

### Build for Simulator

```
User: Build MyApp for the simulator

Claude uses xcode_build:

🔨 Building MyApp...
   Configuration: Debug
   SDK: iphonesimulator
   Destination: iPhone 15 Pro

✅ Build Succeeded (12.4s)
   Product: ~/Library/Developer/Xcode/DerivedData/MyApp-.../Build/Products/Debug-iphonesimulator/MyApp.app
```

### Get Build Settings

```
User: What's the bundle identifier for MyApp?

Claude uses xcode_get_build_settings:

Build Settings for MyApp:
  PRODUCT_NAME = MyApp
  PRODUCT_BUNDLE_IDENTIFIER = com.example.MyApp
  INFOPLIST_FILE = MyApp/Info.plist
  SWIFT_VERSION = 5.0
  IPHONEOS_DEPLOYMENT_TARGET = 15.0
  ...
```

---

## 4. Simulator Control

### List Available Simulators

```
User: What simulators do I have?

Claude uses simulator_list:

📱 Available Simulators (showing available only):

iPhone 15 Pro Max (iOS 17.2) - Shutdown
  UDID: ABCD1234-...

iPhone 15 Pro (iOS 17.2) - Booted ✅
  UDID: EFGH5678-...

iPhone 15 (iOS 17.2) - Shutdown
  UDID: IJKL9012-...

iPad Pro 12.9" (iOS 17.2) - Shutdown
  UDID: MNOP3456-...
```

### Boot and Manage Simulators

```
User: Start the iPhone 15 Pro Max simulator

Claude uses simulator_boot:

✅ Booted iPhone 15 Pro Max
   UDID: ABCD1234-...
   Runtime: iOS 17.2
```

```
User: Shut it down

Claude uses simulator_shutdown:

✅ Simulator shut down successfully
```

### App Lifecycle

```
User: Install ~/Build/MyApp.app and launch it

Claude:
1. Uses simulator_install_app
2. Uses simulator_launch_app

✅ Installed MyApp.app
✅ Launched com.example.MyApp (PID: 12345)
```

### Screenshots and Deep Links

```
User: Take a screenshot

Claude uses simulator_screenshot:

✅ Screenshot saved: /tmp/ios-screenshot-abc123.png
   [Shows screenshot]
```

```
User: Open the deep link myapp://profile/user123

Claude uses simulator_open_url:

✅ Opened URL: myapp://profile/user123
   [Takes screenshot showing result]
```

---

## 5. UI Automation

### Basic Interactions

```
User: Tap on the login button at coordinates 200, 600

Claude uses ui_tap:

✅ Tapped at (200, 600)
```

```
User: Type my email into the focused field

Claude uses ui_type:

✅ Typed: "user@example.com"
```

### Gestures

```
User: Swipe up to scroll the list

Claude uses ui_swipe:

✅ Swiped from (200, 600) to (200, 200)
```

```
User: Long press on the item at 150, 300

Claude uses ui_long_press:

✅ Long pressed at (150, 300) for 1000ms
```

### Hardware Buttons

```
User: Press the home button

Claude uses ui_press_button:

✅ Pressed home button
```

```
User: Shake the device to trigger undo

Claude uses ui_press_button with "shake":

✅ Device shaken
```

### Appearance and Accessibility

```
User: Switch to dark mode

Claude uses ui_set_appearance:

✅ Set appearance to dark mode
   [Takes screenshot showing dark mode]
```

```
User: What's on the screen right now?

Claude uses ui_describe_screen:

📱 Current Screen Elements:
   • NavigationBar: "Settings"
   • Button: "Profile" at (50, 150)
   • Switch: "Dark Mode" (enabled) at (300, 250)
   • Button: "Sign Out" at (200, 400)
   • TabBar with 4 items at bottom
```

```
User: Find the Sign Out button

Claude uses ui_find_element:

🔍 Found element:
   Type: Button
   Label: "Sign Out"
   Identifier: "signout-button"
   Frame: (50, 380, 300, 44)
```

### Biometric Testing

```
User: Test Face ID authentication - make it succeed

Claude uses simulate_biometric with match: true:

✅ Simulated successful Face ID match
```

---

## 6. Testing Workflows

### Run All Tests

```
User: Run the tests for MyApp

Claude uses xcode_test:

🧪 Running tests for MyApp...

Test Results:
   ✅ MyAppTests (14 passed, 0 failed)
      • testUserLogin (0.12s)
      • testUserLogout (0.08s)
      • testDataFetch (0.34s)
      ...

   ✅ MyAppUITests (6 passed, 0 failed)
      • testLoginFlow (2.1s)
      • testNavigationFlow (1.8s)
      ...

Total: 20 tests, 20 passed, 0 failed
```

### Run Specific Tests

```
User: Run only the LoginTests class

Claude uses xcode_test with testClass: "LoginTests":

🧪 Running LoginTests...

Test Results:
   ✅ LoginTests (4 passed, 0 failed)
      • testValidCredentials (0.15s)
      • testInvalidCredentials (0.12s)
      • testEmptyFields (0.08s)
      • testRememberMe (0.10s)
```

### Code Coverage

```
User: Run tests with coverage and show me the report

Claude:
1. Uses xcode_test with enableCoverage: true
2. Uses xcode_coverage

📊 Code Coverage Report:

Overall: 78.4%

By File:
   LoginViewController.swift: 92.3%
   UserService.swift: 85.1%
   NetworkManager.swift: 71.2%
   DataModel.swift: 68.9%
   AppDelegate.swift: 45.0%

Uncovered Lines:
   NetworkManager.swift:145-152 (error handling)
   DataModel.swift:89-95 (edge case)
```

### List Available Tests

```
User: What tests are available in the project?

Claude uses xcode_test_list:

📋 Available Tests:

MyAppTests:
   • LoginTests
      - testValidCredentials
      - testInvalidCredentials
      - testEmptyFields
   • UserServiceTests
      - testFetchUser
      - testUpdateUser
      - testDeleteUser
   ...

MyAppUITests:
   • LoginUITests
      - testLoginFlow
      - testLoginError
   ...
```

---

## 7. Environment Simulation

### Network Conditions

```
User: Test my app on a slow 3G connection

Claude uses set_network_condition with "3G":

✅ Network condition set to 3G
   Bandwidth: ~780 Kbps
   Latency: ~200ms

[Takes screenshot showing loading state]
```

```
User: Now test with no network

Claude uses set_network_condition with "100% Loss":

✅ Network condition set to 100% Loss (offline)

[Takes screenshot showing offline state]
```

```
User: Reset the network

Claude uses set_network_condition with "reset":

✅ Network condition reset to normal
```

### GPS Location

```
User: Set the location to Tokyo

Claude uses set_location with preset "tokyo":

✅ Location set to Tokyo
   Latitude: 35.6762
   Longitude: 139.6503
```

```
User: Set a custom location at 37.7749, -122.4194

Claude uses set_location:

✅ Location set to custom coordinates
   Latitude: 37.7749
   Longitude: -122.4194
```

### Memory and System

```
User: Trigger a memory warning to test my cleanup code

Claude uses trigger_memory_warning:

✅ Memory warning triggered
   Check logs for didReceiveMemoryWarning calls
```

### Push Notifications

```
User: Send a test push notification

Claude uses send_push:

✅ Push notification sent:
   Title: "New Message"
   Body: "You have a new message from John"
   Badge: 1
```

---

## 8. Web-to-iOS Development

### Analyze a Website's UI

```
User: Analyze the UI at https://example.com/dashboard

Claude uses web_analyze_ui:

🎨 UI Analysis for example.com/dashboard:

Layout Pattern: Dashboard with sidebar navigation
Color Scheme:
  Primary: #3B82F6 (Blue)
  Secondary: #10B981 (Green)
  Background: #F3F4F6 (Light Gray)
  Text: #1F2937 (Dark Gray)

Components Detected:
  • Sidebar navigation (vertical)
  • Header with search bar
  • Card grid (3 columns)
  • Data tables
  • Chart widgets

Typography:
  Headings: Inter, 600 weight
  Body: Inter, 400 weight
```

### Extract Color Scheme

```
User: Extract the colors from that website

Claude uses web_extract_colors:

🎨 Extracted Color Palette:

Primary Colors:
  #3B82F6 - Blue (buttons, links)
  #10B981 - Green (success states)
  #EF4444 - Red (errors)

Neutral Colors:
  #1F2937 - Dark text
  #6B7280 - Secondary text
  #F3F4F6 - Background
  #FFFFFF - Card background

SwiftUI Color Extension:
extension Color {
    static let primaryBlue = Color(hex: "3B82F6")
    static let successGreen = Color(hex: "10B981")
    static let errorRed = Color(hex: "EF4444")
    ...
}
```

### Convert to SwiftUI

```
User: Convert this design to SwiftUI: A profile card with avatar, name, title, and follow button

Claude uses text_to_swiftui:

struct ProfileCard: View {
    let name: String
    let title: String
    let avatarURL: URL?
    let isFollowing: Bool
    let onFollow: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            // Avatar
            AsyncImage(url: avatarURL) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                Circle()
                    .fill(Color.gray.opacity(0.3))
            }
            .frame(width: 80, height: 80)
            .clipShape(Circle())

            // Name and Title
            VStack(spacing: 4) {
                Text(name)
                    .font(.headline)
                    .foregroundColor(.primary)

                Text(title)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            // Follow Button
            Button(action: onFollow) {
                Text(isFollowing ? "Following" : "Follow")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(isFollowing ? .primary : .white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 8)
                    .background(isFollowing ? Color.clear : Color.blue)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(isFollowing ? Color.gray : Color.clear)
                    )
                    .cornerRadius(20)
            }
        }
        .padding(24)
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.1), radius: 10)
    }
}
```

### Download Images

```
User: Download the hero image from that page

Claude uses web_download_image:

✅ Image downloaded:
   Source: https://example.com/hero.jpg
   Saved to: ~/Downloads/hero.jpg
   Size: 1920x1080
   Format: JPEG
```

---

## 9. Debugging & Diagnostics

### Analyze Build Errors

```
User: I got a build error, here's the output: [paste build output]

Claude uses analyze_build_errors:

🔍 Build Error Analysis:

Error 1: Type mismatch
   File: LoginViewController.swift:45
   Issue: Cannot convert value of type 'String?' to expected argument type 'String'
   Suggestion: Use optional binding or provide a default value

   Fix:
   - userService.login(username: usernameField.text ?? "")
   + guard let username = usernameField.text else { return }
   + userService.login(username: username)

Error 2: Missing import
   File: NetworkManager.swift:12
   Issue: Cannot find type 'URLSession' in scope
   Suggestion: Add 'import Foundation' at the top of the file
```

### Track Session Errors

```
User: Show me error patterns from this session

Claude uses get_error_stats:

📊 Session Error Statistics:

Total Errors: 7
Unique Patterns: 3

Recurring Issues:
  • Optional unwrapping (3 occurrences)
    Files: LoginVC, ProfileVC, SettingsVC
    Suggestion: Consider using guard let pattern consistently

  • Missing imports (2 occurrences)
    Pattern: Foundation types used without import

  • Type mismatches (2 occurrences)
    Pattern: String? vs String
```

### Get Simulator Logs

```
User: Get the crash logs for my app

Claude uses simulator_get_logs with bundleId filter:

📋 Recent Logs for com.example.MyApp:

[ERROR] 10:45:32 - Fatal error: Unexpectedly found nil
   Thread 1: signal SIGABRT
   0: MyApp.AppDelegate.application(_:didFinishLaunchingWithOptions:)
   1: MyApp.UserService.fetchCurrentUser()

[WARNING] 10:45:30 - Failed to load user defaults
   Key: "lastLoginDate" not found

[INFO] 10:45:28 - App launched
   Version: 1.0.0
   Build: 42
```

### Video Recording

```
User: Start recording the simulator

Claude uses simulator_start_recording:

🎬 Recording started
   Output: ~/Desktop/simulator-recording.mp4
```

```
User: Stop recording

Claude uses simulator_stop_recording:

🎬 Recording stopped
   Saved to: ~/Desktop/simulator-recording.mp4
   Duration: 45 seconds
```

---

## 10. Complete Project Workflows

### New Feature Development

```
User: I want to add a profile page to my app

Claude:
1. Starts dev session with dev_session_start
2. Creates ProfileViewController.swift
3. Adds UI elements
4. Builds with dev_run
5. Takes screenshot to show progress

User: The avatar is too small

Claude:
1. Increases avatar size in code
2. Uses dev_restart for quick rebuild
3. Screenshots to confirm change

User: Add a settings button in the nav bar

Claude:
1. Adds UIBarButtonItem
2. dev_restart
3. Screenshots

User: Test the dark mode

Claude:
1. Uses ui_set_appearance("dark")
2. Takes screenshot in dark mode
3. Notes any styling issues
```

### Bug Investigation

```
User: Users are reporting the app crashes when opening the settings

Claude:
1. Uses simulator_get_logs to find crash reports
2. Identifies: "Force unwrap of nil at SettingsVC:89"
3. Uses analyze_build_errors to suggest fix
4. Makes the fix
5. Uses xcode_test to run SettingsTests
6. Uses dev_run to verify fix visually
```

### Design Implementation from Web

```
User: I want my app to look like the dashboard at example.com

Claude:
1. Uses web_analyze_ui to understand the design
2. Uses web_extract_colors to get the color palette
3. Creates SwiftUI views matching the design
4. Uses dev_run to build and show results
5. Uses ui_set_appearance("dark") to test dark mode
6. Takes screenshots for comparison
```

### Full Test Suite

```
User: Run all tests, fix any failures, and give me coverage

Claude:
1. Uses xcode_test with enableCoverage: true
2. Identifies 2 failing tests
3. Investigates failures with logs
4. Fixes the issues
5. Re-runs tests to confirm
6. Uses xcode_coverage for final report
7. Provides summary with improvement suggestions
```

---

## Tips for Best Results

1. **Use dev sessions** — Start with `dev_session_start` for the fastest iteration loop

2. **Name your simulators** — Use device names like "iPhone 15 Pro" instead of UDIDs

3. **Check environment first** — Use `ios_dev_info` to verify your setup

4. **Let Claude find paths** — Use `xcode_get_build_settings` to locate build artifacts

5. **Iterate in small steps** — Use `dev_restart` for quick changes instead of full rebuilds

6. **Combine with screenshots** — After any UI change, take a screenshot to verify

7. **Use accessibility inspection** — `ui_describe_screen` helps Claude understand what's visible

8. **Track errors** — `get_error_stats` helps identify recurring issues

---

## What's Next?

The iOS Dev MCP continues to evolve. Upcoming capabilities:

- Real device deployment and testing
- Watch and tvOS simulator support
- Performance profiling integration
- Visual regression testing
- CI/CD pipeline integration
