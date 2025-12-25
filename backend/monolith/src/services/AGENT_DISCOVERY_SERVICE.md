# AgentDiscoveryService

## Overview

The `AgentDiscoveryService` is a critical component of the multi-agent system that provides automatic agent registration, capability-based discovery, and health monitoring. It implements a Service Discovery pattern allowing agents to automatically register themselves and be discovered by other system components.

**Issue**: #2704 - Phase 2.1
**Location**: `backend/monolith/src/services/AgentDiscoveryService.js`

## Features

### 1. Auto-Registration
- Agents can register themselves on startup
- Automatic ID generation if not provided
- Capability indexing for fast lookups
- Metadata support for additional agent information

### 2. Capability-Based Discovery
- O(1) lookup by capability using indexed data structure
- Agents can have multiple capabilities
- Fast retrieval of all agents with specific capability
- Only returns active agents by default

### 3. Heartbeat Monitoring
- Automatic heartbeat checking every 30 seconds (configurable)
- Auto-deregistration after 90 seconds of inactivity (configurable)
- Status tracking (active/inactive)
- Automatic reactivation on heartbeat receipt

### 4. Event-Driven Architecture
- `agent:registered` - Emitted when agent registers
- `agent:deregistered` - Emitted when agent is removed
- `agent:updated` - Emitted when agent info changes
- `agent:heartbeat` - Emitted on heartbeat update
- `agent:timeout` - Emitted when agent times out
- Subscribe/unsubscribe support for event listeners

### 5. Integration with AgentRegistry
- Optional integration with existing AgentRegistry
- Backward compatible with current agent system
- Adds discovery and auto-registration layer on top

### 6. Memory Optimization
- Uses `BoundedMap` to prevent unbounded memory growth
- Maximum 5000 agents by default (configurable)
- Automatic eviction of oldest entries when limit reached
- References Issue #2157 (memory leak prevention)

## Architecture

```
┌─────────────────────────────────────────────────┐
│         AgentDiscoveryService                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────┐      ┌──────────────────┐   │
│  │  Agents Map   │      │ Capability Index │   │
│  │  (BoundedMap) │      │  Map<capability, │   │
│  │               │      │   Set<agentId>>  │   │
│  └───────────────┘      └──────────────────┘   │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │      Heartbeat Monitoring Timer           │ │
│  │  (checks every 30s, timeout 90s)          │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │         Event Emitter                     │ │
│  │  (agent:registered, deregistered, etc.)   │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## API

### Constructor

```javascript
const discoveryService = new AgentDiscoveryService({
  maxAgents: 5000,           // Maximum agents to store
  heartbeatInterval: 30000,  // Heartbeat check interval (30s)
  heartbeatTimeout: 90000,   // Heartbeat timeout (90s)
  agentRegistry: registry    // Optional: existing AgentRegistry
});
```

### Methods

#### `register(agentInfo)`

Register a new agent with automatic capability indexing.

**Parameters:**
```javascript
{
  id: 'agent-id',              // Optional: auto-generated if not provided
  name: 'Agent Name',          // Required
  capabilities: ['cap1', 'cap2'], // Required: at least one capability
  endpoint: 'http://localhost:8081/api/agents/agent-id', // Required
  healthCheckUrl: '/health',   // Optional: default '/health'
  metadata: {                  // Optional
    version: '1.0.0',
    criticality: 'medium'
  }
}
```

**Returns:**
```javascript
{
  success: true,
  agent: {
    id: 'generated-or-provided-id',
    name: 'Agent Name',
    capabilities: ['cap1', 'cap2'],
    endpoint: 'http://localhost:8081/api/agents/agent-id',
    registeredAt: '2025-11-10T17:00:00.000Z'
  }
}
```

**Example:**
```javascript
const result = await discoveryService.register({
  name: 'DataProcessorAgent',
  capabilities: ['data_processing', 'validation'],
  endpoint: 'http://localhost:8081/api/agents/data-processor',
  metadata: {
    version: '2.1.0',
    maxConcurrentTasks: 10
  }
});

