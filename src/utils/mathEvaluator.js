/**
 * Safe mathematical expression evaluator
 * Replaces unsafe eval() calls with a controlled parser
 * Supports basic arithmetic operations: +, -, *, /, (, )
 */

/**
 * Tokenize a mathematical expression
 * @param {string} expr - The expression to tokenize
 * @returns {Array} Array of tokens
 */
function tokenize(expr) {
  const tokens = []
  let current = ''

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i]

    if (char === ' ') {
      continue
    }

    if ('+-*/()'.includes(char)) {
      if (current) {
        tokens.push(parseFloat(current))
        current = ''
      }
      tokens.push(char)
    } else if (char >= '0' && char <= '9' || char === '.') {
      current += char
    } else {
      throw new Error(`Invalid character in expression: ${char}`)
    }
  }

  if (current) {
    tokens.push(parseFloat(current))
  }

  return tokens
}

/**
 * Evaluate a mathematical expression safely
 * Uses the Shunting Yard algorithm to convert infix to postfix
 * Then evaluates the postfix expression
 *
 * @param {string} expression - Mathematical expression to evaluate
 * @returns {number} Result of the evaluation
 * @throws {Error} If the expression is invalid
 */
export function evaluateMathExpression(expression) {
  if (!expression || typeof expression !== 'string') {
    throw new Error('Invalid expression')
  }

  // Replace common symbols
  let expr = expression.trim()
  expr = expr.replace(/÷/g, '/')
  expr = expr.replace(/×/g, '*')

  // Tokenize the expression
  const tokens = tokenize(expr)

  // Convert to postfix notation using Shunting Yard algorithm
  const outputQueue = []
  const operatorStack = []

  const precedence = {
    '+': 1,
    '-': 1,
    '*': 2,
    '/': 2
  }

  for (const token of tokens) {
    if (typeof token === 'number') {
      outputQueue.push(token)
    } else if (token === '(') {
      operatorStack.push(token)
    } else if (token === ')') {
      while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
        outputQueue.push(operatorStack.pop())
      }
      if (operatorStack.length === 0) {
        throw new Error('Mismatched parentheses')
      }
      operatorStack.pop() // Remove the '('
    } else if ('+-*/'.includes(token)) {
      while (
        operatorStack.length > 0 &&
        operatorStack[operatorStack.length - 1] !== '(' &&
        precedence[operatorStack[operatorStack.length - 1]] >= precedence[token]
      ) {
        outputQueue.push(operatorStack.pop())
      }
      operatorStack.push(token)
    }
  }

  while (operatorStack.length > 0) {
    const op = operatorStack.pop()
    if (op === '(' || op === ')') {
      throw new Error('Mismatched parentheses')
    }
    outputQueue.push(op)
  }

  // Evaluate the postfix expression
  const evaluationStack = []

  for (const token of outputQueue) {
    if (typeof token === 'number') {
      evaluationStack.push(token)
    } else {
      if (evaluationStack.length < 2) {
        throw new Error('Invalid expression')
      }
      const b = evaluationStack.pop()
      const a = evaluationStack.pop()

      switch (token) {
        case '+':
          evaluationStack.push(a + b)
          break
        case '-':
          evaluationStack.push(a - b)
          break
        case '*':
          evaluationStack.push(a * b)
          break
        case '/':
          if (b === 0) {
            throw new Error('Division by zero')
          }
          evaluationStack.push(a / b)
          break
        default:
          throw new Error(`Unknown operator: ${token}`)
      }
    }
  }

  if (evaluationStack.length !== 1) {
    throw new Error('Invalid expression')
  }

  return evaluationStack[0]
}

/**
 * Safe wrapper that returns null on error instead of throwing
 * @param {string} expression - Mathematical expression to evaluate
 * @returns {number|null} Result or null if invalid
 */
export function safeEvaluate(expression) {
  try {
    return evaluateMathExpression(expression)
  } catch (e) {
    console.error('Math evaluation error:', e.message)
    return null
  }
}
