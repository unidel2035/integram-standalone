/**
 * SecurityScanner - Detects security vulnerabilities in code
 * Issue #1594 - Code review system
 */

export class SecurityScanner {
  constructor() {
    this.patterns = this.initializePatterns()
  }

  /**
   * Initialize security vulnerability patterns
   */
  initializePatterns() {
    return {
      // Hardcoded secrets
      secrets: [
        { pattern: /(api[_-]?key|apikey)\s*[=:]\s*['"][^'"]+['"]/gi, name: 'API Key', severity: 'critical' },
        { pattern: /(password|passwd|pwd)\s*[=:]\s*['"][^'"]+['"]/gi, name: 'Hardcoded Password', severity: 'critical' },
        { pattern: /(secret|token)\s*[=:]\s*['"][^'"]{20,}['"]/gi, name: 'Secret Token', severity: 'critical' },
        { pattern: /sk-[a-zA-Z0-9]{20,}/g, name: 'OpenAI API Key', severity: 'critical' },
        { pattern: /ghp_[a-zA-Z0-9]{36}/g, name: 'GitHub Personal Access Token', severity: 'critical' },
        { pattern: /AKIA[0-9A-Z]{16}/g, name: 'AWS Access Key', severity: 'critical' }
      ],

      // SQL Injection
      sql: [
        { pattern: /['"]?\s*\+\s*['"]?\s*SELECT\s+/gi, name: 'SQL Injection (SELECT)', severity: 'high' },
        { pattern: /\$\{.*?\}.*?(SELECT|INSERT|UPDATE|DELETE)/gi, name: 'SQL Template Injection', severity: 'high' },
        { pattern: /query\s*\([^)]*\+[^)]*\)/gi, name: 'Dynamic SQL Query', severity: 'medium' },
        { pattern: /execute\s*\([^)]*\+[^)]*\)/gi, name: 'Dynamic SQL Execute', severity: 'high' }
      ],

