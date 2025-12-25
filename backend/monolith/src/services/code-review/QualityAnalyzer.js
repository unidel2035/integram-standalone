/**
 * QualityAnalyzer - Analyzes code quality and best practices
 * Issue #1594 - Code review system
 */

export class QualityAnalyzer {
  constructor() {
    this.maxFunctionLength = 50
    this.maxComplexity = 10
    this.maxParameters = 5
  }

  /**
   * Analyze a file for code quality
   * @param {string} filePath - File path
   * @param {string} content - File content
   * @returns {Promise<Object>} Analysis result with issues and metrics
   */
  async analyzeFile(filePath, content) {
    const issues = []
    const metrics = {
      cyclomaticComplexity: null,
      cognitiveComplexity: null,
      maintainabilityIndex: null,
      followsConventions: null,
      hasDocumentation: null
    }

    // Calculate complexity
    const complexity = this.calculateComplexity(content)
    metrics.cyclomaticComplexity = complexity.cyclomatic
    metrics.cognitiveComplexity = complexity.cognitive

    // Detect code smells
    const smells = this.detectCodeSmells(content, filePath)
    issues.push(...smells)

    // Check naming conventions
    const namingIssues = this.checkNamingConventions(content, filePath)
    issues.push(...namingIssues)

    // Check documentation
    metrics.hasDocumentation = this.hasDocumentation(content)

    // Calculate maintainability index
    metrics.maintainabilityIndex = this.calculateMaintainabilityIndex(
      content,
      complexity.cyclomatic,
      metrics.hasDocumentation
    )

    metrics.followsConventions = namingIssues.length === 0

    return {
      issues,
      metrics
    }
  }

  /**
   * Calculate code complexity
   */
  calculateComplexity(code) {
    // Cyclomatic complexity: count decision points
    const cyclomaticKeywords = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\b\?\b/g, // ternary
      /\&\&/g,
      /\|\|/g
    ]

    let cyclomatic = 1 // Base complexity

    for (const pattern of cyclomaticKeywords) {
      const matches = code.match(pattern)
      if (matches) {
        cyclomatic += matches.length
      }
    }

    // Cognitive complexity: similar but weighted differently
    const cognitive = Math.floor(cyclomatic * 0.8)

