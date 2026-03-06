// useIntegramDocEditorWebSocket.spec.js - Unit tests for Integram Document Editor WebSocket composable
// Issue #6777: Test table update functionality

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { useIntegramDocEditorWebSocket } from '../useIntegramDocEditorWebSocket';

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;

    // Simulate connection
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 0);
  }

  send(data) {
    this.lastSent = data;
  }

  close(code, reason) {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose({ code, reason });
  }

  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
}

global.WebSocket = MockWebSocket;

// Mock apiConfig
vi.mock('@/utils/apiConfig', () => ({
  getWebSocketUrl: () => 'ws://localhost:3000'
}));

describe('useIntegramDocEditorWebSocket - Table Update (Issue #6777)', () => {
  let documentId;
  let userId;
  let onTableUpdate;

  beforeEach(() => {
    documentId = ref('doc-123');
    userId = ref('user-1');
    onTableUpdate = vi.fn();
  });

  it('should provide sendTableUpdate method', () => {
    const { sendTableUpdate } = useIntegramDocEditorWebSocket(
      documentId,
      userId,
      { autoConnect: false }
    );

    expect(sendTableUpdate).toBeDefined();
    expect(typeof sendTableUpdate).toBe('function');
  });

  it('should send table update message via WebSocket', async () => {
    const { connect, sendTableUpdate } = useIntegramDocEditorWebSocket(
      documentId,
      userId,
      { autoConnect: false }
    );

    connect();

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 10));

    const result = sendTableUpdate('916814', 'kval');

    expect(result).toBe(true);
  });

  it('should not send table update when disconnected', () => {
    const { sendTableUpdate } = useIntegramDocEditorWebSocket(
      documentId,
      userId,
      { autoConnect: false }
    );

    const result = sendTableUpdate('916814', 'kval');

    expect(result).toBe(false);
  });

  it('should not send table update when tableId is missing', async () => {
    const { connect, sendTableUpdate } = useIntegramDocEditorWebSocket(
      documentId,
      userId,
      { autoConnect: false }
    );

    connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    const result1 = sendTableUpdate(null, 'kval');
    const result2 = sendTableUpdate('916814', null);

    expect(result1).toBe(false);
    expect(result2).toBe(false);
  });

  it('should call onTableUpdate callback when receiving table-update message', async () => {
    const { connect } = useIntegramDocEditorWebSocket(
      documentId,
      userId,
      {
        autoConnect: false,
        onTableUpdate
      }
    );

    connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    // Get the mock WebSocket instance
    const ws = global.WebSocket.prototype;

    // Simulate receiving table update message
    if (ws.onmessage) {
      ws.onmessage({
        data: JSON.stringify({
          type: 'integram-doc:table-update',
          tableId: '916814',
          database: 'kval',
          userId: 'user-2'
        })
      });
    }

    expect(onTableUpdate).toHaveBeenCalledTimes(1);
    expect(onTableUpdate).toHaveBeenCalledWith('916814', 'kval');
  });

  it('should include correct data in table update message', async () => {
    const { connect, sendTableUpdate } = useIntegramDocEditorWebSocket(
      documentId,
      userId,
      { autoConnect: false }
    );

    connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    sendTableUpdate('916814', 'kval');

    // Access lastSent from any MockWebSocket instance
    const instances = MockWebSocket.instances || [];
    if (instances.length > 0) {
      const ws = instances[instances.length - 1];
      const sent = JSON.parse(ws.lastSent);

      expect(sent).toMatchObject({
        type: 'integram-doc:table-update',
        roomId: 'integram-doc-doc-123',
        userId: 'user-1',
        documentId: 'doc-123',
        tableId: '916814',
        database: 'kval'
      });
    }
  });

  it('should not call onTableUpdate if tableId or database is missing', async () => {
    const { connect } = useIntegramDocEditorWebSocket(
      documentId,
      userId,
      {
        autoConnect: false,
        onTableUpdate
      }
    );

    connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    const ws = global.WebSocket.prototype;

    // Message missing tableId
    if (ws.onmessage) {
      ws.onmessage({
        data: JSON.stringify({
          type: 'integram-doc:table-update',
          database: 'kval',
          userId: 'user-2'
        })
      });
    }

    // Message missing database
    if (ws.onmessage) {
      ws.onmessage({
        data: JSON.stringify({
          type: 'integram-doc:table-update',
          tableId: '916814',
          userId: 'user-2'
        })
      });
    }

    expect(onTableUpdate).not.toHaveBeenCalled();
  });
});
