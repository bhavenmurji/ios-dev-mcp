# iOS Dev MCP - Example Workflows

This document shows example workflows you can accomplish with the iOS Development MCP server.

## Quick Start Examples

### 1. Run Swift Code

**Simple Computation:**
```
User: Run this Swift code for me:
let fibonacci = [1, 1, 2, 3, 5, 8, 13, 21, 34]
print("Sum: \(fibonacci.reduce(0, +))")
print("Average: \(Double(fibonacci.reduce(0, +)) / Double(fibonacci.count))")
```

Claude will use `swift_execute` to run the code and return:
```
Sum: 88
Average: 9.777777777777779
```

**Define and Test a Function:**
```
User: Can you test this Swift function?

func isPalindrome(_ str: String) -> Bool {
    let cleaned = str.lowercased().filter { $0.isLetter }
    return cleaned == String(cleaned.reversed())
}

print(isPalindrome("A man a plan a canal Panama"))
print(isPalindrome("Hello World"))
```

### 2. Explore an Xcode Project

**List Available Schemes:**
```
User: What schemes are available in my project at ~/MyApp/MyApp.xcodeproj?

Claude uses xcode_list_schemes and returns:
Schemes: MyApp, MyAppTests, MyAppUITests
Configurations: Debug, Release
Targets: MyApp, MyAppTests, MyAppUITests
```

**Get Build Settings:**
```
User: What's the bundle identifier for MyApp?

Claude uses xcode_get_build_settings with scheme "MyApp" and returns:
PRODUCT_NAME = MyApp
PRODUCT_BUNDLE_IDENTIFIER = com.example.MyApp
...
```

### 3. Work with iOS Simulator

**List Available Simulators:**
```
User: What simulators do I have available?

Claude uses simulator_list and returns:
Found 12 simulator(s):

iPhone 15 Pro (Shutdown) - com.apple.CoreSimulator.SimRuntime.iOS-17-2
  UDID: ABCD1234-...

iPhone 15 (Shutdown) - com.apple.CoreSimulator.SimRuntime.iOS-17-2
  UDID: EFGH5678-...
...
```

**Boot a Simulator:**
```
User: Start the iPhone 15 Pro simulator

Claude uses simulator_boot with deviceName "iPhone 15 Pro" and returns:
Successfully booted simulator iPhone 15 Pro
```

**Take a Screenshot:**
```
User: Take a screenshot of the current simulator

Claude uses simulator_screenshot and returns:
Screenshot saved to: /var/folders/.../ios-screenshot-abc123.png
```

## Complete Workflow Examples

### Build and Run an App

```
User: Build my app at ~/Projects/MyApp/MyApp.xcodeproj and run it on iPhone 15

Claude:
1. Uses xcode_list_schemes to discover the "MyApp" scheme
2. Uses xcode_build with:
   - projectPath: ~/Projects/MyApp/MyApp.xcodeproj
   - scheme: MyApp
   - sdk: iphonesimulator
   Returns: Build Succeeded (Time: 12.34s)

3. Uses simulator_boot with deviceName "iPhone 15"
   Returns: Successfully booted simulator iPhone 15

4. Uses xcode_get_build_settings to find the built app path
   Returns: BUILT_PRODUCTS_DIR = .../Build/Products/Debug-iphonesimulator

5. Uses simulator_install_app with the .app bundle path
   Returns: Successfully installed app

6. Uses simulator_launch_app with bundleId "com.example.MyApp"
   Returns: Successfully launched com.example.MyApp (PID: 12345)

7. Uses simulator_screenshot to capture the running app
   Returns: Screenshot saved to: ~/Desktop/app-running.png
```

### Debug a Crash

```
User: My app keeps crashing on launch, can you help debug?

Claude:
1. Uses simulator_get_logs filtered by the app's bundleId
   Returns recent logs including crash information

2. Analyzes the crash log and identifies the issue
   (e.g., "Found a crash in AppDelegate.swift:23 - Force unwrap of nil optional")

3. Suggests a fix based on the crash analysis
```

### Test a Deep Link

```
User: Test the deep link myapp://open?item=123 in my app

Claude:
1. Uses simulator_list to check for booted simulators
2. If needed, uses simulator_boot to start one
3. Uses simulator_open_url with url "myapp://open?item=123"
   Returns: Opened URL: myapp://open?item=123
4. Uses simulator_screenshot to show the result
```

### Check Development Environment

```
User: Is my iOS development environment set up correctly?

Claude uses ios_dev_info and returns:
iOS Development Tools Status:

Swift: Available (Swift version 5.9.2)
Xcode: Available (Xcode 15.2 Build version 15C500b)
simctl: Available
  Booted: iPhone 15 Pro (ABCD1234-...)
```

## Advanced Examples

### Iterative Development with Swift

```
User: Help me write a sorting algorithm in Swift. Let's start with bubble sort.

Claude writes the code and uses swift_execute to test it:

func bubbleSort(_ arr: inout [Int]) {
    for i in 0..<arr.count {
        for j in 0..<(arr.count - 1 - i) {
            if arr[j] > arr[j + 1] {
                arr.swapAt(j, j + 1)
            }
        }
    }
}

var numbers = [64, 34, 25, 12, 22, 11, 90]
bubbleSort(&numbers)
print(numbers)

Output: [11, 12, 22, 25, 34, 64, 90]
```

### Binary Search Tree Implementation

```swift
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

    func contains(_ searchValue: T) -> Bool {
        if searchValue == value {
            return true
        } else if searchValue < value {
            return left?.contains(searchValue) ?? false
        } else {
            return right?.contains(searchValue) ?? false
        }
    }
}

// Test it
let bst = BinarySearchTree(5)
bst.insert(3)
bst.insert(7)
bst.insert(1)
bst.insert(9)

print(bst.contains(7))  // true
print(bst.contains(4))  // false
```

### Batch Operations

```
User: Install my app on all booted simulators

Claude:
1. Uses simulator_list with onlyBooted: true to find all booted devices
2. For each booted simulator, uses simulator_install_app
3. Reports success/failure for each installation
```

## Tips

1. **Use device names for convenience**: Instead of remembering UDIDs, you can reference simulators by name like "iPhone 15 Pro"

2. **Default to booted simulator**: Most simulator operations will automatically use the currently booted simulator if you don't specify a UDID

3. **Check tool availability first**: Use `ios_dev_info` to verify your development tools are properly installed

4. **Handle build artifacts**: After building, use `xcode_get_build_settings` to find where the .app bundle was generated

## Future Examples

- SwiftUI preview generation
- Performance profiling
- Visual regression testing
- Multi-device testing
- CI/CD integration
- UI automation with accessibility labels
