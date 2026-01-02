/**
 * WebDriverAgent Integration
 * Provides reliable element discovery and interaction via Facebook's WebDriverAgent
 *
 * WDA runs on the iOS Simulator and provides a REST API for:
 * - Element tree queries (accessibility hierarchy)
 * - Reliable tap/swipe/type operations
 * - Screenshot capture
 */

import { executeCommand, executeShell } from "../utils/process.js";
import { getBootedSimulator } from "../simulator/controller.js";

export interface WDAElement {
  type: string;
  label: string | null;
  name: string | null;
  value: string | null;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  enabled: boolean;
  visible: boolean;
  accessible: boolean;
  accessibilityContainer: boolean;
  children?: WDAElement[];
}

export interface WDASession {
  sessionId: string;
  bundleId: string;
  port: number;
  pid?: number;
}

export interface WDAStatus {
  installed: boolean;
  running: boolean;
  port?: number;
  sessionId?: string;
  error?: string;
}

// WDA state management
let currentSession: WDASession | null = null;
let wdaProcess: { pid: number; port: number } | null = null;

const WDA_BUNDLE_ID = "com.facebook.WebDriverAgentRunner.xctrunner";
const DEFAULT_WDA_PORT = 8100;

/**
 * Check if WebDriverAgent is available
 */
export async function checkWDAStatus(): Promise<WDAStatus> {
  // Check if WDA is responding
  if (wdaProcess) {
    try {
      const response = await fetchWDA(`http://localhost:${wdaProcess.port}/status`);
      if (response.ok) {
        const status = await response.json();
        return {
          installed: true,
          running: true,
          port: wdaProcess.port,
          sessionId: status.sessionId,
        };
      }
    } catch {
      // WDA not responding
    }
  }

  // Check if WDA is installed on simulator
  const booted = await getBootedSimulator();
  if (!booted) {
    return {
      installed: false,
      running: false,
      error: "No booted simulator",
    };
  }

  // Try to find WDA in common locations
  const wdaLocations = [
    `${process.env.HOME}/Library/Developer/Xcode/DerivedData/WebDriverAgent-*/Build/Products/Debug-iphonesimulator/WebDriverAgentRunner-Runner.app`,
    "/usr/local/lib/node_modules/appium/node_modules/appium-webdriveragent/WebDriverAgent.xcodeproj",
  ];

  for (const location of wdaLocations) {
    const result = await executeCommand("ls", [location], { timeout: 2000 });
    if (result.exitCode === 0) {
      return {
        installed: true,
        running: false,
      };
    }
  }

  return {
    installed: false,
    running: false,
    error: "WebDriverAgent not found. Install via: brew install appium && appium driver install xcuitest",
  };
}

/**
 * Simple fetch wrapper for WDA requests
 */
async function fetchWDA(url: string, options?: {
  method?: string;
  body?: object;
  timeout?: number;
}): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  const { method = "GET", body, timeout = 10000 } = options || {};

  const curlArgs = [
    "-s",
    "-X", method,
    "-H", "Content-Type: application/json",
    "--max-time", String(timeout / 1000),
  ];

  if (body) {
    curlArgs.push("-d", JSON.stringify(body));
  }

  curlArgs.push(url);

  const result = await executeCommand("curl", curlArgs, { timeout: timeout + 1000 });

  return {
    ok: result.exitCode === 0 && result.stdout.length > 0,
    status: result.exitCode === 0 ? 200 : 500,
    json: async () => JSON.parse(result.stdout),
  };
}

/**
 * Start WebDriverAgent on the simulator
 */
