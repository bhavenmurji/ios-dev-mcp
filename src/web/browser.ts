/**
 * Web Browser Integration
 * Fetch web content and convert to iOS development context
 */

import { executeCommand } from "../utils/process.js";
import * as https from "https";
import * as http from "http";
import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";

export interface WebFetchResult {
  success: boolean;
  content?: string;
  title?: string;
  error?: string;
  contentType?: string;
}

export interface ImageDownloadResult {
  success: boolean;
  localPath?: string;
  filename?: string;
  size?: number;
  error?: string;
}

export interface ColorPalette {
  colors: Array<{
    hex: string;
    rgb: { r: number; g: number; b: number };
    name?: string;
  }>;
}

export interface UIPattern {
  type: string;
  description: string;
  swiftUICode?: string;
  uiKitCode?: string;
}

/**
 * Fetch content from a URL
 */
export async function fetchWebContent(
  url: string,
  options: { timeout?: number; extractText?: boolean } = {}
): Promise<WebFetchResult> {
  const { timeout = 10000, extractText = true } = options;

  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === "https:" ? https : http;

      const req = protocol.get(
        url,
        {
          timeout,
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        },
        (res) => {
          // Handle redirects
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            fetchWebContent(res.headers.location, options).then(resolve);
            return;
          }

          if (res.statusCode !== 200) {
            resolve({ success: false, error: `HTTP ${res.statusCode}` });
            return;
          }

          const contentType = res.headers["content-type"] || "";
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            let content = data;
            let title: string | undefined;

            if (extractText && contentType.includes("text/html")) {
              // Extract title
              const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
              title = titleMatch ? titleMatch[1].trim() : undefined;

              // Extract main text content (simplified)
              content = extractTextFromHtml(data);
            }

            resolve({
              success: true,
              content,
              title,
              contentType,
            });
          });
        }
      );

      req.on("error", (err) => {
        resolve({ success: false, error: err.message });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({ success: false, error: "Request timeout" });
      });
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

/**
 * Extract readable text from HTML
 */
function extractTextFromHtml(html: string): string {
  // Remove script and style tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");

  // Extract specific content areas if available
  const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const articleMatch = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const contentMatch = text.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

  if (mainMatch) {
    text = mainMatch[1];
  } else if (articleMatch) {
    text = articleMatch[1];
  } else if (contentMatch) {
    text = contentMatch[1];
  }

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Clean up whitespace
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  // Limit length
  if (text.length > 10000) {
    text = text.substring(0, 10000) + "...";
  }

  return text;
}

/**
 * Download an image from URL
 */
export async function downloadImage(
  url: string,
  options: { outputDir?: string; filename?: string } = {}
): Promise<ImageDownloadResult> {
  const outputDir = options.outputDir || path.join(os.tmpdir(), "ios-dev-mcp-assets");

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Determine filename
  const urlPath = new URL(url).pathname;
  const defaultFilename = path.basename(urlPath) || `image-${Date.now()}.png`;
  const filename = options.filename || defaultFilename;
  const outputPath = path.join(outputDir, filename);

  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === "https:" ? https : http;

      const req = protocol.get(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          },
        },
        async (res) => {
          // Handle redirects
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            downloadImage(res.headers.location, options).then(resolve);
            return;
          }

          if (res.statusCode !== 200) {
            resolve({ success: false, error: `HTTP ${res.statusCode}` });
            return;
          }

          const chunks: Buffer[] = [];

          res.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
          });

          res.on("end", async () => {
            const buffer = Buffer.concat(chunks);

            try {
              await fs.writeFile(outputPath, buffer);
              resolve({
                success: true,
                localPath: outputPath,
                filename,
                size: buffer.length,
              });
            } catch (err) {
              resolve({
                success: false,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          });
        }
      );

      req.on("error", (err) => {
        resolve({ success: false, error: err.message });
      });
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

/**
 * Extract colors from CSS or webpage
 */
export function extractColors(content: string): ColorPalette {
  const colors: ColorPalette["colors"] = [];
  const seen = new Set<string>();

  // Match hex colors
  const hexPattern = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
  let match;

  while ((match = hexPattern.exec(content)) !== null) {
    let hex = match[1];
    // Expand 3-char hex to 6-char
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    hex = hex.toUpperCase();

    if (!seen.has(hex)) {
      seen.add(hex);
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      colors.push({
        hex: `#${hex}`,
        rgb: { r, g, b },
      });
    }
  }

  // Match rgb/rgba colors
  const rgbPattern = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;
  while ((match = rgbPattern.exec(content)) !== null) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();

    if (!seen.has(hex.substring(1))) {
      seen.add(hex.substring(1));
      colors.push({ hex, rgb: { r, g, b } });
    }
  }

  return { colors };
}

