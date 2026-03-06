/**
 * Agent Data Mapper
 *
 * Converts Visual Agent Builder data structures to Integram database API format.
 * Handles all 4 creation modes: Form, Canvas, AI Prompt, Code.
 */

/**
 * Emoji to text icon mapping for database compatibility
 * Integram DB doesn't support UTF-8 4-byte characters (emojis)
 */
const EMOJI_TO_TEXT = {
  '🤖': 'robot',
  '🎨': 'art',
  '💼': 'business',
  '📊': 'chart',
  '🔧': 'tool',
  '🧠': 'brain',
  '💡': 'idea',
  '🌤️': 'weather',
  '⚡': 'bolt',
  '🔍': 'search',
  '📝': 'note',
  '🎯': 'target',
  '🚀': 'rocket',
  '💬': 'chat',
  '📈': 'growth',
  '🛠️': 'tools',
  '🎮': 'game',
  '📚': 'book',
  '🔒': 'lock',
  '✅': 'check',
  '❌': 'cross',
  '⭐': 'star',
  '🏠': 'home',
  '👤': 'user',
  '👥': 'users',
  '📅': 'calendar',
  '🔔': 'bell',
  '💰': 'money',
  '🎵': 'music',
  '📷': 'camera',
  '🌐': 'globe',
  '📧': 'email',
  '☁️': 'cloud',
  '🔗': 'link'
};

/**
 * Sanitize icon for database compatibility
 * Converts emojis to text alternatives
 * @param {string} icon - Icon (can be emoji or text)
 * @returns {string} Database-safe icon string
 */
export function sanitizeIcon(icon) {
  if (!icon) return 'robot';

  // Check if it's a known emoji
  if (EMOJI_TO_TEXT[icon]) {
    return EMOJI_TO_TEXT[icon];
  }

  // Check if string contains any emoji (4-byte UTF-8)
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  if (emojiRegex.test(icon)) {
    // Try to find a match in our map
    for (const [emoji, text] of Object.entries(EMOJI_TO_TEXT)) {
      if (icon.includes(emoji)) {
        return text;
      }
    }
    // Default fallback for unknown emojis
    return 'robot';
  }

  // Already a text icon, return as-is
  return icon;
}

/**
 * Generate unique agent ID from name
 * @param {string} name - Agent name
 * @returns {string} Kebab-case ID (e.g., "my-custom-agent")
 */
export function generateAgentId(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Agent name is required to generate ID');
  }

  // Transliterate Cyrillic to Latin
  const cyrillicToLatin = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
    'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };

  const transliterated = name
    .toLowerCase()
    .split('')
    .map(char => cyrillicToLatin[char] || char)
    .join('');

  return transliterated
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters (now safe after transliteration)
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single
    .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
    || `agent-${Date.now()}`;      // Fallback if empty
}

/**
 * Map Visual Agent Builder form data to Agent API format
 * @param {Object} formData - Visual Agent Builder form data
 * @param {string} mode - Creation mode: 'form', 'canvas', 'ai', 'code'
 * @returns {Object} Agent data in API format
 */
export function mapToAgentAPI(formData, mode = 'form') {
  // Validate required fields
  if (!formData.name) {
    throw new Error('Agent name is required');
  }
  if (!formData.description) {
    throw new Error('Agent description is required');
  }

  // Generate ID if not provided
  const id = formData.id || generateAgentId(formData.name);

  // Generate path if not provided
  const path = formData.path || `/agent/${id}`;

  // Parse capabilities
  let capabilities = [];
  if (Array.isArray(formData.capabilities)) {
    capabilities = formData.capabilities;
  } else if (typeof formData.capabilities === 'string') {
    try {
      capabilities = JSON.parse(formData.capabilities);
    } catch (e) {
      capabilities = formData.capabilities.split(',').map(c => c.trim());
    }
  }

  // Parse triggers
  let triggers = [];
  if (Array.isArray(formData.triggers)) {
    triggers = formData.triggers;
  } else if (typeof formData.triggers === 'string') {
    try {
      triggers = JSON.parse(formData.triggers);
    } catch (e) {
      // If triggers is a string like "help, support, info", convert to trigger objects
      const keywords = formData.triggers.split(',').map(t => t.trim()).filter(Boolean);
      if (keywords.length > 0) {
        triggers = [{
          keywords: keywords,
          priority: formData.priority || 5
        }];
      }
    }
  }

  // Parse tags
  let tags = [];
  if (Array.isArray(formData.tags)) {
    tags = formData.tags;
  } else if (typeof formData.tags === 'string') {
    try {
      tags = JSON.parse(formData.tags);
    } catch (e) {
      tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
    }
  }

  // Parse metadata
  let metadata = {};
  if (typeof formData.metadata === 'object' && formData.metadata !== null) {
    metadata = formData.metadata;
  } else if (typeof formData.metadata === 'string') {
    try {
      metadata = JSON.parse(formData.metadata);
    } catch (e) {
      metadata = { raw: formData.metadata };
    }
  }

  // Add mode-specific metadata
  metadata.createdVia = mode;
  metadata.createdAt = new Date().toISOString();

  // Construct API payload
  return {
    id,
    name: formData.name,
    description: formData.description,
    icon: sanitizeIcon(formData.icon || '🤖'),
    category: formData.category || 'other',
    path,
    creator: formData.creator || 'DronDoc User',
    status: formData.status || 'Running',
    tags,
    price: typeof formData.price === 'number' ? formData.price : 0,
    pricingModel: formData.pricingModel || 'free',
    capabilities,
    triggers,
    priority: typeof formData.priority === 'number' ? formData.priority : 5,
    enabled: typeof formData.enabled === 'boolean' ? formData.enabled : true,
    metadata
  };
}

