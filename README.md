# iOS Development MCP Server

A unified Model Context Protocol (MCP) server that brings together Swift code execution, Xcode project building, iOS Simulator control, and device testing into one seamless development workflow with Claude.

## 🎯 Vision

Enable Claude to be a true iOS development partner - from ideation through code, build, test, and debug - all in a single conversational flow. No more context-switching between fragmented tools.

## ✨ Features

### Phase 1 (MVP) - In Development
- [ ] **Swift Code Execution** - Run Swift code snippets and experiments
- [ ] **Xcode Project Building** - Build iOS/macOS projects  
- [ ] **Simulator Control** - Launch, control, and screenshot iOS Simulator
- [ ] **Basic Testing** - Run XCTest suites

### Phase 2 (Planned)
- [ ] **UI Automation** - Tap, swipe, type, and interact with UI elements
- [ ] **Visual Testing** - Screenshot comparison and UI regression detection
- [ ] **Real Device Support** - Deploy and test on physical iOS devices
- [ ] **SwiftUI Previews** - Generate and control SwiftUI previews

### Phase 3 (Future)
- [ ] **Intelligent Testing** - AI-suggested test scenarios based on code analysis
- [ ] **Performance Profiling** - Memory, CPU, and battery usage analysis
- [ ] **Crash Analysis** - Automatic crash log parsing and debugging assistance
- [ ] **CI/CD Integration** - Connect with GitHub Actions, Fastlane, etc.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/ios-dev-mcp.git
cd ios-dev-mcp

# Install dependencies
npm install

# Build the server
npm run build

# Run the server
npm start
```

### Configure with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ios-dev": {
      "command": "node",
      "args": ["/path/to/ios-dev-mcp/build/index.js"]
    }
  }
}
```

## 📚 Usage Examples

### Swift Code Execution
```
Claude: Let me run that Swift code for you...
> let greeting = "Hello, World!"
> print(greeting)
Output: Hello, World!
```

### Build & Run Project
```
Claude: Building your iOS project...
✓ Build succeeded
✓ Launched on iPhone 15 Pro Simulator
📸 Here's what your app looks like
```

### UI Testing
```
Claude: I'll test that login flow...
✓ Tapped email field
✓ Entered "test@example.com"
✓ Tapped password field
✓ Entered password
✓ Tapped login button
✓ Verified dashboard appeared
```

## 🏗️ Architecture

```
ios-dev-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── swift/                # Swift execution engine
│   ├── xcode/                # Xcode build tools
│   ├── simulator/            # iOS Simulator control
│   ├── device/               # Real device support
│   └── utils/                # Shared utilities
├── examples/                 # Example projects & workflows
├── docs/                     # Documentation
└── tests/                    # Test suites
```

## 🤝 Contributing

We welcome contributions! This project consolidates and extends the excellent work from:
- [SwiftClaude](https://github.com/GeorgeLyon/SwiftClaude) - Swift code execution
- [ios-simulator-mcp](https://github.com/joshuayoes/ios-simulator-mcp) - Simulator control
- [XcodeBuildMCP](https://github.com/cameroncooke/XcodeBuildMCP) - Xcode building
- [xcode-mcp-server](https://github.com/r-huijts/xcode-mcp-server) - Comprehensive Xcode tools

### How to Contribute
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📋 Requirements

- macOS 13.0+ (for Xcode and Simulator support)
- Xcode 15.0+
- Node.js 18+
- Swift 5.9+

## 🗺️ Roadmap

**Q1 2025**
- ✅ Project initialization
- [ ] MVP release (Swift execution + basic building)
- [ ] Community feedback and iteration

**Q2 2025**
- [ ] Full UI automation support
- [ ] Real device testing
- [ ] Visual regression testing

**Q3 2025**
- [ ] AI-powered testing suggestions
- [ ] Performance profiling
- [ ] CI/CD integrations

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Acknowledgments

Built on the shoulders of giants. Special thanks to:
- George Lyon (SwiftClaude)
- Joshua Yoes (ios-simulator-mcp)
- Cameron Cooke (XcodeBuildMCP)
- R. Huijts (xcode-mcp-server)
- The Anthropic team for MCP
- The iOS development community

## 📬 Contact

- **Issues:** [GitHub Issues](https://github.com/yourusername/ios-dev-mcp/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/ios-dev-mcp/discussions)
- **Twitter:** [@yourusername](https://twitter.com/yourusername)

---

**Made with ❤️ for the iOS development community**
