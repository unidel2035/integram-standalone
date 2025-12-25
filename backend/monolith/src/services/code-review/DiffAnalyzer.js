/**
 * DiffAnalyzer - Parses Git diffs and extracts changed code
 * Issue #1594 - Code review system
 */

export class DiffAnalyzer {
  constructor() {
    this.chunkSize = 50 // Max lines per chunk for AI analysis
  }

  /**
   * Parse a Git diff string
   * @param {string} diffString - Diff in unified format
   * @returns {Object} Parsed diff with changes
   */
  parseDiff(diffString) {
    if (!diffString || diffString.trim() === '') {
      return {
        hunks: [],
        additions: [],
        deletions: [],
        changes: []
      }
    }

    const lines = diffString.split('\n')
    const hunks = []
    const additions = []
    const deletions = []
    const changes = []

    let currentHunk = null
    let lineNumber = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Hunk header: @@ -1,3 +1,4 @@
      if (line.startsWith('@@')) {
        if (currentHunk) {
          hunks.push(currentHunk)
        }

        const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/)
        if (match) {
          currentHunk = {
            oldStart: parseInt(match[1]),
            oldLines: parseInt(match[2] || 1),
            newStart: parseInt(match[3]),
            newLines: parseInt(match[4] || 1),
            lines: []
          }
          lineNumber = currentHunk.newStart
        }
        continue
      }

      if (!currentHunk) continue

      // Added line
      if (line.startsWith('+')) {
        const content = line.substring(1)
        additions.push({
          line: lineNumber,
          content
        })
        changes.push({
          type: 'add',
          line: lineNumber,
          content
        })
        currentHunk.lines.push({ type: 'add', line: lineNumber, content })
        lineNumber++
      }
      // Deleted line
      else if (line.startsWith('-')) {
        const content = line.substring(1)
        deletions.push({
          content
        })
        changes.push({
          type: 'delete',
          content
        })
        currentHunk.lines.push({ type: 'delete', content })
      }
      // Context line
      else if (!line.startsWith('\\')) {
        const content = line.startsWith(' ') ? line.substring(1) : line
        currentHunk.lines.push({ type: 'context', line: lineNumber, content })
        lineNumber++
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk)
    }

    return {
      hunks,
      additions,
      deletions,
      changes
    }
  }

  /**
   * Extract changed lines from diff
   * @param {Object} diff - Parsed diff object
   * @returns {Array} Array of changed lines with context
   */
  getChangedLines(diff) {
    const changedLines = []

    for (const hunk of diff.hunks) {
      for (const line of hunk.lines) {
        if (line.type !== 'context') {
          changedLines.push({
            line: line.line,
            type: line.type,
            content: line.content
          })
        }
      }
    }

    return changedLines
  }

  /**
   * Get changed files from a full diff
   * @param {string} fullDiff - Full diff with multiple files
   * @returns {Array} Array of file changes
   */
  extractChangedFiles(fullDiff) {
    const files = []
    const fileSections = fullDiff.split(/^diff --git /m).filter(Boolean)

    for (const section of fileSections) {
      const lines = section.split('\n')
      const headerLine = lines[0]

      // Extract file paths
      const match = headerLine.match(/a\/(.+?) b\/(.+)/)
      if (!match) continue

      const [, oldPath, newPath] = match

      // Find the actual diff content (after the header lines)
      let diffStart = 1
      while (diffStart < lines.length && !lines[diffStart].startsWith('@@')) {
        diffStart++
      }

      const diffContent = lines.slice(diffStart).join('\n')

      files.push({
        oldPath,
        newPath,
        filename: newPath,
        diff: diffContent,
        parsed: this.parseDiff(diffContent)
      })
    }

    return files
  }

  /**
   * Group changes into chunks for AI analysis
   * @param {Array} changes - Array of changes
   * @param {number} maxChunkSize - Maximum lines per chunk
   * @returns {Array} Array of chunks
   */
  groupChangesIntoChunks(changes, maxChunkSize = this.chunkSize) {
    const chunks = []
    let currentChunk = []

    for (const change of changes) {
      currentChunk.push(change)

      if (currentChunk.length >= maxChunkSize) {
        chunks.push([...currentChunk])
        currentChunk = []
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk)
    }

    return chunks
  }

  /**
   * Get context around a specific line
   * @param {Object} diff - Parsed diff
   * @param {number} lineNumber - Target line number
   * @param {number} contextLines - Number of context lines before/after
   * @returns {Object} Context information
   */
  getLineContext(diff, lineNumber, contextLines = 3) {
    const result = {
      before: [],
      line: null,
      after: []
    }

    for (const hunk of diff.hunks) {
      const allLines = hunk.lines.filter(l => l.line !== undefined)
      const targetIndex = allLines.findIndex(l => l.line === lineNumber)

      if (targetIndex === -1) continue

      // Get context before
      const beforeStart = Math.max(0, targetIndex - contextLines)
      result.before = allLines.slice(beforeStart, targetIndex)

      // Get target line
      result.line = allLines[targetIndex]

      // Get context after
      const afterEnd = Math.min(allLines.length, targetIndex + contextLines + 1)
      result.after = allLines.slice(targetIndex + 1, afterEnd)

      break
    }

    return result
  }

  /**
   * Calculate diff statistics
   * @param {Object} diff - Parsed diff
   * @returns {Object} Statistics
   */
  getStats(diff) {
    return {
      additions: diff.additions.length,
      deletions: diff.deletions.length,
      changes: diff.changes.length,
      hunks: diff.hunks.length
    }
  }

  /**
   * Check if a line is part of a function/method
   * @param {Object} diff - Parsed diff
   * @param {number} lineNumber - Line number
   * @param {string} language - Programming language
   * @returns {Object|null} Function info if found
   */
  getFunctionContext(diff, lineNumber, language = 'javascript') {
    const context = this.getLineContext(diff, lineNumber, 10)

    // Simple heuristic for JavaScript/TypeScript
    const functionPatterns = [
      /function\s+(\w+)\s*\(/,
      /(\w+)\s*=\s*function\s*\(/,
      /(\w+)\s*:\s*function\s*\(/,
      /async\s+function\s+(\w+)\s*\(/,
      /(\w+)\s*=\s*async\s*\(/,
      /(\w+)\s*\([^)]*\)\s*{/,
      /class\s+(\w+)/
    ]

    // Search backward for function declaration
    const allBefore = [...context.before].reverse()
    for (const line of allBefore) {
      for (const pattern of functionPatterns) {
        const match = line.content.match(pattern)
        if (match) {
          return {
            name: match[1],
            line: line.line,
            type: line.content.includes('class') ? 'class' : 'function'
          }
        }
      }
    }

    return null
  }
}
