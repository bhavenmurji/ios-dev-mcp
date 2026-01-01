/**
 * Process execution utilities for running shell commands
 */

import { spawn, SpawnOptions } from "child_process";

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export interface ProcessOptions {
  cwd?: string;
  timeout?: number; // in milliseconds
  env?: Record<string, string>;
}

/**
 * Execute a command and return the result
 */
export async function executeCommand(
  command: string,
  args: string[],
  options: ProcessOptions = {}
): Promise<ProcessResult> {
  const { cwd, timeout = 30000, env } = options;

  return new Promise((resolve) => {
    const spawnOptions: SpawnOptions = {
      cwd,
      env: { ...process.env, ...env },
      shell: false,
    };

    const proc = spawn(command, args, spawnOptions);

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, timeout);

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (exitCode) => {
      clearTimeout(timeoutId);
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode ?? 1,
        timedOut,
      });
    });

    proc.on("error", (error) => {
      clearTimeout(timeoutId);
      resolve({
        stdout: "",
        stderr: error.message,
        exitCode: 1,
        timedOut: false,
      });
    });
  });
}

/**
 * Execute a command through shell (for complex commands with pipes, etc.)
 */
export async function executeShell(
  command: string,
  options: ProcessOptions = {}
): Promise<ProcessResult> {
  const { cwd, timeout = 30000, env } = options;

  return new Promise((resolve) => {
    const spawnOptions: SpawnOptions = {
      cwd,
      env: { ...process.env, ...env },
      shell: true,
    };

    const proc = spawn(command, [], spawnOptions);

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, timeout);

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (exitCode) => {
      clearTimeout(timeoutId);
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode ?? 1,
        timedOut,
      });
    });

    proc.on("error", (error) => {
      clearTimeout(timeoutId);
      resolve({
        stdout: "",
        stderr: error.message,
        exitCode: 1,
        timedOut: false,
      });
    });
  });
}
