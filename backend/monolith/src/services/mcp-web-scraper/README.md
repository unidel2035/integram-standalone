# MCP Web Scraper Server

**Model Context Protocol (MCP) server for AI-powered web scraping and automation**

A powerful, production-ready web scraping server that provides Claude, GPT, and other AI agents with comprehensive web scraping, search, and browser automation capabilities.

## 🎯 Features

### Core Scraping
- **HTML to Markdown** - Clean, readable content extraction
- **Structured Data Extraction** - Extract data using JSON schemas
- **Batch Scraping** - Process multiple URLs in parallel
- **Search Engine Results** - Google, Yandex, Bing, DuckDuckGo

### Infrastructure
- **Proxy Rotation** - Support for datacenter, residential, mobile, and ISP proxies
- **Rate Limiting** - Configurable request throttling
- **Error Handling** - Automatic retries and proxy failover
- **Session Management** - Sticky sessions for consistent scraping

### Anti-Detection (Planned)
- Browser fingerprint spoofing
- Cloudflare bypass
- CAPTCHA integration

## 📦 Installation

### Prerequisites
- Node.js 18+
- Playwright (installed automatically)

### Setup

1. **Install dependencies** (from monolith root):
```bash
cd backend/monolith
npm install
```

2. **Install Playwright browsers**:
```bash
npx playwright install chromium
```

3. **Configure environment** (see Configuration section below)

## 🔧 Configuration

### Environment Variables

Create `.env` file or set environment variables:

```env
# API Authentication (optional)
API_TOKEN=your_secret_token

# Proxy Configuration
PROXY_LIST=ip1:port:user:pass,ip2:port:user:pass
PROXY_TYPE=datacenter  # datacenter, residential, mobile, isp
PROXY_ROTATION=round-robin  # round-robin, random, sticky-session, geo-targeted
PROXY_TIMEOUT=30000
PROXY_RETRY_COUNT=3

# Rate Limiting
RATE_LIMIT=1000/1d  # 1000 requests per day (format: <number>/<duration><unit>)
# Examples: 100/1h (100/hour), 10/1m (10/minute), 1000/1d (1000/day)

# Browser Configuration
MAX_CONCURRENT_BROWSERS=5
BROWSER_HEADLESS=true
BROWSER_TIMEOUT=60000

# Request Configuration
REQUEST_TIMEOUT=60000
USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36

# Features
PRO_MODE=true
DEBUG=false
LOG_LEVEL=info

# CAPTCHA Solvers (optional)
ANTICAPTCHA_KEY=your_anticaptcha_key
TWOCAPTCHA_KEY=your_2captcha_key
```

### Proxy Configuration

#### Format
Each proxy must be in the format: `ip:port:username:password`

Example:
```env
PROXY_LIST=123.45.67.89:8080:myuser:mypass,98.76.54.32:8080:user2:pass2
```

#### Rotation Strategies

- **round-robin** - Use proxies sequentially
- **random** - Pick random proxy for each request
- **sticky-session** - Same proxy for same session ID
- **geo-targeted** - Select proxy based on geography (planned)

#### Supported Proxy Services

- Custom proxy lists
- [Proxy6](https://proxy6.net/)
- [Webshare](https://www.webshare.io/)
- [IPRoyal](https://iproyal.com/)
- Any HTTP/HTTPS/SOCKS5 proxy

## 🚀 Usage

### Starting the Server

#### Standalone (stdio):
```bash
API_TOKEN=xxx node backend/monolith/src/services/mcp-web-scraper/server.js
```

#### With Claude Code:
```bash
claude mcp add web-scraper \
  --command "node" \
  --args "/absolute/path/to/backend/monolith/src/services/mcp-web-scraper/server.js" \
  --env API_TOKEN=your_token \
  --env PROXY_LIST=ip:port:user:pass
```

### Integrating with Claude Desktop

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "web-scraper": {
      "command": "node",
      "args": ["/absolute/path/to/backend/monolith/src/services/mcp-web-scraper/server.js"],
      "env": {
        "API_TOKEN": "your_token",
        "PROXY_LIST": "ip:port:user:pass",
        "RATE_LIMIT": "1000/1d"
      }
    }
  }
}
```

## 📚 Available Tools

### Scraping Tools

#### `scrape_as_markdown`
Extract web page content as clean Markdown.

**Parameters:**
- `url` (string, required) - URL to scrape
- `waitFor` (string, optional) - CSS selector to wait for
- `timeout` (number, optional) - Request timeout in ms

**Example:**
```javascript
{
  "url": "https://example.com/article",
  "waitFor": ".article-content"
}
```

#### `scrape_as_html`
Get raw HTML content from web page.

**Parameters:**
- `url` (string, required) - URL to scrape
- `fullPage` (boolean, optional) - Include head/scripts/styles

#### `extract`
Extract structured data using JSON schema.

**Parameters:**
- `url` (string, required) - URL to scrape
- `schema` (object, required) - JSON Schema defining data structure
- `instructions` (string, optional) - Additional extraction instructions

**Example:**
```javascript
{
  "url": "https://example.com/product/123",
  "schema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "price": { "type": "number" },
      "description": { "type": "string" }
    }
  }
}
```

#### `scrape_batch`
Scrape multiple URLs in parallel (max 10).

**Parameters:**
- `urls` (array, required) - Array of URLs (max 10)
- `format` (string, optional) - "markdown" or "html" (default: markdown)

#### `check_url`
Check if URL is accessible.

**Parameters:**
- `url` (string, required) - URL to check

### Search Tools

#### `search_engine`
Search using search engines.

**Parameters:**
- `query` (string, required) - Search query
- `engine` (string, optional) - google/yandex/bing/duckduckgo (default: google)
- `numResults` (number, optional) - Number of results (default: 10)
- `country` (string, optional) - Country code (e.g., RU, US)
- `language` (string, optional) - Language code (e.g., en, ru)

**Example:**
```javascript
{
  "query": "best restaurants in Moscow",
  "engine": "yandex",
  "numResults": 20,
  "country": "RU",
  "language": "ru"
}
```

#### `search_engine_batch`
Search multiple queries (max 5).

**Parameters:**
- `queries` (array, required) - Array of search queries (max 5)
- `engine` (string, optional) - Search engine
- `numResults` (number, optional) - Results per query

### Status Tools

#### `get_stats`
Get scraper statistics.

Returns:
- Proxy status and statistics
- Rate limit status
- Configuration info

## 🏗️ Architecture

```
mcp-web-scraper/
├── server.js              # Main MCP server
├── config.js              # Configuration management
├── proxy_manager.js       # Proxy rotation logic
├── rate_limiter.js        # Request throttling
├── scraping_tools.js      # Core scraping functions
├── search_tools.js        # Search engine integration
└── utils/
    ├── html_to_markdown.js    # HTML → Markdown converter
    └── content_extractor.js   # Structured data extraction
