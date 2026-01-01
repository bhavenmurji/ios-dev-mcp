/**
 * Xcode Testing Module
 * Provides XCTest execution and result parsing
 */

import { executeCommand } from "../utils/process.js";
import { detectProjectType } from "./builder.js";
import { getBootedSimulator } from "../simulator/controller.js";

export interface TestResult {
  name: string;
  className: string;
  status: "passed" | "failed" | "skipped";
  duration: number;
  failureMessage?: string;
}

export interface TestSuiteResult {
  success: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  tests: TestResult[];
  output: string;
  error?: string;
}

export interface TestListResult {
  success: boolean;
  testTargets: Array<{
    name: string;
    tests: string[];
  }>;
  error?: string;
}

/**
 * Run tests for an Xcode project
 */
export async function runTests(
  projectPath: string,
  options: {
    scheme: string;
    testPlan?: string;
    destination?: string;
    configuration?: string;
    onlyTesting?: string[]; // Specific tests to run
    skipTesting?: string[]; // Tests to skip
    timeout?: number;
  }
): Promise<TestSuiteResult> {
  const startTime = Date.now();
  const projectType = await detectProjectType(projectPath);

  if (!projectType) {
    return {
      success: false,
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      tests: [],
      output: "",
      error: `Invalid project path: ${projectPath}`,
    };
  }

  const {
    scheme,
    testPlan,
    destination,
    configuration = "Debug",
    onlyTesting,
    skipTesting,
    timeout = 600000, // 10 minutes default
  } = options;

  const args: string[] = [];

  // Add project or workspace
  if (projectType === "workspace") {
    args.push("-workspace", projectPath);
  } else {
    args.push("-project", projectPath);
  }

  args.push("-scheme", scheme);
  args.push("-configuration", configuration);

  // Add destination
  if (destination) {
    args.push("-destination", destination);
  } else {
    // Try to use booted simulator
    const booted = await getBootedSimulator();
    if (booted) {
      args.push("-destination", `platform=iOS Simulator,id=${booted.udid}`);
    } else {
      args.push("-destination", "platform=iOS Simulator,name=iPhone 15");
    }
  }

  // Add test plan if specified
  if (testPlan) {
    args.push("-testPlan", testPlan);
  }

  // Add specific tests to run
  if (onlyTesting && onlyTesting.length > 0) {
    for (const test of onlyTesting) {
      args.push("-only-testing", test);
    }
  }

  // Add tests to skip
  if (skipTesting && skipTesting.length > 0) {
    for (const test of skipTesting) {
      args.push("-skip-testing", test);
    }
  }

  // Add test action
  args.push("test");

  // Disable code signing for simulator
  args.push("CODE_SIGNING_ALLOWED=NO");

  // Enable parallel testing
  args.push("-parallel-testing-enabled", "YES");

  const result = await executeCommand("xcodebuild", args, { timeout });

  const duration = Date.now() - startTime;

  // Parse test results from output
  const tests = parseTestResults(result.stdout + "\n" + result.stderr);

  const passed = tests.filter((t) => t.status === "passed").length;
  const failed = tests.filter((t) => t.status === "failed").length;
  const skipped = tests.filter((t) => t.status === "skipped").length;

  if (result.timedOut) {
    return {
      success: false,
      totalTests: tests.length,
      passed,
      failed,
      skipped,
      duration,
      tests,
      output: result.stdout,
      error: `Tests timed out after ${timeout / 1000} seconds`,
    };
  }

  // Check for test failures
  const hasFailures =
    failed > 0 || result.stdout.includes("** TEST FAILED **");

  return {
    success: !hasFailures && result.exitCode === 0,
    totalTests: tests.length,
    passed,
    failed,
    skipped,
    duration,
    tests,
    output: result.stdout,
    error: hasFailures ? `${failed} test(s) failed` : undefined,
  };
}

/**
 * Parse test results from xcodebuild output
 */
