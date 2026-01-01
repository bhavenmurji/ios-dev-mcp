/**
 * Build Error Fixing & Smart Issue Tracking
 * Auto-suggest fixes for common Swift/Xcode errors
 * Tracks recurring issues to prevent debugging loops
 */

export interface BuildError {
  file: string;
  line: number;
  column?: number;
  message: string;
  code?: string;
  severity: "error" | "warning";
  raw: string;
}

export interface ErrorFix {
  description: string;
  confidence: "high" | "medium" | "low";
  codeChange?: {
    file: string;
    line: number;
    original?: string;
    replacement: string;
  };
  explanation: string;
  command?: string;
}

export interface IssuePattern {
  hash: string;
  errorType: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  attemptedFixes: string[];
  resolved: boolean;
}

// In-memory issue tracker (persists during session)
const issueHistory: Map<string, IssuePattern> = new Map();

/**
 * Parse Xcode build output to extract errors
 */
export function parseBuildErrors(output: string): BuildError[] {
  const errors: BuildError[] = [];
  const lines = output.split("\n");

  // Pattern: /path/file.swift:line:column: error: message
  const errorPattern = /^(.+?):(\d+):(\d+)?:?\s*(error|warning):\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(errorPattern);
    if (match) {
      const [, file, lineNum, col, severity, message] = match;
      errors.push({
        file,
        line: parseInt(lineNum, 10),
        column: col ? parseInt(col, 10) : undefined,
        message,
        severity: severity as "error" | "warning",
        raw: line,
      });
    }
  }

  return errors;
}

/**
 * Generate a hash for an error to track recurrence
 */
