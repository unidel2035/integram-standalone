/**
 * Tests for KAG RAG (Retrieval-Augmented Generation) functionality
 * Issue #5072
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import KAGService from '../KAGService.js';

describe('KAGService - RAG Pipeline', () => {
  let kagService;
  let mockLLMCoordinator;

  beforeEach(() => {
    kagService = new KAGService();

    // Mock LLM coordinator
    mockLLMCoordinator = {
      chatWithToken: vi.fn().mockResolvedValue({
        content: 'This is a test answer from the AI model.',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      })
    };

    // Add test entities to knowledge graph
    kagService.entities.set('issue_1', {
      id: 'issue_1',
      type: 'Issue',
      name: 'Issue #1: Implement RAG pipeline',
      properties: {
        number: 1,
        title: 'Implement RAG pipeline',
        state: 'open',
        author: 'testuser',
        url: 'https://github.com/test/repo/issues/1'
      },
      observations: [
        'Issue #1',
        'Title: Implement RAG pipeline',
        'Implement a full RAG pipeline with retrieve, augment, and generate steps'
      ]
    });

    kagService.entities.set('doc_readme', {
      id: 'doc_readme',
      type: 'Documentation',
      name: 'README.md',
      properties: {
        path: 'README.md',
        url: 'https://github.com/test/repo/blob/main/README.md'
      },
      observations: [
        'Documentation: README.md',
        'This project implements a Knowledge Augmented Generation system'
      ]
    });
  });

  describe('answerQuestion', () => {
    it('should answer question using RAG pipeline', async () => {
      const result = await kagService.answerQuestion('What is RAG?', {
        llmCoordinator: mockLLMCoordinator,
        accessToken: 'test_token',
        modelId: 'test_model'
      });

      expect(result.success).toBe(true);
      expect(result.answer).toBe('This is a test answer from the AI model.');
      expect(result.sources).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.model).toBe('test_model');
    });

    it('should retrieve relevant sources', async () => {
      const result = await kagService.answerQuestion('RAG pipeline', {
        llmCoordinator: mockLLMCoordinator,
        accessToken: 'test_token',
        modelId: 'test_model',
        maxSources: 5,
        minScore: 0.1
      });

      expect(result.sources).toBeInstanceOf(Array);
      expect(result.sources.length).toBeGreaterThan(0);

      const firstSource = result.sources[0];
      expect(firstSource).toHaveProperty('id');
      expect(firstSource).toHaveProperty('type');
      expect(firstSource).toHaveProperty('name');
      expect(firstSource).toHaveProperty('score');
    });

    it('should include conversation history in prompt', async () => {
      const conversationHistory = [
        { role: 'user', content: 'What is KAG?' },
        { role: 'assistant', content: 'KAG stands for Knowledge Augmented Generation.' }
      ];

      await kagService.answerQuestion('Tell me more about it', {
        llmCoordinator: mockLLMCoordinator,
        accessToken: 'test_token',
        modelId: 'test_model',
        conversationHistory
      });

      expect(mockLLMCoordinator.chatWithToken).toHaveBeenCalled();
      const callArgs = mockLLMCoordinator.chatWithToken.mock.calls[0];
      const prompt = callArgs[2];

      expect(prompt).toContain('ИСТОРИЯ РАЗГОВОРА');
      expect(prompt).toContain('What is KAG?');
      expect(prompt).toContain('Tell me more about it');
    });

    it('should pass correct parameters to LLM coordinator', async () => {
      await kagService.answerQuestion('Test question', {
        llmCoordinator: mockLLMCoordinator,
        accessToken: 'my_token',
        modelId: 'my_model',
        temperature: 0.5,
        maxTokens: 1000
      });

      expect(mockLLMCoordinator.chatWithToken).toHaveBeenCalledWith(
        'my_token',
        'my_model',
        expect.any(String),
        expect.objectContaining({
          application: 'KnowledgeBase',
          operation: 'rag_answer',
          temperature: 0.5,
          maxTokens: 1000
        })
      );
    });

    it('should throw error if llmCoordinator is missing', async () => {
      await expect(
        kagService.answerQuestion('Test', {
          accessToken: 'token',
          modelId: 'model'
        })
      ).rejects.toThrow('LLM coordinator is required for RAG');
    });

    it('should throw error if accessToken is missing', async () => {
      await expect(
        kagService.answerQuestion('Test', {
          llmCoordinator: mockLLMCoordinator,
          modelId: 'model'
        })
      ).rejects.toThrow('Access token and model ID are required for RAG');
    });

    it('should throw error if modelId is missing', async () => {
      await expect(
        kagService.answerQuestion('Test', {
          llmCoordinator: mockLLMCoordinator,
          accessToken: 'token'
        })
      ).rejects.toThrow('Access token and model ID are required for RAG');
    });

    it('should handle LLM errors gracefully', async () => {
      const errorCoordinator = {
        chatWithToken: vi.fn().mockRejectedValue(new Error('LLM API failed'))
      };

      await expect(
        kagService.answerQuestion('Test', {
          llmCoordinator: errorCoordinator,
          accessToken: 'token',
          modelId: 'model'
        })
      ).rejects.toThrow('RAG pipeline failed: LLM API failed');
    });

    it('should return usage statistics', async () => {
      const result = await kagService.answerQuestion('Test', {
        llmCoordinator: mockLLMCoordinator,
        accessToken: 'token',
        modelId: 'model'
      });

      expect(result.usage).toBeDefined();
      expect(result.usage.total_tokens).toBe(150);
    });
  });

  describe('_buildContext', () => {
    it('should build context from search results', () => {
      const searchResults = [
        {
          entity: kagService.entities.get('issue_1'),
          score: 2.5
        },
        {
          entity: kagService.entities.get('doc_readme'),
          score: 1.8
        }
      ];

      const context = kagService._buildContext(searchResults);

      expect(context).toContain('[Issue] Issue #1: Implement RAG pipeline');
      expect(context).toContain('Score: 2.50');
      expect(context).toContain('[Documentation] README.md');
      expect(context).toContain('---'); // Separator
    });

    it('should limit observations to first 3', () => {
      const entityWithManyObs = {
        id: 'test',
        type: 'Test',
        name: 'Test Entity',
        properties: {},
        observations: ['Obs 1', 'Obs 2', 'Obs 3', 'Obs 4', 'Obs 5']
      };

      const context = kagService._buildContext([
        { entity: entityWithManyObs, score: 1.0 }
      ]);

      expect(context).toContain('Obs 1');
      expect(context).toContain('Obs 2');
      expect(context).toContain('Obs 3');
      expect(context).not.toContain('Obs 4');
      expect(context).not.toContain('Obs 5');
    });
  });

  describe('_buildPrompt', () => {
    it('should build prompt with question and context', () => {
      const question = 'What is RAG?';
      const context = 'RAG stands for Retrieval-Augmented Generation.';

      const prompt = kagService._buildPrompt(question, context);

      expect(prompt).toContain('КОНТЕКСТ ИЗ БАЗЫ ЗНАНИЙ');
      expect(prompt).toContain(context);
      expect(prompt).toContain('ВОПРОС ПОЛЬЗОВАТЕЛЯ');
      expect(prompt).toContain(question);
    });

    it('should include conversation history if provided', () => {
      const question = 'Tell me more';
      const context = 'Some context';
      const history = [
        { role: 'user', content: 'What is AI?' },
        { role: 'assistant', content: 'AI is artificial intelligence.' }
      ];

      const prompt = kagService._buildPrompt(question, context, history);

      expect(prompt).toContain('ИСТОРИЯ РАЗГОВОРА');
      expect(prompt).toContain('Пользователь: What is AI?');
      expect(prompt).toContain('Ассистент: AI is artificial intelligence.');
    });

    it('should not include history section if empty', () => {
      const question = 'Test';
      const context = 'Context';

      const prompt = kagService._buildPrompt(question, context, []);

      expect(prompt).not.toContain('ИСТОРИЯ РАЗГОВОРА');
    });
  });
});
