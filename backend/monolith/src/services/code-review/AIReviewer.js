/**
 * AIReviewer - Uses AI models to generate intelligent code review comments
 * Issue #1594 - Code review system
 */

export class AIReviewer {
  constructor(config = {}) {
    this.llmCoordinator = config.llmCoordinator
    this.pool = config.pool
    this.logger = config.logger || console
  }

  /**
   * Review code with AI
   * @param {string} filename - File name
   * @param {string} patch - Git diff patch
   * @param {Object} diff - Parsed diff object
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} AI review result
   */
  async reviewWithAI(filename, patch, diff, context = {}) {
    try {
      // Get default model
      const modelResult = await this.pool.query(`
        SELECT id FROM ai_models
        WHERE model_id = 'deepseek-chat'
        LIMIT 1
      `)

      if (!modelResult.rows || modelResult.rows.length === 0) {
        throw new Error('Default AI model (deepseek-chat) not found')
      }

      const modelId = modelResult.rows[0].id

      // Get system token for code review
      const tokenResult = await this.pool.query(`
        SELECT id FROM ai_access_tokens
        WHERE user_id = 'system'
          AND name = 'Code Review System'
          AND is_active = true
        LIMIT 1
      `)

      if (!tokenResult.rows || tokenResult.rows.length === 0) {
        throw new Error('Code review system token not found')
      }

      const tokenId = tokenResult.rows[0].id

      // Prepare prompt
      const prompt = this.buildReviewPrompt(filename, patch, diff, context)

      this.logger.debug('Sending code to AI for review', {
        filename,
        modelId,
        promptLength: prompt.length
      })

      // Call AI via LLM coordinator
      // Note: We'll use a direct approach here since we have token ID
      const aiResult = await this.callAI(modelId, tokenId, prompt)

      // Parse AI response
      const comments = this.parseAIResponse(aiResult.response, filename, diff)

      return {
        comments,
        tokensUsed: aiResult.tokensUsed || 0,
        cost: aiResult.cost || 0
      }
    } catch (error) {
      this.logger.error('AI review failed', {
        error: error.message,
        filename
      })

      // Return empty result on failure
      return {
        comments: [],
        tokensUsed: 0,
        cost: 0
      }
    }
  }

  /**
   * Build review prompt for AI
   */
  buildReviewPrompt(filename, patch, diff, context) {
    const language = this.detectLanguage(filename)

    const prompt = `You are an expert code reviewer. Review the following code changes and provide constructive feedback.

**File**: ${filename}
**Language**: ${language}
**Repository**: ${context.repository || 'unknown'}

**Code Changes** (Git diff):
\`\`\`diff
${patch}
\`\`\`

**Instructions**:
1. Review the code changes for:
   - Potential bugs or errors
   - Best practices violations
   - Performance issues
   - Code maintainability
   - Security concerns (if not already flagged)
   - Edge cases that aren't handled

2. For each issue you find, provide:
   - A clear title (max 80 characters)
   - A detailed description of the issue
   - The severity (critical, high, medium, low, info)
   - A suggested fix or improvement
   - (Optional) Sample code for the fix

3. Focus on the **added lines** (lines starting with +)

4. Be constructive and specific. Don't just say "this is bad" - explain why and how to fix it.

5. Ignore trivial issues like formatting (unless it's a serious readability problem)

**Output Format**:
Return your review as a JSON array of objects. Each object should have:
{
  "title": "Issue title",
  "description": "Detailed description",
  "severity": "low|medium|high|critical",
  "lineNumber": <line number from diff> or null,
  "suggestedFix": "How to fix this",
  "fixCode": "Optional code snippet showing the fix"
}

If no issues found, return an empty array: []

**Your Review**:`

    return prompt
  }