console.log(result.agent.id); // 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
```

#### `deregister(agentId)`

Remove an agent from the registry.

**Parameters:**
- `agentId` (string) - Agent ID to remove

**Returns:**
```javascript
{
  success: true,
  agentId: 'agent-id',
  message: 'Agent deregistered successfully'
}
```

**Example:**
```javascript
await discoveryService.deregister('f47ac10b-58cc-4372-a567-0e02b2c3d479');
```

#### `discover(capability)`

Find all agents with a specific capability.

**Parameters:**
- `capability` (string) - Capability to search for

**Returns:**
Array of agent objects with the capability (active agents only)

**Example:**
```javascript
const agents = discoveryService.discover('data_processing');
// Returns: [
//   { id: 'agent-1', name: 'Agent1', capabilities: ['data_processing', 'validation'], ... },
//   { id: 'agent-2', name: 'Agent2', capabilities: ['data_processing'], ... }
// ]
```

#### `discoverById(agentId)`

Find a specific agent by ID.

**Parameters:**
- `agentId` (string) - Agent ID

**Returns:**
Agent object or `null` if not found

**Example:**
```javascript
const agent = discoveryService.discoverById('f47ac10b-58cc-4372-a567-0e02b2c3d479');
if (agent) {
  console.log(`Found agent: ${agent.name}`);
}
```

#### `getAll(options)`

Get all registered agents.

**Parameters:**
```javascript
{
  status: 'active' // 'active', 'inactive', or 'all' (default: 'active')
}
```

**Returns:**
Array of all agents matching status filter

**Example:**
```javascript
const activeAgents = discoveryService.getAll();
const allAgents = discoveryService.getAll({ status: 'all' });
const inactiveAgents = discoveryService.getAll({ status: 'inactive' });
```

#### `subscribe(callback, eventType)`

Subscribe to discovery events.

**Parameters:**
- `callback` (function) - Event callback
- `eventType` (string, optional) - Specific event type to subscribe to

**Returns:**
Unsubscribe function

**Example:**
```javascript
// Subscribe to all events
const unsubscribe = discoveryService.subscribe((agent) => {
  console.log('Agent event:', agent);
});

// Subscribe to specific event
const unsubscribeRegistered = discoveryService.subscribe(
  (agent) => {
    console.log('New agent registered:', agent.name);
  },
  'agent:registered'
);

// Later: unsubscribe
unsubscribe();
```

#### `updateHeartbeat(agentId)`

Update agent heartbeat timestamp.

**Parameters:**
- `agentId` (string) - Agent ID

**Returns:**
```javascript
{
  success: true,
  agentId: 'agent-id',
  lastHeartbeat: '2025-11-10T17:05:00.000Z'
}
```

**Example:**
```javascript
await discoveryService.updateHeartbeat('agent-id');
```

#### `getStats()`

Get service statistics.

**Returns:**
```javascript
{
  totalAgents: 10,
  activeAgents: 8,
  inactiveAgents: 2,
  capabilities: 5,
  heartbeatInterval: 30000,
  heartbeatTimeout: 90000
}
```

#### `shutdown()`

Cleanly shutdown the service.

**Example:**
```javascript
discoveryService.shutdown();
```

## Events

### `agent:registered`

Emitted when an agent successfully registers.

**Payload:**
```javascript
{
  id: 'agent-id',
  name: 'Agent Name',
  capabilities: ['cap1', 'cap2'],
  endpoint: 'http://...',
  status: 'active',
  registeredAt: Date,
  lastHeartbeat: Date
}
```

### `agent:deregistered`

Emitted when an agent is removed.

**Payload:** Same as `agent:registered`

### `agent:updated`

Emitted when agent information changes (e.g., status change).

**Payload:** Same as `agent:registered`

### `agent:heartbeat`

Emitted when agent heartbeat is updated.

**Payload:** Same as `agent:registered`

### `agent:timeout`

Emitted when agent heartbeat times out.

**Payload:** Same as `agent:registered`

## Usage Examples

### Basic Agent Registration

```javascript
import { AgentDiscoveryService } from './services/AgentDiscoveryService.js';

const discoveryService = new AgentDiscoveryService();

// Register an agent
const result = await discoveryService.register({
  name: 'MyAgent',
  capabilities: ['processing', 'validation'],
  endpoint: 'http://localhost:3000/agent'
});

console.log('Agent registered:', result.agent.id);
```

### Finding Agents by Capability

```javascript
// Find all agents that can process data
const processors = discoveryService.discover('processing');

console.log(`Found ${processors.length} processing agents`);

for (const agent of processors) {
  console.log(`- ${agent.name} at ${agent.endpoint}`);
}
```

### Event Subscription

```javascript
// Monitor agent lifecycle
discoveryService.subscribe((agent) => {
  console.log('Agent event:', agent);
});

// Monitor only registrations
discoveryService.subscribe((agent) => {
  console.log('New agent:', agent.name);
  // Send welcome notification
  notifyAgentRegistered(agent);
}, 'agent:registered');

// Monitor timeouts
discoveryService.subscribe((agent) => {
  console.error('Agent timeout:', agent.name);
  // Alert operations team
  sendAlert(`Agent ${agent.name} is not responding`);
}, 'agent:timeout');
```

### Heartbeat from Agent

```javascript
// Agent periodically sends heartbeat
setInterval(async () => {
  try {
    await discoveryService.updateHeartbeat(agentId);
  } catch (error) {
    console.error('Heartbeat failed:', error);
  }
}, 20000); // Every 20 seconds
```

### Integration with Existing AgentRegistry

```javascript
import { AgentRegistry } from './core/AgentRegistry.js';
import { AgentDiscoveryService } from './services/AgentDiscoveryService.js';

