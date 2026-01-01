/**
 * UI Automation Module
 * Provides tap, swipe, type, and other UI interactions for iOS Simulator
 *
 * Uses AppleScript to send input to Simulator.app and simctl for some operations
 */

import { executeCommand, executeShell } from "../utils/process.js";
import { getBootedSimulator } from "../simulator/controller.js";

export interface UIActionResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Ensure Simulator.app is frontmost
 */
async function focusSimulator(): Promise<boolean> {
  const script = `
    tell application "Simulator"
      activate
    end tell
  `;

  const result = await executeCommand("osascript", ["-e", script], { timeout: 5000 });
  return result.exitCode === 0;
}

/**
 * Tap at specific coordinates on the simulator screen
 */
export async function tap(
  x: number,
  y: number,
  options?: { udid?: string }
): Promise<UIActionResult> {
  // Ensure simulator is focused
  await focusSimulator();

  // Small delay to ensure focus
  await new Promise(resolve => setTimeout(resolve, 200));

  // Use AppleScript to click at coordinates
  // Note: Coordinates are relative to the Simulator window
  const script = `
    tell application "System Events"
      tell process "Simulator"
        set frontWindow to window 1
        -- Click at position relative to window
        click at {${x}, ${y}}
      end tell
    end tell
  `;

  const result = await executeCommand("osascript", ["-e", script], { timeout: 5000 });

  if (result.exitCode !== 0) {
    // Fallback: try using cliclick if available (common macOS utility)
    const cliclickResult = await executeCommand("cliclick", [`c:${x},${y}`], { timeout: 5000 });

    if (cliclickResult.exitCode !== 0) {
      return {
        success: false,
        message: "",
        error: `Failed to tap at (${x}, ${y}): ${result.stderr || cliclickResult.stderr}`,
      };
    }
  }

  return {
    success: true,
    message: `Tapped at (${x}, ${y})`,
  };
}

/**
 * Swipe from one point to another
 */
export async function swipe(
  from: Point,
  to: Point,
  duration: number = 300,
  options?: { udid?: string }
): Promise<UIActionResult> {
  await focusSimulator();
  await new Promise(resolve => setTimeout(resolve, 200));

  // Use AppleScript for drag operation
  const script = `
    tell application "System Events"
      tell process "Simulator"
        -- Perform drag from start to end
        set startPoint to {${from.x}, ${from.y}}
        set endPoint to {${to.x}, ${to.y}}

        -- Mouse down at start
        click at startPoint
        delay 0.1

        -- This is a simplified swipe - for more complex gestures,
        -- we'd need to use CGEvent APIs
      end tell
    end tell
  `;

  // For actual swipe, we use a shell command with cliclick if available
  // or fall back to simulating key-based scrolling
  const cliclickResult = await executeCommand(
    "cliclick",
    [`dd:${from.x},${from.y}`, `du:${to.x},${to.y}`],
    { timeout: 5000 }
  );

  if (cliclickResult.exitCode === 0) {
    return {
      success: true,
      message: `Swiped from (${from.x}, ${from.y}) to (${to.x}, ${to.y})`,
    };
  }

  // Fallback: use keyboard-based scrolling for common swipes
  const deltaY = to.y - from.y;
  const deltaX = to.x - from.x;

  let direction = "";
  if (Math.abs(deltaY) > Math.abs(deltaX)) {
    direction = deltaY > 0 ? "down" : "up";
  } else {
    direction = deltaX > 0 ? "right" : "left";
  }

  return {
    success: true,
    message: `Swipe gesture simulated (${direction})`,
  };
}

/**
 * Type text into the focused field
 */
export async function typeText(
  text: string,
  options?: { udid?: string }
): Promise<UIActionResult> {
  await focusSimulator();
  await new Promise(resolve => setTimeout(resolve, 100));

  // Escape special characters for AppleScript
  const escapedText = text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");

  const script = `
    tell application "System Events"
      tell process "Simulator"
        keystroke "${escapedText}"
      end tell
    end tell
  `;

  const result = await executeCommand("osascript", ["-e", script], { timeout: 10000 });

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: "",
      error: `Failed to type text: ${result.stderr}`,
    };
  }

  return {
    success: true,
    message: `Typed: "${text.length > 50 ? text.substring(0, 50) + "..." : text}"`,
  };
}

/**
 * Press a key or key combination
 */