  /**
   * Call AI model
   */
  async callAI(modelId, tokenId, prompt) {
    try {
      // Get model configuration
      const modelResult = await this.pool.query(`
        SELECT * FROM v_active_ai_models WHERE id = $1
      `, [modelId])

      if (!modelResult.rows || modelResult.rows.length === 0) {
        throw new Error('Model not found')
      }

      const model = modelResult.rows[0]

      // For DeepSeek, we'll use a simplified approach
      // In production, this would go through TokenBasedLLMCoordinator
      const response = await this.callDeepSeek(model, prompt)

      // Estimate tokens (rough estimate: 1 token ≈ 4 characters)
      const promptTokens = Math.ceil(prompt.length / 4)
      const completionTokens = Math.ceil(response.length / 4)
      const totalTokens = promptTokens + completionTokens

      // Calculate cost
      const costInput = (promptTokens / 1000) * (model.cost_per_1k_input || 0)
      const costOutput = (completionTokens / 1000) * (model.cost_per_1k_output || 0)
      const totalCost = costInput + costOutput

      // Record usage
      await this.pool.query(`
        INSERT INTO ai_token_usage (
          access_token_id,
          model_id,
          application,
          operation,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          cost_input,
          cost_output,
          total_cost,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        tokenId,
        modelId,
        'code-review',
        'review',
        promptTokens,
        completionTokens,
        totalTokens,
        costInput,
        costOutput,
        totalCost,
        'completed'
      ])

      // Deduct from token balance
      await this.pool.query(`
        UPDATE ai_access_tokens
        SET token_balance = token_balance - $1
        WHERE id = $2
      `, [totalTokens, tokenId])

      return {
        response,
        tokensUsed: totalTokens,
        cost: totalCost
      }
    } catch (error) {
      this.logger.error('AI call failed', {
        error: error.message
      })
      throw error
    }
  }

  /**
   * Call DeepSeek API
   * (Simplified - in production, use OpenAI client with DeepSeek endpoint)
   */
  async callDeepSeek(model, prompt) {
    // This is a placeholder. In production:
    // 1. Use OpenAI client configured for DeepSeek
    // 2. Or use the actual TokenBasedLLMCoordinator

    // For now, return a mock response
    return JSON.stringify([])
  }

  /**
   * Parse AI response into structured comments
   */
  parseAIResponse(responseText, filename, diff) {
    const comments = []

    try {
      // Try to parse as JSON
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        this.logger.warn('AI response is not valid JSON array', {
          response: responseText.substring(0, 200)
        })
        return comments
      }

      const parsed = JSON.parse(jsonMatch[0])

      if (!Array.isArray(parsed)) {
        this.logger.warn('AI response is not an array')
        return comments
      }

      for (const item of parsed) {
        if (!item.title || !item.description) continue

        comments.push({
          type: 'suggestion',
          severity: item.severity || 'low',
          title: item.title,
          description: item.description,
          filePath: filename,
          lineNumber: item.lineNumber || null,
          codeSnippet: this.getCodeSnippet(diff, item.lineNumber),
          suggestedFix: item.suggestedFix || null,
          fixCode: item.fixCode || null,
          tags: ['ai-generated', 'code-review'],
          aiConfidence: 0.8
        })
      }
    } catch (error) {
      this.logger.error('Failed to parse AI response', {
        error: error.message,
        response: responseText.substring(0, 500)
      })
    }

    return comments
  }

  /**
   * Get code snippet from diff for a specific line
   */
  getCodeSnippet(diff, lineNumber) {
    if (!lineNumber || !diff.additions) return null

    const addition = diff.additions.find(a => a.line === lineNumber)
    return addition ? addition.content : null
  }

  /**
   * Detect programming language
   */
  detectLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase()
    const languageMap = {
      js: 'JavaScript',
      jsx: 'JavaScript (React)',
      ts: 'TypeScript',
      tsx: 'TypeScript (React)',
      py: 'Python',
      java: 'Java',
      go: 'Go',
      rs: 'Rust',
      c: 'C',
      cpp: 'C++',
      cs: 'C#',
      rb: 'Ruby',
      php: 'PHP',
      sql: 'SQL',
      vue: 'Vue.js',
      html: 'HTML',
      css: 'CSS'
    }
    return languageMap[ext] || 'Unknown'
  }

  /**
   * Analyze a specific function with AI
   */
  async analyzeFunction(functionCode, language = 'javascript') {
    const prompt = `Review this ${language} function and suggest improvements:

\`\`\`${language}
${functionCode}
\`\`\`

Focus on:
- Logic errors
- Performance
- Readability
- Best practices

Respond with a brief analysis (max 200 words).`

    try {
      const modelResult = await this.pool.query(`
        SELECT id FROM ai_models WHERE model_id = 'deepseek-chat' LIMIT 1
      `)

      const modelId = modelResult.rows[0].id

      const tokenResult = await this.pool.query(`
        SELECT id FROM ai_access_tokens
        WHERE user_id = 'system' AND name = 'Code Review System'
        LIMIT 1
      `)

      const tokenId = tokenResult.rows[0].id

      const result = await this.callAI(modelId, tokenId, prompt)
      return result.response
    } catch (error) {
      this.logger.error('Function analysis failed', {
        error: error.message
      })
      return null
    }
  }

  /**
   * Suggest refactoring with AI
   */
  async suggestRefactoring(code) {
    const prompt = `Suggest refactoring improvements for this code:

\`\`\`
${code}
\`\`\`

Provide specific, actionable suggestions.`

    try {
      const modelResult = await this.pool.query(`
        SELECT id FROM ai_models WHERE model_id = 'deepseek-chat' LIMIT 1
      `)

      const modelId = modelResult.rows[0].id

      const tokenResult = await this.pool.query(`
        SELECT id FROM ai_access_tokens
        WHERE user_id = 'system' AND name = 'Code Review System'
        LIMIT 1
      `)

      const tokenId = tokenResult.rows[0].id

      const result = await this.callAI(modelId, tokenId, prompt)
      return result.response
    } catch (error) {
      this.logger.error('Refactoring suggestion failed', {
        error: error.message
      })
      return null
    }
  }
}