const agentRegistry = new AgentRegistry();
const discoveryService = new AgentDiscoveryService({
  agentRegistry // Pass existing registry for integration
});

// Now both systems work together
await discoveryService.register({
  name: 'MyAgent',
  capabilities: ['test'],
  endpoint: 'http://localhost:3000'
});

// Agent is registered in both systems
const agent = agentRegistry.getAgent(agentId);
console.log(agent); // Agent exists in AgentRegistry too
```

## API Endpoints

The discovery service exposes the following REST endpoints:

### GET `/api/discovery/agents`
Get all registered agents

**Query Parameters:**
- `status` (optional): Filter by status (`active`, `inactive`, `all`)

**Response:**
```json
{
  "success": true,
  "agents": [...],
  "count": 10
}
```

### GET `/api/discovery/agents/:id`
Get specific agent by ID

**Response:**
```json
{
  "success": true,
  "agent": {
    "id": "agent-id",
    "name": "Agent Name",
    ...
  }
}
```

### GET `/api/discovery/capabilities/:capability`
Find agents by capability

**Response:**
```json
{
  "success": true,
  "capability": "data_processing",
  "agents": [...],
  "count": 5
}
```

### POST `/api/discovery/register`
Register a new agent

**Request Body:**
```json
{
  "name": "Agent Name",
  "capabilities": ["cap1", "cap2"],
  "endpoint": "http://localhost:8081/api/agents/agent-id",
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "id": "generated-id",
    ...
  }
}
```

### DELETE `/api/discovery/agents/:id`
Deregister an agent

**Response:**
```json
{
  "success": true,
  "agentId": "agent-id",
  "message": "Agent deregistered successfully"
}
```

### POST `/api/discovery/agents/:id/heartbeat`
Update agent heartbeat

**Response:**
```json
{
  "success": true,
  "agentId": "agent-id",
  "lastHeartbeat": "2025-11-10T17:05:00.000Z"
}
```

### GET `/api/discovery/stats`
Get discovery service statistics

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalAgents": 10,
    "activeAgents": 8,
    "inactiveAgents": 2,
    "capabilities": 5,
    "heartbeatInterval": 30000,
    "heartbeatTimeout": 90000
  }
}
```

## Testing

The service includes comprehensive unit tests covering:

- Agent registration with validation
- Agent deregistration
- Capability-based discovery
- ID-based discovery
- Event subscriptions
- Heartbeat monitoring
- Timeout handling
- Statistics reporting
- Shutdown procedure

**Run tests:**
```bash
npm run test:run -- AgentDiscoveryService.spec.js
```

**Test coverage:**
- All public methods tested
- Edge cases covered
- Error handling verified
- Event emission verified
- Heartbeat timeout verified

## Performance Considerations

### Memory Usage
- Uses `BoundedMap` with 5000 agent limit (configurable)
- Automatic eviction prevents unbounded growth
- Capability index uses Set for O(1) membership checks

### Lookup Performance
- Capability discovery: O(1) via indexed Map
- ID lookup: O(1) via Map.get()
- Get all: O(n) iteration over agents

### Heartbeat Monitoring
- Runs every 30 seconds by default
- O(n) scan of all agents each interval
- For 5000 agents, scan completes in <10ms

### Scalability
- Handles up to 5000 agents by default
- Can be increased via `maxAgents` option
- Recommended: Use multiple discovery services for >10k agents

## Integration Checklist

To integrate AgentDiscoveryService into your application:

- [ ] Import `AgentDiscoveryService` in your main server file
- [ ] Create instance with appropriate options
- [ ] Add discovery routes to Express app
- [ ] Store instance in `app.locals.discoveryService`
- [ ] Update agents to auto-register on startup
- [ ] Implement heartbeat mechanism in agents
- [ ] Subscribe to events for monitoring/alerting
- [ ] Add discovery service to shutdown sequence

## Future Enhancements

Potential improvements for Phase 3+:

1. **Distributed Discovery**: Support for multiple discovery service instances
2. **Agent Load Balancing**: Choose least-loaded agent for capability
3. **Health Checks**: Active health checking of registered agents
4. **Persistent Storage**: Store agent registry in database
5. **Agent Versioning**: Support for multiple versions of same agent
6. **Capability Negotiation**: Match agents based on capability versions
7. **Service Mesh Integration**: Integrate with Istio/Linkerd
8. **Metrics Export**: Prometheus metrics for monitoring

## References

- Issue #2704: Phase 2.1 implementation
- Issue #2157: Memory optimization (BoundedMap usage)
- `/backend/monolith/src/core/AgentRegistry.js`: Existing agent registry
- `/backend/monolith/src/agents/BaseAgent.js`: Base agent class
- `/docs/MULTI_AGENT_ORGANISM_AUDIT.md`: Multi-agent architecture

## License

Part of DronDoc platform - Internal use only
