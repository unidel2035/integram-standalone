// PriorityQueue.test.js - Unit tests for PriorityQueue
import { describe, it, expect, beforeEach } from 'vitest';
import PriorityQueue from '../PriorityQueue.js';

describe('PriorityQueue', () => {
  let queue;

  beforeEach(() => {
    queue = new PriorityQueue();
  });

  describe('Basic Operations', () => {
    it('should start empty', () => {
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size).toBe(0);
    });

    it('should enqueue and dequeue items in priority order', () => {
      queue.enqueue({ id: 't1', name: 'Task 1' }, 5);
      queue.enqueue({ id: 't2', name: 'Task 2' }, 3);
      queue.enqueue({ id: 't3', name: 'Task 3' }, 7);

      expect(queue.size).toBe(3);
      expect(queue.dequeue().id).toBe('t2'); // Priority 3 (highest)
      expect(queue.dequeue().id).toBe('t1'); // Priority 5
      expect(queue.dequeue().id).toBe('t3'); // Priority 7 (lowest)
      expect(queue.isEmpty()).toBe(true);
    });

    it('should peek without removing', () => {
      queue.enqueue({ id: 't1' }, 5);
      queue.enqueue({ id: 't2' }, 3);

      const peeked = queue.peek();
      expect(peeked.id).toBe('t2');
      expect(queue.size).toBe(2); // Size unchanged
    });

    it('should return null when dequeuing empty queue', () => {
      expect(queue.dequeue()).toBeNull();
    });

    it('should return null when peeking empty queue', () => {
      expect(queue.peek()).toBeNull();
    });
  });

  describe('Priority Updates', () => {
    it('should update priority of existing item', () => {
      queue.enqueue({ id: 't1' }, 5);
      queue.enqueue({ id: 't2' }, 3);
      queue.enqueue({ id: 't3' }, 7);

      // Update t3 to highest priority
      const updated = queue.updatePriority('t3', 1);

      expect(updated).toBe(true);
      expect(queue.dequeue().id).toBe('t3'); // Now highest priority
    });

    it('should return false when updating non-existent item', () => {
      queue.enqueue({ id: 't1' }, 5);

      const updated = queue.updatePriority('t999', 1);
      expect(updated).toBe(false);
    });

    it('should maintain heap property after priority increase', () => {
      queue.enqueue({ id: 't1' }, 3);
      queue.enqueue({ id: 't2' }, 5);
      queue.enqueue({ id: 't3' }, 7);

      // Decrease t1 priority (increase value)
      queue.updatePriority('t1', 9);

      expect(queue.dequeue().id).toBe('t2'); // Priority 5
      expect(queue.dequeue().id).toBe('t3'); // Priority 7
      expect(queue.dequeue().id).toBe('t1'); // Priority 9 (lowest)
    });
  });

  describe('Item Removal', () => {
    it('should remove specific item', () => {
      queue.enqueue({ id: 't1' }, 3);
      queue.enqueue({ id: 't2' }, 5);
      queue.enqueue({ id: 't3' }, 7);

      const removed = queue.remove('t2');

      expect(removed).toBe(true);
      expect(queue.size).toBe(2);
      expect(queue.dequeue().id).toBe('t1');
      expect(queue.dequeue().id).toBe('t3');
    });

    it('should return false when removing non-existent item', () => {
      queue.enqueue({ id: 't1' }, 5);

      const removed = queue.remove('t999');
      expect(removed).toBe(false);
    });

    it('should handle removing last item', () => {
      queue.enqueue({ id: 't1' }, 3);
      queue.enqueue({ id: 't2' }, 5);

      queue.remove('t2');

      expect(queue.size).toBe(1);
      expect(queue.dequeue().id).toBe('t1');
    });
  });

  describe('Array Conversion', () => {
    it('should convert to sorted array', () => {
      queue.enqueue({ id: 't1' }, 5);
      queue.enqueue({ id: 't2' }, 3);
      queue.enqueue({ id: 't3' }, 7);

      const array = queue.toArray();

      expect(array).toHaveLength(3);
      expect(array[0].id).toBe('t2'); // Priority 3
      expect(array[1].id).toBe('t1'); // Priority 5
      expect(array[2].id).toBe('t3'); // Priority 7
    });
  });

  describe('Clear', () => {
    it('should clear all items', () => {
      queue.enqueue({ id: 't1' }, 5);
      queue.enqueue({ id: 't2' }, 3);

      queue.clear();

      expect(queue.isEmpty()).toBe(true);
      expect(queue.size).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should calculate queue statistics', () => {
      queue.enqueue({ id: 't1' }, 5);
      queue.enqueue({ id: 't2' }, 3);

      // Wait a bit
      setTimeout(() => {
        const stats = queue.getStats();

        expect(stats.size).toBe(2);
        expect(stats.avgWaitTime).toBeGreaterThan(0);
        expect(stats.oldestTask).toBeDefined();
        expect(stats.oldestTask.item.id).toBe('t1');
      }, 100);
    });

    it('should return empty stats for empty queue', () => {
      const stats = queue.getStats();

      expect(stats.size).toBe(0);
      expect(stats.avgWaitTime).toBe(0);
      expect(stats.oldestTask).toBeNull();
    });
  });

  describe('Heap Property Maintenance', () => {
    it('should maintain min-heap property with many items', () => {
      const items = [10, 5, 15, 3, 8, 12, 20, 1, 7];

      items.forEach((priority, index) => {
        queue.enqueue({ id: `t${index}`, priority }, priority);
      });

      // Dequeue all items - should come out in sorted order
      const dequeued = [];
      while (!queue.isEmpty()) {
        const item = queue.dequeue();
        dequeued.push(item.priority);
      }

      // Check sorted order
      for (let i = 1; i < dequeued.length; i++) {
        expect(dequeued[i]).toBeGreaterThanOrEqual(dequeued[i - 1]);
      }
    });

    it('should handle duplicate priorities', () => {
      queue.enqueue({ id: 't1' }, 5);
      queue.enqueue({ id: 't2' }, 5);
      queue.enqueue({ id: 't3' }, 5);

      // All same priority - should dequeue in some stable order
      const ids = [];
      while (!queue.isEmpty()) {
        ids.push(queue.dequeue().id);
      }

      expect(ids).toHaveLength(3);
      expect(ids).toContain('t1');
      expect(ids).toContain('t2');
      expect(ids).toContain('t3');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single item', () => {
      queue.enqueue({ id: 't1' }, 5);

      expect(queue.peek().id).toBe('t1');
      expect(queue.dequeue().id).toBe('t1');
      expect(queue.isEmpty()).toBe(true);
    });

    it('should handle priority value edge cases', () => {
      queue.enqueue({ id: 't1' }, 0);
      queue.enqueue({ id: 't2' }, -5);
      queue.enqueue({ id: 't3' }, 1000);

      expect(queue.dequeue().id).toBe('t2'); // Negative priority
      expect(queue.dequeue().id).toBe('t1'); // Zero priority
      expect(queue.dequeue().id).toBe('t3'); // Large priority
    });

    it('should handle items without id', () => {
      queue.enqueue({ name: 'No ID 1' }, 5);
      queue.enqueue({ name: 'No ID 2' }, 3);

      expect(queue.size).toBe(2);
      expect(queue.dequeue().name).toBe('No ID 2');
    });
  });

  describe('Performance', () => {
    it('should handle large number of items efficiently', () => {
      const count = 1000;
      const start = Date.now();

      // Enqueue
      for (let i = 0; i < count; i++) {
        queue.enqueue({ id: `t${i}` }, Math.random() * 100);
      }

      // Dequeue
      while (!queue.isEmpty()) {
        queue.dequeue();
      }

      const elapsed = Date.now() - start;

      // Should complete in reasonable time (< 1 second for 1000 items)
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