```

### Technology Stack
- **MCP SDK** - @modelcontextprotocol/sdk
- **Browser Automation** - Playwright (Chromium)
- **HTTP Client** - Axios
- **HTML Parsing** - JSDOM
- **Markdown Conversion** - Turndown + GFM plugin
- **Proxy Support** - https-proxy-agent, socks-proxy-agent

## 📊 Examples

### Example 1: Scrape Article

```javascript
// Request
{
  "tool": "scrape_as_markdown",
  "arguments": {
    "url": "https://example.com/article/ai-future"
  }
}

// Response
{
  "success": true,
  "url": "https://example.com/article/ai-future",
  "markdown": "# The Future of AI\n\nArtificial intelligence is...",
  "length": 5432,
  "timestamp": "2025-12-10T14:30:00Z"
}
```

### Example 2: Extract Product Data

```javascript
// Request
{
  "tool": "extract",
  "arguments": {
    "url": "https://shop.example.com/product/123",
    "schema": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "price": { "type": "number" },
        "availability": { "type": "string" },
        "rating": { "type": "number" }
      }
    }
  }
}

// Response
{
  "success": true,
  "url": "https://shop.example.com/product/123",
  "data": {
    "title": "MacBook Pro 16\"",
    "price": 2499.99,
    "availability": "In Stock",
    "rating": 4.8
  }
}
```

### Example 3: Search Multiple Engines

```javascript
// Request
{
  "tool": "search_engine",
  "arguments": {
    "query": "best laptop 2025",
    "engine": "google",
    "numResults": 10
  }
}

// Response
{
  "success": true,
  "engine": "google",
  "query": "best laptop 2025",
  "results": [
    {
      "position": 1,
      "title": "Top 10 Laptops of 2025",
      "url": "https://example.com/top-laptops",
      "snippet": "Discover the best laptops..."
    }
  ]
}
```

## 🔍 Troubleshooting

### Issue: Browser fails to launch
**Solution**: Install Playwright browsers:
```bash
npx playwright install chromium
```

### Issue: Proxy connections failing
**Solution**:
- Check proxy format (ip:port:user:pass)
- Verify proxy credentials
- Test proxy manually: `curl -x http://user:pass@ip:port https://example.com`

### Issue: Rate limit errors
**Solution**:
- Increase rate limit: `RATE_LIMIT=2000/1d`
- Use multiple proxies to distribute load
- Add delays between requests

### Issue: Cloudflare blocking
**Solution** (Phase 3 feature):
- Enable residential proxies
- Use browser fingerprint spoofing
- Implement CAPTCHA solver integration

## 📈 Performance

- **Simple scraping**: 2-5 seconds per page
- **Batch scraping**: 3-10 URLs processed in parallel
- **Search queries**: 3-7 seconds per query
- **Memory**: ~200MB base + 100MB per browser instance
- **CPU**: Light (mostly I/O bound)

## 🛡️ Best Practices

1. **Use proxies** for production scraping
2. **Set rate limits** to avoid IP bans
3. **Handle errors gracefully** - implement retry logic
4. **Monitor proxy health** using `get_stats` tool
5. **Respect robots.txt** and website ToS
6. **Cache results** when possible
7. **Use headless browser** for performance

## 🗺️ Roadmap

### Phase 1: MVP ✅
- [x] Basic scraping (HTML, Markdown)
- [x] Search engine integration
- [x] Proxy rotation
- [x] Rate limiting
- [x] Batch operations

### Phase 2: Browser Automation (Next)
- [ ] Browser session management
- [ ] Interactive browser tools (click, type, scroll)
- [ ] ARIA snapshot
- [ ] Screenshot/PDF generation
- [ ] Network request monitoring

### Phase 3: Anti-Detection
- [ ] Browser fingerprint spoofing
- [ ] Cloudflare bypass
- [ ] CAPTCHA integration (AntiCaptcha, 2Captcha)
- [ ] Stealth mode

### Phase 4: Specialized Parsers
- [ ] E-commerce (Amazon, Ozon, Wildberries)
- [ ] Social media (VK, Telegram, YouTube)
- [ ] Business data (2GIS, Yandex Maps, Rusprofile)

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

## 📞 Support

- **GitHub Issues**: [dronedoc2025/issues](https://github.com/unidel2035/dronedoc2025/issues)
- **Documentation**: See inline code comments
- **Examples**: Check `examples/` directory

## 🔗 References

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Bright Data MCP](https://github.com/brightdata/brightdata-mcp) (reference implementation)
- [Claude Code](https://claude.com/claude-code)

---

**Built with ❤️ for the DronDoc ecosystem**
