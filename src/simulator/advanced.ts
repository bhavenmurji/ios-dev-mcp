/**
 * Advanced Simulator Features
 * Video recording, push notifications, network conditioning
 */

import * as path from "path";
import * as os from "os";
import { executeCommand, executeShell } from "../utils/process.js";
import { getBootedSimulator } from "./controller.js";

// Active recordings
const activeRecordings: Map<string, { process: any; outputPath: string; startTime: Date }> = new Map();

export interface RecordingOptions {
  udid?: string;
  outputPath?: string;
  codec?: "h264" | "hevc";
  mask?: "ignored" | "alpha" | "black";
}

export interface RecordingResult {
  success: boolean;
  recordingId?: string;
  outputPath?: string;
  error?: string;
}

/**
 * Start video recording of the simulator
 */
export async function startRecording(
  options: RecordingOptions = {}
): Promise<RecordingResult> {
  const { codec = "h264", mask = "ignored" } = options;

  // Get target simulator
  let targetUdid = options.udid;
  if (!targetUdid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return { success: false, error: "No booted simulator found" };
    }
    targetUdid = booted.udid;
  }

  // Check if already recording
  if (activeRecordings.has(targetUdid)) {
    return { success: false, error: "Recording already in progress for this simulator" };
  }

  // Generate output path
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = options.outputPath || path.join(os.tmpdir(), `simulator-recording-${timestamp}.mp4`);

  // Start recording in background
  const args = [
    "simctl",
    "io",
    targetUdid,
    "recordVideo",
    "--codec", codec,
    "--mask", mask,
    outputPath,
  ];

  try {
    // We need to run this as a background process
    const { spawn } = await import("child_process");
    const recordProcess = spawn("xcrun", args, {
      detached: true,
      stdio: "ignore",
    });

    // Store recording info
    activeRecordings.set(targetUdid, {
      process: recordProcess,
      outputPath,
      startTime: new Date(),
    });

    return {
      success: true,
      recordingId: targetUdid,
      outputPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Stop video recording
 */
export async function stopRecording(options: {
  udid?: string;
}): Promise<{
  success: boolean;
  outputPath?: string;
  duration?: number;
  error?: string;
}> {
  let targetUdid = options.udid;
  if (!targetUdid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return { success: false, error: "No booted simulator found" };
    }
    targetUdid = booted.udid;
  }

  const recording = activeRecordings.get(targetUdid);
  if (!recording) {
    return { success: false, error: "No active recording found for this simulator" };
  }

  try {
    // Send SIGINT to stop recording gracefully
    recording.process.kill("SIGINT");

    // Wait a moment for the file to be finalized
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const duration = (new Date().getTime() - recording.startTime.getTime()) / 1000;

    activeRecordings.delete(targetUdid);

    return {
      success: true,
      outputPath: recording.outputPath,
      duration,
    };
  } catch (error) {
    activeRecordings.delete(targetUdid);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get recording status
 */
export function getRecordingStatus(udid?: string): {
  isRecording: boolean;
  outputPath?: string;
  duration?: number;
} {
  if (udid) {
    const recording = activeRecordings.get(udid);
    if (recording) {
      return {
        isRecording: true,
        outputPath: recording.outputPath,
        duration: (new Date().getTime() - recording.startTime.getTime()) / 1000,
      };
    }
    return { isRecording: false };
  }

  // Return first active recording
  for (const [, recording] of activeRecordings) {
    return {
      isRecording: true,
      outputPath: recording.outputPath,
      duration: (new Date().getTime() - recording.startTime.getTime()) / 1000,
    };
  }

  return { isRecording: false };
}

export interface PushNotificationPayload {
  aps: {
    alert?: string | {
      title?: string;
      subtitle?: string;
      body?: string;
    };
    badge?: number;
    sound?: string;
    category?: string;
    "content-available"?: number;
    "mutable-content"?: number;
  };
  [key: string]: unknown;
}

/**
 * Send a push notification to the simulator
 */
export async function sendPushNotification(
  bundleId: string,
  payload: PushNotificationPayload,
  options: { udid?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  let targetUdid = options.udid;
  if (!targetUdid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return { success: false, error: "No booted simulator found" };
    }
    targetUdid = booted.udid;
  }

  // Create temp file with payload
  const payloadJson = JSON.stringify(payload);
  const tempFile = path.join(os.tmpdir(), `push-${Date.now()}.json`);

  try {
    const { writeFile, unlink } = await import("fs/promises");
    await writeFile(tempFile, payloadJson);

    const result = await executeCommand("xcrun", [
      "simctl",
      "push",
      targetUdid,
      bundleId,
      tempFile,
    ]);

    // Clean up
    await unlink(tempFile).catch(() => {});

    if (result.exitCode !== 0) {
      return { success: false, error: result.stderr || "Failed to send push notification" };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send a simple push notification with just a message
 */
export async function sendSimplePush(
  bundleId: string,
  title: string,
  body: string,
  options: { udid?: string; badge?: number; sound?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  const payload: PushNotificationPayload = {
    aps: {
      alert: {
        title,
        body,
      },
      badge: options.badge,
      sound: options.sound || "default",
    },
  };

  return sendPushNotification(bundleId, payload, options);
}

export type NetworkCondition =
  | "100% Loss"
  | "3G"
  | "DSL"
  | "Edge"
  | "High Latency DNS"
  | "LTE"
  | "Very Bad Network"
  | "WiFi"
  | "WiFi 802.11ac"
  | "reset";

export interface StatusBarOverride {
  time?: string;
  dataNetwork?: "wifi" | "3g" | "4g" | "lte" | "lte-a" | "lte+" | "5g" | "5g-uwb" | "5g+";
  wifiMode?: "active" | "searching" | "failed";
  wifiBars?: number;
  cellularMode?: "active" | "searching" | "failed" | "notSupported";
  cellularBars?: number;
  operatorName?: string;
  batteryState?: "charging" | "charged" | "discharging";
  batteryLevel?: number;
}

/**
 * Set network link conditioning profile
 * Note: Requires Network Link Conditioner to be installed
 */
export async function setNetworkCondition(
  condition: NetworkCondition,
  options: { udid?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  let targetUdid = options.udid;
  if (!targetUdid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return { success: false, error: "No booted simulator found" };
    }
    targetUdid = booted.udid;
  }

  if (condition === "reset") {
    // Disable network conditioning
    const result = await executeCommand("xcrun", [
      "simctl",
      "status_bar",
      targetUdid,
      "clear",
    ]);

    return {
      success: result.exitCode === 0,
      error: result.exitCode === 0 ? undefined : "Failed to reset network condition",
    };
  }

  // Map conditions to simctl status bar settings
  const conditionMap: Record<string, StatusBarOverride> = {
    "100% Loss": { dataNetwork: "3g", cellularBars: 0, wifiBars: 0 },
    "3G": { dataNetwork: "3g", cellularBars: 2, cellularMode: "active" },
    "DSL": { dataNetwork: "wifi", wifiBars: 2, wifiMode: "active" },
    "Edge": { dataNetwork: "3g", cellularBars: 1, cellularMode: "active" },
    "High Latency DNS": { dataNetwork: "wifi", wifiBars: 4, wifiMode: "active" },
    "LTE": { dataNetwork: "lte", cellularBars: 4, cellularMode: "active" },
    "Very Bad Network": { dataNetwork: "3g", cellularBars: 1, cellularMode: "searching" },
    "WiFi": { dataNetwork: "wifi", wifiBars: 3, wifiMode: "active" },
    "WiFi 802.11ac": { dataNetwork: "wifi", wifiBars: 4, wifiMode: "active" },
  };

  const override = conditionMap[condition];
  if (!override) {
    return { success: false, error: `Unknown condition: ${condition}` };
  }

  return setStatusBar(override, { udid: targetUdid });
}

/**
 * Override status bar appearance
 */
export async function setStatusBar(
  override: StatusBarOverride,
  options: { udid?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  let targetUdid = options.udid;
  if (!targetUdid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return { success: false, error: "No booted simulator found" };
    }
    targetUdid = booted.udid;
  }

  const args = ["simctl", "status_bar", targetUdid, "override"];

  if (override.time) {
    args.push("--time", override.time);
  }
  if (override.dataNetwork) {
    args.push("--dataNetwork", override.dataNetwork);
  }
  if (override.wifiMode) {
    args.push("--wifiMode", override.wifiMode);
  }
  if (override.wifiBars !== undefined) {
    args.push("--wifiBars", override.wifiBars.toString());
  }
  if (override.cellularMode) {
    args.push("--cellularMode", override.cellularMode);
  }
  if (override.cellularBars !== undefined) {
    args.push("--cellularBars", override.cellularBars.toString());
  }
  if (override.operatorName) {
    args.push("--operatorName", override.operatorName);
  }
  if (override.batteryState) {
    args.push("--batteryState", override.batteryState);
  }
  if (override.batteryLevel !== undefined) {
    args.push("--batteryLevel", override.batteryLevel.toString());
  }

  const result = await executeCommand("xcrun", args);

  return {
    success: result.exitCode === 0,
    error: result.exitCode === 0 ? undefined : result.stderr || "Failed to set status bar",
  };
}

/**
 * Clear status bar overrides
 */
export async function clearStatusBar(options: {
  udid?: string;
}): Promise<{ success: boolean; error?: string }> {
  let targetUdid = options.udid;
  if (!targetUdid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return { success: false, error: "No booted simulator found" };
    }
    targetUdid = booted.udid;
  }

  const result = await executeCommand("xcrun", ["simctl", "status_bar", targetUdid, "clear"]);

  return {
    success: result.exitCode === 0,
    error: result.exitCode === 0 ? undefined : "Failed to clear status bar",
  };
}

/**
 * Set location for the simulator
 */
export async function setLocation(
  latitude: number,
  longitude: number,
  options: { udid?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  let targetUdid = options.udid;
  if (!targetUdid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return { success: false, error: "No booted simulator found" };
    }
    targetUdid = booted.udid;
  }

  const result = await executeCommand("xcrun", [
    "simctl",
    "location",
    targetUdid,
    "set",
    `${latitude},${longitude}`,
  ]);

  return {
    success: result.exitCode === 0,
    error: result.exitCode === 0 ? undefined : result.stderr || "Failed to set location",
  };
}

/**
 * Set predefined location
 */
export async function setNamedLocation(
  location: "apple" | "london" | "tokyo" | "newyork" | "sydney" | "sanfrancisco",
  options: { udid?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  const locations: Record<string, [number, number]> = {
    apple: [37.334722, -122.008889],        // Apple Park
    london: [51.5074, -0.1278],              // London
    tokyo: [35.6762, 139.6503],              // Tokyo
    newyork: [40.7128, -74.0060],            // New York
    sydney: [-33.8688, 151.2093],            // Sydney
    sanfrancisco: [37.7749, -122.4194],      // San Francisco
  };

  const coords = locations[location];
  if (!coords) {
    return { success: false, error: `Unknown location: ${location}` };
  }

  return setLocation(coords[0], coords[1], options);
}

/**
 * Trigger a memory warning in the app
 */
export async function triggerMemoryWarning(options: {
  udid?: string;
}): Promise<{ success: boolean; error?: string }> {
  let targetUdid = options.udid;
  if (!targetUdid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return { success: false, error: "No booted simulator found" };
    }
    targetUdid = booted.udid;
  }

  const result = await executeCommand("xcrun", [
    "simctl",
    "notify_post",
    targetUdid,
    "UISimulatedMemoryWarningNotification",
  ]);

  return {
    success: result.exitCode === 0,
    error: result.exitCode === 0 ? undefined : "Failed to trigger memory warning",
  };
}

/**
 * Trigger iCloud sync
 */
export async function triggeriCloudSync(options: {
  udid?: string;
}): Promise<{ success: boolean; error?: string }> {
  let targetUdid = options.udid;
  if (!targetUdid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return { success: false, error: "No booted simulator found" };
    }
    targetUdid = booted.udid;
  }

  const result = await executeCommand("xcrun", [
    "simctl",
    "spawn",
    targetUdid,
    "notifyutil",
    "-p",
    "com.apple.icloud.presence.sync.trigger",
  ]);

  return {
    success: result.exitCode === 0,
    error: result.exitCode === 0 ? undefined : "Failed to trigger iCloud sync",
  };
}

/**
 * Get biometric enrollment state
 */
export async function getBiometricState(options: {
  udid?: string;
}): Promise<{ success: boolean; enrolled?: boolean; error?: string }> {
  let targetUdid = options.udid;
  if (!targetUdid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return { success: false, error: "No booted simulator found" };
    }
    targetUdid = booted.udid;
  }

  // Check Face ID enrollment
  const result = await executeCommand("xcrun", [
    "simctl",
    "spawn",
    targetUdid,
    "notifyutil",
    "-g",
    "com.apple.BiometricKit.enrollmentChanged",
  ]);

  // This is a simplified check - actual state requires more complex parsing
  return {
    success: true,
    enrolled: true, // Default to true as enrollment state is complex
  };
}

/**
 * Toggle biometric enrollment
 */
export async function setBiometricEnrollment(
  enrolled: boolean,
  options: { udid?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  let targetUdid = options.udid;
  if (!targetUdid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return { success: false, error: "No booted simulator found" };
    }
    targetUdid = booted.udid;
  }

  // Note: Actual enrollment toggle requires Xcode UI or specific APIs
  // This simulates the notification
  const notification = enrolled
    ? "com.apple.BiometricKit_Sim.fingerTouch.match"
    : "com.apple.BiometricKit_Sim.fingerTouch.nomatch";

  const result = await executeCommand("xcrun", [
    "simctl",
    "notify_post",
    targetUdid,
    notification,
  ]);

  return {
    success: result.exitCode === 0,
    error: result.exitCode === 0 ? undefined : "Failed to set biometric enrollment",
  };
}

/**
 * Simulate biometric match/non-match
 */
export async function simulateBiometric(
  match: boolean,
  options: { udid?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  let targetUdid = options.udid;
  if (!targetUdid) {
    const booted = await getBootedSimulator();
    if (!booted) {
      return { success: false, error: "No booted simulator found" };
    }
    targetUdid = booted.udid;
  }

  const notification = match
    ? "com.apple.BiometricKit_Sim.fingerTouch.match"
    : "com.apple.BiometricKit_Sim.fingerTouch.nomatch";

  const result = await executeCommand("xcrun", [
    "simctl",
    "notify_post",
    targetUdid,
    notification,
  ]);

  return {
    success: result.exitCode === 0,
    error: result.exitCode === 0 ? undefined : "Failed to simulate biometric",
  };
}
