/**
 * Multi-Agent Orchestration Module
 *
 * Exports all orchestration components for multi-agent workflows.
 *
 * Features (LangGraph-inspired enhancements):
 * - AgentRegistry: Central registry for agent discovery
 * - ExecutionContext: Shared state for execution chains
 * - MultiAgentOrchestrator: Main orchestration engine
 * - CheckpointManager: State persistence via Integram
 * - StreamingHandler: Real-time streaming support
 */

export { AgentRegistry, globalRegistry } from './AgentRegistry.js'
export { ExecutionContext } from './ExecutionContext.js'
export { MultiAgentOrchestrator, createOrchestrator } from './MultiAgentOrchestrator.js'
export { CheckpointManager, checkpointManager } from './CheckpointManager.js'
export { StreamingHandler, StreamEventType } from './StreamingHandler.js'

// Re-export for convenience
export default {
  AgentRegistry,
  ExecutionContext,
  MultiAgentOrchestrator,
  createOrchestrator,
  CheckpointManager,
  checkpointManager,
  StreamingHandler,
  StreamEventType
}
