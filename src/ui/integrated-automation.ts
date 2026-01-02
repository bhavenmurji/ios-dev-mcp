/**
 * Integrated UI Automation System
 *
 * Combines multiple approaches for reliable iOS Simulator automation:
 * 1. Screenshot + Vision analysis for understanding UI state
 * 2. WebDriverAgent for reliable element discovery and interaction
 * 3. AppleScript/cliclick as fallback for interaction
 * 4. XCUITest code generation for regression testing
 *
 * Usage workflow:
 * 1. analyzeScreen() - Take screenshot and get element tree
 * 2. findAndTap() / findAndType() - Interact with elements by description
 * 3. recordAction() - Record actions for test generation
 * 4. generateXCUITest() - Generate test code from recorded actions
 */

import { executeCommand } from "../utils/process.js";
import { getBootedSimulator, takeScreenshot } from "../simulator/controller.js";
import { tap, swipe, typeText } from "./automation.js";
import {
  checkWDAStatus,
  startWDA,
  getElementTree,
  findElements,
  tapCoordinates,
  typeTextWDA,
  swipeWDA,
  WDAElement,
} from "./webdriver-agent.js";

// ============================================================================
// Types
// ============================================================================

export interface UIElement {
  id: string;
  type: string;
  label: string | null;
  value: string | null;
  hint: string | null;
  rect: { x: number; y: number; width: number; height: number };
  centerX: number;
  centerY: number;
  enabled: boolean;
  visible: boolean;
  interactable: boolean;
}

export interface ScreenAnalysis {
  success: boolean;
  screenshotPath?: string;
  elements: UIElement[];
  interactiveElements: UIElement[];
  textFields: UIElement[];
  buttons: UIElement[];
  labels: UIElement[];
  error?: string;
  method: "wda" | "fallback";
}

export interface RecordedAction {
  timestamp: number;
  type: "tap" | "type" | "swipe" | "wait" | "screenshot";
  element?: {
    type: string;
    label: string | null;
    accessibilityId: string | null;
  };
  coordinates?: { x: number; y: number };
  text?: string;
  swipe?: { fromX: number; fromY: number; toX: number; toY: number };
  duration?: number;
}

export interface AutomationSession {
  startTime: number;
  bundleId?: string;
  recordedActions: RecordedAction[];
  screenshots: string[];
}

// Session state
let automationSession: AutomationSession | null = null;

// ============================================================================
// Screen Analysis
// ============================================================================

/**
 * Analyze the current screen - get screenshot and element tree
 */
export async function analyzeScreen(options?: {
  includeScreenshot?: boolean;
  startWDAIfNeeded?: boolean;
}): Promise<ScreenAnalysis> {
  const { includeScreenshot = true, startWDAIfNeeded = true } = options || {};

  const booted = await getBootedSimulator();
  if (!booted) {
    return {
      success: false,
      elements: [],
      interactiveElements: [],
      textFields: [],
      buttons: [],
      labels: [],
      error: "No booted simulator",
      method: "fallback",
    };
  }

  // Take screenshot if requested
  let screenshotPath: string | undefined;
  if (includeScreenshot) {
    const screenshotResult = await takeScreenshot(booted.udid);
    if (screenshotResult.success) {
      screenshotPath = screenshotResult.path;
    }
  }

  // Try WDA first for element tree
  const wdaStatus = await checkWDAStatus();

  if (wdaStatus.running) {
    return await analyzeWithWDA(screenshotPath);
  }

  if (startWDAIfNeeded && wdaStatus.installed) {
    const startResult = await startWDA();
    if (startResult.success) {
      return await analyzeWithWDA(screenshotPath);
    }
  }

  // Fallback to basic analysis
  return await analyzeWithFallback(screenshotPath);
}

/**
 * Analyze screen using WDA element tree
 */
async function analyzeWithWDA(screenshotPath?: string): Promise<ScreenAnalysis> {
  const treeResult = await getElementTree();

  if (!treeResult.success || !treeResult.elements) {
    return {
      success: false,
      screenshotPath,
      elements: [],
      interactiveElements: [],
      textFields: [],
      buttons: [],
      labels: [],
      error: treeResult.error,
      method: "wda",
    };
  }

  // Flatten and convert WDA elements
  const elements = flattenWDATree(treeResult.elements);

  const interactiveElements = elements.filter((e) => e.interactable);
  const textFields = elements.filter((e) =>
    ["XCUIElementTypeTextField", "XCUIElementTypeSecureTextField", "XCUIElementTypeTextView"].includes(e.type)
  );
  const buttons = elements.filter((e) =>
    ["XCUIElementTypeButton", "XCUIElementTypeLink"].includes(e.type)
  );
  const labels = elements.filter((e) =>
    ["XCUIElementTypeStaticText"].includes(e.type)
  );

  return {
    success: true,
    screenshotPath,
    elements,
    interactiveElements,
    textFields,
    buttons,
    labels,
    method: "wda",
  };
}