function parseTestResults(output: string): TestResult[] {
  const tests: TestResult[] = [];
  const lines = output.split("\n");

  // Patterns for different test result formats
  const testPassedPattern =
    /Test Case '-\[(\w+)\s+(\w+)\]' passed \((\d+\.?\d*) seconds\)/;
  const testFailedPattern =
    /Test Case '-\[(\w+)\s+(\w+)\]' failed \((\d+\.?\d*) seconds\)/;
  const swiftTestPassedPattern =
    /Test Case '(\w+)\.(\w+)' passed \((\d+\.?\d*) seconds\)/;
  const swiftTestFailedPattern =
    /Test Case '(\w+)\.(\w+)' failed \((\d+\.?\d*) seconds\)/;

  let currentFailureMessage = "";
  let lastTestName = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for passed tests
    let match = line.match(testPassedPattern) || line.match(swiftTestPassedPattern);
    if (match) {
      tests.push({
        className: match[1],
        name: match[2],
        status: "passed",
        duration: parseFloat(match[3]),
      });
      continue;
    }

    // Check for failed tests
    match = line.match(testFailedPattern) || line.match(swiftTestFailedPattern);
    if (match) {
      const testName = match[2];

      // Look back for failure message
      let failureMessage = "";
      for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
        if (
          lines[j].includes("XCTAssert") ||
          lines[j].includes("failed:") ||
          lines[j].includes("error:")
        ) {
          failureMessage = lines[j].trim();
          break;
        }
      }

      tests.push({
        className: match[1],
        name: testName,
        status: "failed",
        duration: parseFloat(match[3]),
        failureMessage,
      });
      continue;
    }

    // Check for skipped tests
    if (line.includes("Test Case") && line.includes("skipped")) {
      const skippedMatch = line.match(/Test Case ['-]?\[?(\w+)[.\s]+(\w+)/);
      if (skippedMatch) {
        tests.push({
          className: skippedMatch[1],
          name: skippedMatch[2],
          status: "skipped",
          duration: 0,
        });
      }
    }
  }

  return tests;
}

/**
 * List available tests in a project
 */
export async function listTests(
  projectPath: string,
  scheme: string
): Promise<TestListResult> {
  const projectType = await detectProjectType(projectPath);

  if (!projectType) {
    return {
      success: false,
      testTargets: [],
      error: `Invalid project path: ${projectPath}`,
    };
  }

  const args: string[] = [];

  if (projectType === "workspace") {
    args.push("-workspace", projectPath);
  } else {
    args.push("-project", projectPath);
  }

  args.push("-scheme", scheme);
  args.push("-showTestInfo");

  const result = await executeCommand("xcodebuild", args, { timeout: 60000 });

  if (result.exitCode !== 0) {
    // Fallback: try to find test targets from scheme
    return {
      success: false,
      testTargets: [],
      error: result.stderr || "Failed to list tests",
    };
  }

  // Parse test info from output
  const testTargets: Array<{ name: string; tests: string[] }> = [];
  const lines = result.stdout.split("\n");

  let currentTarget: { name: string; tests: string[] } | null = null;

  for (const line of lines) {
    // Look for test target headers
    if (line.includes("Tests") && line.includes(":")) {
      if (currentTarget) {
        testTargets.push(currentTarget);
      }
      currentTarget = { name: line.replace(":", "").trim(), tests: [] };
    } else if (currentTarget && line.trim().startsWith("-")) {
      currentTarget.tests.push(line.trim().substring(1).trim());
    }
  }

  if (currentTarget) {
    testTargets.push(currentTarget);
  }

  return {
    success: true,
    testTargets,
  };
}

/**
 * Run a specific test method
 */