/**
 * Generate SwiftUI Color definitions from palette
 */
export function generateSwiftUIColors(palette: ColorPalette, prefix: string = "app"): string {
  const lines = [
    "import SwiftUI",
    "",
    "extension Color {",
  ];

  palette.colors.forEach((color, index) => {
    const name = color.name || `${prefix}Color${index + 1}`;
    const r = (color.rgb.r / 255).toFixed(3);
    const g = (color.rgb.g / 255).toFixed(3);
    const b = (color.rgb.b / 255).toFixed(3);

    lines.push(`    static let ${name} = Color(red: ${r}, green: ${g}, blue: ${b}) // ${color.hex}`);
  });

  lines.push("}");
  return lines.join("\n");
}

/**
 * Generate UIKit UIColor definitions from palette
 */
export function generateUIKitColors(palette: ColorPalette, prefix: string = "app"): string {
  const lines = [
    "import UIKit",
    "",
    "extension UIColor {",
  ];

  palette.colors.forEach((color, index) => {
    const name = color.name || `${prefix}Color${index + 1}`;
    const r = (color.rgb.r / 255).toFixed(3);
    const g = (color.rgb.g / 255).toFixed(3);
    const b = (color.rgb.b / 255).toFixed(3);

    lines.push(`    static let ${name} = UIColor(red: ${r}, green: ${g}, blue: ${b}, alpha: 1.0) // ${color.hex}`);
  });

  lines.push("}");
  return lines.join("\n");
}

/**
 * Extract UI patterns from HTML content
 */
export function extractUIPatterns(html: string): UIPattern[] {
  const patterns: UIPattern[] = [];

  // Detect navigation patterns
  if (/<nav/i.test(html)) {
    patterns.push({
      type: "navigation",
      description: "Navigation bar or menu detected",
      swiftUICode: `NavigationStack {
    // Your content
}
.navigationTitle("Title")
.toolbar {
    ToolbarItem(placement: .navigationBarTrailing) {
        Button("Action") { }
    }
}`,
    });
  }

  // Detect card patterns
  if (/<div[^>]*class="[^"]*card[^"]*"/i.test(html)) {
    patterns.push({
      type: "card",
      description: "Card UI pattern detected",
      swiftUICode: `struct CardView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image("placeholder")
                .resizable()
                .aspectRatio(contentMode: .fill)

            VStack(alignment: .leading, spacing: 4) {
                Text("Title")
                    .font(.headline)
                Text("Description")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal)
            .padding(.bottom)
        }
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(radius: 4)
    }
}`,
    });
  }

  // Detect list patterns
  if (/<ul|<ol|<li/i.test(html)) {
    patterns.push({
      type: "list",
      description: "List UI pattern detected",
      swiftUICode: `List {
    ForEach(items) { item in
        HStack {
            Image(systemName: "circle.fill")
            Text(item.title)
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundColor(.secondary)
        }
    }
}`,
    });
  }

  // Detect form patterns
  if (/<form|<input|<textarea/i.test(html)) {
    patterns.push({
      type: "form",
      description: "Form UI pattern detected",
      swiftUICode: `Form {
    Section("User Information") {
        TextField("Name", text: $name)
        TextField("Email", text: $email)
            .textContentType(.emailAddress)
            .keyboardType(.emailAddress)
    }

    Section {
        Button("Submit") {
            // Handle submission
        }
    }
}`,
    });
  }

  // Detect button patterns
  if (/<button/i.test(html)) {
    patterns.push({
      type: "button",
      description: "Button UI pattern detected",
      swiftUICode: `Button(action: {
    // Action
}) {
    Text("Button")
        .fontWeight(.semibold)
        .foregroundColor(.white)
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.blue)
        .cornerRadius(10)
}`,
    });
  }

  // Detect grid/gallery patterns
  if (/<div[^>]*class="[^"]*grid[^"]*"|display:\s*grid/i.test(html)) {
    patterns.push({
      type: "grid",
      description: "Grid/Gallery UI pattern detected",
      swiftUICode: `LazyVGrid(columns: [
    GridItem(.flexible()),
    GridItem(.flexible()),
    GridItem(.flexible())
], spacing: 16) {
    ForEach(items) { item in
        VStack {
            Image(item.image)
                .resizable()
                .aspectRatio(1, contentMode: .fill)
                .clipped()
            Text(item.title)
                .font(.caption)
        }
    }
}`,
    });
  }

  // Detect tab patterns
  if (/<div[^>]*class="[^"]*tab[^"]*"/i.test(html)) {
    patterns.push({
      type: "tabs",
      description: "Tab UI pattern detected",
      swiftUICode: `TabView {
    HomeView()
        .tabItem {
            Image(systemName: "house")
            Text("Home")
        }

    SearchView()
        .tabItem {
            Image(systemName: "magnifyingglass")
            Text("Search")
        }

    ProfileView()
        .tabItem {
            Image(systemName: "person")
            Text("Profile")
        }
}`,
    });
  }

  // Detect modal/dialog patterns
  if (/<div[^>]*class="[^"]*(modal|dialog)[^"]*"/i.test(html)) {
    patterns.push({
      type: "modal",
      description: "Modal/Dialog UI pattern detected",
      swiftUICode: `@State private var showModal = false

Button("Show Modal") {
    showModal = true
}
.sheet(isPresented: $showModal) {
    VStack(spacing: 20) {
        Text("Modal Title")
            .font(.title)
        Text("Modal content goes here")
        Button("Dismiss") {
            showModal = false
        }
    }
    .padding()
}`,
    });
  }

  return patterns;
}

