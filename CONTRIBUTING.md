# Contributing to iOS Development MCP

Thank you for your interest in contributing! This project aims to create the best-in-class MCP server for iOS development.

## 🎯 Project Goals

1. **Unified Experience** - Single tool for entire iOS development workflow
2. **Performance** - Fast, efficient, minimal overhead
3. **Reliability** - Production-ready, well-tested
4. **Extensibility** - Easy to add new features and capabilities

## 🚀 Getting Started

### Prerequisites
- macOS 13.0+
- Xcode 15.0+
- Node.js 18+
- Swift 5.9+

### Setup
```bash
git clone https://github.com/yourusername/ios-dev-mcp.git
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

## 📝 Contribution Guidelines

### Code Style
- Use TypeScript for MCP server code
- Use Swift for execution engine where appropriate
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Keep functions focused and testable

### Commit Messages
Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions/changes
- `refactor:` Code refactoring
- `perf:` Performance improvements

Example: `feat: add UI element detection for simulator`

### Pull Request Process

1. **Fork & Branch**
   - Fork the repo
   - Create feature branch from `main`
   - Use descriptive branch names: `feature/ui-automation` or `fix/simulator-crash`

2. **Develop & Test**
   - Write tests for new features
   - Ensure all tests pass
   - Update documentation

3. **Submit PR**
   - Fill out PR template completely
   - Link related issues
   - Request review from maintainers

4. **Code Review**
   - Address feedback promptly
   - Keep discussions professional and constructive
   - Be open to suggestions

## 🏗️ Architecture

### Module Organization
```
src/
├── swift/          # Swift code execution
├── xcode/          # Xcode build tools
├── simulator/      # iOS Simulator control
├── device/         # Real device support
└── utils/          # Shared utilities
```

### Adding New Tools

1. Define tool schema in `src/index.ts`
2. Implement handler function
3. Create module in appropriate directory
4. Add tests
5. Update README with examples

Example:
```typescript
// In src/index.ts
{
  name: "my_new_tool",
  description: "Does something awesome",
  inputSchema: {
    type: "object",
    properties: {
      param: { type: "string" }
    },
    required: ["param"]
  }
}
```

## 🧪 Testing

### Test Requirements
- Unit tests for all new functions
- Integration tests for tool interactions
- Manual testing on real projects

### Test Structure
```typescript
describe('MyFeature', () => {
  it('should handle normal case', () => {
    // test implementation
  });

  it('should handle edge cases', () => {
    // test implementation
  });

  it('should handle errors gracefully', () => {
    // test implementation
  });
});
```

## 📚 Documentation

### Required Documentation
- JSDoc for all public APIs
- README updates for new features
- Example usage in `/examples`
- Update CHANGELOG.md

### Documentation Style
- Be clear and concise
- Include code examples
- Explain the "why" not just the "how"
- Keep it up to date

## 🤝 Community

### Communication Channels
- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and general discussion
- **Pull Requests** - Code contributions

### Code of Conduct
- Be respectful and inclusive
- Assume good intentions
- Welcome newcomers
- Focus on constructive feedback
- Keep discussions professional

### Getting Help
- Check existing issues and discussions
- Review documentation
- Ask in GitHub Discussions
- Tag maintainers if stuck

## 🎁 Recognition

Contributors will be:
- Listed in README acknowledgments
- Credited in release notes
- Given contributor badge on GitHub

## 📋 Issue Labels

- `good first issue` - Great for newcomers
- `help wanted` - Looking for contributors
- `bug` - Something isn't working
- `enhancement` - New feature request
- `documentation` - Documentation improvements
- `performance` - Performance improvements needed

## ⚡ Quick Contribution Ideas

**Easy (Good First Issues)**
- Add examples to `/examples`
- Improve error messages
- Add tests for existing code
- Fix documentation typos

**Medium**
- Implement missing simulator controls
- Add new Xcode build options
- Improve test coverage
- Performance optimizations

**Advanced**
- Real device support
- Visual regression testing
- CI/CD integrations
- Performance profiling tools

## 🙏 Thank You!

Every contribution matters - from fixing typos to implementing major features. Thank you for helping build the future of iOS development with Claude!

---

Questions? Open a [GitHub Discussion](https://github.com/yourusername/ios-dev-mcp/discussions)