/**
 * Flatten WDA element tree into array
 */
function flattenWDATree(element: WDAElement, result: UIElement[] = [], idCounter = { value: 0 }): UIElement[] {
  const centerX = element.rect.x + element.rect.width / 2;
  const centerY = element.rect.y + element.rect.height / 2;

  const isInteractable =
    element.enabled &&
    element.visible &&
    (element.type.includes("Button") ||
      element.type.includes("TextField") ||
      element.type.includes("Link") ||
      element.type.includes("Cell") ||
      element.type.includes("Switch") ||
      element.type.includes("Slider") ||
      element.accessible);

  result.push({
    id: `element_${idCounter.value++}`,
    type: element.type,
    label: element.label,
    value: element.value,
    hint: null,
    rect: element.rect,
    centerX,
    centerY,
    enabled: element.enabled,
    visible: element.visible,
    interactable: isInteractable,
  });

  if (element.children) {
    for (const child of element.children) {
      flattenWDATree(child, result, idCounter);
    }
  }

  return result;
}

/**
 * Fallback analysis using accessibility queries
 */
async function analyzeWithFallback(screenshotPath?: string): Promise<ScreenAnalysis> {
  // This is a simplified fallback - actual implementation would use
  // AppleScript accessibility queries, but those have limitations with Simulator

  return {
    success: true,
    screenshotPath,
    elements: [],
    interactiveElements: [],
    textFields: [],
    buttons: [],
    labels: [],
    method: "fallback",
  };
}

// ============================================================================
// Element Interaction
// ============================================================================

/**
 * Find and tap an element by its label, accessibility ID, or type
 */
export async function findAndTap(
  query: {
    label?: string;
    accessibilityId?: string;
    type?: string;
    containsText?: string;
    index?: number;
  }
): Promise<{ success: boolean; element?: UIElement; error?: string }> {
  const analysis = await analyzeScreen({ includeScreenshot: false });

  if (!analysis.success) {
    return { success: false, error: analysis.error };
  }

  // Find matching element
  let matches = analysis.interactiveElements;

  if (query.label) {
    matches = matches.filter((e) => e.label?.toLowerCase().includes(query.label!.toLowerCase()));
  }

  if (query.type) {
    matches = matches.filter((e) => e.type.toLowerCase().includes(query.type!.toLowerCase()));
  }

  if (query.containsText) {
    matches = matches.filter((e) =>
      e.label?.toLowerCase().includes(query.containsText!.toLowerCase()) ||
      e.value?.toLowerCase().includes(query.containsText!.toLowerCase())
    );
  }

  const index = query.index || 0;
  if (matches.length <= index) {
    return {
      success: false,
      error: `No matching element found. Query: ${JSON.stringify(query)}. Found ${matches.length} matches.`,
    };
  }

  const element = matches[index];

  // Tap using best available method
  const tapResult = await tapAtCoordinates(element.centerX, element.centerY);

  if (tapResult.success) {
    recordAction({
      timestamp: Date.now(),
      type: "tap",
      element: {
        type: element.type,
        label: element.label,
        accessibilityId: null,
      },
      coordinates: { x: element.centerX, y: element.centerY },
    });
  }

  return { success: tapResult.success, element, error: tapResult.error };
}

/**
 * Find a text field and type into it
 */
export async function findAndType(
  query: {
    label?: string;
    placeholder?: string;
    index?: number;
  },
  text: string
): Promise<{ success: boolean; element?: UIElement; error?: string }> {
  const analysis = await analyzeScreen({ includeScreenshot: false });

  if (!analysis.success) {
    return { success: false, error: analysis.error };
  }

  // Find matching text field
  let matches = analysis.textFields;

  if (query.label) {
    matches = matches.filter((e) => e.label?.toLowerCase().includes(query.label!.toLowerCase()));
  }

  if (query.placeholder) {
    matches = matches.filter((e) => e.value?.toLowerCase().includes(query.placeholder!.toLowerCase()));
  }

  const index = query.index || 0;
  if (matches.length <= index) {
    return {
      success: false,
      error: `No matching text field found. Query: ${JSON.stringify(query)}`,
    };
  }

  const element = matches[index];

  // Tap to focus
  await tapAtCoordinates(element.centerX, element.centerY);
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Type text
  const typeResult = await typeAtFocused(text);

  if (typeResult.success) {
    recordAction({
      timestamp: Date.now(),
      type: "tap",
      element: { type: element.type, label: element.label, accessibilityId: null },
      coordinates: { x: element.centerX, y: element.centerY },
    });
    recordAction({
      timestamp: Date.now(),
      type: "type",
      text,
    });
  }

  return { success: typeResult.success, element, error: typeResult.error };
}

