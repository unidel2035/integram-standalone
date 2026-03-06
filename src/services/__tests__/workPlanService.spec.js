// workPlanService.spec.js - Unit tests for Work Plan Service
// Issue #5427: Work Plan Templates - Шаблоны планов работы субагента

import { describe, it, expect } from 'vitest';
import {
  STEP_TYPES,
  TRIGGER_TYPES,
  MCP_OPERATIONS,
  createWorkPlan,
  createStep,
  validateWorkPlan,
  validateStep,
  parseVariables,
  replaceVariables,
  evaluateCondition,
  getUsedVariables,
  cloneWorkPlan,
  exportWorkPlan,
  importWorkPlan
} from '../workPlanService.js';

describe('workPlanService', () => {
  describe('createWorkPlan', () => {
    it('should create a new work plan with default values', () => {
      const plan = createWorkPlan();

      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('name', 'New Work Plan');
      expect(plan).toHaveProperty('steps');
      expect(plan.steps).toEqual([]);
      expect(plan.trigger.type).toBe(TRIGGER_TYPES.MANUAL);
      expect(plan.metadata).toHaveProperty('createdAt');
    });

    it('should create a work plan with custom data', () => {
      const plan = createWorkPlan({
        name: 'Custom Plan',
        description: 'Test description',
        tags: ['test', 'custom']
      });

      expect(plan.name).toBe('Custom Plan');
      expect(plan.description).toBe('Test description');
      expect(plan.metadata.tags).toEqual(['test', 'custom']);
    });
  });

  describe('createStep', () => {
    it('should create a new step with default values', () => {
      const step = createStep();

      expect(step).toHaveProperty('id');
      expect(step).toHaveProperty('name', 'New Step');
      expect(step.type).toBe(STEP_TYPES.LLM);
      expect(step.enabled).toBe(true);
    });

    it('should create an LLM step with config', () => {
      const step = createStep({
        name: 'LLM Step',
        type: STEP_TYPES.LLM,
        config: {
          prompt: 'Test prompt {{variable}}'
        }
      });

      expect(step.type).toBe(STEP_TYPES.LLM);
      expect(step.config.prompt).toBe('Test prompt {{variable}}');
      expect(step.config).toHaveProperty('temperature');
    });

    it('should create an MCP step with config', () => {
      const step = createStep({
        type: STEP_TYPES.MCP,
        config: {
          operation: MCP_OPERATIONS.SEARCH,
          table: 'test_table'
        }
      });

      expect(step.type).toBe(STEP_TYPES.MCP);
      expect(step.config.operation).toBe(MCP_OPERATIONS.SEARCH);
      expect(step.config.table).toBe('test_table');
    });

    it('should create a condition step with config', () => {
      const step = createStep({
        type: STEP_TYPES.CONDITION,
        config: {
          condition: '{{status}} == "active"',
          thenStep: 'step-1',
          elseStep: 'step-2'
        }
      });

      expect(step.type).toBe(STEP_TYPES.CONDITION);
      expect(step.config.condition).toBe('{{status}} == "active"');
    });
  });

  describe('validateWorkPlan', () => {
    it('should validate a correct work plan', () => {
      const plan = createWorkPlan({
        name: 'Valid Plan',
        trigger: { type: TRIGGER_TYPES.MESSAGE, config: {} },
        steps: [
          createStep({
            id: 'step-1',
            name: 'Step 1',
            type: STEP_TYPES.LLM,
            config: { prompt: 'Test' }
          })
        ]
      });

      const result = validateWorkPlan(plan);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail validation for plan without name', () => {
      const plan = createWorkPlan({ name: '' });
      const result = validateWorkPlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Plan name is required');
    });

    it('should fail validation for plan without trigger', () => {
      const plan = createWorkPlan({ name: 'Test' });
      plan.trigger = null;
      const result = validateWorkPlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Trigger type is required');
    });

    it('should fail validation for plan without steps', () => {
      const plan = createWorkPlan({
        name: 'Test',
        steps: []
      });
      const result = validateWorkPlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Plan must have at least one step');
    });

    it('should detect duplicate step IDs', () => {
      const plan = createWorkPlan({
        name: 'Test',
        steps: [
          createStep({ id: 'step-1', name: 'Step 1', config: { prompt: 'Test' } }),
          createStep({ id: 'step-1', name: 'Step 2', config: { prompt: 'Test' } })
        ]
      });
      const result = validateWorkPlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate step ID'))).toBe(true);
    });

    it('should detect invalid step references in conditions', () => {
      const plan = createWorkPlan({
        name: 'Test',
        steps: [
          createStep({
            id: 'step-1',
            name: 'Step 1',
            type: STEP_TYPES.CONDITION,
            config: {
              condition: 'true',
              thenStep: 'invalid-step',
              elseStep: 'step-2'
            }
          })
        ]
      });
      const result = validateWorkPlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid thenStep reference'))).toBe(true);
    });
  });

  describe('validateStep', () => {
    it('should validate a correct LLM step', () => {
      const step = createStep({
        id: 'step-1',
        name: 'Test',
        type: STEP_TYPES.LLM,
        config: { prompt: 'Test prompt' }
      });
      const errors = validateStep(step, 0);

      expect(errors).toEqual([]);
    });

    it('should fail validation for LLM step without prompt', () => {
      const step = createStep({
        id: 'step-1',
        name: 'Test',
        type: STEP_TYPES.LLM,
        config: { prompt: '' }
      });
      const errors = validateStep(step, 0);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('requires a prompt'))).toBe(true);
    });

    it('should fail validation for MCP step without operation', () => {
      const step = createStep({
        id: 'step-1',
        name: 'Test',
        type: STEP_TYPES.MCP,
        config: { table: 'test' }
      });
      const errors = validateStep(step, 0);

      expect(errors.some(e => e.includes('requires an operation'))).toBe(true);
    });

    it('should fail validation for step without name', () => {
      const step = createStep({ id: 'step-1', name: '' });
      const errors = validateStep(step, 0);

      expect(errors.some(e => e.includes('Step name is required'))).toBe(true);
    });
  });

  describe('parseVariables', () => {
    it('should parse variables from text', () => {
      const text = 'Hello {{name}}, your status is {{status}}';
      const vars = parseVariables(text);

      expect(vars).toContain('name');
      expect(vars).toContain('status');
      expect(vars.length).toBe(2);
    });

    it('should handle text without variables', () => {
      const vars = parseVariables('Hello world');
      expect(vars).toEqual([]);
    });

    it('should handle empty or null text', () => {
      expect(parseVariables('')).toEqual([]);
      expect(parseVariables(null)).toEqual([]);
    });

    it('should parse variables with spaces', () => {
      const vars = parseVariables('{{ name }} and {{ age }}');
      expect(vars).toContain('name');
      expect(vars).toContain('age');
    });
  });

  describe('replaceVariables', () => {
    it('should replace variables in text', () => {
      const text = 'Hello {{name}}, your age is {{age}}';
      const vars = { name: 'John', age: '30' };
      const result = replaceVariables(text, vars);

      expect(result).toBe('Hello John, your age is 30');
    });

    it('should handle missing variables', () => {
      const text = 'Hello {{name}}, your age is {{age}}';
      const vars = { name: 'John' };
      const result = replaceVariables(text, vars);

      expect(result).toContain('John');
      expect(result).toContain('{{age}}'); // Unreplaced variable
    });

    it('should handle variables with spaces', () => {
      const text = '{{ name }} is {{ age }} years old';
      const vars = { name: 'Alice', age: '25' };
      const result = replaceVariables(text, vars);

      expect(result).toBe('Alice is 25 years old');
    });

    it('should return original text if no variables', () => {
      const text = 'Hello world';
      const result = replaceVariables(text, {});
      expect(result).toBe('Hello world');
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate equality condition', () => {
      expect(evaluateCondition('{{status}} == active', { status: 'active' })).toBe(true);
      expect(evaluateCondition('{{status}} == active', { status: 'inactive' })).toBe(false);
    });

    it('should evaluate inequality condition', () => {
      expect(evaluateCondition('{{status}} != active', { status: 'inactive' })).toBe(true);
      expect(evaluateCondition('{{status}} != active', { status: 'active' })).toBe(false);
    });

    it('should evaluate greater than condition', () => {
      expect(evaluateCondition('{{score}} > 50', { score: '60' })).toBe(true);
      expect(evaluateCondition('{{score}} > 50', { score: '40' })).toBe(false);
    });

    it('should evaluate less than condition', () => {
      expect(evaluateCondition('{{score}} < 50', { score: '40' })).toBe(true);
      expect(evaluateCondition('{{score}} < 50', { score: '60' })).toBe(false);
    });

    it('should evaluate includes condition', () => {
      expect(evaluateCondition('{{text}} includes hello', { text: 'hello world' })).toBe(true);
      expect(evaluateCondition('{{text}} includes bye', { text: 'hello world' })).toBe(false);
    });

    it('should handle invalid conditions gracefully', () => {
      expect(evaluateCondition('invalid condition', {})).toBe(false);
    });
  });

  describe('getUsedVariables', () => {
    it('should get all used variables from a plan', () => {
      const plan = createWorkPlan({
        name: 'Test',
        steps: [
          createStep({
            id: 'step-1',
            type: STEP_TYPES.LLM,
            config: { prompt: 'Hello {{name}}' },
            outputVar: 'greeting'
          }),
          createStep({
            id: 'step-2',
            type: STEP_TYPES.CONDITION,
            config: { condition: '{{greeting}} includes hello' },
            inputVars: ['greeting']
          })
        ]
      });

      const vars = getUsedVariables(plan);
      expect(vars.has('name')).toBe(true);
      expect(vars.has('greeting')).toBe(true);
    });

    it('should return empty set for plan without variables', () => {
      const plan = createWorkPlan({
        name: 'Test',
        steps: [
          createStep({
            id: 'step-1',
            type: STEP_TYPES.ACTION,
            config: { actionType: 'log' }
          })
        ]
      });

      const vars = getUsedVariables(plan);
      expect(vars.size).toBe(0);
    });
  });

  describe('cloneWorkPlan', () => {
    it('should clone a work plan', () => {
      const original = createWorkPlan({
        name: 'Original',
        steps: [
          createStep({ id: 'step-1', name: 'Step 1', config: { prompt: 'Test' } })
        ]
      });

      const cloned = cloneWorkPlan(original);

      expect(cloned.id).not.toBe(original.id);
      expect(cloned.name).toBe('Original (Copy)');
      expect(cloned.steps.length).toBe(1);
    });

    it('should clone with new name', () => {
      const original = createWorkPlan({ name: 'Original' });
      const cloned = cloneWorkPlan(original, { newName: 'Cloned' });

      expect(cloned.name).toBe('Cloned');
    });

    it('should regenerate step IDs when requested', () => {
      const original = createWorkPlan({
        name: 'Original',
        steps: [
          createStep({ id: 'step-1', name: 'Step 1', config: { prompt: 'Test' } }),
          createStep({
            id: 'step-2',
            name: 'Step 2',
            type: STEP_TYPES.CONDITION,
            config: {
              condition: 'true',
              thenStep: 'step-1'
            }
          })
        ]
      });

      const cloned = cloneWorkPlan(original, { regenerateStepIds: true });

      expect(cloned.steps[0].id).not.toBe('step-1');
      expect(cloned.steps[1].id).not.toBe('step-2');
      expect(cloned.steps[1].config.thenStep).toBe(cloned.steps[0].id);
    });
  });

  describe('exportWorkPlan and importWorkPlan', () => {
    it('should export and import a work plan', () => {
      const original = createWorkPlan({
        name: 'Test Plan',
        description: 'Test description',
        steps: [
          createStep({
            id: 'step-1',
            name: 'Step 1',
            type: STEP_TYPES.LLM,
            config: { prompt: 'Test prompt' }
          })
        ]
      });

      const exported = exportWorkPlan(original);
      expect(typeof exported).toBe('string');

      const imported = importWorkPlan(exported);
      expect(imported.name).toBe(original.name);
      expect(imported.description).toBe(original.description);
      expect(imported.steps.length).toBe(1);
      expect(imported.steps[0].name).toBe('Step 1');
    });

    it('should fail to import invalid JSON', () => {
      expect(() => {
        importWorkPlan('invalid json');
      }).toThrow();
    });

    it('should fail to import invalid work plan', () => {
      const invalidPlan = JSON.stringify({ name: '', steps: [] });
      expect(() => {
        importWorkPlan(invalidPlan);
      }).toThrow(/Invalid work plan/);
    });
  });

  describe('Constants', () => {
    it('should have correct step types', () => {
      expect(STEP_TYPES.LLM).toBe('llm');
      expect(STEP_TYPES.MCP).toBe('mcp');
      expect(STEP_TYPES.CONDITION).toBe('condition');
      expect(STEP_TYPES.ACTION).toBe('action');
      expect(STEP_TYPES.TRANSFORM).toBe('transform');
      expect(STEP_TYPES.WEBHOOK).toBe('webhook');
    });

    it('should have correct trigger types', () => {
      expect(TRIGGER_TYPES.MESSAGE).toBe('message');
      expect(TRIGGER_TYPES.SCHEDULE).toBe('schedule');
      expect(TRIGGER_TYPES.WEBHOOK).toBe('webhook');
      expect(TRIGGER_TYPES.MANUAL).toBe('manual');
      expect(TRIGGER_TYPES.EVENT).toBe('event');
    });

    it('should have correct MCP operations', () => {
      expect(MCP_OPERATIONS.SEARCH).toBe('search');
      expect(MCP_OPERATIONS.CREATE).toBe('create');
      expect(MCP_OPERATIONS.UPDATE).toBe('update');
      expect(MCP_OPERATIONS.DELETE).toBe('delete');
      expect(MCP_OPERATIONS.QUERY).toBe('query');
      expect(MCP_OPERATIONS.EXECUTE_REPORT).toBe('execute_report');
    });
  });
});
