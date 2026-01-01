# Swift Execution Examples

This directory contains example workflows for using the iOS Development MCP.

## Example 1: Simple Swift Execution

**User:** "Can you write me a function that reverses a string?"

**Claude:** "Sure! Here's a Swift function that reverses a string:"

```swift
func reverseString(_ input: String) -> String {
    return String(input.reversed())
}

// Test it
let original = "Hello, World!"
let reversed = reverseString(original)
print("Original: \(original)")
print("Reversed: \(reversed)")
```

**Output:**
```
Original: Hello, World!
Reversed: !dlroW ,olleH
```

---

## Example 2: Build and Run iOS App

**User:** "Build and run my app on the iPhone 15 Pro simulator"

**Claude workflow:**
1. Build project using xcode_build
2. Launch simulator with simulator_launch
3. Install app with simulator_install_app
4. Take screenshot with simulator_screenshot
5. Show result to user

---

## Example 3: UI Testing

**User:** "Test the login flow in my app"

**Claude workflow:**
1. Launch app on simulator
2. Find email text field
3. Enter test email
4. Find password field
5. Enter test password
6. Tap login button
7. Verify home screen appears
8. Report results

---

## Example 4: Algorithm Development

**User:** "Help me implement a binary search tree in Swift"

**Claude:** Iteratively develops and tests the implementation:

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

---

## Example 5: Debugging Workflow

**User:** "My app crashes when I tap the submit button"

**Claude workflow:**
1. Build and run app
2. Navigate to the problematic screen
3. Tap submit button
4. Capture crash log
5. Analyze error
6. Suggest fixes
7. Rebuild with fix
8. Verify it works

---

## More Examples Coming Soon

- SwiftUI preview generation
- Performance profiling
- Visual regression testing
- Multi-device testing
- CI/CD integration
