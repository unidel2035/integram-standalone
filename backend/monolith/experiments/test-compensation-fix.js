/**
 * Test script to verify the security fix for CompensationService
 * This script tests that:
 * 1. The new expr-eval implementation works for legitimate expressions
 * 2. Code injection attacks are prevented
 */

import { CompensationService } from '../src/services/process/CompensationService.js'

console.log('🧪 Testing CompensationService security fix...\n')

// Create a minimal CompensationService instance
const service = new CompensationService({})

// Test 1: Simple arithmetic (should work)
console.log('Test 1: Simple arithmetic')
const result1 = service.evaluateExpression('2 + 2', {})
console.log(`  Expression: '2 + 2'`)
console.log(`  Result: ${result1}`)
console.log(`  ✓ Expected: 4, Got: ${result1}, Status: ${result1 === 4 ? 'PASS' : 'FAIL'}\n`)

// Test 2: Context variable access (should work)
console.log('Test 2: Context variable access')
const context = { result: { amount: 1000 } }
const result2 = service.evaluateExpression('result.amount * 2', context)
console.log(`  Expression: 'result.amount * 2'`)
console.log(`  Context: ${JSON.stringify(context)}`)
console.log(`  Result: ${result2}`)
console.log(`  ✓ Expected: 2000, Got: ${result2}, Status: ${result2 === 2000 ? 'PASS' : 'FAIL'}\n`)

// Test 3: Invalid syntax (should return undefined and log error)
console.log('Test 3: Invalid syntax handling')
const result3 = service.evaluateExpression('invalid syntax!!!', {})
console.log(`  Expression: 'invalid syntax!!!'`)
console.log(`  Result: ${result3}`)
console.log(`  ✓ Expected: undefined, Got: ${result3}, Status: ${result3 === undefined ? 'PASS' : 'FAIL'}\n`)

// Test 4: Code injection attempt - process.env (should fail safely)
console.log('Test 4: 🔒 Security test - process.env access attempt')
const result4 = service.evaluateExpression('process.env.NODE_ENV', {})
console.log(`  Expression: 'process.env.NODE_ENV'`)
console.log(`  Result: ${result4}`)
console.log(`  ✓ Expected: undefined (blocked), Got: ${result4}, Status: ${result4 === undefined ? 'PASS - SECURE ✓' : 'FAIL - VULNERABLE ✗'}\n`)

// Test 5: Code injection attempt - require (should fail safely)
console.log('Test 5: 🔒 Security test - require() attempt')
const result5 = service.evaluateExpression("require('child_process')", {})
console.log(`  Expression: "require('child_process')"`)
console.log(`  Result: ${result5}`)
console.log(`  ✓ Expected: undefined (blocked), Got: ${result5}, Status: ${result5 === undefined ? 'PASS - SECURE ✓' : 'FAIL - VULNERABLE ✗'}\n`)

// Test 6: Code injection attempt - function constructor (should fail safely)
console.log('Test 6: 🔒 Security test - Function constructor attempt')
const result6 = service.evaluateExpression("Function('return process.env')()", {})
console.log(`  Expression: "Function('return process.env')()"`)
console.log(`  Result: ${result6}`)
console.log(`  ✓ Expected: undefined (blocked), Got: ${result6}, Status: ${result6 === undefined ? 'PASS - SECURE ✓' : 'FAIL - VULNERABLE ✗'}\n`)

// Test 7: Legitimate complex expression (should work)
console.log('Test 7: Complex legitimate expression')
const context7 = { x: 10, y: 20 }
const result7 = service.evaluateExpression('(x + y) * 2', context7)
console.log(`  Expression: '(x + y) * 2'`)
console.log(`  Context: ${JSON.stringify(context7)}`)
console.log(`  Result: ${result7}`)
console.log(`  ✓ Expected: 60, Got: ${result7}, Status: ${result7 === 60 ? 'PASS' : 'FAIL'}\n`)

// Summary
console.log('=' .repeat(60))
console.log('📊 Test Summary:')
const tests = [
  result1 === 4,
  result2 === 2000,
  result3 === undefined,
  result4 === undefined, // Security: should block process.env
  result5 === undefined, // Security: should block require
  result6 === undefined, // Security: should block Function
  result7 === 60
]

const passed = tests.filter(t => t).length
const total = tests.length
console.log(`  Total tests: ${total}`)
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${total - passed}`)
console.log(`  Status: ${passed === total ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`)
console.log('=' .repeat(60))

// Exit with appropriate code
process.exit(passed === total ? 0 : 1)
