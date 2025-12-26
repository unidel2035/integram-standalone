#!/usr/bin/env node
/**
 * Test script for Issue #53: EventEmitter memory leak cleanup
 *
 * This script verifies that TaskQueue and AgentRegistry properly clean up
 * EventEmitter listeners during shutdown to prevent memory leaks.
 */

import { TaskQueue, TaskPriority } from '../backend/monolith/src/core/TaskQueue.js';
import { AgentRegistry, AgentCapabilities } from '../backend/monolith/src/core/AgentRegistry.js';

console.log('='.repeat(70));
console.log('Testing EventEmitter Cleanup in TaskQueue and AgentRegistry');
console.log('='.repeat(70));

/**
 * Test TaskQueue shutdown
 */
async function testTaskQueueShutdown() {
  console.log('\n📋 Testing TaskQueue...');

  const taskQueue = new TaskQueue({
    maxRetries: 3,
    taskTimeout: 300000,
    cleanupInterval: 60000
  });

  // Add some test listeners
  taskQueue.on('task:created', () => {});
  taskQueue.on('task:completed', () => {});
  taskQueue.on('task:failed', () => {});

  // Create some test tasks
  taskQueue.createTask({
    type: 'test_task_1',
    priority: TaskPriority.HIGH,
    payload: { data: 'test' }
  });

  taskQueue.createTask({
    type: 'test_task_2',
    priority: TaskPriority.NORMAL,
    payload: { data: 'test' }
  });

  // Check state before shutdown
  const listenerCount = taskQueue.listenerCount('task:created') +
                        taskQueue.listenerCount('task:completed') +
                        taskQueue.listenerCount('task:failed');

  const tasksBefore = taskQueue.tasks.size();
  console.log(`   Before shutdown:`);
  console.log(`   - Event listeners: ${listenerCount}`);
  console.log(`   - Tasks in queue: ${tasksBefore}`);
  console.log(`   - Cleanup timer: ${taskQueue.cleanupTimer ? 'RUNNING' : 'STOPPED'}`);

  // Shutdown
  console.log('\n   Calling shutdown()...');
  taskQueue.shutdown();

  // Check state after shutdown
  const listenersAfter = taskQueue.listenerCount('task:created') +
                         taskQueue.listenerCount('task:completed') +
                         taskQueue.listenerCount('task:failed');
  const tasksAfter = taskQueue.tasks.size();

  console.log(`   After shutdown:`);
  console.log(`   - Event listeners: ${listenersAfter}`);
  console.log(`   - Tasks in queue: ${tasksAfter}`);
  console.log(`   - Cleanup timer: ${taskQueue.cleanupTimer ? 'RUNNING' : 'STOPPED'}`);

  // Verify cleanup
  if (listenersAfter === 0 && tasksAfter === 0 && !taskQueue.cleanupTimer) {
    console.log('   ✅ TaskQueue cleanup: PASSED');
    return true;
  } else {
    console.log('   ❌ TaskQueue cleanup: FAILED');
    if (listenersAfter > 0) console.log(`      - Event listeners not removed (${listenersAfter} remaining)`);
    if (tasksAfter > 0) console.log(`      - Tasks not cleared (${tasksAfter} remaining)`);
    if (taskQueue.cleanupTimer) console.log('      - Cleanup timer still running');
    return false;
  }
}

/**
 * Test AgentRegistry shutdown
 */
async function testAgentRegistryShutdown() {
  console.log('\n👥 Testing AgentRegistry...');

  const agentRegistry = new AgentRegistry({
    heartbeatInterval: 30000,
    heartbeatTimeout: 90000,
    cleanupInterval: 60000
  });

  // Add some test listeners
  agentRegistry.on('agent:registered', () => {});
  agentRegistry.on('agent:unregistered', () => {});
  agentRegistry.on('agent:offline', () => {});

  // Register some test agents
  agentRegistry.registerAgent({
    name: 'Test Agent 1',
    capabilities: [AgentCapabilities.GENERIC]
  });

  agentRegistry.registerAgent({
    name: 'Test Agent 2',
    capabilities: [AgentCapabilities.DATA_PROCESSOR]
  });

  // Check state before shutdown
  const listenerCount = agentRegistry.listenerCount('agent:registered') +
                        agentRegistry.listenerCount('agent:unregistered') +
                        agentRegistry.listenerCount('agent:offline');

  const agentsBefore = agentRegistry.agents.size();
  const timersBefore = agentRegistry.heartbeatTimers.size;

  console.log(`   Before shutdown:`);
  console.log(`   - Event listeners: ${listenerCount}`);
  console.log(`   - Registered agents: ${agentsBefore}`);
  console.log(`   - Heartbeat timers: ${timersBefore}`);
  console.log(`   - Cleanup timer: ${agentRegistry.cleanupTimer ? 'RUNNING' : 'STOPPED'}`);

  // Shutdown
  console.log('\n   Calling shutdown()...');
  agentRegistry.shutdown();

  // Check state after shutdown
  const listenersAfter = agentRegistry.listenerCount('agent:registered') +
                         agentRegistry.listenerCount('agent:unregistered') +
                         agentRegistry.listenerCount('agent:offline');

  const agentsAfter = agentRegistry.agents.size();
  const timersAfter = agentRegistry.heartbeatTimers.size;

  console.log(`   After shutdown:`);
  console.log(`   - Event listeners: ${listenersAfter}`);
  console.log(`   - Registered agents: ${agentsAfter}`);
  console.log(`   - Heartbeat timers: ${timersAfter}`);
  console.log(`   - Cleanup timer: ${agentRegistry.cleanupTimer ? 'RUNNING' : 'STOPPED'}`);

  // Verify cleanup
  if (listenersAfter === 0 &&
      agentsAfter === 0 &&
      timersAfter === 0 &&
      !agentRegistry.cleanupTimer) {
    console.log('   ✅ AgentRegistry cleanup: PASSED');
    return true;
  } else {
    console.log('   ❌ AgentRegistry cleanup: FAILED');
    if (listenersAfter > 0) console.log(`      - Event listeners not removed (${listenersAfter} remaining)`);
    if (agentsAfter > 0) console.log(`      - Agents not cleared (${agentsAfter} remaining)`);
    if (timersAfter > 0) console.log(`      - Heartbeat timers not cleared (${timersAfter} remaining)`);
    if (agentRegistry.cleanupTimer) console.log('      - Cleanup timer still running');
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    const taskQueuePassed = await testTaskQueueShutdown();
    const agentRegistryPassed = await testAgentRegistryShutdown();

    console.log('\n' + '='.repeat(70));
    console.log('Test Results:');
    console.log('='.repeat(70));
    console.log(`TaskQueue shutdown:      ${taskQueuePassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`AgentRegistry shutdown:  ${agentRegistryPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('='.repeat(70));

    if (taskQueuePassed && agentRegistryPassed) {
      console.log('\n✅ All tests PASSED - Memory leak fixes are working correctly!\n');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests FAILED - Memory leak fixes need attention!\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests();