function hashError(error: BuildError): string {
  // Normalize the error for comparison
  const normalized = `${error.file}:${error.message.replace(/'.+?'/g, "'X'")}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Track an error occurrence
 */
export function trackError(error: BuildError): IssuePattern {
  const hash = hashError(error);
  const existing = issueHistory.get(hash);

  if (existing) {
    existing.count++;
    existing.lastSeen = new Date();
    return existing;
  }

  const pattern: IssuePattern = {
    hash,
    errorType: extractErrorType(error.message),
    count: 1,
    firstSeen: new Date(),
    lastSeen: new Date(),
    attemptedFixes: [],
    resolved: false,
  };

  issueHistory.set(hash, pattern);
  return pattern;
}

/**
 * Extract error type category
 */
function extractErrorType(message: string): string {
  if (message.includes("cannot find") || message.includes("undeclared")) {
    return "undefined_reference";
  }
  if (message.includes("type") && message.includes("conform")) {
    return "protocol_conformance";
  }
  if (message.includes("cannot convert") || message.includes("type mismatch")) {
    return "type_mismatch";
  }
  if (message.includes("missing argument") || message.includes("extra argument")) {
    return "argument_mismatch";
  }
  if (message.includes("optional") || message.includes("nil")) {
    return "optional_handling";
  }
  if (message.includes("ambiguous")) {
    return "ambiguous_reference";
  }
  if (message.includes("private") || message.includes("internal") || message.includes("access")) {
    return "access_control";
  }
  if (message.includes("deprecated")) {
    return "deprecation";
  }
  if (message.includes("import") || message.includes("module")) {
    return "import_error";
  }
  if (message.includes("async") || message.includes("await")) {
    return "concurrency";
  }
  return "general";
}

/**
 * Common Swift/Xcode error patterns and their fixes
 */
const ERROR_FIXES: Array<{
  pattern: RegExp;
  fix: (match: RegExpMatchArray, error: BuildError) => ErrorFix;
}> = [
  // Missing import
  {
    pattern: /cannot find type '(\w+)' in scope/,
    fix: (match, error) => ({
      description: `Add missing import for ${match[1]}`,
      confidence: "medium",
      codeChange: {
        file: error.file,
        line: 1,
        replacement: `import Foundation // or the module containing ${match[1]}`,
      },
      explanation: `The type '${match[1]}' is not in scope. Common modules to import:\n- Foundation: for basic types\n- UIKit: for UI components\n- SwiftUI: for SwiftUI views\n- Combine: for reactive programming`,
    }),
  },

  // Missing function
  {
    pattern: /cannot find '(\w+)' in scope/,
    fix: (match, error) => ({
      description: `Define or import '${match[1]}'`,
      confidence: "medium",
      explanation: `'${match[1]}' is not defined. Either:\n1. Import the module containing it\n2. Define the function/variable\n3. Check for typos in the name`,
    }),
  },

  // Type mismatch
  {
    pattern: /cannot convert value of type '(.+?)' to expected argument type '(.+?)'/,
    fix: (match, error) => ({
      description: `Convert ${match[1]} to ${match[2]}`,
      confidence: "high",
      explanation: `Type mismatch: got ${match[1]}, expected ${match[2]}.\n\nCommon fixes:\n- String to Int: Int(stringValue) ?? 0\n- Int to String: String(intValue)\n- Optional unwrap: value ?? defaultValue\n- Cast: value as? ${match[2]}`,
    }),
  },

  // Missing protocol conformance
  {
    pattern: /type '(.+?)' does not conform to protocol '(.+?)'/,
    fix: (match, error) => ({
      description: `Add ${match[2]} conformance to ${match[1]}`,
      confidence: "high",
      explanation: `${match[1]} needs to conform to ${match[2]}.\n\nAdd the required methods/properties:\n\n\`\`\`swift\nextension ${match[1]}: ${match[2]} {\n  // Add required members\n}\n\`\`\`\n\nCommon protocols:\n- Codable: init(from:) and encode(to:)\n- Equatable: static func == \n- Hashable: func hash(into:)\n- Identifiable: var id property`,
    }),
  },

  // Optional unwrapping
  {
    pattern: /value of optional type '(.+?)\?' must be unwrapped/,
    fix: (match, error) => ({
      description: `Safely unwrap optional ${match[1]}`,
      confidence: "high",
      explanation: `The value is optional and must be unwrapped.\n\nOptions:\n1. Optional binding: if let value = optional { }\n2. Guard: guard let value = optional else { return }\n3. Nil coalescing: optional ?? defaultValue\n4. Optional chaining: optional?.method()`,
    }),
  },

  // Missing argument label
  {
    pattern: /missing argument label '(\w+):' in call/,
    fix: (match, error) => ({
      description: `Add argument label '${match[1]}:'`,
      confidence: "high",
      explanation: `Swift requires the argument label '${match[1]}:' in this function call.\n\nChange: function(value)\nTo: function(${match[1]}: value)`,
    }),
  },

  // Extra argument
  {
    pattern: /extra argument '(\w+)' in call/,
    fix: (match, error) => ({
      description: `Remove extra argument '${match[1]}'`,
      confidence: "high",
      explanation: `The function doesn't accept an argument named '${match[1]}'. Check the function signature and remove the extra argument.`,
    }),
  },

  // Async/await issues
  {
    pattern: /'async' call in a function that does not support concurrency/,
    fix: (match, error) => ({
      description: "Add async support to function",
      confidence: "high",
      explanation: `You're calling an async function from a non-async context.\n\nOptions:\n1. Make the calling function async: func doWork() async { }\n2. Use Task { }: Task { await asyncFunction() }\n3. Use Task.detached for background work`,
    }),
  },

  // Missing await
  {
    pattern: /expression is 'async' but is not marked with 'await'/,
    fix: (match, error) => ({
      description: "Add 'await' keyword",
      confidence: "high",
      explanation: "Add the 'await' keyword before the async call:\n\n`let result = await asyncFunction()`",
    }),
  },

  // Actor isolation
  {
    pattern: /actor-isolated .+ cannot be (referenced|mutated) from/,
    fix: (match, error) => ({
      description: "Handle actor isolation",
      confidence: "medium",
      explanation: `Actor-isolated members require async access.\n\nOptions:\n1. Make the access async: await actor.property\n2. Use nonisolated for the member if it's safe\n3. Access from within the actor's context`,
    }),
  },

  // Sendable conformance
  {
    pattern: /cannot be sent to/,
    fix: (match, error) => ({
      description: "Add Sendable conformance",
      confidence: "medium",
      explanation: `For Swift concurrency, make the type Sendable:\n\n\`\`\`swift\nstruct MyType: Sendable {\n  // Only use Sendable properties\n}\n\`\`\`\n\nOr use @unchecked Sendable if you handle thread safety manually.`,
    }),
  },

  // SwiftUI View requirements
  {
    pattern: /type '(.+?)' does not conform to protocol 'View'/,
    fix: (match, error) => ({
      description: "Add View body property",
      confidence: "high",
      explanation: `SwiftUI Views need a body property:\n\n\`\`\`swift\nstruct ${match[1]}: View {\n  var body: some View {\n    Text("Hello")\n  }\n}\n\`\`\``,
    }),
  },

  // Missing return
  {
    pattern: /missing return in a function expected to return '(.+?)'/,
    fix: (match, error) => ({
      description: `Add return statement for ${match[1]}`,
      confidence: "high",
      explanation: `The function must return a ${match[1]}. Add a return statement at the end of the function or in all branches.`,
    }),
  },
];

