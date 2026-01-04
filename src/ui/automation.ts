/**
 * UI Automation Module
 * Provides tap, swipe, type, and other UI interactions for iOS Simulator
 *
 * Uses AppleScript to send input to Simulator.app and simctl for some operations
 */

import { executeCommand, executeShell } from "../utils/process.js";
import { resolveUdid } from "../simulator/controller.js";

// Cache for IDB availability check
let idbAvailable: boolean | null = null;
let axeAvailable: boolean | null = null;

/**
 * Check if IDB (iOS Development Bridge) is installed and available
 * Results are cached for the session to avoid repeated checks
 */
export async function isIDBAvailable(): Promise<boolean> {
  if (idbAvailable !== null) {
    return idbAvailable;
  }

  const result = await executeCommand("which", ["idb"], { timeout: 2000 });
  idbAvailable = result.exitCode === 0;
  return idbAvailable;
}

/**
 * Check if AXe (Apple Accessibility APIs tool) is installed and available
 * Results are cached for the session to avoid repeated checks
 */
export async function isAXeAvailable(): Promise<boolean> {
  if (axeAvailable !== null) {
    return axeAvailable;
  }

  const result = await executeCommand("which", ["axe"], { timeout: 2000 });
  axeAvailable = result.exitCode === 0;
  return axeAvailable;
}

/**
 * Clear the cached availability checks (useful for testing or after installation)
 */
export function clearAvailabilityCache(): void {
  idbAvailable = null;
  axeAvailable = null;
}

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
 * Get Simulator window position and size
 */
async function getSimulatorWindowBounds(): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
} | null> {
  const script = `
    tell application "System Events"
      tell process "Simulator"
        if (count of windows) > 0 then
          set frontWindow to window 1
          set winPos to position of frontWindow
          set winSize to size of frontWindow
          return (item 1 of winPos) & "," & (item 2 of winPos) & "," & (item 1 of winSize) & "," & (item 2 of winSize)
        end if
      end tell
    end tell
  `;

  const result = await executeCommand("osascript", ["-e", script], { timeout: 5000 });
  if (result.exitCode !== 0 || !result.stdout.trim()) {
    return null;
  }

  const parts = result.stdout.trim().split(",").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return null;
  }

  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

/**
 * Tap at specific coordinates on the simulator screen
 *
 * Priority order:
 * 1. IDB (Facebook's iOS Development Bridge) - works directly with device coordinates
 * 2. AXe (Apple Accessibility APIs) - works directly with device coordinates
 * 3. cliclick - requires window position
 * 4. AppleScript - fallback, requires window position
 */
export async function tap(
  x: number,
  y: number,
  options?: { udid?: string }
): Promise<UIActionResult> {
  // Resolve UDID - handles "booted" alias and undefined
  const udid = await resolveUdid(options?.udid);

  // Method 1: Try IDB first (most reliable - doesn't need window position)
  // idb ui tap --udid <UDID> -- <x> <y>
  if (udid) {
    const idbResult = await executeCommand(
      "idb",
      ["ui", "tap", "--udid", udid, "--", String(x), String(y)],
      { timeout: 5000 }
    );
    if (idbResult.exitCode === 0) {
      return {
        success: true,
        message: `Tapped at (${x}, ${y}) via IDB`,
      };
    }
  }

  // Method 2: Try AXe (Apple Accessibility APIs - doesn't need window position)
  // axe tap -x <x> -y <y> --udid <UDID>
  if (udid) {
    const axeResult = await executeCommand(
      "axe",
      ["tap", "-x", String(x), "-y", String(y), "--udid", udid],
      { timeout: 5000 }
    );
    if (axeResult.exitCode === 0) {
      return {
        success: true,
        message: `Tapped at (${x}, ${y}) via AXe`,
      };
    }
  }

  // Method 3 & 4: Fall back to window-based approach (cliclick/AppleScript)
  // This requires getting the Simulator window position
  await focusSimulator();
  await new Promise(resolve => setTimeout(resolve, 200));

  const windowBounds = await getSimulatorWindowBounds();
  if (!windowBounds) {
    return {
      success: false,
      message: "",
      error: "Could not get Simulator window position. Install IDB (brew install idb-companion) or AXe for reliable tapping.",
    };
  }

  // Calculate absolute screen position
  const titleBarHeight = 28;
  const absX = windowBounds.x + x;
  const absY = windowBounds.y + titleBarHeight + y;

  // Method 3: Try cliclick
  const cliclickResult = await executeCommand("cliclick", [`c:${absX},${absY}`], { timeout: 5000 });
  if (cliclickResult.exitCode === 0) {
    return {
      success: true,
      message: `Tapped at (${x}, ${y}) via cliclick`,
    };
  }

  // Method 4: Fallback to AppleScript
  const script = `
    tell application "System Events"
      click at {${absX}, ${absY}}
    end tell
  `;

  const result = await executeCommand("osascript", ["-e", script], { timeout: 5000 });

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: "",
      error: `Failed to tap at (${x}, ${y}): ${result.stderr}. Install: brew install idb-companion (or) brew install axe (or) brew install cliclick`,
    };
  }

  return {
    success: true,
    message: `Tapped at (${x}, ${y}) via AppleScript`,
  };
}