    return {
      cyclomatic,
      cognitive
    }
  }

  /**
   * Detect code smells
   */
  detectCodeSmells(code, filePath) {
    const smells = []

    // Long functions
    const functions = this.extractFunctions(code)
    for (const func of functions) {
      if (func.length > this.maxFunctionLength) {
        smells.push({
          type: 'quality',
          severity: 'medium',
          title: 'Long Function',
          description: `Function '${func.name}' is ${func.length} lines long. Consider breaking it into smaller functions.`,
          filePath,
          lineNumber: func.startLine,
          codeSnippet: func.signature,
          suggestedFix: 'Refactor into smaller, focused functions',
          tags: ['quality', 'code-smell', 'long-function'],
          aiConfidence: 0.9
        })
      }
    }

    // Too many parameters
    for (const func of functions) {
      if (func.paramCount > this.maxParameters) {
        smells.push({
          type: 'quality',
          severity: 'low',
          title: 'Too Many Parameters',
          description: `Function '${func.name}' has ${func.paramCount} parameters. Consider using an options object.`,
          filePath,
          lineNumber: func.startLine,
          codeSnippet: func.signature,
          suggestedFix: 'Use an options object or refactor to reduce parameters',
          tags: ['quality', 'code-smell', 'too-many-parameters'],
          aiConfidence: 0.85
        })
      }
    }

    // Code duplication (simple check)
    const duplicates = this.findDuplicates(code)
    for (const dup of duplicates) {
      smells.push({
        type: 'quality',
        severity: 'low',
        title: 'Code Duplication',
        description: 'Found duplicate code blocks. Consider extracting to a shared function.',
        filePath,
        lineNumber: dup.line,
        codeSnippet: dup.code,
        suggestedFix: 'Extract duplicate code to a shared function',
        tags: ['quality', 'code-smell', 'duplication'],
        aiConfidence: 0.7
      })
    }

    // Magic numbers
    const magicNumbers = this.findMagicNumbers(code)
    for (const magic of magicNumbers) {
      smells.push({
        type: 'quality',
        severity: 'info',
        title: 'Magic Number',
        description: `Magic number ${magic.value} found. Consider using a named constant.`,
        filePath,
        lineNumber: magic.line,
        codeSnippet: magic.context,
        suggestedFix: `const ${magic.suggestedName} = ${magic.value}`,
        tags: ['quality', 'magic-number'],
        aiConfidence: 0.6
      })
    }

    return smells
  }

  /**
   * Extract functions from code
   */
  extractFunctions(code) {
    const functions = []
    const lines = code.split('\n')

    // JavaScript/TypeScript function patterns
    const patterns = [
      /function\s+(\w+)\s*\(([^)]*)\)/,
      /(\w+)\s*=\s*function\s*\(([^)]*)\)/,
      /(\w+)\s*:\s*function\s*\(([^)]*)\)/,
      /async\s+function\s+(\w+)\s*\(([^)]*)\)/,
      /(\w+)\s*=\s*async\s*\(([^)]*)\)\s*=>/,
      /(\w+)\s*=\s*\(([^)]*)\)\s*=>/,
      /(\w+)\s*\(([^)]*)\)\s*{/
    ]

    let currentFunction = null
    let braceCount = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check for function start
      if (!currentFunction) {
        for (const pattern of patterns) {
          const match = line.match(pattern)
          if (match) {
            currentFunction = {
              name: match[1] || 'anonymous',
              params: match[2] || '',
              paramCount: match[2] ? match[2].split(',').filter(p => p.trim()).length : 0,
              startLine: i + 1,
              signature: line.trim(),
              length: 0
            }
            braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
            break
          }
        }
      } else {
        // Count braces
        braceCount += (line.match(/{/g) || []).length
        braceCount -= (line.match(/}/g) || []).length
        currentFunction.length++

        // Function ended
        if (braceCount === 0) {
          functions.push(currentFunction)
          currentFunction = null
        }
      }
    }

    return functions
  }

  /**
   * Check naming conventions
   */
  checkNamingConventions(code, filePath) {
    const issues = []

    // Check for camelCase in JavaScript/TypeScript
    if (filePath.match(/\.(js|ts|jsx|tsx)$/)) {
      // Variable names should be camelCase
      const variablePattern = /(const|let|var)\s+([A-Z][a-zA-Z0-9_]*)\s*=/g
      let match

      while ((match = variablePattern.exec(code)) !== null) {
        const varName = match[2]
        if (varName && !varName.startsWith('_') && varName[0] === varName[0].toUpperCase()) {
          issues.push({
            type: 'quality',
            severity: 'info',
            title: 'Naming Convention',
            description: `Variable '${varName}' should use camelCase, not PascalCase`,
            filePath,
            codeSnippet: match[0],
            suggestedFix: `Use ${varName[0].toLowerCase()}${varName.slice(1)} instead`,
            tags: ['quality', 'naming-convention'],
            aiConfidence: 0.75
          })
        }
      }
    }

    return issues
  }

  /**
   * Check if file has documentation
   */
  hasDocumentation(code) {
    // Check for JSDoc comments
    const jsdocPattern = /\/\*\*[\s\S]*?\*\//
    const hasJSDoc = jsdocPattern.test(code)

    // Check for regular comments
    const commentPattern = /\/\/.+|\/\*[\s\S]*?\*\//g
    const comments = code.match(commentPattern)
    const hasComments = comments && comments.length > 0

    return hasJSDoc || hasComments
  }

  /**
   * Calculate maintainability index
   * (Simplified version of Microsoft's Maintainability Index)
   */
  calculateMaintainabilityIndex(code, complexity, hasDocumentation) {
    const lines = code.split('\n').length
    const volume = Math.log2(lines + 1) * Math.log2(code.length + 1)

    let index = 171 - 5.2 * Math.log(volume) - 0.23 * complexity - 16.2 * Math.log(lines)

    // Bonus for documentation
    if (hasDocumentation) {
      index += 5
    }

    // Normalize to 0-100
    index = Math.max(0, Math.min(100, index))

    return Math.round(index * 100) / 100
  }

  /**
   * Find duplicate code blocks
   */
  findDuplicates(code) {
    const duplicates = []
    const lines = code.split('\n')
    const minBlockSize = 5

    // Simple duplicate detection: look for repeated blocks
    for (let i = 0; i < lines.length - minBlockSize; i++) {
      const block = lines.slice(i, i + minBlockSize).join('\n').trim()
      if (block.length < 20) continue

      for (let j = i + minBlockSize; j < lines.length - minBlockSize; j++) {
        const compareBlock = lines.slice(j, j + minBlockSize).join('\n').trim()
        if (block === compareBlock) {
          duplicates.push({
            line: i + 1,
            code: block.substring(0, 100) + '...'
          })
          break
        }
      }
    }

    return duplicates.slice(0, 3) // Limit to 3 duplicates
  }

  /**
   * Find magic numbers
   */
  findMagicNumbers(code) {
    const magicNumbers = []
    const lines = code.split('\n')

    const magicPattern = /\b([2-9]|\d{2,})\b/g // Numbers >= 2

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Skip if line is a comment
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue

      let match
      while ((match = magicPattern.exec(line)) !== null) {
        const value = match[1]

        // Skip common safe numbers
        if (['0', '1', '10', '100', '1000'].includes(value)) continue

        magicNumbers.push({
          value,
          line: i + 1,
          context: line.trim(),
          suggestedName: this.suggestConstantName(line, value)
        })
      }
    }

    return magicNumbers.slice(0, 5) // Limit to 5
  }

  /**
   * Suggest a constant name for a magic number
   */
  suggestConstantName(context, value) {
    if (context.includes('timeout') || context.includes('delay')) {
      return 'TIMEOUT_MS'
    }
    if (context.includes('max') || context.includes('limit')) {
      return 'MAX_LIMIT'
    }
    if (context.includes('min')) {
      return 'MIN_VALUE'
    }
    if (context.includes('page') || context.includes('size')) {
      return 'PAGE_SIZE'
    }
    return 'CONSTANT_VALUE'
  }

  /**
   * Estimate test coverage
   */
  estimateTestCoverage(files) {
    const codeFiles = files.filter(f => !f.match(/\.(test|spec)\.(js|ts|jsx|tsx)$/))
    const testFiles = files.filter(f => f.match(/\.(test|spec)\.(js|ts|jsx|tsx)$/))

    if (codeFiles.length === 0) return 0

    // Simple heuristic: ratio of test files to code files
    const ratio = testFiles.length / codeFiles.length

    return Math.min(100, Math.round(ratio * 100))
  }
}