/**
 * Tap at coordinates using best available method
 */
export async function tapAtCoordinates(
  x: number,
  y: number
): Promise<{ success: boolean; method: string; error?: string }> {
  // Try WDA first (most reliable)
  const wdaStatus = await checkWDAStatus();
  if (wdaStatus.running) {
    const result = await tapCoordinates(x, y);
    if (result.success) {
      return { success: true, method: "wda" };
    }
  }

  // Fall back to cliclick/AppleScript
  const result = await tap(x, y);
  return {
    success: result.success,
    method: "applescript",
    error: result.error,
  };
}

/**
 * Type text at currently focused element
 */
export async function typeAtFocused(
  text: string
): Promise<{ success: boolean; method: string; error?: string }> {
  // Try WDA first
  const wdaStatus = await checkWDAStatus();
  if (wdaStatus.running) {
    const result = await typeTextWDA(text);
    if (result.success) {
      return { success: true, method: "wda" };
    }
  }

  // Fall back to AppleScript
  const result = await typeText(text);
  return {
    success: result.success,
    method: "applescript",
    error: result.error,
  };
}

/**
 * Swipe gesture
 */
export async function swipeGesture(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  duration?: number
): Promise<{ success: boolean; method: string; error?: string }> {
  // Try WDA first
  const wdaStatus = await checkWDAStatus();
  if (wdaStatus.running) {
    const result = await swipeWDA(fromX, fromY, toX, toY, duration);
    if (result.success) {
      recordAction({
        timestamp: Date.now(),
        type: "swipe",
        swipe: { fromX, fromY, toX, toY },
        duration,
      });
      return { success: true, method: "wda" };
    }
  }

  // Fall back to cliclick/AppleScript
  const result = await swipe({ x: fromX, y: fromY }, { x: toX, y: toY }, duration);

  if (result.success) {
    recordAction({
      timestamp: Date.now(),
      type: "swipe",
      swipe: { fromX, fromY, toX, toY },
      duration,
    });
  }

  return {
    success: result.success,
    method: "applescript",
    error: result.error,
  };
}

// ============================================================================
// Test Recording
// ============================================================================

/**
 * Start recording actions for test generation
 */
export function startRecording(bundleId?: string): void {
  automationSession = {
    startTime: Date.now(),
    bundleId,
    recordedActions: [],
    screenshots: [],
  };
}

/**
 * Stop recording and return recorded actions
 */
export function stopRecording(): AutomationSession | null {
  const session = automationSession;
  automationSession = null;
  return session;
}

/**
 * Record an action (called internally)
 */
function recordAction(action: RecordedAction): void {
  if (automationSession) {
    automationSession.recordedActions.push(action);
  }
}

/**
 * Add a wait/delay action
 */
export function recordWait(milliseconds: number): void {
  recordAction({
    timestamp: Date.now(),
    type: "wait",
    duration: milliseconds,
  });
}

/**
 * Get current recording session
 */
export function getRecordingSession(): AutomationSession | null {
  return automationSession;
}

// ============================================================================
// XCUITest Code Generation
// ============================================================================

/**
 * Generate XCUITest Swift code from recorded actions
 */