export async function runSingleTest(
  projectPath: string,
  scheme: string,
  testIdentifier: string, // Format: TargetName/ClassName/testMethodName
  options?: {
    destination?: string;
    timeout?: number;
  }
): Promise<TestSuiteResult> {
  return runTests(projectPath, {
    scheme,
    onlyTesting: [testIdentifier],
    destination: options?.destination,
    timeout: options?.timeout,
  });
}

/**
 * Build for testing (compile test bundle without running)
 */
export async function buildForTesting(
  projectPath: string,
  options: {
    scheme: string;
    destination?: string;
    configuration?: string;
    timeout?: number;
  }
): Promise<{ success: boolean; output: string; error?: string }> {
  const projectType = await detectProjectType(projectPath);

  if (!projectType) {
    return {
      success: false,
      output: "",
      error: `Invalid project path: ${projectPath}`,
    };
  }

  const { scheme, destination, configuration = "Debug", timeout = 600000 } =
    options;

  const args: string[] = [];

  if (projectType === "workspace") {
    args.push("-workspace", projectPath);
  } else {
    args.push("-project", projectPath);
  }

  args.push("-scheme", scheme);
  args.push("-configuration", configuration);

  if (destination) {
    args.push("-destination", destination);
  } else {
    const booted = await getBootedSimulator();
    if (booted) {
      args.push("-destination", `platform=iOS Simulator,id=${booted.udid}`);
    } else {
      args.push("-destination", "platform=iOS Simulator,name=iPhone 15");
    }
  }

  args.push("build-for-testing");
  args.push("CODE_SIGNING_ALLOWED=NO");

  const result = await executeCommand("xcodebuild", args, { timeout });

  return {
    success: result.exitCode === 0,
    output: result.stdout,
    error: result.exitCode !== 0 ? result.stderr : undefined,
  };
}

/**
 * Run tests without building (uses previously built test bundle)
 */
export async function testWithoutBuilding(
  projectPath: string,
  options: {
    scheme: string;
    destination?: string;
    xctestrun?: string; // Path to .xctestrun file
    onlyTesting?: string[];
    timeout?: number;
  }
): Promise<TestSuiteResult> {
  const startTime = Date.now();
  const projectType = await detectProjectType(projectPath);

  if (!projectType) {
    return {
      success: false,
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      tests: [],
      output: "",
      error: `Invalid project path: ${projectPath}`,
    };
  }

  const { scheme, destination, xctestrun, onlyTesting, timeout = 600000 } =
    options;

  const args: string[] = [];

  if (xctestrun) {
    args.push("-xctestrun", xctestrun);
  } else {
    if (projectType === "workspace") {
      args.push("-workspace", projectPath);
    } else {
      args.push("-project", projectPath);
    }
    args.push("-scheme", scheme);
  }

  if (destination) {
    args.push("-destination", destination);
  } else {
    const booted = await getBootedSimulator();
    if (booted) {
      args.push("-destination", `platform=iOS Simulator,id=${booted.udid}`);
    } else {
      args.push("-destination", "platform=iOS Simulator,name=iPhone 15");
    }
  }

  if (onlyTesting && onlyTesting.length > 0) {
    for (const test of onlyTesting) {
      args.push("-only-testing", test);
    }
  }

  args.push("test-without-building");

  const result = await executeCommand("xcodebuild", args, { timeout });
  const duration = Date.now() - startTime;

  const tests = parseTestResults(result.stdout + "\n" + result.stderr);
  const passed = tests.filter((t) => t.status === "passed").length;
  const failed = tests.filter((t) => t.status === "failed").length;
  const skipped = tests.filter((t) => t.status === "skipped").length;

  return {
    success: result.exitCode === 0 && failed === 0,
    totalTests: tests.length,
    passed,
    failed,
    skipped,
    duration,
    tests,
    output: result.stdout,
    error: failed > 0 ? `${failed} test(s) failed` : undefined,
  };
}

/**
 * Get code coverage report
 */