/**
 * Analyze a webpage for iOS UI conversion
 */
export async function analyzeWebpageForUI(url: string): Promise<{
  success: boolean;
  title?: string;
  colors: ColorPalette;
  patterns: UIPattern[];
  summary: string;
  error?: string;
}> {
  const result = await fetchWebContent(url, { extractText: false });

  if (!result.success) {
    return {
      success: false,
      colors: { colors: [] },
      patterns: [],
      summary: "",
      error: result.error,
    };
  }

  const colors = extractColors(result.content || "");
  const patterns = extractUIPatterns(result.content || "");

  const summary = [
    `Page: ${result.title || url}`,
    "",
    `Colors found: ${colors.colors.length}`,
    colors.colors.slice(0, 5).map((c) => `  ${c.hex}`).join("\n"),
    "",
    `UI Patterns detected: ${patterns.length}`,
    patterns.map((p) => `  - ${p.type}: ${p.description}`).join("\n"),
    "",
    "Use these patterns as inspiration for your iOS app!",
  ].join("\n");

  return {
    success: true,
    title: result.title,
    colors,
    patterns,
    summary,
  };
}

/**
 * Fetch API documentation and summarize
 */
export async function fetchAPIDocs(url: string): Promise<{
  success: boolean;
  content?: string;
  endpoints?: Array<{ method: string; path: string; description: string }>;
  error?: string;
}> {
  const result = await fetchWebContent(url);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Try to extract API endpoints from common patterns
  const endpoints: Array<{ method: string; path: string; description: string }> = [];
  const content = result.content || "";

  // Match common API documentation patterns
  const methodPatterns = [
    /\b(GET|POST|PUT|DELETE|PATCH)\s+([\/\w\-\{\}]+)/gi,
    /endpoint[:\s]+["']?(GET|POST|PUT|DELETE|PATCH)?\s*([\/\w\-\{\}]+)/gi,
  ];

  for (const pattern of methodPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      endpoints.push({
        method: (match[1] || "GET").toUpperCase(),
        path: match[2],
        description: "",
      });
    }
  }

  return {
    success: true,
    content: result.content,
    endpoints: endpoints.slice(0, 20), // Limit to 20 endpoints
  };
}

/**
 * Generate Swift networking code from API endpoint
 */
