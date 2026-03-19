/**
 * A2A MCP Tools — expose A2A protocol to Claude Code via MCP
 *
 * Tools:
 * - a2a_register — Register an agent
 * - a2a_send_task — Send task to another agent
 * - a2a_route_task — Route task by skill
 * - a2a_task_status — Check task status
 * - a2a_complete_task — Complete a task
 * - a2a_agents — List agents
 * - a2a_receipts — Query crypto receipts
 * - a2a_verify_receipt — Verify receipt
 * - a2a_taxonomy_classify — Classify agent
 * - a2a_workforce — Workforce dashboard
 */

import { getA2AProtocol, createAgentCard } from '../a2a/A2AProtocol.js';
import { getCryptoReceiptService } from '../receipts/CryptoReceiptService.js';
import { getAgentTaxonomy } from '../agents/AgentTaxonomy.js';

export function getA2ATools() {
  return [
    {
      name: 'a2a_register',
      description: 'Register an AI agent with Agent Card (A2A protocol). Provide agentId, name, skills[], and optional taxonomy classification.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Unique agent identifier' },
          name: { type: 'string', description: 'Human-readable agent name' },
          description: { type: 'string' },
          skills: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          domain: { type: 'string', description: 'Taxonomy domain: analytics|operations|development|governance|knowledge|communication|infrastructure' },
          role: { type: 'string', description: 'Taxonomy role: analyst|executor|monitor|coordinator|specialist|guardian|assistant' },
          autonomy: { type: 'string', description: 'Autonomy level: augmentation|automation|supervised|autonomous' },
        },
        required: ['agentId', 'name'],
      },
    },
    {
      name: 'a2a_send_task',
      description: 'Send a task from one agent to another (A2A tasks/send). Returns task with ID for tracking.',
      inputSchema: {
        type: 'object',
        properties: {
          fromAgent: { type: 'string', description: 'Sending agent ID' },
          toAgent: { type: 'string', description: 'Receiving agent ID' },
          message: { type: 'string', description: 'Task message text' },
          metadata: { type: 'object' },
        },
        required: ['fromAgent', 'toAgent', 'message'],
      },
    },
    {
      name: 'a2a_route_task',
      description: 'Route a task to the best available agent by required skill. Auto-selects agent with matching capability and fewest active tasks.',
      inputSchema: {
        type: 'object',
        properties: {
          fromAgent: { type: 'string' },
          skillRequired: { type: 'string', description: 'Skill to match (e.g., "data-query", "code-review")' },
          message: { type: 'string' },
        },
        required: ['fromAgent', 'skillRequired', 'message'],
      },
    },
    {
      name: 'a2a_task_status',
      description: 'Get task status, messages, and artifacts by task ID.',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
        },
        required: ['taskId'],
      },
    },
    {
      name: 'a2a_complete_task',
      description: 'Mark a task as completed with optional final message and artifacts.',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          agentId: { type: 'string' },
          finalMessage: { type: 'string' },
        },
        required: ['taskId', 'agentId'],
      },
    },
    {
      name: 'a2a_agents',
      description: 'List registered agents. Optional filters: capability, skill, status.',
      inputSchema: {
        type: 'object',
        properties: {
          capability: { type: 'string' },
          skill: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
    {
      name: 'a2a_receipts',
      description: 'Query cryptographic action receipts. Each receipt is HMAC-SHA256 signed and hash-chained.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          action: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
    {
      name: 'a2a_verify_receipt',
      description: 'Verify a cryptographic receipt signature and chain integrity.',
      inputSchema: {
        type: 'object',
        properties: {
          receiptId: { type: 'string' },
        },
        required: ['receiptId'],
      },
    },
    {
      name: 'a2a_taxonomy_classify',
      description: 'Classify an agent using the workforce taxonomy (domain, role, autonomy level, capabilities).',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          template: { type: 'string', description: 'Template: integram-data-agent|kag-knowledge-agent|code-review-agent|process-orchestrator|audit-guardian|health-monitor|chat-assistant|gift-economy-agent' },
          domain: { type: 'string' },
          role: { type: 'string' },
          autonomy: { type: 'string' },
          capabilities: { type: 'array', items: { type: 'string' } },
        },
        required: ['agentId'],
      },
    },
    {
      name: 'a2a_workforce',
      description: 'Get workforce dashboard: agents by domain/role/autonomy, capability coverage, gap analysis.',
      inputSchema: { type: 'object', properties: {} },
    },
  ];
}

export async function handleA2ATool(toolName, args) {
  const a2a = getA2AProtocol({ receiptService: getCryptoReceiptService() });
  const receipts = getCryptoReceiptService();
  const taxonomy = getAgentTaxonomy();

  switch (toolName) {
    case 'a2a_register': {
      const card = createAgentCard({
        name: args.name,
        description: args.description,
        skills: args.skills || [],
      });
      const agent = a2a.registerAgent(args.agentId, card);
      if (args.domain || args.role || args.autonomy) {
        taxonomy.classify(args.agentId, {
          name: args.name,
          description: args.description,
          domain: args.domain,
          role: args.role,
          autonomy: args.autonomy,
        });
      }
      return { ok: true, agent };
    }

    case 'a2a_send_task': {
      const task = a2a.sendTask({
        fromAgent: args.fromAgent,
        toAgent: args.toAgent,
        message: { text: args.message },
        metadata: args.metadata,
      });
      return { ok: true, taskId: task.id, state: task.state };
    }

    case 'a2a_route_task': {
      const task = a2a.routeTask({
        fromAgent: args.fromAgent,
        skillRequired: args.skillRequired,
        message: { text: args.message },
      });
      return { ok: true, taskId: task.id, assignedTo: task.assignedTo, state: task.state };
    }

    case 'a2a_task_status': {
      const task = a2a.getTask(args.taskId);
      if (!task) return { error: 'Task not found' };
      return { task };
    }

    case 'a2a_complete_task': {
      const task = a2a.completeTask(args.taskId, args.agentId, {
        finalMessage: args.finalMessage ? { text: args.finalMessage } : null,
      });
      return { ok: true, taskId: task.id, state: task.state };
    }

    case 'a2a_agents': {
      return { agents: a2a.listAgents(args) };
    }

    case 'a2a_receipts': {
      return receipts.query(args);
    }

    case 'a2a_verify_receipt': {
      return receipts.verifyReceipt(args.receiptId);
    }

    case 'a2a_taxonomy_classify': {
      const classification = taxonomy.classify(args.agentId, args);
      return { ok: true, classification };
    }

    case 'a2a_workforce': {
      return taxonomy.getWorkforceDashboard();
    }

    default:
      return { error: `Unknown A2A tool: ${toolName}` };
  }
}