export async function getCoverage(
  projectPath: string,
  scheme: string
): Promise<{
  success: boolean;
  coverage?: {
    lineCoverage: number;
    files: Array<{
      path: string;
      lineCoverage: number;
      coveredLines: number;
      executableLines: number;
    }>;
  };
  error?: string;
}> {
  // Coverage data is stored in derived data
  // We need to find the .xcresult bundle and parse it

  const projectType = await detectProjectType(projectPath);
  if (!projectType) {
    return {
      success: false,
      error: `Invalid project path: ${projectPath}`,
    };
  }

  // Find the most recent test result
  const findResult = await executeCommand(
    "find",
    [
      `${process.env.HOME}/Library/Developer/Xcode/DerivedData`,
      "-name",
      "*.xcresult",
      "-type",
      "d",
      "-mtime",
      "-1",
    ],
    { timeout: 30000 }
  );

  if (findResult.exitCode !== 0 || !findResult.stdout.trim()) {
    return {
      success: false,
      error: "No recent test results found. Run tests first.",
    };
  }

  const xcresultPaths = findResult.stdout.trim().split("\n");
  const latestResult = xcresultPaths[xcresultPaths.length - 1];

  // Use xcrun xcresulttool to get coverage
  const coverageResult = await executeCommand(
    "xcrun",
    ["xccov", "view", "--report", latestResult],
    { timeout: 30000 }
  );

  if (coverageResult.exitCode !== 0) {
    return {
      success: false,
      error: `Failed to get coverage: ${coverageResult.stderr}`,
    };
  }

  // Parse coverage output
  const lines = coverageResult.stdout.split("\n");
  const files: Array<{
    path: string;
    lineCoverage: number;
    coveredLines: number;
    executableLines: number;
  }> = [];

  let totalCoverage = 0;

  for (const line of lines) {
    // Parse coverage percentage from lines like:
    // "MyFile.swift: 85.00% (17/20)"
    const match = line.match(/(.+?):\s+(\d+\.?\d*)%\s+\((\d+)\/(\d+)\)/);
    if (match) {
      const coverage = parseFloat(match[2]);
      files.push({
        path: match[1].trim(),
        lineCoverage: coverage,
        coveredLines: parseInt(match[3]),
        executableLines: parseInt(match[4]),
      });
    }

    // Look for total coverage
    if (line.toLowerCase().includes("total")) {
      const totalMatch = line.match(/(\d+\.?\d*)%/);
      if (totalMatch) {
        totalCoverage = parseFloat(totalMatch[1]);
      }
    }
  }

  return {
    success: true,
    coverage: {
      lineCoverage: totalCoverage,
      files,
    },
  };
}

/**
 * Format test results for display
 */
export function formatTestResults(result: TestSuiteResult): string {
  const lines: string[] = [];

  // Summary
  if (result.success) {
    lines.push(`✅ Tests Passed`);
  } else {
    lines.push(`❌ Tests Failed`);
  }

  lines.push(
    `   ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`
  );
  lines.push(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);
  lines.push("");

  // Failed tests details
  const failed = result.tests.filter((t) => t.status === "failed");
  if (failed.length > 0) {
    lines.push("Failed Tests:");
    for (const test of failed) {
      lines.push(`  ✗ ${test.className}.${test.name}`);
      if (test.failureMessage) {
        lines.push(`    ${test.failureMessage}`);
      }
    }
    lines.push("");
  }

  // Passed tests (abbreviated)
  const passed = result.tests.filter((t) => t.status === "passed");
  if (passed.length > 0) {
    lines.push(`Passed Tests (${passed.length}):`);
    // Show first 10, then summarize
    const toShow = passed.slice(0, 10);
    for (const test of toShow) {
      lines.push(`  ✓ ${test.className}.${test.name} (${test.duration.toFixed(3)}s)`);
    }
    if (passed.length > 10) {
      lines.push(`  ... and ${passed.length - 10} more`);
    }
  }

  return lines.join("\n");
}