export function generateNetworkingCode(
  baseURL: string,
  endpoint: { method: string; path: string }
): string {
  const method = endpoint.method.toUpperCase();
  const functionName = endpoint.path
    .replace(/[\/\-\{\}]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();

  return `
// MARK: - ${method} ${endpoint.path}

func ${functionName}() async throws -> Data {
    let url = URL(string: "${baseURL}${endpoint.path}")!
    var request = URLRequest(url: url)
    request.httpMethod = "${method}"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let (data, response) = try await URLSession.shared.data(for: request)

    guard let httpResponse = response as? HTTPURLResponse,
          (200...299).contains(httpResponse.statusCode) else {
        throw URLError(.badServerResponse)
    }

    return data
}
`.trim();
}

/**
 * Convert text content to SwiftUI views
 */
export function textToSwiftUI(
  text: string,
  options: {
    style?: "article" | "list" | "card" | "minimal";
    includeImages?: boolean;
  } = {}
): string {
  const { style = "article" } = options;
  const lines = text.split("\n").filter((l) => l.trim());

  switch (style) {
    case "list":
      return generateListView(lines);
    case "card":
      return generateCardView(lines);
    case "minimal":
      return generateMinimalView(lines);
    case "article":
    default:
      return generateArticleView(lines);
  }
}

function generateArticleView(lines: string[]): string {
  const title = lines[0] || "Title";
  const body = lines.slice(1).join("\n\n");

  return `struct ArticleView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("${escapeSwiftString(title)}")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text("${escapeSwiftString(body)}")
                    .font(.body)
                    .lineSpacing(4)
            }
            .padding()
        }
    }
}`;
}

function generateListView(lines: string[]): string {
  const items = lines.map((l) => `"${escapeSwiftString(l)}"`).join(",\n        ");

  return `struct ContentListView: View {
    let items = [
        ${items}
    ]

    var body: some View {
        List(items, id: \\.self) { item in
            Text(item)
                .padding(.vertical, 4)
        }
    }
}`;
}

function generateCardView(lines: string[]): string {
  const title = lines[0] || "Title";
  const subtitle = lines[1] || "";
  const body = lines.slice(2).join(" ");

  return `struct ContentCardView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("${escapeSwiftString(title)}")
                .font(.headline)
                .fontWeight(.bold)

            ${subtitle ? `Text("${escapeSwiftString(subtitle)}")
                .font(.subheadline)
                .foregroundColor(.secondary)` : ""}

            Text("${escapeSwiftString(body)}")
                .font(.body)
                .lineLimit(nil)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 5, x: 0, y: 2)
    }
}`;
}

function generateMinimalView(lines: string[]): string {
  return `struct ContentView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ${lines.map((l) => `Text("${escapeSwiftString(l)}")`).join("\n            ")}
        }
        .padding()
    }
}`;
}

function escapeSwiftString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .substring(0, 500); // Limit length
}

/**
 * Parse structured data from web content
 */
export interface ParsedWebContent {
  title?: string;
  headings: string[];
  paragraphs: string[];
  lists: string[][];
  images: string[];
  links: Array<{ text: string; url: string }>;
}

export function parseWebContent(html: string): ParsedWebContent {
  const result: ParsedWebContent = {
    headings: [],
    paragraphs: [],
    lists: [],
    images: [],
    links: [],
  };

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  result.title = titleMatch ? titleMatch[1].trim() : undefined;

  // Extract headings
  const headingMatches = html.matchAll(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi);
  for (const match of headingMatches) {
    result.headings.push(match[1].trim());
  }

  // Extract paragraphs
  const pMatches = html.matchAll(/<p[^>]*>([^<]+)<\/p>/gi);
  for (const match of pMatches) {
    const text = match[1].trim();
    if (text.length > 20) {
      result.paragraphs.push(text);
    }
  }

  // Extract lists
  const listMatches = html.matchAll(/<ul[^>]*>([\s\S]*?)<\/ul>/gi);
  for (const match of listMatches) {
    const items: string[] = [];
    const liMatches = match[1].matchAll(/<li[^>]*>([^<]+)<\/li>/gi);
    for (const li of liMatches) {
      items.push(li[1].trim());
    }
    if (items.length > 0) {
      result.lists.push(items);
    }
  }

  // Extract images
  const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
  for (const match of imgMatches) {
    result.images.push(match[1]);
  }

  // Extract links
  const linkMatches = html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi);
  for (const match of linkMatches) {
    result.links.push({ url: match[1], text: match[2].trim() });
  }

  return result;
}

/**
 * Generate complete SwiftUI view from parsed web content
 */
