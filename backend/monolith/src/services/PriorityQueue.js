// PriorityQueue.js - Heap-based priority queue implementation
// Part of Smart Resource Management system (Issue #5304)

/**
 * Priority Queue implemented using binary min-heap
 * Lower priority value = higher priority (processed first)
 */
export class PriorityQueue {
  constructor() {
    this.heap = [];
    this.itemMap = new Map(); // taskId -> heap index for fast lookup
  }

  /**
   * Get size of queue
   */
  get size() {
    return this.heap.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty() {
    return this.heap.length === 0;
  }

  /**
   * Enqueue item with priority
   * @param {any} item - Item to enqueue
   * @param {number} priority - Priority value (lower = higher priority)
   */
  enqueue(item, priority) {
    const entry = { item, priority, enqueuedAt: Date.now() };

    // Add to end of heap
    this.heap.push(entry);
    const index = this.heap.length - 1;

    // Track in map if item has id
    if (item.id) {
      this.itemMap.set(item.id, index);
    }

    // Bubble up to maintain heap property
    this._bubbleUp(index);
  }

  /**
   * Dequeue item with highest priority
   * @returns {any} Item with highest priority (lowest priority value)
   */
  dequeue() {
    if (this.isEmpty()) {
      return null;
    }

    const root = this.heap[0];
    const last = this.heap.pop();

    // Update map
    if (root.item.id) {
      this.itemMap.delete(root.item.id);
    }

    if (!this.isEmpty()) {
      this.heap[0] = last;

      // Update map for moved item
      if (last.item.id) {
        this.itemMap.set(last.item.id, 0);
      }

      // Bubble down to maintain heap property
      this._bubbleDown(0);
    }

    return root.item;
  }

  /**
   * Peek at highest priority item without removing
   * @returns {any} Item with highest priority
   */
  peek() {
    return this.isEmpty() ? null : this.heap[0].item;
  }

  /**
   * Update priority of existing item
   * @param {string} itemId - ID of item to update
   * @param {number} newPriority - New priority value
   * @returns {boolean} True if updated, false if not found
   */
  updatePriority(itemId, newPriority) {
    const index = this.itemMap.get(itemId);

    if (index === undefined || index >= this.heap.length) {
      return false;
    }

    const oldPriority = this.heap[index].priority;
    this.heap[index].priority = newPriority;

    // Re-heapify
    if (newPriority < oldPriority) {
      this._bubbleUp(index);
    } else if (newPriority > oldPriority) {
      this._bubbleDown(index);
    }

    return true;
  }

  /**
   * Remove specific item from queue
   * @param {string} itemId - ID of item to remove
   * @returns {boolean} True if removed, false if not found
   */
  remove(itemId) {
    const index = this.itemMap.get(itemId);

    if (index === undefined || index >= this.heap.length) {
      return false;
    }

    // Remove from map
    this.itemMap.delete(itemId);

    // If last item, just pop
    if (index === this.heap.length - 1) {
      this.heap.pop();
      return true;
    }

    // Replace with last item
    const last = this.heap.pop();
    const removed = this.heap[index];
    this.heap[index] = last;

    // Update map for moved item
    if (last.item.id) {
      this.itemMap.set(last.item.id, index);
    }

    // Re-heapify
    if (last.priority < removed.priority) {
      this._bubbleUp(index);
    } else {
      this._bubbleDown(index);
    }

    return true;
  }

  /**
   * Get all items sorted by priority
   * @returns {Array} Array of items sorted by priority
   */
  toArray() {
    return [...this.heap]
      .sort((a, b) => a.priority - b.priority)
      .map(entry => entry.item);
  }

  /**
   * Clear all items
   */
  clear() {
    this.heap = [];
    this.itemMap.clear();
  }

  /**
   * Bubble up element at index to maintain heap property
   * @private
   */
  _bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);

      if (this.heap[index].priority >= this.heap[parentIndex].priority) {
        break;
      }

      // Swap with parent
      this._swap(index, parentIndex);
      index = parentIndex;
    }
  }

  /**
   * Bubble down element at index to maintain heap property
   * @private
   */
  _bubbleDown(index) {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (
        leftChild < this.heap.length &&
        this.heap[leftChild].priority < this.heap[smallest].priority
      ) {
        smallest = leftChild;
      }

      if (
        rightChild < this.heap.length &&
        this.heap[rightChild].priority < this.heap[smallest].priority
      ) {
        smallest = rightChild;
      }

      if (smallest === index) {
        break;
      }

      // Swap with smallest child
      this._swap(index, smallest);
      index = smallest;
    }
  }

  /**
   * Swap two elements in heap
   * @private
   */
  _swap(i, j) {
    // Update map
    if (this.heap[i].item.id) {
      this.itemMap.set(this.heap[i].item.id, j);
    }
    if (this.heap[j].item.id) {
      this.itemMap.set(this.heap[j].item.id, i);
    }

    // Swap in heap
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  /**
   * Get queue statistics
   */
  getStats() {
    if (this.isEmpty()) {
      return {
        size: 0,
        avgWaitTime: 0,
        oldestTask: null
      };
    }

    const now = Date.now();
    const waitTimes = this.heap.map(entry => now - entry.enqueuedAt);
    const avgWaitTime = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;

    const oldest = this.heap.reduce((oldest, entry) =>
      entry.enqueuedAt < oldest.enqueuedAt ? entry : oldest
    );

    return {
      size: this.heap.length,
      avgWaitTime,
      oldestTask: {
        item: oldest.item,
        waitTime: now - oldest.enqueuedAt,
        priority: oldest.priority
      }
    };
  }
}

export default PriorityQueue;