export async function startWDA(options?: {
  port?: number;
  bundleId?: string;
}): Promise<{ success: boolean; session?: WDASession; error?: string }> {
  const port = options?.port || DEFAULT_WDA_PORT;
  const bundleId = options?.bundleId;

  const booted = await getBootedSimulator();
  if (!booted) {
    return { success: false, error: "No booted simulator" };
  }

  // Check if WDA is already running
  try {
    const statusResult = await fetchWDA(`http://localhost:${port}/status`, { timeout: 2000 });
    if (statusResult.ok) {
      const status = await statusResult.json();
      currentSession = {
        sessionId: status.sessionId || "existing",
        bundleId: bundleId || "",
        port,
      };
      return { success: true, session: currentSession };
    }
  } catch {
    // Not running, need to start
  }

  // Try to start WDA using xcodebuild
  const wdaProjectPath = await findWDAProject();
  if (!wdaProjectPath) {
    return {
      success: false,
      error: "WebDriverAgent project not found. Install via: npm install -g appium && appium driver install xcuitest"
    };
  }

  // Start WDA in background
  const startResult = await executeShell(
    `xcodebuild -project "${wdaProjectPath}" ` +
    `-scheme WebDriverAgentRunner ` +
    `-destination "platform=iOS Simulator,id=${booted.udid}" ` +
    `USE_PORT=${port} ` +
    `test &`,
    { timeout: 5000 }
  );

  // Wait for WDA to start
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      const statusResult = await fetchWDA(`http://localhost:${port}/status`, { timeout: 2000 });
      if (statusResult.ok) {
        const status = await statusResult.json();

        // Create session if needed
        if (bundleId) {
          const sessionResult = await createWDASession(port, bundleId);
          if (sessionResult.success) {
            return sessionResult;
          }
        }

        currentSession = {
          sessionId: status.sessionId || "default",
          bundleId: bundleId || "",
          port,
        };
        return { success: true, session: currentSession };
      }
    } catch {
      // Keep waiting
    }
  }

  return { success: false, error: "WDA failed to start within 30 seconds" };
}

/**
 * Find WDA project location
 */
async function findWDAProject(): Promise<string | null> {
  // Check common locations
  const locations = [
    "/usr/local/lib/node_modules/appium/node_modules/appium-webdriveragent/WebDriverAgent.xcodeproj",
    `${process.env.HOME}/.appium/node_modules/appium-xcuitest-driver/node_modules/appium-webdriveragent/WebDriverAgent.xcodeproj`,
  ];

  for (const loc of locations) {
    const result = await executeCommand("test", ["-d", loc], { timeout: 1000 });
    if (result.exitCode === 0) {
      return loc;
    }
  }

  // Try to find via mdfind
  const findResult = await executeCommand(
    "mdfind",
    ["-name", "WebDriverAgent.xcodeproj"],
    { timeout: 5000 }
  );

  if (findResult.exitCode === 0 && findResult.stdout.trim()) {
    const paths = findResult.stdout.trim().split("\n");
    return paths[0];
  }

  return null;
}

/**
 * Create a WDA session for a specific app
 */
async function createWDASession(
  port: number,
  bundleId: string
): Promise<{ success: boolean; session?: WDASession; error?: string }> {
  const result = await fetchWDA(`http://localhost:${port}/session`, {
    method: "POST",
    body: {
      capabilities: {
        bundleId: bundleId,
        arguments: [],
        environment: {},
      },
    },
  });

  if (!result.ok) {
    return { success: false, error: "Failed to create WDA session" };
  }

  const data = await result.json();
  currentSession = {
    sessionId: data.sessionId,
    bundleId,
    port,
  };

  return { success: true, session: currentSession };
}

/**
 * Get the current element tree from WDA
 */
export async function getElementTree(options?: {
  port?: number;
  sessionId?: string;
}): Promise<{ success: boolean; elements?: WDAElement; error?: string }> {
  const port = options?.port || currentSession?.port || DEFAULT_WDA_PORT;
  const sessionId = options?.sessionId || currentSession?.sessionId;

  const url = sessionId
    ? `http://localhost:${port}/session/${sessionId}/source`
    : `http://localhost:${port}/source`;

  const result = await fetchWDA(url, { timeout: 30000 });

  if (!result.ok) {
    return { success: false, error: "Failed to get element tree from WDA" };
  }

  const data = await result.json();
  return { success: true, elements: data.value };
}

/**
 * Find elements matching criteria
 */
export async function findElements(
  using: "accessibility id" | "class name" | "xpath" | "predicate string",
  value: string,
  options?: { port?: number; sessionId?: string }
): Promise<{ success: boolean; elements?: WDAElement[]; error?: string }> {
  const port = options?.port || currentSession?.port || DEFAULT_WDA_PORT;
  const sessionId = options?.sessionId || currentSession?.sessionId;

  if (!sessionId) {
    return { success: false, error: "No WDA session. Start WDA first." };
  }

  const result = await fetchWDA(
    `http://localhost:${port}/session/${sessionId}/elements`,
    {
      method: "POST",
      body: { using, value },
    }
  );

  if (!result.ok) {
    return { success: false, error: "Failed to find elements" };
  }

  const data = await result.json();
  return { success: true, elements: data.value };
}

