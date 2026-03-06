/**
 * VSL AI Service
 *
 * Integrates AI (LLM) capabilities with VSL for:
 * - Natural language to VSL conversion
 * - VSL editing via text commands
 * - Scene understanding and description
 * - Intelligent object placement and relationships
 *
 * Uses DronDoc token-based AI access (DeepSeek by default)
 *
 * @module services/vslAIService
 */

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api'

/**
 * VSL AI Service Class
 */
export class VSLAIService {
  constructor() {
    this.defaultModel = null
    this.accessToken = null
  }

  /**
   * Initialize AI service with user token
   * @param {string} userId - User ID for token retrieval
   */
  async init(userId) {
    try {
      const response = await fetch(`${API_BASE_URL}/ai-tokens/default-token/${userId}`)
      if (!response.ok) {
        throw new Error('Failed to get AI access token')
      }

      const result = await response.json()
      this.accessToken = result.data.token
      this.defaultModel = result.data.defaultModel

      return this
    } catch (error) {
      console.error('Failed to initialize VSL AI Service:', error)
      throw error
    }
  }

  /**
   * Generate VSL document from natural language description
   * @param {string} description - Natural language description of the scene
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} VSL document
   */
  async generateFromDescription(description, options = {}) {
    const {
      canvasSize = { width: 800, height: 600 },
      unit = 'px',
      contextType = 'general', // 'general', 'architectural', 'engineering'
      temperature = 0.2
    } = options

    const systemPrompt = this._buildSystemPrompt(contextType)
    const userPrompt = this._buildGenerationPrompt(description, canvasSize, unit)

    try {
      const vslJSON = await this._callAI(systemPrompt, userPrompt, { temperature })

      // Parse and validate VSL
      const vslDocument = typeof vslJSON === 'string' ? JSON.parse(vslJSON) : vslJSON

      return vslDocument
    } catch (error) {
      console.error('Failed to generate VSL from description:', error)
      throw error
    }
  }

  /**
   * Edit VSL document based on natural language command
   * @param {Object} document - Current VSL document
   * @param {string} command - Edit command in natural language
   * @param {Object} options - Edit options
   * @returns {Promise<Object>} Updated VSL document
   */
  async editWithCommand(document, command, options = {}) {
    const { temperature = 0.1 } = options

    const systemPrompt = `You are a VSL (Visual Scene Language) editor. You receive a VSL JSON document and a user command to modify it. You must return the complete modified VSL JSON document.

Key rules:
1. Preserve the VSL JSON structure
2. Only modify what the user requests
3. Keep all object IDs unless explicitly asked to remove objects
4. Return valid JSON only, no explanations
5. Maintain relationships between objects when relevant`

    const userPrompt = `Current VSL Document:
\`\`\`json
${JSON.stringify(document, null, 2)}
\`\`\`

User Command: ${command}

Return the complete modified VSL document as JSON.`

    try {
      const vslJSON = await this._callAI(systemPrompt, userPrompt, { temperature })

      // Parse and validate VSL
      const updatedDocument = typeof vslJSON === 'string' ? JSON.parse(vslJSON) : vslJSON

      return updatedDocument
    } catch (error) {
      console.error('Failed to edit VSL with command:', error)
      throw error
    }
  }

  /**
   * Describe a VSL document in natural language
   * @param {Object} document - VSL document
   * @param {Object} options - Description options
   * @returns {Promise<string>} Natural language description
   */
  async describeScene(document, options = {}) {
    const { detailLevel = 'medium', language = 'en' } = options

    const systemPrompt = `You are a VSL (Visual Scene Language) analyzer. You receive a VSL JSON document and describe the scene in natural language.

Detail levels:
- brief: One sentence summary
- medium: Paragraph describing main elements
- detailed: Comprehensive description including all objects, relationships, and spatial arrangement

Return your description in ${language === 'ru' ? 'Russian' : 'English'}.`

    const userPrompt = `VSL Document:
\`\`\`json
${JSON.stringify(document, null, 2)}
\`\`\`

Detail level: ${detailLevel}

Describe this scene in natural language.`

    try {
      const description = await this._callAI(systemPrompt, userPrompt, { temperature: 0.3 })
      return description
    } catch (error) {
      console.error('Failed to describe VSL scene:', error)
      throw error
    }
  }

  /**
   * Suggest improvements or corrections to a VSL document
   * @param {Object} document - VSL document
   * @param {string} context - Context or goal (e.g., "architectural drawing", "UI design")
   * @returns {Promise<Object>} Suggestions with reasoning
   */
  async suggestImprovements(document, context = '') {
    const systemPrompt = `You are a VSL (Visual Scene Language) expert consultant. Analyze VSL documents and suggest improvements.

Return a JSON object with this structure:
{
  "suggestions": [
    {
      "type": "improvement|correction|enhancement",
      "severity": "low|medium|high",
      "description": "What to improve",
      "reasoning": "Why this improvement is needed",
      "example": "Example of the fix (VSL JSON snippet if applicable)"
    }
  ],
  "overallAssessment": "Brief overall assessment of the document"
}`

    const contextInfo = context ? `\nContext: ${context}` : ''

    const userPrompt = `Analyze this VSL document and suggest improvements:${contextInfo}

\`\`\`json
${JSON.stringify(document, null, 2)}
\`\`\`

Return suggestions as JSON.`

    try {
      const result = await this._callAI(systemPrompt, userPrompt, { temperature: 0.4 })
      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error) {
      console.error('Failed to get VSL suggestions:', error)
      throw error
    }
  }

