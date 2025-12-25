/**
 * Tool Format Converter
 * Issue #5266: Convert between Anthropic and OpenAI tool formats
 *
 * Anthropic format:
 * {
 *   name: 'tool_name',
 *   description: 'description',
 *   input_schema: { type: 'object', properties: {...}, required: [...] }
 * }
 *
 * OpenAI format:
 * {
 *   type: 'function',
 *   function: {
 *     name: 'tool_name',
 *     description: 'description',
 *     parameters: { type: 'object', properties: {...}, required: [...] }
 *   }
 * }
 */

/**
 * Convert Anthropic tool format to OpenAI tool format
 * @param {Array} anthropicTools - Tools in Anthropic format
 * @returns {Array} Tools in OpenAI format
 */
export function convertAnthropicToOpenAI(anthropicTools) {
  if (!anthropicTools || anthropicTools.length === 0) {
    return [];
  }

  return anthropicTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }
  }));
}

/**
 * Convert OpenAI tool format to Anthropic tool format
 * @param {Array} openaiTools - Tools in OpenAI format
 * @returns {Array} Tools in Anthropic format
 */
export function convertOpenAIToAnthropic(openaiTools) {
  if (!openaiTools || openaiTools.length === 0) {
    return [];
  }

  return openaiTools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters
  }));
}

/**
 * Detect tool format (anthropic or openai)
 * @param {Array} tools - Tools array
 * @returns {string} 'anthropic' | 'openai' | 'unknown'
 */
export function detectToolFormat(tools) {
  if (!tools || tools.length === 0) {
    return 'unknown';
  }

  const firstTool = tools[0];

  // Check for Anthropic format (has input_schema)
  if (firstTool.input_schema) {
    return 'anthropic';
  }

  // Check for OpenAI format (has type: 'function' and function object)
  if (firstTool.type === 'function' && firstTool.function) {
    return 'openai';
  }

  return 'unknown';
}

/**
 * Convert tools to appropriate format based on provider
 * @param {Array} tools - Tools in any format
 * @param {string} providerName - Provider name (anthropic, openai, deepseek, polza, kodacode)
 * @returns {Array} Tools in correct format for provider
 */
export function convertToolsForProvider(tools, providerName) {
  if (!tools || tools.length === 0) {
    return null;
  }

  const provider = providerName.toLowerCase();
  const currentFormat = detectToolFormat(tools);

  // OpenAI-compatible providers: openai, deepseek, polza, kodacode
  const openaiCompatibleProviders = ['openai', 'deepseek', 'polza', 'kodacode'];

  if (openaiCompatibleProviders.includes(provider)) {
    // Need OpenAI format
    if (currentFormat === 'anthropic') {
      return convertAnthropicToOpenAI(tools);
    }
    return tools; // Already in OpenAI format or unknown
  }

  if (provider === 'anthropic') {
    // Need Anthropic format
    if (currentFormat === 'openai') {
      return convertOpenAIToAnthropic(tools);
    }
    return tools; // Already in Anthropic format or unknown
  }

  // Unknown provider, return as-is
  return tools;
}