/**
 * Swipe from one point to another
 *
 * Priority order:
 * 1. IDB (Facebook's iOS Development Bridge) - works directly with device coordinates
 * 2. AXe (Apple Accessibility APIs) - works directly with device coordinates
 * 3. cliclick - requires window position
 * 4. Fallback message
 */
export async function swipe(
  from: Point,
  to: Point,
  duration: number = 300,
  options?: { udid?: string }
): Promise<UIActionResult> {
  // Resolve UDID - handles "booted" alias and undefined
  const udid = await resolveUdid(options?.udid);

  // Convert duration from ms to seconds for IDB/AXe
  const durationSec = duration / 1000;

  // Method 1: Try IDB first (most reliable - doesn't need window position)
  // idb ui swipe --udid <UDID> --duration <SEC> -- <fromX> <fromY> <toX> <toY>
  if (udid) {
    const idbResult = await executeCommand(
      "idb",
      [
        "ui", "swipe", "--udid", udid,
        "--duration", String(durationSec),
        "--", String(from.x), String(from.y), String(to.x), String(to.y)
      ],
      { timeout: 10000 }
    );
    if (idbResult.exitCode === 0) {
      return {
        success: true,
        message: `Swiped from (${from.x}, ${from.y}) to (${to.x}, ${to.y}) via IDB`,
      };
    }
  }

  // Method 2: Try AXe (Apple Accessibility APIs - doesn't need window position)
  // axe swipe --from-x <x> --from-y <y> --to-x <x> --to-y <y> --duration <sec> --udid <UDID>
  if (udid) {
    const axeResult = await executeCommand(
      "axe",
      [
        "swipe",
        "--from-x", String(from.x), "--from-y", String(from.y),
        "--to-x", String(to.x), "--to-y", String(to.y),
        "--duration", String(durationSec),
        "--udid", udid
      ],
      { timeout: 10000 }
    );
    if (axeResult.exitCode === 0) {
      return {
        success: true,
        message: `Swiped from (${from.x}, ${from.y}) to (${to.x}, ${to.y}) via AXe`,
      };
    }
  }

  // Method 3: Fall back to window-based approach with cliclick
  await focusSimulator();
  await new Promise(resolve => setTimeout(resolve, 200));

  const windowBounds = await getSimulatorWindowBounds();
  if (!windowBounds) {
    return {
      success: false,
      message: "",
      error: "Could not get Simulator window position. Install IDB (brew install idb-companion) or AXe for reliable swiping.",
    };
  }

  // Calculate absolute screen positions
  const titleBarHeight = 28;
  const absFromX = windowBounds.x + from.x;
  const absFromY = windowBounds.y + titleBarHeight + from.y;
  const absToX = windowBounds.x + to.x;
  const absToY = windowBounds.y + titleBarHeight + to.y;

  // Use cliclick for drag if available
  const cliclickResult = await executeCommand(
    "cliclick",
    [`dd:${absFromX},${absFromY}`, `du:${absToX},${absToY}`],
    { timeout: 5000 }
  );

  if (cliclickResult.exitCode === 0) {
    return {
      success: true,
      message: `Swiped from (${from.x}, ${from.y}) to (${to.x}, ${to.y}) via cliclick`,
    };
  }

  // Fallback: no reliable swipe available
  const deltaY = to.y - from.y;
  const deltaX = to.x - from.x;
  let direction = "";
  if (Math.abs(deltaY) > Math.abs(deltaX)) {
    direction = deltaY > 0 ? "down" : "up";
  } else {
    direction = deltaX > 0 ? "right" : "left";
  }

  return {
    success: false,
    message: "",
    error: `Swipe (${direction}) failed. Install: brew install idb-companion (or) brew install axe (or) brew install cliclick`,
  };
}

