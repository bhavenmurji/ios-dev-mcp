# Contributing to iOS Development MCP

Thank you for your interest in contributing! This project provides the most comprehensive MCP server for iOS development, with 53 tools covering everything from Swift execution to web-to-iOS conversion.

## Project Goals

1. **Unified Experience** — Single MCP server for the entire iOS development workflow
2. **Comprehensive Coverage** — Swift, Xcode, Simulator, UI, Testing, Web integration
3. **Performance** — Fast, efficient, minimal overhead
4. **Reliability** — Production-ready, well-tested
5. **Extensibility** — Easy to add new tools and capabilities

## Getting Started

### Prerequisites

- macOS 13.0+
- Xcode 15.0+
- Node.js 18+
- Swift 5.9+

### Setup

```bash
git clone https://github.com/bhavenmurji/ios-dev-mcp.git
cd ios-dev-mcp
npm install
npm run build
```

### Running Tests

```bash
npm test
```

### Development Mode

```bash
npm run dev
```

## Architecture

### Module Organization

```
src/
├── index.ts              # MCP server entry + 53 tool definitions
├── swift/
│   └── executor.ts       # Swift code execution and compilation
├── xcode/
│   ├── builder.ts        # Xcode building, schemes, settings
│   └── testing.ts        # XCTest execution, coverage
├── simulator/
│   ├── controller.ts     # Simulator lifecycle management
│   └── advanced.ts       # Video, push, network, location, biometrics
├── ui/
│   ├── automation.ts     # Tap, swipe, type, gestures, buttons
│   └── accessibility.ts  # Element inspection and screen description
├── workflow/
│   └── dev.ts            # Iterative development sessions
├── context/
│   └── claude-md.ts      # CLAUDE.md project context generation
├── diagnostics/
│   └── error-fixer.ts    # Smart error analysis and tracking
├── web/
│   └── browser.ts        # Web fetching and iOS conversion
└── utils/
    ├── process.ts        # Command execution utilities
    └── tempfile.ts       # Temporary file management
```

### Tool Categories (53 Total)

| Category | Tools | Location |
|----------|-------|----------|
| Iterative Development | 6 | `workflow/dev.ts` |
| Swift Execution | 1 | `swift/executor.ts` |
| Xcode Building | 3 | `xcode/builder.ts` |
| Simulator Control | 9 | `simulator/controller.ts` |
| Advanced Simulator | 8 | `simulator/advanced.ts` |
| UI Automation | 11 | `ui/automation.ts` |
| Accessibility | 2 | `ui/accessibility.ts` |
| XCTest Integration | 3 | `xcode/testing.ts` |
| Web Integration | 6 | `web/browser.ts` |
| Project Context | 1 | `context/claude-md.ts` |
| Error Diagnostics | 2 | `diagnostics/error-fixer.ts` |
| System Info | 1 | `index.ts` |

## Adding New Tools

### 1. Define Tool Schema

In `src/index.ts`, add the tool definition:

```typescript
{
  name: "my_new_tool",
  description: "Does something awesome for iOS development",
  inputSchema: {
    type: "object",
    properties: {
      param: { type: "string", description: "Parameter description" }
    },
    required: ["param"]
  }
}
```

### 2. Implement Handler

Add the case in the tool handler switch:

```typescript
case "my_new_tool": {
  const result = await myNewFunction(args.param);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}
```

### 3. Create Implementation

Add the implementation in the appropriate module:

```typescript
// src/mymodule/feature.ts
export async function myNewFunction(param: string): Promise<Result> {
  // Implementation
}
```

### 4. Add Tests

```typescript
// tests/mymodule/feature.test.ts
describe('myNewFunction', () => {
  it('should handle normal case', () => {
    // Test implementation
  });
});
```

### 5. Update Documentation

- Add to README.md tool tables
- Add example usage in examples/README.md
- Update this file if adding a new module

## Code Style

- Use TypeScript for all MCP server code
- Use Swift for execution engine where appropriate
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Keep functions focused and testable
- Use Zod for schema validation

## Commit Messages

Follow conventional commits:

- `feat:` New feature or tool
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions/changes
- `refactor:` Code refactoring
- `perf:` Performance improvements

Examples:
```
feat: add Face ID simulation to ui automation
fix: handle simulator timeout on slow builds
docs: add web integration examples
```

## Pull Request Process

### 1. Fork & Branch

- Fork the repo
- Create feature branch from `main`
- Use descriptive names: `feature/watch-connectivity` or `fix/simulator-crash`

### 2. Develop & Test

- Write tests for new features
- Ensure all tests pass: `npm test`
- Lint your code: `npm run lint`
- Update documentation

### 3. Submit PR

- Fill out PR template completely
- Link related issues
- Include examples of tool usage
- Add screenshots if UI-related

### 4. Code Review

- Address feedback promptly
- Keep discussions constructive
- Be open to suggestions

## Testing

### Test Requirements

- Unit tests for all new functions
- Integration tests for tool interactions
- Manual testing on real Xcode projects

### Test Structure

```typescript
describe('FeatureName', () => {
  it('should handle normal case', () => {
    // Test
  });

  it('should handle edge cases', () => {
    // Test
  });

  it('should handle errors gracefully', () => {
    // Test
  });
});
```

## Quick Contribution Ideas

### Easy (Good First Issues)

- Add examples to `/examples`
- Improve error messages
- Add tests for existing code
- Fix documentation typos
- Add JSDoc comments

### Medium

- Add new simulator capabilities
- Improve test coverage
- Add new location presets
- Performance optimizations
- Better error diagnostics patterns

### Advanced

- Real device support
- Watch/tvOS simulator support
- Visual regression testing
- Performance profiling tools
- CI/CD integrations

## Community

### Communication

- **GitHub Issues** — Bug reports and feature requests
- **GitHub Discussions** — Questions and general discussion
- **Pull Requests** — Code contributions

### Code of Conduct

- Be respectful and inclusive
- Assume good intentions
- Welcome newcomers
- Focus on constructive feedback
- Keep discussions professional

## Recognition

Contributors will be:
- Listed in README acknowledgments
- Credited in release notes
- Given contributor badge on GitHub

## Thank You!

Every contribution matters — from fixing typos to implementing major features. Thank you for helping build the most comprehensive iOS development MCP!

---

Questions? Open a [GitHub Discussion](https://github.com/bhavenmurji/ios-dev-mcp/discussions)