/**
 * Extract agent configuration from canvas components
 * @param {Object} canvas - Canvas data with components and connections
 * @param {string} canvasName - Name of the canvas (used as agent name)
 * @returns {Object} Agent data extracted from canvas
 */
export function extractAgentFromCanvas(canvas, canvasName) {
  if (!canvas || typeof canvas !== 'object') {
    throw new Error('Canvas data is required');
  }
  if (!canvasName) {
    throw new Error('Canvas name is required');
  }

  const components = canvas.components || [];
  const connections = canvas.connections || [];

  // Find base agent component
  const baseAgent = components.find(c => c.type === 'base-agent' || c.type === 'agent');

  // Extract agent properties from base agent component or use defaults
  const agentProps = baseAgent?.data || {};

  // Extract capabilities from components
  const capabilities = [];
  components.forEach(component => {
    if (component.type === 'capability' || component.category === 'capabilities') {
      const capName = component.data?.name || component.label;
      if (capName && !capabilities.includes(capName)) {
        capabilities.push(capName);
      }
    }
  });

  // Extract triggers from components
  const triggers = [];
  components.forEach(component => {
    if (component.type === 'trigger' || component.category === 'triggers') {
      const keywords = component.data?.keywords || [];
      const priority = component.data?.priority || 5;
      if (keywords.length > 0) {
        triggers.push({ keywords, priority });
      }
    }
  });

  // Build agent data
  const agentData = {
    name: agentProps.name || canvasName,
    description: agentProps.description || `Agent created from canvas: ${canvasName}`,
    icon: sanitizeIcon(agentProps.icon || '🎨'),
    category: agentProps.category || 'other',
    creator: agentProps.creator || 'Visual Agent Builder',
    status: agentProps.status || 'Running',
    tags: agentProps.tags || ['canvas', 'visual'],
    price: agentProps.price || 0,
    pricingModel: agentProps.pricingModel || 'free',
    capabilities: capabilities.length > 0 ? capabilities : (agentProps.capabilities || []),
    triggers: triggers.length > 0 ? triggers : (agentProps.triggers || []),
    priority: agentProps.priority || 5,
    enabled: typeof agentProps.enabled === 'boolean' ? agentProps.enabled : true,
    metadata: {
      canvas: {
        components: components.length,
        connections: connections.length,
        viewport: canvas.viewport
      },
      ...agentProps.metadata
    }
  };

  return agentData;
}

/**
 * Validate agent data before sending to API
 * @param {Object} agentData - Agent data to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validateAgentData(agentData) {
  const errors = [];

  // Required fields
  if (!agentData.id || typeof agentData.id !== 'string') {
    errors.push('Agent ID is required and must be a string');
  }
  if (!agentData.name || typeof agentData.name !== 'string') {
    errors.push('Agent name is required and must be a string');
  }
  if (!agentData.description || typeof agentData.description !== 'string') {
    errors.push('Agent description is required and must be a string');
  }
  if (!agentData.path || typeof agentData.path !== 'string') {
    errors.push('Agent path is required and must be a string');
  }

  // Type validations
  if (agentData.icon && typeof agentData.icon !== 'string') {
    errors.push('Agent icon must be a string');
  }
  if (agentData.category && typeof agentData.category !== 'string') {
    errors.push('Agent category must be a string');
  }
  if (agentData.creator && typeof agentData.creator !== 'string') {
    errors.push('Agent creator must be a string');
  }
  if (agentData.status && typeof agentData.status !== 'string') {
    errors.push('Agent status must be a string');
  }
  if (agentData.tags && !Array.isArray(agentData.tags)) {
    errors.push('Agent tags must be an array');
  }
  if (agentData.price !== undefined && typeof agentData.price !== 'number') {
    errors.push('Agent price must be a number');
  }
  if (agentData.pricingModel && typeof agentData.pricingModel !== 'string') {
    errors.push('Agent pricingModel must be a string');
  }
  if (agentData.capabilities && !Array.isArray(agentData.capabilities)) {
    errors.push('Agent capabilities must be an array');
  }
  if (agentData.triggers && !Array.isArray(agentData.triggers)) {
    errors.push('Agent triggers must be an array');
  }
  if (agentData.priority !== undefined && typeof agentData.priority !== 'number') {
    errors.push('Agent priority must be a number');
  }
  if (agentData.enabled !== undefined && typeof agentData.enabled !== 'boolean') {
    errors.push('Agent enabled must be a boolean');
  }
  if (agentData.metadata && typeof agentData.metadata !== 'object') {
    errors.push('Agent metadata must be an object');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  generateAgentId,
  mapToAgentAPI,
  extractAgentFromCanvas,
  validateAgentData,
  sanitizeIcon
};