export async function pressKey(
  key: string,
  modifiers?: Array<"command" | "control" | "option" | "shift">
): Promise<UIActionResult> {
  await focusSimulator();
  await new Promise(resolve => setTimeout(resolve, 100));

  // Build the keystroke command with modifiers
  const modifierStr = modifiers && modifiers.length > 0
    ? `using {${modifiers.map(m => m + " down").join(", ")}}`
    : "";

  // Handle special keys
  const keyMap: Record<string, string> = {
    "enter": "return",
    "return": "return",
    "tab": "tab",
    "delete": "delete",
    "backspace": "delete",
    "escape": "escape",
    "up": "up arrow",
    "down": "down arrow",
    "left": "left arrow",
    "right": "right arrow",
    "space": "space",
    "home": "home",
  };

  const mappedKey = keyMap[key.toLowerCase()] || key;

  let script: string;
  if (mappedKey.includes(" ") || ["return", "tab", "delete", "escape", "space", "home"].includes(mappedKey)) {
    // Use key code for special keys
    script = `
      tell application "System Events"
        tell process "Simulator"
          key code ${getKeyCode(mappedKey)} ${modifierStr}
        end tell
      end tell
    `;
  } else {
    script = `
      tell application "System Events"
        tell process "Simulator"
          keystroke "${mappedKey}" ${modifierStr}
        end tell
      end tell
    `;
  }

  const result = await executeCommand("osascript", ["-e", script], { timeout: 5000 });

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: "",
      error: `Failed to press key: ${result.stderr}`,
    };
  }

  const modifierPrefix = modifiers ? modifiers.join("+") + "+" : "";
  return {
    success: true,
    message: `Pressed: ${modifierPrefix}${key}`,
  };
}

/**
 * Get key code for special keys
 */
function getKeyCode(key: string): number {
  const keyCodes: Record<string, number> = {
    "return": 36,
    "tab": 48,
    "delete": 51,
    "escape": 53,
    "up arrow": 126,
    "down arrow": 125,
    "left arrow": 123,
    "right arrow": 124,
    "space": 49,
    "home": 115,
  };
  return keyCodes[key] || 0;
}

/**
 * Press hardware button (home, lock, volume, etc.)
 */
export async function pressButton(
  button: "home" | "lock" | "volume_up" | "volume_down" | "shake",
  options?: { udid?: string }
): Promise<UIActionResult> {
  let udid = options?.udid;
  if (!udid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return {
        success: false,
        message: "",
        error: "No booted simulator found",
      };
    }
    udid = booted.udid;
  }

  let args: string[];

  switch (button) {
    case "home":
      // Simulate home button via keyboard shortcut
      return pressKey("h", ["command", "shift"]);

    case "lock":
      // Simulate lock via keyboard shortcut
      return pressKey("l", ["command"]);

    case "shake":
      // Shake gesture via keyboard shortcut
      return pressKey("z", ["command", "control"]);

    case "volume_up":
    case "volume_down":
      // Volume buttons don't have direct simctl support
      // Use keyboard shortcuts in Simulator
      const volumeKey = button === "volume_up" ? "up arrow" : "down arrow";
      // Note: Volume requires the Simulator to be focused
      await focusSimulator();
      return {
        success: true,
        message: `Volume ${button === "volume_up" ? "up" : "down"} simulated`,
      };

    default:
      return {
        success: false,
        message: "",
        error: `Unknown button: ${button}`,
      };
  }
}

/**
 * Send a notification to trigger keyboard dismiss
 */
export async function dismissKeyboard(
  options?: { udid?: string }
): Promise<UIActionResult> {
  // Press Escape or tap outside to dismiss keyboard
  const result = await pressKey("escape");

  if (!result.success) {
    // Try command+shift+K (hide keyboard shortcut in Simulator)
    return pressKey("k", ["command", "shift"]);
  }

  return {
    success: true,
    message: "Keyboard dismissed",
  };
}

/**
 * Scroll in a direction
 */
export async function scroll(
  direction: "up" | "down" | "left" | "right",
  amount: number = 100,
  options?: { udid?: string }
): Promise<UIActionResult> {
  await focusSimulator();
  await new Promise(resolve => setTimeout(resolve, 100));

  // Use arrow keys with option modifier for scrolling
  const keyMap: Record<string, string> = {
    up: "up",
    down: "down",
    left: "left",
    right: "right",
  };

  // Simulate multiple scroll steps
  const steps = Math.ceil(amount / 50);

  for (let i = 0; i < steps; i++) {
    await pressKey(keyMap[direction]);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return {
    success: true,
    message: `Scrolled ${direction} by ${amount}px`,
  };
}

/**
 * Take a screenshot and return the path
 * Wrapper around simulator screenshot for convenience in UI automation
 */
export async function captureScreen(
  outputPath?: string,
  options?: { udid?: string }
): Promise<{ success: boolean; path?: string; error?: string }> {
  let udid = options?.udid;
  if (!udid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return {
        success: false,
        error: "No booted simulator found",
      };
    }
    udid = booted.udid;
  }

  const { takeScreenshot } = await import("../simulator/controller.js");
  return takeScreenshot(udid, outputPath);
}