/**
 * Tap on an element using WDA
 */
export async function tapElement(
  elementId: string,
  options?: { port?: number; sessionId?: string }
): Promise<{ success: boolean; error?: string }> {
  const port = options?.port || currentSession?.port || DEFAULT_WDA_PORT;
  const sessionId = options?.sessionId || currentSession?.sessionId;

  if (!sessionId) {
    return { success: false, error: "No WDA session" };
  }

  const result = await fetchWDA(
    `http://localhost:${port}/session/${sessionId}/element/${elementId}/click`,
    { method: "POST", body: {} }
  );

  return { success: result.ok, error: result.ok ? undefined : "Failed to tap element" };
}

/**
 * Tap at coordinates using WDA
 */
export async function tapCoordinates(
  x: number,
  y: number,
  options?: { port?: number; sessionId?: string }
): Promise<{ success: boolean; error?: string }> {
  const port = options?.port || currentSession?.port || DEFAULT_WDA_PORT;
  const sessionId = options?.sessionId || currentSession?.sessionId;

  if (!sessionId) {
    return { success: false, error: "No WDA session" };
  }

  const result = await fetchWDA(
    `http://localhost:${port}/session/${sessionId}/wda/tap/0`,
    {
      method: "POST",
      body: { x, y },
    }
  );

  return { success: result.ok, error: result.ok ? undefined : "Failed to tap" };
}

/**
 * Type text using WDA
 */
export async function typeTextWDA(
  text: string,
  options?: { port?: number; sessionId?: string }
): Promise<{ success: boolean; error?: string }> {
  const port = options?.port || currentSession?.port || DEFAULT_WDA_PORT;
  const sessionId = options?.sessionId || currentSession?.sessionId;

  if (!sessionId) {
    return { success: false, error: "No WDA session" };
  }

  const result = await fetchWDA(
    `http://localhost:${port}/session/${sessionId}/wda/keys`,
    {
      method: "POST",
      body: { value: text.split("") },
    }
  );

  return { success: result.ok, error: result.ok ? undefined : "Failed to type" };
}

/**
 * Swipe using WDA
 */
export async function swipeWDA(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  duration: number = 0.5,
  options?: { port?: number; sessionId?: string }
): Promise<{ success: boolean; error?: string }> {
  const port = options?.port || currentSession?.port || DEFAULT_WDA_PORT;
  const sessionId = options?.sessionId || currentSession?.sessionId;

  if (!sessionId) {
    return { success: false, error: "No WDA session" };
  }

  const result = await fetchWDA(
    `http://localhost:${port}/session/${sessionId}/wda/dragfromtoforduration`,
    {
      method: "POST",
      body: {
        fromX,
        fromY,
        toX,
        toY,
        duration,
      },
    }
  );

  return { success: result.ok, error: result.ok ? undefined : "Failed to swipe" };
}

/**
 * Take screenshot using WDA
 */
export async function screenshotWDA(
  options?: { port?: number; sessionId?: string }
): Promise<{ success: boolean; base64?: string; error?: string }> {
  const port = options?.port || currentSession?.port || DEFAULT_WDA_PORT;
  const sessionId = options?.sessionId || currentSession?.sessionId;

  const url = sessionId
    ? `http://localhost:${port}/session/${sessionId}/screenshot`
    : `http://localhost:${port}/screenshot`;

  const result = await fetchWDA(url);

  if (!result.ok) {
    return { success: false, error: "Failed to take screenshot" };
  }

  const data = await result.json();
  return { success: true, base64: data.value };
}

/**
 * Stop WDA
 */
export async function stopWDA(): Promise<void> {
  if (wdaProcess?.pid) {
    await executeCommand("kill", [String(wdaProcess.pid)], { timeout: 5000 });
  }
  wdaProcess = null;
  currentSession = null;
}

/**
 * Get current WDA session
 */
export function getWDASession(): WDASession | null {
  return currentSession;
}
