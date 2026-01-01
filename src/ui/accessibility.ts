/**
 * Accessibility Inspection
 * Read UI element hierarchy for smarter UI interactions
 */

import { executeCommand } from "../utils/process.js";
import { getBootedSimulator } from "../simulator/controller.js";

export interface AccessibilityElement {
  type: string;
  label?: string;
  value?: string;
  identifier?: string;
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  traits: string[];
  isEnabled: boolean;
  isSelected: boolean;
  children?: AccessibilityElement[];
}

export interface AccessibilityTree {
  success: boolean;
  elements?: AccessibilityElement[];
  rootElement?: AccessibilityElement;
  error?: string;
}

export interface ElementQuery {
  label?: string;
  identifier?: string;
  type?: string;
  value?: string;
}

/**
 * Get the accessibility hierarchy using UI scripting
 * Uses AppleScript to query the Simulator's accessibility tree
 */
export async function getAccessibilityTree(options: {
  udid?: string;
  bundleId?: string;
}): Promise<AccessibilityTree> {
  const { udid, bundleId } = options;

  // Get the booted simulator if not specified
  let targetUdid = udid;
  if (!targetUdid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return { success: false, error: "No booted simulator found" };
    }
    targetUdid = booted.udid;
  }

  // Use accessibility inspector via xcrun
  // This queries the accessibility hierarchy through Accessibility Inspector
  const script = `
tell application "System Events"
  tell process "Simulator"
    set windowList to every window
    if (count of windowList) > 0 then
      set mainWindow to window 1
      set allElements to entire contents of mainWindow
      set output to ""
      repeat with elem in allElements
        try
          set elemClass to class of elem as string
          set elemName to ""
          set elemValue to ""
          set elemId to ""
          set elemPos to {0, 0}
          set elemSize to {0, 0}

          try
            set elemName to name of elem
          end try
          try
            set elemValue to value of elem as string
          end try
          try
            set elemId to description of elem
          end try
          try
            set elemPos to position of elem
          end try
          try
            set elemSize to size of elem
          end try

          set output to output & elemClass & "|" & elemName & "|" & elemValue & "|" & elemId & "|" & (item 1 of elemPos) & "," & (item 2 of elemPos) & "|" & (item 1 of elemSize) & "," & (item 2 of elemSize) & "\\n"
        end try
      end repeat
      return output
    end if
  end tell
end tell
`;

  try {
    const result = await executeCommand("osascript", ["-e", script], {
      timeout: 10000,
    });

    if (result.exitCode !== 0) {
      // Fallback: try using accessibility audit
      return await getAccessibilityAudit(targetUdid, bundleId);
    }

    const elements = parseAccessibilityOutput(result.stdout);
    return {
      success: true,
      elements,
    };
  } catch (error) {
    // Fallback to audit-based approach
    return await getAccessibilityAudit(targetUdid, bundleId);
  }
}

/**
 * Parse AppleScript accessibility output
 */
function parseAccessibilityOutput(output: string): AccessibilityElement[] {
  const elements: AccessibilityElement[] = [];
  const lines = output.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length >= 6) {
      const [type, label, value, identifier, posStr, sizeStr] = parts;
      const [x, y] = posStr.split(",").map(Number);
      const [width, height] = sizeStr.split(",").map(Number);

      elements.push({
        type: type || "unknown",
        label: label || undefined,
        value: value || undefined,
        identifier: identifier || undefined,
        frame: { x: x || 0, y: y || 0, width: width || 0, height: height || 0 },
        traits: [],
        isEnabled: true,
        isSelected: false,
      });
    }
  }

  return elements;
}

/**
 * Fallback when accessibility tree cannot be read
 * Returns a failure with helpful guidance
 */
async function getAccessibilityAudit(
  udid: string,
  bundleId?: string
): Promise<AccessibilityTree> {
  // The accessibility tree cannot be read directly from simctl
  // This is a known limitation - recommend using screenshots instead
  return {
    success: false,
    elements: [],
    error:
      "Cannot read accessibility tree directly. For UI automation:\n" +
      "1. Use simulator_screenshot to view the current UI\n" +
      "2. Use ui_tap with coordinates from the screenshot\n" +
      "3. Add accessibilityIdentifier to SwiftUI/UIKit views for better automation",
  };
}

/**
 * Find an element by query criteria
 */
export async function findElement(
  query: ElementQuery,
  options: { udid?: string } = {}
): Promise<{
  success: boolean;
  element?: AccessibilityElement;
  tapPoint?: { x: number; y: number };
  error?: string;
}> {
  const tree = await getAccessibilityTree(options);

  if (!tree.success || !tree.elements) {
    // Fallback: use image-based element finding via Simulator
    return await findElementFallback(query, options);
  }

  // Search for matching element
  for (const element of tree.elements) {
    if (matchesQuery(element, query)) {
      const tapPoint = {
        x: element.frame.x + element.frame.width / 2,
        y: element.frame.y + element.frame.height / 2,
      };
      return { success: true, element, tapPoint };
    }
  }

  return { success: false, error: `Element not found: ${JSON.stringify(query)}` };
}

/**
 * Check if element matches query
 */
function matchesQuery(element: AccessibilityElement, query: ElementQuery): boolean {
  if (query.label && element.label !== query.label) {
    if (!element.label?.toLowerCase().includes(query.label.toLowerCase())) {
      return false;
    }
  }
  if (query.identifier && element.identifier !== query.identifier) {
    return false;
  }
  if (query.type && element.type !== query.type) {
    return false;
  }
  if (query.value && element.value !== query.value) {
    return false;
  }
  return true;
}

/**
 * Fallback element finding using simctl UI commands
 */