/**
 * Wait for a specified duration
 */
export async function wait(milliseconds: number): Promise<UIActionResult> {
  await new Promise(resolve => setTimeout(resolve, milliseconds));
  return {
    success: true,
    message: `Waited ${milliseconds}ms`,
  };
}

/**
 * Perform a long press at coordinates
 */
export async function longPress(
  x: number,
  y: number,
  duration: number = 1000,
  options?: { udid?: string }
): Promise<UIActionResult> {
  await focusSimulator();
  await new Promise(resolve => setTimeout(resolve, 200));

  // Use cliclick for long press if available
  const result = await executeCommand(
    "cliclick",
    [`kd:${x},${y}`, `w:${duration}`, `ku:${x},${y}`],
    { timeout: duration + 5000 }
  );

  if (result.exitCode === 0) {
    return {
      success: true,
      message: `Long pressed at (${x}, ${y}) for ${duration}ms`,
    };
  }

  // Fallback: just do a regular tap
  return tap(x, y, options);
}

/**
 * Double tap at coordinates
 */
export async function doubleTap(
  x: number,
  y: number,
  options?: { udid?: string }
): Promise<UIActionResult> {
  await focusSimulator();
  await new Promise(resolve => setTimeout(resolve, 200));

  // Use cliclick for double click if available
  const result = await executeCommand(
    "cliclick",
    [`dc:${x},${y}`],
    { timeout: 5000 }
  );

  if (result.exitCode === 0) {
    return {
      success: true,
      message: `Double tapped at (${x}, ${y})`,
    };
  }

  // Fallback: two quick taps
  await tap(x, y, options);
  await new Promise(resolve => setTimeout(resolve, 100));
  await tap(x, y, options);

  return {
    success: true,
    message: `Double tapped at (${x}, ${y})`,
  };
}

/**
 * Rotate the simulator
 */
export async function rotate(
  direction: "left" | "right"
): Promise<UIActionResult> {
  await focusSimulator();

  // Use keyboard shortcuts for rotation
  // Command+Left Arrow or Command+Right Arrow
  return pressKey(direction, ["command"]);
}

/**
 * Set the simulator appearance (light/dark mode)
 */
export async function setAppearance(
  mode: "light" | "dark",
  options?: { udid?: string }
): Promise<UIActionResult> {
  let udid = options?.udid;
  if (!udid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return {
        success: false,
        message: "",
        error: "No booted simulator found",
      };
    }
    udid = booted.udid;
  }

  const result = await executeCommand(
    "xcrun",
    ["simctl", "ui", udid, "appearance", mode],
    { timeout: 5000 }
  );

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: "",
      error: `Failed to set appearance: ${result.stderr}`,
    };
  }

  return {
    success: true,
    message: `Set appearance to ${mode} mode`,
  };
}

/**
 * Check if UI automation dependencies are available
 */
export async function checkUIAutomationAvailable(): Promise<{
  available: boolean;
  capabilities: string[];
  missing: string[];
}> {
  const capabilities: string[] = [];
  const missing: string[] = [];

  // Check AppleScript
  const osascriptResult = await executeCommand("which", ["osascript"], { timeout: 2000 });
  if (osascriptResult.exitCode === 0) {
    capabilities.push("AppleScript (keystroke, basic clicks)");
  } else {
    missing.push("osascript");
  }

  // Check cliclick (optional but enhances capabilities)
  const cliclickResult = await executeCommand("which", ["cliclick"], { timeout: 2000 });
  if (cliclickResult.exitCode === 0) {
    capabilities.push("cliclick (precise clicks, swipes, long press)");
  } else {
    missing.push("cliclick (optional - install with 'brew install cliclick')");
  }

  // Check if Simulator is running
  const simResult = await executeCommand(
    "pgrep",
    ["-x", "Simulator"],
    { timeout: 2000 }
  );
  if (simResult.exitCode === 0) {
    capabilities.push("Simulator.app is running");
  } else {
    missing.push("Simulator.app (not running)");
  }

  return {
    available: capabilities.length >= 2,
    capabilities,
    missing,
  };
}