export function generateXCUITest(
  session: AutomationSession,
  options?: {
    testName?: string;
    className?: string;
    includeComments?: boolean;
  }
): string {
  const {
    testName = "testRecordedFlow",
    className = "RecordedUITests",
    includeComments = true,
  } = options || {};

  const lines: string[] = [];

  // File header
  lines.push("import XCTest");
  lines.push("");
  lines.push(`class ${className}: XCTestCase {`);
  lines.push("");

  // Setup method
  lines.push("    override func setUpWithError() throws {");
  lines.push("        continueAfterFailure = false");
  if (session.bundleId) {
    lines.push(`        let app = XCUIApplication(bundleIdentifier: "${session.bundleId}")`);
  } else {
    lines.push("        let app = XCUIApplication()");
  }
  lines.push("        app.launch()");
  lines.push("    }");
  lines.push("");

  // Test method
  lines.push(`    func ${testName}() throws {`);
  if (session.bundleId) {
    lines.push(`        let app = XCUIApplication(bundleIdentifier: "${session.bundleId}")`);
  } else {
    lines.push("        let app = XCUIApplication()");
  }
  lines.push("");

  // Generate code for each action
  for (const action of session.recordedActions) {
    const actionCode = generateActionCode(action, includeComments);
    if (actionCode) {
      lines.push(actionCode);
    }
  }

  lines.push("    }");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate Swift code for a single action
 */
function generateActionCode(action: RecordedAction, includeComments: boolean): string {
  const indent = "        ";

  switch (action.type) {
    case "tap":
      if (action.element?.label) {
        const elementType = mapElementType(action.element.type);
        if (includeComments) {
          return `${indent}// Tap on "${action.element.label}"\n` +
            `${indent}app.${elementType}["${action.element.label}"].tap()`;
        }
        return `${indent}app.${elementType}["${action.element.label}"].tap()`;
      } else if (action.coordinates) {
        if (includeComments) {
          return `${indent}// Tap at coordinates (${action.coordinates.x}, ${action.coordinates.y})\n` +
            `${indent}app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0)).withOffset(CGVector(dx: ${action.coordinates.x}, dy: ${action.coordinates.y})).tap()`;
        }
        return `${indent}app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0)).withOffset(CGVector(dx: ${action.coordinates.x}, dy: ${action.coordinates.y})).tap()`;
      }
      return "";

    case "type":
      if (action.text) {
        const escapedText = action.text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        if (includeComments) {
          return `${indent}// Type text\n` +
            `${indent}app.typeText("${escapedText}")`;
        }
        return `${indent}app.typeText("${escapedText}")`;
      }
      return "";

    case "swipe":
      if (action.swipe) {
        const { fromX, fromY, toX, toY } = action.swipe;
        const direction = getSwipeDirection(fromX, fromY, toX, toY);
        if (includeComments) {
          return `${indent}// Swipe ${direction}\n` +
            `${indent}app.swipe${capitalize(direction)}()`;
        }
        return `${indent}app.swipe${capitalize(direction)}()`;
      }
      return "";

    case "wait":
      if (action.duration) {
        const seconds = action.duration / 1000;
        if (includeComments) {
          return `${indent}// Wait ${seconds} seconds\n` +
            `${indent}Thread.sleep(forTimeInterval: ${seconds})`;
        }
        return `${indent}Thread.sleep(forTimeInterval: ${seconds})`;
      }
      return "";

    default:
      return "";
  }
}

/**
 * Map WDA element type to XCUI element type
 */
function mapElementType(wdaType: string): string {
  const typeMap: Record<string, string> = {
    "XCUIElementTypeButton": "buttons",
    "XCUIElementTypeTextField": "textFields",
    "XCUIElementTypeSecureTextField": "secureTextFields",
    "XCUIElementTypeTextView": "textViews",
    "XCUIElementTypeStaticText": "staticTexts",
    "XCUIElementTypeLink": "links",
    "XCUIElementTypeImage": "images",
    "XCUIElementTypeSwitch": "switches",
    "XCUIElementTypeSlider": "sliders",
    "XCUIElementTypeCell": "cells",
    "XCUIElementTypeTable": "tables",
    "XCUIElementTypeCollectionView": "collectionViews",
    "XCUIElementTypeNavigationBar": "navigationBars",
    "XCUIElementTypeTabBar": "tabBars",
  };

  return typeMap[wdaType] || "otherElements";
}

/**
 * Determine swipe direction from coordinates
 */
function getSwipeDirection(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): "up" | "down" | "left" | "right" {
  const deltaX = toX - fromX;
  const deltaY = toY - fromY;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX > 0 ? "right" : "left";
  } else {
    return deltaY > 0 ? "down" : "up";
  }
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// High-Level Automation API
// ============================================================================

/**
 * Perform a complete UI test flow
 */
export async function runAutomatedFlow(
  actions: Array<{
    action: "tap" | "type" | "swipe" | "wait" | "screenshot";
    target?: { label?: string; type?: string; containsText?: string; index?: number };
    text?: string;
    coordinates?: { x: number; y: number };
    swipe?: { direction: "up" | "down" | "left" | "right"; distance?: number };
    duration?: number;
  }>,
  options?: {
    recordForTest?: boolean;
    bundleId?: string;
    screenshotOnError?: boolean;
  }
): Promise<{
  success: boolean;
  results: Array<{ action: string; success: boolean; error?: string }>;
  testCode?: string;
}> {
  const { recordForTest = false, bundleId, screenshotOnError = true } = options || {};

  if (recordForTest) {
    startRecording(bundleId);
  }

  const results: Array<{ action: string; success: boolean; error?: string }> = [];

  for (const actionDef of actions) {
    let result: { success: boolean; error?: string };

    switch (actionDef.action) {
      case "tap":
        if (actionDef.target) {
          result = await findAndTap(actionDef.target);
        } else if (actionDef.coordinates) {
          result = await tapAtCoordinates(actionDef.coordinates.x, actionDef.coordinates.y);
        } else {
          result = { success: false, error: "Tap requires target or coordinates" };
        }
        break;

      case "type":
        if (actionDef.target && actionDef.text) {
          result = await findAndType(actionDef.target, actionDef.text);
        } else if (actionDef.text) {
          result = await typeAtFocused(actionDef.text);
        } else {
          result = { success: false, error: "Type requires text" };
        }
        break;

      case "swipe":
        if (actionDef.swipe) {
          const distance = actionDef.swipe.distance || 200;
          const center = { x: 200, y: 400 }; // Approximate screen center
          let from = center;
          let to = center;

          switch (actionDef.swipe.direction) {
            case "up":
              from = { x: center.x, y: center.y + distance / 2 };
              to = { x: center.x, y: center.y - distance / 2 };
              break;
            case "down":
              from = { x: center.x, y: center.y - distance / 2 };
              to = { x: center.x, y: center.y + distance / 2 };
              break;
            case "left":
              from = { x: center.x + distance / 2, y: center.y };
              to = { x: center.x - distance / 2, y: center.y };
              break;
            case "right":
              from = { x: center.x - distance / 2, y: center.y };
              to = { x: center.x + distance / 2, y: center.y };
              break;
          }

          result = await swipeGesture(from.x, from.y, to.x, to.y, actionDef.duration);
        } else {
          result = { success: false, error: "Swipe requires direction" };
        }
        break;

      case "wait":
        await new Promise((resolve) => setTimeout(resolve, actionDef.duration || 1000));
        recordWait(actionDef.duration || 1000);
        result = { success: true };
        break;

      case "screenshot":
        const booted = await getBootedSimulator();
        if (booted) {
          const screenshotResult = await takeScreenshot(booted.udid);
          result = { success: screenshotResult.success, error: screenshotResult.error };
        } else {
          result = { success: false, error: "No booted simulator" };
        }
        break;

      default:
        result = { success: false, error: `Unknown action: ${actionDef.action}` };
    }

    results.push({
      action: actionDef.action,
      success: result.success,
      error: result.error,
    });

    if (!result.success && screenshotOnError) {
      const booted = await getBootedSimulator();
      if (booted) {
        await takeScreenshot(booted.udid);
      }
    }
  }

  const overallSuccess = results.every((r) => r.success);
  let testCode: string | undefined;

  if (recordForTest) {
    const session = stopRecording();
    if (session) {
      testCode = generateXCUITest(session);
    }
  }

  return {
    success: overallSuccess,
    results,
    testCode,
  };
}

/**
 * Get automation system status
 */
export async function getAutomationStatus(): Promise<{
  wda: { installed: boolean; running: boolean; port?: number };
  fallback: { cliclick: boolean; applescript: boolean };
  recording: boolean;
  recommendedMethod: string;
}> {
  const wdaStatus = await checkWDAStatus();

  // Check cliclick
  const cliclickResult = await executeCommand("which", ["cliclick"], { timeout: 2000 });
  const hasCliclick = cliclickResult.exitCode === 0;

  // Check AppleScript
  const osascriptResult = await executeCommand("which", ["osascript"], { timeout: 2000 });
  const hasApplescript = osascriptResult.exitCode === 0;

  let recommendedMethod = "fallback";
  if (wdaStatus.running) {
    recommendedMethod = "wda";
  } else if (wdaStatus.installed) {
    recommendedMethod = "wda (not running - start with ui_automation_start)";
  } else if (hasCliclick) {
    recommendedMethod = "cliclick";
  } else if (hasApplescript) {
    recommendedMethod = "applescript";
  }

  return {
    wda: {
      installed: wdaStatus.installed,
      running: wdaStatus.running,
      port: wdaStatus.port,
    },
    fallback: {
      cliclick: hasCliclick,
      applescript: hasApplescript,
    },
    recording: automationSession !== null,
    recommendedMethod,
  };
}