export function generateSwiftUIFromWebContent(content: ParsedWebContent): string {
  const views: string[] = [];

  if (content.title) {
    views.push(`Text("${escapeSwiftString(content.title)}")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .padding(.bottom)`);
  }

  for (const heading of content.headings.slice(0, 5)) {
    views.push(`Text("${escapeSwiftString(heading)}")
                    .font(.title2)
                    .fontWeight(.semibold)
                    .padding(.top)`);
  }

  for (const para of content.paragraphs.slice(0, 5)) {
    views.push(`Text("${escapeSwiftString(para)}")
                    .font(.body)
                    .lineSpacing(4)`);
  }

  if (content.lists.length > 0) {
    const items = content.lists[0].slice(0, 10);
    views.push(`
                // List items
                ForEach(${JSON.stringify(items)}, id: \\.self) { item in
                    HStack {
                        Image(systemName: "circle.fill")
                            .font(.system(size: 6))
                            .foregroundColor(.secondary)
                        Text(item)
                    }
                }`);
  }

  if (content.links.length > 0) {
    views.push(`
                // Links
                VStack(alignment: .leading, spacing: 8) {
                    Text("Related Links")
                        .font(.headline)
                    ${content.links
                      .slice(0, 5)
                      .map(
                        (l) =>
                          `Link("${escapeSwiftString(l.text)}", destination: URL(string: "${l.url}")!)`
                      )
                      .join("\n                    ")}
                }`);
  }

  return `import SwiftUI

struct WebContentView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                ${views.join("\n\n                ")}
            }
            .padding()
        }
    }
}

#Preview {
    WebContentView()
}`;
}

/**
 * Convert web content to iOS-ready data model
 */
export function generateDataModel(content: ParsedWebContent): string {
  return `import Foundation

struct WebContent: Codable, Identifiable {
    let id = UUID()
    let title: String
    let headings: [String]
    let paragraphs: [String]
    let imageURLs: [String]
    let links: [ContentLink]

    struct ContentLink: Codable, Identifiable {
        let id = UUID()
        let text: String
        let url: String
    }
}

// Sample data from web scrape
extension WebContent {
    static let sample = WebContent(
        title: "${escapeSwiftString(content.title || "Untitled")}",
        headings: ${JSON.stringify(content.headings.slice(0, 10))},
        paragraphs: ${JSON.stringify(content.paragraphs.slice(0, 5).map((p) => p.substring(0, 200)))},
        imageURLs: ${JSON.stringify(content.images.slice(0, 5))},
        links: [
            ${content.links
              .slice(0, 5)
              .map((l) => `ContentLink(text: "${escapeSwiftString(l.text)}", url: "${l.url}")`)
              .join(",\n            ")}
        ]
    )
}`;
}

/**
 * Comprehensive web-to-iOS conversion
 */
export async function convertWebToiOS(
  url: string,
  options: {
    generateView?: boolean;
    generateModel?: boolean;
    generateColors?: boolean;
    style?: "article" | "list" | "card" | "minimal";
  } = {}
): Promise<{
  success: boolean;
  swiftUIView?: string;
  dataModel?: string;
  colors?: string;
  summary: string;
  error?: string;
}> {
  const { generateView = true, generateModel = true, generateColors = true, style = "article" } = options;

  const result = await fetchWebContent(url, { extractText: false });

  if (!result.success) {
    return {
      success: false,
      summary: "",
      error: result.error,
    };
  }

  const html = result.content || "";
  const parsed = parseWebContent(html);
  const outputs: string[] = [];

  let swiftUIView: string | undefined;
  let dataModel: string | undefined;
  let colors: string | undefined;

  if (generateView) {
    swiftUIView = generateSwiftUIFromWebContent(parsed);
    outputs.push("SwiftUI View generated");
  }

  if (generateModel) {
    dataModel = generateDataModel(parsed);
    outputs.push("Data Model generated");
  }

  if (generateColors) {
    const palette = extractColors(html);
    if (palette.colors.length > 0) {
      colors = generateSwiftUIColors(palette, "web");
      outputs.push(`${palette.colors.length} colors extracted`);
    }
  }

  const summary = [
    `Converted: ${result.title || url}`,
    "",
    `Found:`,
    `  - ${parsed.headings.length} headings`,
    `  - ${parsed.paragraphs.length} paragraphs`,
    `  - ${parsed.lists.length} lists`,
    `  - ${parsed.images.length} images`,
    `  - ${parsed.links.length} links`,
    "",
    `Generated: ${outputs.join(", ")}`,
  ].join("\n");

  return {
    success: true,
    swiftUIView,
    dataModel,
    colors,
    summary,
  };
}