  /**
   * Convert image to VSL (via AI vision + reasoning)
   * @param {string} imageData - Base64 image data or URL
   * @param {Object} options - Conversion options
   * @returns {Promise<Object>} VSL document
   */
  async convertImageToVSL(imageData, options = {}) {
    const {
      canvasSize = { width: 800, height: 600 },
      unit = 'px',
      detectionMode = 'automatic' // 'automatic', 'architectural', 'engineering', 'ui'
    } = options

    // Note: This requires a vision-capable model
    // For now, we'll provide a prompt that works with text-based reasoning

    const systemPrompt = `You are a VSL (Visual Scene Language) converter with image understanding capabilities.

Given a description or analysis of an image, generate a VSL JSON document that represents the visual scene.

Focus on:
- Object detection and classification
- Spatial relationships
- Dimensions and proportions
- Text and annotations
- Structural elements

Return valid VSL JSON only.`

    const userPrompt = `Detection mode: ${detectionMode}
Canvas size: ${canvasSize.width}x${canvasSize.height} ${unit}

Analyze the provided image and generate a VSL document representing all visible objects, their positions, sizes, and relationships.

Note: For this implementation, provide a detailed description of what you see, and I will convert it to VSL.`

    // TODO: Implement vision model integration when available
    console.warn('Image-to-VSL conversion requires vision model. Using text-based fallback.')

    throw new Error('Image-to-VSL conversion not yet fully implemented. Requires vision-capable AI model.')
  }

  /**
   * Build system prompt based on context type
   * @private
   */
  _buildSystemPrompt(contextType) {
    const basePrompt = `You are a VSL (Visual Scene Language) generator. VSL is a JSON-based format for representing visual scenes that can be understood and edited by both humans and AI.

VSL JSON Structure:
{
  "version": "1.0.0",
  "canvas": {
    "width": number,
    "height": number,
    "unit": "px|mm|cm|m|in|pt",
    "backgroundColor": "color",
    "showGrid": boolean,
    "gridSize": number
  },
  "objects": [
    {
      "id": "unique-id",
      "type": "rectangle|circle|line|text|wall|door|window|etc",
      "position": { "x": number, "y": number },
      "size": { "width": number, "height": number },
      "style": { "fill": "color", "stroke": "color", ... },
      ...type-specific properties
    }
  ],
  "relationships": [...],
  "metadata": {...}
}`

    const contextPrompts = {
      architectural: `\n\nArchitectural Context:
- Use wall, door, window, furniture types
- Follow architectural standards and conventions
- Include dimensions and proper spacing
- Consider structural relationships
- Add room labels and annotations`,

      engineering: `\n\nEngineering Context:
- Include dimension annotations
- Use technical annotations and callouts
- Follow engineering drawing standards
- Include tolerances and specifications
- Add measurement units and scales`,

      general: `\n\nGeneral Context:
- Use appropriate object types for the scene
- Maintain proper spatial relationships
- Consider visual hierarchy and composition
- Use clear naming conventions`
    }

    return basePrompt + (contextPrompts[contextType] || contextPrompts.general) + '\n\nReturn valid VSL JSON only, no additional text.'
  }

  /**
   * Build generation prompt
   * @private
   */
  _buildGenerationPrompt(description, canvasSize, unit) {
    return `Generate a VSL document for the following scene:

Description: ${description}

Canvas: ${canvasSize.width}x${canvasSize.height} ${unit}

Requirements:
1. Create appropriate objects based on the description
2. Position objects logically in the scene
3. Use realistic sizes and proportions
4. Add relationships between objects where relevant
5. Include metadata (title, description)
6. Use appropriate styles and colors

Return the complete VSL JSON document.`
  }

  /**
   * Call AI with DronDoc token system
   * @private
   */
  async _callAI(systemPrompt, userPrompt, options = {}) {
    const { temperature = 0.2, maxTokens = 4096 } = options

    if (!this.accessToken) {
      throw new Error('AI Service not initialized. Call init() first.')
    }

    try {
      const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken.id}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId: this.defaultModel.id,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          application: 'VSL-Editor',
          operation: 'scene-generation',
          temperature,
          max_tokens: maxTokens
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'AI request failed')
      }

      const result = await response.json()

      // Extract response content
      const content = result.data?.choices?.[0]?.message?.content || result.data?.content || result.data

      // Try to extract JSON from markdown code blocks if present
      if (typeof content === 'string') {
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          return jsonMatch[1].trim()
        }
        return content.trim()
      }

      return content
    } catch (error) {
      console.error('AI call failed:', error)
      throw error
    }
  }

  /**
   * Get usage statistics for VSL AI operations
   * @param {string} startDate - Start date (ISO string)
   * @param {string} endDate - End date (ISO string)
   * @returns {Promise<Object>} Usage statistics
   */
  async getUsageStats(startDate, endDate) {
    if (!this.accessToken) {
      throw new Error('AI Service not initialized')
    }

    try {
      const params = new URLSearchParams({
        application: 'VSL-Editor',
        startDate,
        endDate
      })

      const response = await fetch(`${API_BASE_URL}/ai-tokens/usage-stats?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken.id}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to get usage stats')
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      console.error('Failed to get usage stats:', error)
      throw error
    }
  }
}

// Create singleton instance
const vslAIService = new VSLAIService()

export default vslAIService