async function findElementFallback(
  query: ElementQuery,
  options: { udid?: string }
): Promise<{
  success: boolean;
  element?: AccessibilityElement;
  tapPoint?: { x: number; y: number };
  error?: string;
}> {
  // The iOS Simulator renders apps as a single GPU view, making direct
  // accessibility inspection impossible from the macOS side.
  // This is a fundamental limitation of how the simulator works.

  const queryDescription = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}="${v}"`)
    .join(", ");

  return {
    success: false,
    error:
      `Cannot find element with ${queryDescription}.\n\n` +
      `The iOS Simulator doesn't expose its app's accessibility tree to macOS.\n` +
      `This is a known limitation - the app renders as a single view.\n\n` +
      `Instead, please use:\n` +
      `1. simulator_screenshot - Capture the screen (Claude can analyze it)\n` +
      `2. ui_tap with coordinates - Tap at a specific position\n\n` +
      `Tip: Take a screenshot and describe what you're looking for.`,
  };
}

/**
 * Get all interactive elements (buttons, text fields, etc.)
 */
export async function getInteractiveElements(options: {
  udid?: string;
}): Promise<{
  success: boolean;
  elements?: AccessibilityElement[];
  summary?: string;
  error?: string;
}> {
  const tree = await getAccessibilityTree(options);

  if (!tree.success) {
    return { success: false, error: tree.error };
  }

  const interactive = (tree.elements || []).filter((e) =>
    ["button", "textField", "textView", "switch", "slider", "link", "cell"].some(
      (t) => e.type.toLowerCase().includes(t)
    )
  );

  const summary = interactive
    .map((e) => `${e.type}: "${e.label || e.identifier || "unnamed"}" at (${e.frame.x}, ${e.frame.y})`)
    .join("\n");

  return {
    success: true,
    elements: interactive,
    summary: summary || "No interactive elements found. Try taking a screenshot to see the UI.",
  };
}

/**
 * Describe the current screen for Claude
 *
 * Note: iOS Simulator renders the app as a single GPU-accelerated view,
 * which means the accessibility tree of the iOS app itself is not directly
 * accessible from macOS automation APIs. This is a fundamental limitation.
 *
 * For reliable UI automation, use simulator_screenshot to view the screen
 * and identify tap coordinates visually.
 */
export async function describeScreen(options: {
  udid?: string;
}): Promise<{
  success: boolean;
  description?: string;
  elements?: AccessibilityElement[];
  error?: string;
}> {
  // First try to get the running app info for context
  let appContext = "";
  if (options.udid) {
    try {
      const { executeCommand } = await import("../utils/process.js");
      // Try to get the frontmost app using simctl
      const result = await executeCommand(
        "xcrun",
        ["simctl", "spawn", options.udid, "launchctl", "list"],
        { timeout: 5000 }
      );
      if (result.exitCode === 0) {
        // Parse running apps from launchctl output
        const lines = result.stdout.split('\n');
        const appProcesses = lines.filter(line =>
          line.includes('UIKitApplication') ||
          line.includes('com.apple.') === false && line.includes('application')
        );
        if (appProcesses.length > 0) {
          appContext = `\nDetected running processes:\n${appProcesses.slice(0, 5).join('\n')}\n`;
        }
      }
    } catch {
      // Ignore errors in context gathering
    }
  }

  const interactive = await getInteractiveElements(options);

  // Check if we got Simulator window chrome elements vs actual app elements
  const hasRealElements = interactive.elements && interactive.elements.length > 0 &&
    interactive.elements.some(e =>
      !e.type.includes('window') &&
      !e.type.includes('toolbar') &&
      !e.type.includes('AXWindow')
    );

  if (!interactive.success || !hasRealElements) {
    // Provide helpful guidance when accessibility tree is not available
    return {
      success: true,
      description:
        "iOS Simulator UI Inspection:\n\n" +
        "The accessibility tree of the iOS app cannot be read directly from the macOS side.\n" +
        "This is a known limitation - the iOS Simulator renders the app as a single view.\n" +
        appContext +
        "\nFor UI automation, please use:\n" +
        "1. simulator_screenshot - Capture the current screen (Claude can analyze it visually)\n" +
        "2. ui_tap - Tap at coordinates identified from the screenshot\n" +
        "3. ui_swipe, ui_type_text - Other interaction commands\n\n" +
        "Tip: Take a screenshot and Claude will help identify UI elements and their coordinates.",
    };
  }

  let description = "Current Screen Elements:\n\n";

  const buttons = interactive.elements!.filter((e) => e.type.toLowerCase().includes("button"));
  const textFields = interactive.elements!.filter((e) => e.type.toLowerCase().includes("text"));
  const others = interactive.elements!.filter(
    (e) => !e.type.toLowerCase().includes("button") && !e.type.toLowerCase().includes("text")
  );

  if (buttons.length > 0) {
    description += `Buttons (${buttons.length}):\n`;
    buttons.forEach((b) => {
      description += `  - "${b.label || "unnamed"}" at (${b.frame.x + b.frame.width / 2}, ${b.frame.y + b.frame.height / 2})\n`;
    });
  }

  if (textFields.length > 0) {
    description += `\nText Fields (${textFields.length}):\n`;
    textFields.forEach((t) => {
      description += `  - "${t.label || "unnamed"}" value="${t.value || ""}" at (${t.frame.x + t.frame.width / 2}, ${t.frame.y + t.frame.height / 2})\n`;
    });
  }

  if (others.length > 0) {
    description += `\nOther Interactive Elements (${others.length}):\n`;
    others.forEach((o) => {
      description += `  - ${o.type}: "${o.label || "unnamed"}" at (${o.frame.x + o.frame.width / 2}, ${o.frame.y + o.frame.height / 2})\n`;
    });
  }

  return {
    success: true,
    description,
    elements: interactive.elements,
  };
}