      // XSS Vulnerabilities
      xss: [
        { pattern: /innerHTML\s*=\s*[^;]*/gi, name: 'XSS via innerHTML', severity: 'high' },
        { pattern: /outerHTML\s*=\s*[^;]*/gi, name: 'XSS via outerHTML', severity: 'high' },
        { pattern: /document\.write\s*\([^)]*\+/gi, name: 'XSS via document.write', severity: 'medium' },
        { pattern: /eval\s*\([^)]*\)/gi, name: 'Potential XSS via eval', severity: 'high' }
      ],

      // Command Injection
      command: [
        { pattern: /exec\s*\([^)]*\+/gi, name: 'Command Injection', severity: 'critical' },
        { pattern: /spawn\s*\([^)]*\+/gi, name: 'Command Injection via spawn', severity: 'critical' },
        { pattern: /system\s*\([^)]*\+/gi, name: 'System Command Injection', severity: 'critical' }
      ],

      // Insecure Crypto
      crypto: [
        { pattern: /md5\s*\(/gi, name: 'Weak Hash (MD5)', severity: 'medium' },
        { pattern: /sha1\s*\(/gi, name: 'Weak Hash (SHA1)', severity: 'medium' },
        { pattern: /DES|3DES/gi, name: 'Weak Encryption', severity: 'high' }
      ],

      // Path Traversal
      path: [
        { pattern: /\.\.\//g, name: 'Path Traversal', severity: 'high' },
        { pattern: /readFile\s*\([^)]*\+/gi, name: 'Dynamic File Read', severity: 'medium' },
        { pattern: /writeFile\s*\([^)]*\+/gi, name: 'Dynamic File Write', severity: 'medium' }
      ]
    }
  }

  /**
   * Scan a file for security issues
   * @param {string} filePath - File path
   * @param {string} content - File content
   * @param {Object} diff - Parsed diff object
   * @returns {Promise<Array>} Array of security issues
   */
  async scanFile(filePath, content, diff) {
    const issues = []

    // Only scan added lines from diff
    const addedLines = diff.additions || []

    for (const addedLine of addedLines) {
      const lineContent = addedLine.content || ''
      const lineNumber = addedLine.line

      // Check all pattern categories
      for (const [category, patterns] of Object.entries(this.patterns)) {
        for (const { pattern, name, severity } of patterns) {
          if (pattern.test(lineContent)) {
            issues.push({
              type: 'security',
              severity,
              title: `Security: ${name}`,
              description: this.getDescription(category, name),
              filePath,
              lineNumber,
              codeSnippet: lineContent.trim(),
              suggestedFix: this.getSuggestedFix(category, name),
              tags: ['security', category, severity],
              aiConfidence: 0.85,
              references: this.getReferences(category, name)
            })
          }
        }
      }
    }

    return issues
  }

  /**
   * Get description for a security issue
   */
  getDescription(category, name) {
    const descriptions = {
      'API Key': 'API keys should not be hardcoded in source code. Use environment variables instead.',
      'Hardcoded Password': 'Passwords should never be hardcoded. Use secure configuration management.',
      'Secret Token': 'Secret tokens should be stored in environment variables or secure vaults.',
      'SQL Injection (SELECT)': 'Potential SQL injection vulnerability. Use parameterized queries.',
      'SQL Template Injection': 'Template strings in SQL queries can lead to injection. Use parameterized queries.',
      'Dynamic SQL Query': 'Building SQL queries with string concatenation is unsafe. Use prepared statements.',
      'XSS via innerHTML': 'Setting innerHTML with user input can lead to XSS. Use textContent or sanitize input.',
      'XSS via outerHTML': 'Setting outerHTML with user input can lead to XSS. Use safer alternatives.',
      'XSS via document.write': 'document.write with user input is unsafe. Use safer DOM manipulation.',
      'Potential XSS via eval': 'eval() is dangerous and can execute arbitrary code. Avoid using eval().',
      'Command Injection': 'Executing system commands with user input can lead to command injection.',
      'Command Injection via spawn': 'Spawning processes with unsanitized input is dangerous.',
      'Weak Hash (MD5)': 'MD5 is cryptographically broken. Use SHA-256 or stronger.',
      'Weak Hash (SHA1)': 'SHA1 is considered weak. Use SHA-256 or stronger.',
      'Weak Encryption': 'DES/3DES are outdated. Use AES-256 or modern encryption.',
      'Path Traversal': 'Path traversal sequences can access unauthorized files.',
      'Dynamic File Read': 'Reading files based on user input can be exploited.',
      'Dynamic File Write': 'Writing files based on user input can be dangerous.'
    }

    return descriptions[name] || `Potential security issue detected: ${name}`
  }

  /**
   * Get suggested fix for a security issue
   */
  getSuggestedFix(category, name) {
    const fixes = {
      'API Key': 'Use environment variables: process.env.API_KEY',
      'Hardcoded Password': 'Use environment variables: process.env.PASSWORD',
      'Secret Token': 'Use secure configuration: process.env.SECRET_TOKEN',
      'SQL Injection (SELECT)': 'Use parameterized queries: pool.query("SELECT * FROM users WHERE id = $1", [id])',
      'XSS via innerHTML': 'Use textContent or DOMPurify to sanitize input',
      'XSS via eval': 'Remove eval() and use JSON.parse() or safe alternatives',
      'Command Injection': 'Validate and sanitize input, use child_process.execFile with array arguments',
      'Weak Hash (MD5)': 'Use crypto.createHash("sha256")',
      'Path Traversal': 'Validate file paths and use path.resolve() to prevent traversal'
    }

    return fixes[name] || 'Review and fix this security issue'
  }

  /**
   * Get references for a security issue
   */
  getReferences(category, name) {
    const refs = {
      secrets: {
        cwe: ['CWE-798'],
        docs: ['https://cwe.mitre.org/data/definitions/798.html']
      },
      sql: {
        cwe: ['CWE-89'],
        docs: ['https://cwe.mitre.org/data/definitions/89.html', 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html']
      },
      xss: {
        cwe: ['CWE-79'],
        docs: ['https://cwe.mitre.org/data/definitions/79.html', 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html']
      },
      command: {
        cwe: ['CWE-78'],
        docs: ['https://cwe.mitre.org/data/definitions/78.html']
      },
      crypto: {
        cwe: ['CWE-327'],
        docs: ['https://cwe.mitre.org/data/definitions/327.html']
      },
      path: {
        cwe: ['CWE-22'],
        docs: ['https://cwe.mitre.org/data/definitions/22.html']
      }
    }

    return refs[category] || {}
  }

  /**
   * Check for hardcoded secrets
   */
  detectHardcodedSecrets(code) {
    const secrets = []

    for (const { pattern, name, severity } of this.patterns.secrets) {
      const matches = code.matchAll(pattern)
      for (const match of matches) {
        secrets.push({
          type: name,
          severity,
          value: match[0],
          position: match.index
        })
      }
    }

    return secrets
  }

  /**
   * Check for SQL injection vulnerabilities
   */
  checkSQLInjection(code) {
    const issues = []

    for (const { pattern, name, severity } of this.patterns.sql) {
      if (pattern.test(code)) {
        issues.push({ type: name, severity })
      }
    }

    return issues
  }

  /**
   * Check for XSS vulnerabilities
   */
  checkXSS(code) {
    const issues = []

    for (const { pattern, name, severity } of this.patterns.xss) {
      if (pattern.test(code)) {
        issues.push({ type: name, severity })
      }
    }

    return issues
  }

  /**
   * Check dependencies for known vulnerabilities
   * (Placeholder - would integrate with npm audit or Snyk)
   */
  async checkDependencies(packageJson) {
    // TODO: Integrate with npm audit API or Snyk
    return []
  }

  /**
   * Run npm audit to check for dependency vulnerabilities
   * @returns {Promise<Array>} Array of vulnerability objects
   */
  async runNpmAudit() {
    const { execSync } = require('child_process')
    const vulnerabilities = []

    try {
      // Run npm audit with JSON output
      const auditOutput = execSync('npm audit --json', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      })

      const auditData = JSON.parse(auditOutput)

      // Parse audit results
      if (auditData.vulnerabilities) {
        for (const [packageName, vulnData] of Object.entries(auditData.vulnerabilities)) {
          const vulnerability = {
            package: packageName,
            severity: vulnData.severity,
            title: vulnData.via?.[0]?.title || 'Unknown vulnerability',
            range: vulnData.range,
            fixAvailable: vulnData.fixAvailable,
            isDirect: vulnData.isDirect,
            via: vulnData.via,
            effects: vulnData.effects
          }

          vulnerabilities.push(vulnerability)
        }
      }
    } catch (error) {
      // npm audit returns non-zero exit code if vulnerabilities found
      // Try to parse the output anyway
      if (error.stdout) {
        try {
          const auditData = JSON.parse(error.stdout)
          if (auditData.vulnerabilities) {
            for (const [packageName, vulnData] of Object.entries(auditData.vulnerabilities)) {
              vulnerabilities.push({
                package: packageName,
                severity: vulnData.severity,
                title: vulnData.via?.[0]?.title || 'Unknown vulnerability',
                range: vulnData.range,
                fixAvailable: vulnData.fixAvailable,
                isDirect: vulnData.isDirect
              })
            }
          }
        } catch (parseError) {
          console.error('Failed to parse npm audit output:', parseError)
        }
      }
    }

    return vulnerabilities
  }

  /**
   * Get comprehensive security metrics
   * @param {Array} vulnerabilities - Array of vulnerabilities
   * @returns {Object} Security metrics
   */
  getSecurityMetrics(vulnerabilities) {
    const metrics = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: vulnerabilities.length,
      coverage: 100
    }

    for (const vuln of vulnerabilities) {
      const severity = vuln.severity?.toLowerCase()
      if (severity === 'critical') metrics.critical++
      else if (severity === 'high') metrics.high++
      else if (severity === 'medium') metrics.medium++
      else if (severity === 'low') metrics.low++
    }

    return metrics
  }

  /**
   * Check OWASP Top 10 compliance
   * @param {Array} vulnerabilities - Array of code vulnerabilities
   * @returns {Array} Compliance check results
   */
  checkOWASPCompliance(vulnerabilities) {
    const checks = [
      {
        id: 'owasp-a01',
        name: 'OWASP A01: Broken Access Control',
        description: 'Проверка контроля доступа',
        status: 'pending',
        score: null
      },
      {
        id: 'owasp-a02',
        name: 'OWASP A02: Cryptographic Failures',
        description: 'Проверка криптографии',
        status: 'pending',
        score: null
      },
      {
        id: 'owasp-a03',
        name: 'OWASP A03: Injection',
        description: 'Проверка на SQL/XSS инъекции',
        status: 'pending',
        score: null
      },
      {
        id: 'owasp-a04',
        name: 'OWASP A04: Insecure Design',
        description: 'Проверка дизайна безопасности',
        status: 'pending',
        score: null
      }
    ]

    // Check for injection vulnerabilities (A03)
    const injectionVulns = vulnerabilities.filter(v =>
      v.category === 'sql' || v.category === 'xss' || v.category === 'command'
    )

    if (injectionVulns.length === 0) {
      checks[2].status = 'passed'
      checks[2].score = 100
    } else {
      checks[2].status = 'failed'
      checks[2].score = Math.max(0, 100 - (injectionVulns.length * 10))
    }

    // Check for cryptographic issues (A02)
    const cryptoVulns = vulnerabilities.filter(v => v.category === 'crypto')

    if (cryptoVulns.length === 0) {
      checks[1].status = 'passed'
      checks[1].score = 100
    } else {
      checks[1].status = 'failed'
      checks[1].score = Math.max(0, 100 - (cryptoVulns.length * 15))
    }

    // Check for hardcoded secrets (related to A02)
    const secretVulns = vulnerabilities.filter(v => v.category === 'secrets')

    if (secretVulns.length > 0) {
      checks[1].status = 'failed'
      checks[1].score = Math.min(checks[1].score || 50, 50)
    }

    return checks
  }

  /**
   * Scan entire codebase for vulnerabilities
   * @param {string} codebasePath - Path to codebase
   * @returns {Promise<Object>} Scan results
   */
  async scanCodebase(codebasePath = process.cwd()) {
    const fs = require('fs').promises
    const path = require('path')
    const vulnerabilities = []

    // Recursively scan files
    async function scanDirectory(dirPath) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)

        // Skip node_modules, .git, and other directories
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            await scanDirectory(fullPath)
          }
        } else if (entry.isFile()) {
          // Only scan code files
          const ext = path.extname(entry.name)
          if (['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.java', '.go'].includes(ext)) {
            const content = await fs.readFile(fullPath, 'utf-8')
            const fileVulns = await this.scanFileContent(fullPath, content)
            vulnerabilities.push(...fileVulns)
          }
        }
      }
    }

    await scanDirectory(codebasePath)

    return {
      vulnerabilities,
      metrics: this.getSecurityMetrics(vulnerabilities),
      compliance: this.checkOWASPCompliance(vulnerabilities)
    }
  }

  /**
   * Scan file content for vulnerabilities
   * @param {string} filePath - File path
   * @param {string} content - File content
   * @returns {Array} Vulnerabilities found
   */
  async scanFileContent(filePath, content) {
    const vulnerabilities = []
    const lines = content.split('\n')

    // Check all pattern categories
    for (const [category, patterns] of Object.entries(this.patterns)) {
      for (const { pattern, name, severity } of patterns) {
        // Reset regex state
        pattern.lastIndex = 0

        // Check each line
        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
          const line = lines[lineNumber]

          if (pattern.test(line)) {
            vulnerabilities.push({
              type: 'security',
              severity,
              title: name,
              description: this.getDescription(category, name),
              file: filePath,
              line: lineNumber + 1,
              codeSnippet: line.trim(),
              suggestedFix: this.getSuggestedFix(category, name),
              category,
              detectedAt: new Date().toISOString(),
              fixAvailable: !!this.getSuggestedFix(category, name),
              cwe: this.getReferences(category, name).cwe?.[0],
              references: this.getReferences(category, name).docs || []
            })

            // Reset pattern for next test
            pattern.lastIndex = 0
          }
        }
      }
    }

    return vulnerabilities
  }
}
