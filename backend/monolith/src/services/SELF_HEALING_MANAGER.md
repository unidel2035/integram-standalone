# SelfHealingManager

## Overview

The `SelfHealingManager` is a critical component of the multi-agent organism that provides automatic agent failure detection and recovery. It ensures system resilience by automatically restarting failed agents, finding fallback agents, and enabling graceful degradation when necessary.

**Issue**: [#2706](https://github.com/unidel2035/dronedoc2025/issues/2706) - Phase 3.1: Self-Healing Manager

**Reference**: `/docs/MULTI_AGENT_ORGANISM_AUDIT.md` - sections 2.5, 4.3

## Features

- **Automatic Agent Restart**: Detects agent failures and automatically attempts to restart them
- **Exponential Backoff**: Implements exponential backoff strategy for restart attempts (5s, 10s, 20s, 40s, 80s)
- **Circuit Breaking**: Limits restart attempts to prevent infinite loops (default: 5 attempts in 5-minute window)
- **Fallback Discovery**: Finds alternative agents with same capabilities when primary agent fails
- **Graceful Degradation**: Disables non-critical features when no fallback is available
- **Critical Failure Notifications**: Sends alerts when agents fail permanently
- **Restart History Tracking**: Maintains history of all restart attempts for monitoring and analytics
- **Event-Driven Architecture**: Emits events for external integrations

## Installation

```javascript
import { SelfHealingManager } from './services/SelfHealingManager.js'
import { MultiAgentOrchestrator } from './services/MultiAgentOrchestrator.js'
import { AgentDiscoveryService } from './services/AgentDiscoveryService.js'

// Create dependencies
const orchestrator = new MultiAgentOrchestrator({ /* options */ })
const discoveryService = new AgentDiscoveryService({ /* options */ })
const notificationHub = { /* notification service */ }

// Create self-healing manager
const selfHealingManager = new SelfHealingManager({
  orchestrator,
  discoveryService,
  notificationHub,
  maxRestartAttempts: 5,
  baseRestartDelay: 5000 // 5 seconds
})

// Register integrations
selfHealingManager.registerOrchestratorIntegration()
selfHealingManager.registerAgentRegistryIntegration(agentRegistry)
```

## Configuration

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `orchestrator` | MultiAgentOrchestrator | required | Orchestrator instance for agent lifecycle management |
| `discoveryService` | AgentDiscoveryService | required | Discovery service for finding fallback agents |
| `notificationHub` | Object | optional | Service for sending critical alerts |
| `maxRestartAttempts` | number | 5 | Maximum restart attempts in 5-minute window |
| `baseRestartDelay` | number | 5000 | Base delay in milliseconds for exponential backoff |

### Agent Manifest Configuration

Add self-healing configuration to agent manifests:

```yaml
# agent-manifest.yml
agent:
  id: data-processor
  name: Data Processor Agent
  criticality: critical # critical | high | medium | low

  # Self-healing configuration
  selfHealing:
    enabled: true
    maxRestartAttempts: 5 # Override global setting
    baseRestartDelay: 10000 # Override global setting (10 seconds)

  provides:
    capabilities:
      - data-processing
      - data-transformation
```

## API Reference

### Methods

#### `handleAgentFailure(agentId, error)`

Handles agent failure and initiates recovery process.

**Parameters:**
- `agentId` (string): ID of the failed agent
- `error` (Error): Error that caused the failure

**Returns:** `Promise<void>`

**Example:**
```javascript
await selfHealingManager.handleAgentFailure('agent-1', new Error('Connection lost'))
```

#### `restartAgent(agentId)`

Restarts a specific agent.

**Parameters:**
- `agentId` (string): ID of the agent to restart

**Returns:** `Promise<boolean>` - true if restart successful

**Example:**
```javascript
const success = await selfHealingManager.restartAgent('agent-1')
if (success) {
  console.log('Agent restarted successfully')
}
```

#### `findFallback(capability)`

Finds a fallback agent with the specified capability.

**Parameters:**
- `capability` (string): Required capability

**Returns:** `Promise<Object|null>` - Fallback agent or null if not found

**Example:**
```javascript
const fallback = await selfHealingManager.findFallback('data-processing')
if (fallback) {
  console.log(`Found fallback: ${fallback.name}`)
}
```

#### `enableGracefulDegradation(feature)`

Enables graceful degradation for a feature.

**Parameters:**
- `feature` (string): Feature/agent to degrade

**Returns:** `Promise<void>`

**Example:**
```javascript
await selfHealingManager.enableGracefulDegradation('recommendation-engine')
```

#### `handleCriticalFailure(agentId, error)`

Handles critical failure (max retries exceeded).

**Parameters:**
- `agentId` (string): ID of the failed agent
- `error` (Error): Error that caused the failure

**Returns:** `Promise<void>`

#### `calculateBackoff(attempts, baseDelay)`

Calculates exponential backoff delay.

**Parameters:**
- `attempts` (number): Number of restart attempts
- `baseDelay` (number): Base delay in milliseconds

**Returns:** `number` - Backoff delay in milliseconds

**Example:**
```javascript
const delay = selfHealingManager.calculateBackoff(2, 5000) // Returns 20000 (20s)
```

#### `getRestartAttempts(agentId)`

Gets recent restart attempts for an agent.

**Parameters:**
- `agentId` (string): Agent ID

**Returns:** `number` - Number of restart attempts in last 5 minutes

#### `getRestartHistory(agentId)`

Gets full restart history for an agent.

**Parameters:**
- `agentId` (string): Agent ID

**Returns:** `Array<number>` - Array of restart timestamps

#### `getAllRestartHistory()`

Gets restart history for all agents.

**Returns:** `Array<Object>` - Array of restart history objects

**Example:**
```javascript
const history = selfHealingManager.getAllRestartHistory()
console.log(history)
// [
//   {
//     agentId: 'agent-1',
//     totalRestarts: 3,
//     lastRestartAt: Date,
//     recentRestarts: 2,
//     timestamps: [...]
//   }
// ]
```

#### `getStats()`

Gets self-healing statistics.

**Returns:** `Object` - Statistics object

**Example:**
```javascript
const stats = selfHealingManager.getStats()
console.log(stats)
// {
//   totalAgentsWithHistory: 5,
//   totalRestarts: 12,
//   maxRestartAttempts: 5,
//   baseRestartDelay: 5000,
//   activeRestartTimers: 2,
//   restartHistory: [...]
// }
```

#### `registerOrchestratorIntegration()`

Registers event listeners with orchestrator.

**Returns:** `void`

#### `registerAgentRegistryIntegration(agentRegistry)`

Registers event listeners with agent registry.

**Parameters:**
- `agentRegistry` (AgentRegistry): Agent registry instance

**Returns:** `void`

#### `shutdown()`

Shuts down the self-healing manager and clears all resources.

**Returns:** `void`

### Events

The `SelfHealingManager` extends `EventEmitter` and emits the following events:

#### `agent:restarted`

Emitted when an agent is successfully restarted.

**Payload:**
```javascript
{ agentId: 'agent-1' }
```

**Example:**
```javascript
selfHealingManager.on('agent:restarted', ({ agentId }) => {
  console.log(`Agent ${agentId} restarted successfully`)
})
```

#### `agent:restart-failed`

Emitted when an agent restart fails.

**Payload:**
```javascript
{ agentId: 'agent-1', error: Error }
```

#### `agent:critical-failure`

Emitted when an agent fails permanently (max retries exceeded).

**Payload:**
```javascript
{ agentId: 'agent-1', error: Error, manifest: Object }
```

#### `graceful-degradation:enabled`

Emitted when graceful degradation is enabled for a feature.

**Payload:**
```javascript
{ feature: 'agent-1' }
```

## Usage Examples

### Basic Setup

```javascript
import { SelfHealingManager } from './services/SelfHealingManager.js'

const selfHealingManager = new SelfHealingManager({
  orchestrator,
  discoveryService,
  notificationHub
})

// Register integrations
selfHealingManager.registerOrchestratorIntegration()
selfHealingManager.registerAgentRegistryIntegration(agentRegistry)

// Listen to events
selfHealingManager.on('agent:restarted', ({ agentId }) => {
  console.log(`✅ Agent ${agentId} recovered`)
})

selfHealingManager.on('agent:critical-failure', ({ agentId, error }) => {
  console.error(`🚨 CRITICAL: Agent ${agentId} failed permanently:`, error.message)
})
```

### Manual Agent Restart

```javascript
// Manually trigger agent restart
try {
  const success = await selfHealingManager.restartAgent('my-agent')
  if (success) {
    console.log('Agent restarted successfully')
  }
} catch (error) {
  console.error('Failed to restart agent:', error)
}
```

### Finding Fallback Agents

```javascript
// Find fallback agent when primary fails
const primaryAgent = 'data-processor-1'
const capability = 'data-processing'

const fallback = await selfHealingManager.findFallback(capability)

if (fallback) {
  console.log(`Switching to fallback: ${fallback.name}`)
  // Redirect traffic to fallback agent
} else {
  console.warn('No fallback available - enabling graceful degradation')
  await selfHealingManager.enableGracefulDegradation(primaryAgent)
}
```

### Monitoring Restart History

```javascript
// Get statistics
const stats = selfHealingManager.getStats()
console.log(`Total agents with failures: ${stats.totalAgentsWithHistory}`)
console.log(`Total restart attempts: ${stats.totalRestarts}`)

// Get detailed history
const history = selfHealingManager.getAllRestartHistory()
history.forEach(entry => {
  console.log(`Agent ${entry.agentId}:`)
  console.log(`  - Total restarts: ${entry.totalRestarts}`)
  console.log(`  - Recent restarts: ${entry.recentRestarts}`)
  console.log(`  - Last restart: ${entry.lastRestartAt}`)
})
```

### Custom Notification Handling

```javascript
const notificationHub = {
  async sendCriticalAlert(alert) {
    // Send to Slack, PagerDuty, email, etc.
    await sendSlackNotification({
      channel: '#alerts',
      text: `🚨 CRITICAL AGENT FAILURE: ${alert.agentName}`,
      attachments: [{
        color: 'danger',
        fields: [
          { title: 'Agent ID', value: alert.agentId },
          { title: 'Error', value: alert.error },
          { title: 'Criticality', value: alert.criticality }
        ]
      }]
    })
  }
}

const selfHealingManager = new SelfHealingManager({
  orchestrator,
  discoveryService,
  notificationHub
})
```

## Exponential Backoff Strategy

The self-healing manager uses exponential backoff to avoid overwhelming the system with rapid restart attempts:

| Attempt | Delay | Formula |
|---------|-------|---------|
| 1 | 5 seconds | 5000 × 2^0 |
| 2 | 10 seconds | 5000 × 2^1 |
| 3 | 20 seconds | 5000 × 2^2 |
| 4 | 40 seconds | 5000 × 2^3 |
| 5 | 80 seconds | 5000 × 2^4 |

After 5 attempts within a 5-minute window, the agent is considered critically failed.

## Integration with Other Services

### With MultiAgentOrchestrator

The orchestrator emits `agent:failed` events that the self-healing manager listens to:

```javascript
orchestrator.on('agent:failed', async ({ agentId, error }) => {
  // Automatically handled by self-healing manager
})
```

### With AgentDiscoveryService

Used to find fallback agents with required capabilities:

```javascript
const fallbackAgents = discoveryService.discover('data-processing')
```

### With Notification Services

Sends critical alerts when agents fail permanently:

```javascript
await notificationHub.sendCriticalAlert({
  title: 'Critical Agent Failure',
  message: 'Agent could not be restarted',
  agentId,
  error: error.message
})
```

## Best Practices

1. **Configure Criticality Levels**: Set appropriate criticality levels in agent manifests
   - `critical`: System cannot function without this agent
   - `high`: Important but fallbacks may exist
   - `medium`: Standard agents
   - `low`: Nice-to-have features

2. **Monitor Restart History**: Regularly check restart statistics to identify problematic agents

3. **Set Appropriate Retry Limits**: Adjust `maxRestartAttempts` based on agent startup time and criticality

4. **Register Multiple Fallback Agents**: Ensure high-availability by registering multiple agents with same capabilities

5. **Test Graceful Degradation**: Verify that non-critical features can be disabled without affecting core functionality

6. **Implement Proper Notifications**: Connect to alerting systems for critical failures

7. **Use Structured Logging**: Log all restart attempts with context for debugging

## Testing

### Unit Tests

```bash
npm run test backend/monolith/src/services/__tests__/SelfHealingManager.spec.js
```

### Integration Tests

```bash
npm run test backend/monolith/src/services/__tests__/SelfHealingManager.integration.spec.js
```

### Manual Testing

```javascript
// Simulate agent failure
orchestrator.emit('agent:failed', {
  agentId: 'test-agent',
  error: new Error('Simulated failure')
})

// Check if restart was scheduled
console.log(selfHealingManager.restartTimers.has('test-agent')) // true

// Wait for restart
await new Promise(resolve => setTimeout(resolve, 6000))

// Check restart history
const history = selfHealingManager.getRestartHistory('test-agent')
console.log(`Restart attempts: ${history.length}`)
```

## Troubleshooting

### Agent Not Restarting

**Problem**: Agent fails but self-healing doesn't restart it.

**Solutions**:
1. Check if self-healing is enabled in agent manifest: `selfHealing.enabled: true`
2. Verify orchestrator integration is registered
3. Check restart history: `getRestartHistory(agentId)`
4. Ensure max attempts not exceeded

### Too Many Restarts

**Problem**: Agent keeps restarting rapidly.

**Solutions**:
1. Increase `baseRestartDelay` for longer backoff
2. Reduce `maxRestartAttempts` to fail faster
3. Check agent logs for root cause of failures
4. Verify dependencies are available

### Fallback Not Found

**Problem**: No fallback agent found when primary fails.

**Solutions**:
1. Register multiple agents with same capability
2. Check agent status in discovery service
3. Verify capability names match exactly
4. Ensure fallback agents are healthy (status: 'active')

### Critical Notifications Not Sent

**Problem**: Critical failure notifications not received.

**Solutions**:
1. Verify `notificationHub` is configured
2. Check notification service credentials
3. Test notification service independently
4. Review logs for notification errors

## Performance Considerations

- **Memory Usage**: Restart history is kept in memory. Consider clearing old history periodically.
- **Timer Management**: Each scheduled restart uses a timer. Limits prevent timer exhaustion.
- **Event Listeners**: Properly shutdown manager to remove event listeners.
- **Concurrent Restarts**: Restarts are sequential per agent to avoid conflicts.

## Security Considerations

- **Access Control**: Only authorized services should trigger manual restarts
- **Notification Content**: Avoid including sensitive data in notifications
- **Resource Limits**: Prevent DoS by limiting restart attempts
- **Audit Logging**: Log all restart attempts for security audits

## Future Enhancements

- [ ] Add configurable restart strategies (immediate, delayed, scheduled)
- [ ] Implement health check before marking restart as successful
- [ ] Add support for gradual rollback (canary deployments)
- [ ] Integrate with metrics for predictive failure detection
- [ ] Add support for custom recovery policies per agent
- [ ] Implement distributed coordination for multi-instance setups

## Related Documentation

- [Multi-Agent Organism Audit](/docs/MULTI_AGENT_ORGANISM_AUDIT.md)
- [MultiAgentOrchestrator](./MULTI_AGENT_ORCHESTRATOR.md)
- [AgentDiscoveryService](./AGENT_DISCOVERY_SERVICE.md)
- [Issue #2706](https://github.com/unidel2035/dronedoc2025/issues/2706)

## License

Copyright © 2025 DronDoc Team. All rights reserved.