/**
 * Get fix suggestions for a build error
 */
export function suggestFixes(error: BuildError): ErrorFix[] {
  const fixes: ErrorFix[] = [];
  const pattern = trackError(error);

  // Check if we've seen this error repeatedly
  if (pattern.count > 2) {
    fixes.push({
      description: "⚠️ Recurring issue detected",
      confidence: "high",
      explanation: `This error has occurred ${pattern.count} times. Previous fix attempts: ${
        pattern.attemptedFixes.length > 0 ? pattern.attemptedFixes.join(", ") : "none recorded"
      }.\n\nConsider a different approach or asking for help with the underlying architecture.`,
    });
  }

  // Match against known patterns
  for (const { pattern: regex, fix: getFix } of ERROR_FIXES) {
    const match = error.message.match(regex);
    if (match) {
      fixes.push(getFix(match, error));
    }
  }

  // Generic suggestions based on error type
  if (fixes.length === 0) {
    fixes.push({
      description: "General debugging steps",
      confidence: "low",
      explanation: `Error: ${error.message}\n\nGeneral steps:\n1. Check the line for typos\n2. Verify imports at the top of the file\n3. Check that all required dependencies are installed\n4. Clean build folder (Cmd+Shift+K) and rebuild`,
    });
  }

  return fixes;
}

/**
 * Analyze multiple errors and provide comprehensive fix plan
 */
export function analyzeErrors(errors: BuildError[]): {
  summary: string;
  fixes: Array<{ error: BuildError; suggestions: ErrorFix[] }>;
  recurringIssues: IssuePattern[];
  recommendedOrder: string[];
} {
  const fixes = errors.map((error) => ({
    error,
    suggestions: suggestFixes(error),
  }));

  // Find recurring issues
  const recurringIssues = Array.from(issueHistory.values()).filter((p) => p.count > 1);

  // Determine fix order (dependencies first, then by confidence)
  const recommendedOrder: string[] = [];

  // Import errors first
  const importErrors = fixes.filter((f) => f.error.message.includes("import") || f.error.message.includes("module"));
  // Type definition errors second
  const typeErrors = fixes.filter((f) => f.error.message.includes("cannot find type"));
  // Everything else
  const otherErrors = fixes.filter((f) => !importErrors.includes(f) && !typeErrors.includes(f));

  [...importErrors, ...typeErrors, ...otherErrors].forEach((f, i) => {
    recommendedOrder.push(`${i + 1}. ${f.error.file}:${f.error.line} - ${f.error.message.substring(0, 50)}...`);
  });

  const summary = `
Found ${errors.length} error(s)${recurringIssues.length > 0 ? ` (${recurringIssues.length} recurring)` : ""}.

${recurringIssues.length > 0 ? `⚠️ RECURRING ISSUES DETECTED - Consider a different approach for:\n${recurringIssues.map((r) => `  - ${r.errorType} (seen ${r.count}x)`).join("\n")}\n` : ""}
Recommended fix order:
${recommendedOrder.join("\n")}
`;

  return { summary, fixes, recurringIssues, recommendedOrder };
}

/**
 * Record a fix attempt for tracking
 */
export function recordFixAttempt(error: BuildError, fixDescription: string): void {
  const hash = hashError(error);
  const pattern = issueHistory.get(hash);
  if (pattern) {
    pattern.attemptedFixes.push(fixDescription);
  }
}

/**
 * Mark an issue as resolved
 */
export function markResolved(error: BuildError): void {
  const hash = hashError(error);
  const pattern = issueHistory.get(hash);
  if (pattern) {
    pattern.resolved = true;
  }
}

/**
 * Get session statistics
 */
export function getSessionStats(): {
  totalErrors: number;
  resolvedErrors: number;
  recurringErrors: number;
  topIssueTypes: Array<{ type: string; count: number }>;
} {
  const patterns = Array.from(issueHistory.values());
  const typeCount = new Map<string, number>();

  for (const p of patterns) {
    typeCount.set(p.errorType, (typeCount.get(p.errorType) || 0) + p.count);
  }

  const topIssueTypes = Array.from(typeCount.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalErrors: patterns.reduce((sum, p) => sum + p.count, 0),
    resolvedErrors: patterns.filter((p) => p.resolved).length,
    recurringErrors: patterns.filter((p) => p.count > 1).length,
    topIssueTypes,
  };
}

/**
 * Clear session history
 */
export function clearHistory(): void {
  issueHistory.clear();
}