/**
 * Type text into the focused field
 *
 * Priority order:
 * 1. IDB (Facebook's iOS Development Bridge)
 * 2. AXe (Apple Accessibility APIs)
 * 3. AppleScript (requires Simulator focus)
 */
export async function typeText(
  text: string,
  options?: { udid?: string }
): Promise<UIActionResult> {
  // Resolve UDID - handles "booted" alias and undefined
  const udid = await resolveUdid(options?.udid);

  // Method 1: Try IDB first
  // idb ui text --udid <UDID> "<text>"
  if (udid) {
    const idbResult = await executeCommand(
      "idb",
      ["ui", "text", "--udid", udid, text],
      { timeout: 10000 }
    );
    if (idbResult.exitCode === 0) {
      return {
        success: true,
        message: `Typed: "${text.length > 50 ? text.substring(0, 50) + "..." : text}" via IDB`,
      };
    }
  }

  // Method 2: Try AXe
  // axe type "<text>" --udid <UDID>
  if (udid) {
    const axeResult = await executeCommand(
      "axe",
      ["type", text, "--udid", udid],
      { timeout: 10000 }
    );
    if (axeResult.exitCode === 0) {
      return {
        success: true,
        message: `Typed: "${text.length > 50 ? text.substring(0, 50) + "..." : text}" via AXe`,
      };
    }
  }

  // Method 3: Fallback to AppleScript
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
      error: `Failed to type text: ${result.stderr}. Install IDB or AXe for reliable text input.`,
    };
  }

  return {
    success: true,
    message: `Typed: "${text.length > 50 ? text.substring(0, 50) + "..." : text}" via AppleScript`,
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
 *
 * Priority order:
 * 1. IDB (Facebook's iOS Development Bridge) - direct button press
 * 2. Keyboard shortcuts via AppleScript
 */
export async function pressButton(
  button: "home" | "lock" | "volume_up" | "volume_down" | "shake" | "siri" | "apple_pay",
  options?: { udid?: string }
): Promise<UIActionResult> {
  // Resolve UDID - handles "booted" alias and undefined
  const udid = await resolveUdid(options?.udid);
  if (!udid) {
    return {
      success: false,
      message: "",
      error: "No booted simulator found",
    };
  }

  // Map button names to IDB button codes
  // IDB supports: HOME, SIRI, SIDE_BUTTON, APPLE_PAY, LOCK
  const idbButtonMap: Record<string, string> = {
    home: "HOME",
    lock: "LOCK",
    siri: "SIRI",
    apple_pay: "APPLE_PAY",
    // side_button could also be used for lock on newer devices
  };

  // Method 1: Try IDB first for supported buttons
  const idbButton = idbButtonMap[button];
  if (idbButton) {
    const idbResult = await executeCommand(
      "idb",
      ["ui", "button", "--udid", udid, idbButton],
      { timeout: 5000 }
    );
    if (idbResult.exitCode === 0) {
      return {
        success: true,
        message: `Pressed ${button} button via IDB`,
      };
    }
  }

  // Method 2: Fallback to keyboard shortcuts
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

    case "siri":
      // Siri via long press on home or side button
      await focusSimulator();
      return pressKey("h", ["command", "shift"]);

    case "apple_pay":
      // Apple Pay via double-click side button (Command+Shift+H twice)
      await focusSimulator();
      await pressKey("h", ["command", "shift"]);
      await new Promise(resolve => setTimeout(resolve, 100));
      return pressKey("h", ["command", "shift"]);

    case "volume_up":
    case "volume_down":
      // Volume buttons don't have direct simctl support
      // Use keyboard shortcuts in Simulator
      await focusSimulator();
      // Try to simulate volume change via media keys
      const volumeResult = await executeCommand(
        "osascript",
        ["-e", `set volume output volume ((output volume of (get volume settings)) ${button === "volume_up" ? "+" : "-"} 10)`],
        { timeout: 5000 }
      );
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
 *
 * Priority order:
 * 1. IDB (Facebook's iOS Development Bridge) - works directly with device coordinates
 * 2. AXe (Apple Accessibility APIs) - works directly with device coordinates
 * 3. Keyboard shortcuts - fallback
 */
export async function scroll(
  direction: "up" | "down" | "left" | "right",
  amount: number = 100,
  options?: { udid?: string; x?: number; y?: number }
): Promise<UIActionResult> {
  // Resolve UDID - handles "booted" alias and undefined
  const udid = await resolveUdid(options?.udid);

  // Calculate delta values based on direction
  // IDB scroll uses: idb ui scroll --udid <UDID> -- <x> <y> <dx> <dy>
  // where (x, y) is the starting point and (dx, dy) is the scroll delta
  let dx = 0;
  let dy = 0;
  switch (direction) {
    case "up":
      dy = -amount;
      break;
    case "down":
      dy = amount;
      break;
    case "left":
      dx = -amount;
      break;
    case "right":
      dx = amount;
      break;
  }

  // Default starting position (center of typical screen)
  const startX = options?.x ?? 200;
  const startY = options?.y ?? 400;

  // Method 1: Try IDB first (most reliable - doesn't need window position)
  if (udid) {
    const idbResult = await executeCommand(
      "idb",
      [
        "ui", "scroll", "--udid", udid,
        "--", String(startX), String(startY), String(dx), String(dy)
      ],
      { timeout: 10000 }
    );
    if (idbResult.exitCode === 0) {
      return {
        success: true,
        message: `Scrolled ${direction} by ${amount}px via IDB`,
      };
    }
  }

  // Method 2: Try AXe (Apple Accessibility APIs)
  if (udid) {
    const axeResult = await executeCommand(
      "axe",
      [
        "scroll",
        "--direction", direction,
        "--amount", String(amount),
        "--udid", udid
      ],
      { timeout: 10000 }
    );
    if (axeResult.exitCode === 0) {
      return {
        success: true,
        message: `Scrolled ${direction} by ${amount}px via AXe`,
      };
    }
  }

  // Method 3: Fallback to keyboard shortcuts
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
    message: `Scrolled ${direction} by ${amount}px via keyboard`,
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
  // Resolve UDID - handles "booted" alias and undefined
  const udid = await resolveUdid(options?.udid);
  if (!udid) {
    return {
      success: false,
      error: "No booted simulator found",
    };
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
 *
 * Priority order:
 * 1. IDB (Facebook's iOS Development Bridge) - supports duration via touch events
 * 2. AXe (Apple Accessibility APIs)
 * 3. cliclick - requires window position
 * 4. Regular tap as fallback
 */
export async function longPress(
  x: number,
  y: number,
  duration: number = 1000,
  options?: { udid?: string }
): Promise<UIActionResult> {
  // Resolve UDID - handles "booted" alias and undefined
  const udid = await resolveUdid(options?.udid);
  const durationSec = duration / 1000;

  // Method 1: Try IDB first (most reliable - supports long press via button press or touch)
  // Use idb ui button with HOLD_HOME_BUTTON or simulate via swipe with same start/end
  if (udid) {
    // IDB doesn't have a direct long-press, but we can simulate it with a swipe
    // that starts and ends at the same position with a duration
    const idbResult = await executeCommand(
      "idb",
      [
        "ui", "swipe", "--udid", udid,
        "--duration", String(durationSec),
        "--", String(x), String(y), String(x), String(y)
      ],
      { timeout: duration + 5000 }
    );
    if (idbResult.exitCode === 0) {
      return {
        success: true,
        message: `Long pressed at (${x}, ${y}) for ${duration}ms via IDB`,
      };
    }
  }

  // Method 2: Try AXe (Apple Accessibility APIs)
  if (udid) {
    const axeResult = await executeCommand(
      "axe",
      [
        "longpress",
        "-x", String(x), "-y", String(y),
        "--duration", String(durationSec),
        "--udid", udid
      ],
      { timeout: duration + 5000 }
    );
    if (axeResult.exitCode === 0) {
      return {
        success: true,
        message: `Long pressed at (${x}, ${y}) for ${duration}ms via AXe`,
      };
    }
  }

  // Method 3: Try cliclick with window bounds
  await focusSimulator();
  await new Promise(resolve => setTimeout(resolve, 200));

  const windowBounds = await getSimulatorWindowBounds();
  if (windowBounds) {
    const titleBarHeight = 28;
    const absX = windowBounds.x + x;
    const absY = windowBounds.y + titleBarHeight + y;

    // Use cliclick for long press if available
    const result = await executeCommand(
      "cliclick",
      [`kd:${absX},${absY}`, `w:${duration}`, `ku:${absX},${absY}`],
      { timeout: duration + 5000 }
    );

    if (result.exitCode === 0) {
      return {
        success: true,
        message: `Long pressed at (${x}, ${y}) for ${duration}ms via cliclick`,
      };
    }
  }

  // Fallback: just do a regular tap
  // Note: This won't provide true long press behavior
  const tapResult = await tap(x, y, options);
  if (tapResult.success) {
    return {
      success: true,
      message: `Long press fallback: ${tapResult.message} (long press not fully supported without IDB/AXe/cliclick)`,
    };
  }

  return {
    success: false,
    message: "",
    error: `Failed to long press at (${x}, ${y}). Install: brew install idb-companion (or) brew install axe (or) brew install cliclick`,
  };
}

/**
 * Double tap at coordinates
 *
 * Priority order:
 * 1. IDB (Facebook's iOS Development Bridge) - two quick taps
 * 2. AXe (Apple Accessibility APIs)
 * 3. cliclick - requires window position
 * 4. Two tap() calls as fallback
 */
export async function doubleTap(
  x: number,
  y: number,
  options?: { udid?: string }
): Promise<UIActionResult> {
  // Resolve UDID - handles "booted" alias and undefined
  const udid = await resolveUdid(options?.udid);

  // Method 1: Try IDB first (most reliable)
  // IDB doesn't have a direct double-tap, so we do two quick taps
  if (udid) {
    const firstTap = await executeCommand(
      "idb",
      ["ui", "tap", "--udid", udid, "--", String(x), String(y)],
      { timeout: 5000 }
    );
    if (firstTap.exitCode === 0) {
      // Small delay between taps for double-tap recognition
      await new Promise(resolve => setTimeout(resolve, 50));
      const secondTap = await executeCommand(
        "idb",
        ["ui", "tap", "--udid", udid, "--", String(x), String(y)],
        { timeout: 5000 }
      );
      if (secondTap.exitCode === 0) {
        return {
          success: true,
          message: `Double tapped at (${x}, ${y}) via IDB`,
        };
      }
    }
  }

  // Method 2: Try AXe (Apple Accessibility APIs)
  if (udid) {
    const axeResult = await executeCommand(
      "axe",
      [
        "doubletap",
        "-x", String(x), "-y", String(y),
        "--udid", udid
      ],
      { timeout: 5000 }
    );
    if (axeResult.exitCode === 0) {
      return {
        success: true,
        message: `Double tapped at (${x}, ${y}) via AXe`,
      };
    }
  }

  // Method 3: Try cliclick with window bounds
  await focusSimulator();
  await new Promise(resolve => setTimeout(resolve, 200));

  const windowBounds = await getSimulatorWindowBounds();
  if (windowBounds) {
    const titleBarHeight = 28;
    const absX = windowBounds.x + x;
    const absY = windowBounds.y + titleBarHeight + y;

    // Use cliclick for double click if available
    const result = await executeCommand(
      "cliclick",
      [`dc:${absX},${absY}`],
      { timeout: 5000 }
    );

    if (result.exitCode === 0) {
      return {
        success: true,
        message: `Double tapped at (${x}, ${y}) via cliclick`,
      };
    }
  }

  // Fallback: two quick taps via tap function
  const firstResult = await tap(x, y, options);
  if (firstResult.success) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const secondResult = await tap(x, y, options);
    if (secondResult.success) {
      return {
        success: true,
        message: `Double tapped at (${x}, ${y}) via ${firstResult.message.split(" via ")[1] || "fallback"}`,
      };
    }
  }

  return {
    success: false,
    message: "",
    error: `Failed to double tap at (${x}, ${y}). Install: brew install idb-companion (or) brew install axe (or) brew install cliclick`,
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
  // Resolve UDID - handles "booted" alias and undefined
  const udid = await resolveUdid(options?.udid);
  if (!udid) {
    return {
      success: false,
      message: "",
      error: "No booted simulator found",
    };
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
 * Priority order: IDB > AXe > cliclick > AppleScript
 */
export async function checkUIAutomationAvailable(): Promise<{
  available: boolean;
  capabilities: string[];
  missing: string[];
  recommended: string[];
}> {
  const capabilities: string[] = [];
  const missing: string[] = [];
  const recommended: string[] = [];

  // Check IDB (best option - works directly with device coordinates)
  const hasIDB = await isIDBAvailable();
  if (hasIDB) {
    capabilities.push("IDB (tap, swipe, scroll, type - PREFERRED, works without window focus)");
  } else {
    recommended.push("idb (recommended - install with 'brew install idb-companion && pip install fb-idb')");
  }

  // Check AXe (second best - Apple Accessibility APIs)
  const hasAXe = await isAXeAvailable();
  if (hasAXe) {
    capabilities.push("AXe (tap, swipe, scroll, type - works without window focus)");
  } else {
    if (!hasIDB) {
      recommended.push("axe (alternative to IDB - install with 'brew install axe')");
    }
  }

  // Check cliclick (requires window position but reliable)
  const cliclickResult = await executeCommand("which", ["cliclick"], { timeout: 2000 });
  const hasCliclick = cliclickResult.exitCode === 0;
  if (hasCliclick) {
    capabilities.push("cliclick (tap, swipe, long press, double-click - requires window focus)");
  } else {
    if (!hasIDB && !hasAXe) {
      missing.push("cliclick (fallback - install with 'brew install cliclick')");
    }
  }

  // Check AppleScript (basic fallback for clicks and keystrokes)
  const osascriptResult = await executeCommand("which", ["osascript"], { timeout: 2000 });
  const hasAppleScript = osascriptResult.exitCode === 0;
  if (hasAppleScript) {
    capabilities.push("AppleScript (keystroke, fallback clicks - requires window focus)");
  } else {
    missing.push("osascript (system utility - should be available on macOS)");
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

  // Available if we have at least one input method
  const available = hasIDB || hasAXe || hasCliclick || hasAppleScript;

  return {
    available,
    capabilities,
    missing,
    recommended,
  };
}
