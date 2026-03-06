/**
 * Rate Limit Handler for Frontend
 * Issue #77: Handle 429 responses with exponential backoff
 *
 * Provides utilities for:
 * - Detecting rate limit errors
 * - Exponential backoff retry logic
 * - User feedback for rate limits
 * - Request queueing
 */

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt, baseDelay = 1000, maxDelay = 30000) {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * delay;
  return delay + jitter;
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error) {
  if (!error) return false;

  // Check HTTP status code
  if (error.response && error.response.status === 429) {
    return true;
  }

  // Check error code
  if (error.code === 'RATE_LIMIT_EXCEEDED' || error.code === 'TOO_MANY_REQUESTS') {
    return true;
  }

  // Check error message
  const message = error.message || error.error || '';
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('слишком много запросов')
  ) {
    return true;
  }

  return false;
}

/**
 * Extract retry-after value from error response
 */
export function getRetryAfter(error) {
  if (!error || !error.response) return null;

  // Check Retry-After header
  const retryAfterHeader = error.response.headers?.['retry-after'];
  if (retryAfterHeader) {
    const retryAfter = parseInt(retryAfterHeader);
    if (!isNaN(retryAfter)) {
      return retryAfter * 1000; // Convert seconds to milliseconds
    }
  }

  // Check response data
  if (error.response.data && error.response.data.retryAfter) {
    return error.response.data.retryAfter * 1000;
  }

  return null;
}

/**
 * Retry a request with exponential backoff
 */
export async function retryWithBackoff(requestFn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    onRetry = null,
    shouldRetry = isRateLimitError,
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (!shouldRetry(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay
      let delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);

      // Use Retry-After header if available
      const retryAfter = getRetryAfter(error);
      if (retryAfter) {
        delay = retryAfter;
      }

      // Callback for retry event
      if (onRetry) {
        onRetry(attempt + 1, delay, error);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Create a rate-limited axios instance
 */
export function createRateLimitedClient(axiosInstance) {
  // Intercept responses to handle rate limits
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (isRateLimitError(error)) {
        const retryAfter = getRetryAfter(error);

        // Add rate limit info to error
        error.isRateLimit = true;
        error.retryAfter = retryAfter;

        // Show user notification
        if (window.showRateLimitNotification) {
          window.showRateLimitNotification(retryAfter);
        }
      }

      return Promise.reject(error);
    }
  );

  return axiosInstance;
}

/**
 * Request queue for managing concurrent requests
 */
export class RequestQueue {
  constructor(maxConcurrent = 5, minInterval = 100) {
    this.maxConcurrent = maxConcurrent;
    this.minInterval = minInterval;
    this.queue = [];
    this.running = 0;
    this.lastRequestTime = 0;
  }

  async add(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Ensure minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minInterval) {
      await sleep(this.minInterval - timeSinceLastRequest);
    }

    const { requestFn, resolve, reject } = this.queue.shift();
    this.running++;
    this.lastRequestTime = Date.now();

    try {
      const result = await requestFn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }

  clear() {
    this.queue = [];
  }

  get length() {
    return this.queue.length;
  }
}

/**
 * Global request queue instance
 */
export const globalRequestQueue = new RequestQueue();

/**
 * Wrapper for fetch with rate limit handling
 */
export async function fetchWithRateLimit(url, options = {}, retryOptions = {}) {
  const requestFn = () => fetch(url, options).then(async (response) => {
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after') || response.headers.get('Retry-After');
      const error = new Error('Too many requests');
      error.response = {
        status: 429,
        headers: { 'retry-after': retryAfter },
        data: await response.json().catch(() => ({})),
      };
      throw error;
    }

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return response;
  });

  return retryWithBackoff(requestFn, retryOptions);
}

/**
 * Show rate limit notification to user
 */
export function showRateLimitNotification(retryAfter) {
  const seconds = retryAfter ? Math.ceil(retryAfter / 1000) : 60;

  const message =
    seconds < 60
      ? `Слишком много запросов. Повторите через ${seconds} сек.`
      : `Слишком много запросов. Повторите через ${Math.ceil(seconds / 60)} мин.`;

  // Try to use application's notification system
  if (window.$toast) {
    window.$toast.add({
      severity: 'warn',
      summary: 'Превышен лимит запросов',
      detail: message,
      life: 5000,
    });
  } else if (window.showNotification) {
    window.showNotification('warning', message);
  } else {
    console.warn(message);
  }
}

// Register global notification handler
if (typeof window !== 'undefined') {
  window.showRateLimitNotification = showRateLimitNotification;
}

export default {
  isRateLimitError,
  getRetryAfter,
  retryWithBackoff,
  createRateLimitedClient,
  RequestQueue,
  globalRequestQueue,
  fetchWithRateLimit,
  showRateLimitNotification,
};
