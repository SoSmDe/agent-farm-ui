import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawnKanbanWorkerViaRpc } from './kanban-worker-spawn.js';
import * as gatewayRpc from './gateway-rpc.js';

vi.mock('./gateway-rpc.js', () => ({
  gatewayRpcCall: vi.fn(),
}));

describe('kanban-worker-spawn', () => {
  const mockGatewayRpcCall = vi.mocked(gatewayRpc.gatewayRpcCall);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('spawnKanbanWorkerViaRpc', () => {
    it('should spawn a worker under agent:main:main when available', async () => {
      // Pre-spawn sessions.list returns agent:main:main with no children
      mockGatewayRpcCall.mockImplementation(async (method: string) => {
        if (method === 'sessions.list') {
          return {
            sessions: [
              { id: 'sess-main', key: 'agent:main:main', agentName: 'main', rootAgentId: 'main' },
            ],
          };
        }
        // chat.send returns ok
        if (method === 'chat.send') {
          return { ok: true };
        }
        return {};
      });

      // Post-spawn sessions.list returns the new child
      let callCount = 0;
      mockGatewayRpcCall.mockImplementation(async (method: string) => {
        if (method === 'sessions.list') {
          callCount++;
          if (callCount === 1) {
            // Pre-spawn
            return {
              sessions: [
                { id: 'sess-main', key: 'agent:main:main', agentName: 'main', rootAgentId: 'main' },
              ],
            };
          }
          // Post-spawn (second call)
          return {
            sessions: [
              { id: 'sess-main', key: 'agent:main:main', agentName: 'main', rootAgentId: 'main' },
              { id: 'sess-child', key: 'agent:main:subagent:abc123', agentName: 'main', rootAgentId: 'main' },
            ],
          };
        }
        if (method === 'chat.send') {
          return { ok: true };
        }
        return {};
      });

      const result = await spawnKanbanWorkerViaRpc({
        label: 'test-worker',
        task: 'Test task',
        model: 'test-model',
        thinking: 'medium',
      });

      expect(result.parentSessionKey).toBe('agent:main:main');
      expect(result.childSessionKey).toBe('agent:main:subagent:abc123');
      expect(result.sessionId).toBe('sess-child');

      // Verify chat.send was called with correct message format
      const chatSendCall = mockGatewayRpcCall.mock.calls.find(call => call[0] === 'chat.send');
      expect(chatSendCall).toBeDefined();
      const chatSendParams = chatSendCall![1] as Record<string, unknown>;
      expect(chatSendParams.sessionKey).toBe('agent:main:main');
      expect(chatSendParams.message).toContain('[spawn-subagent]');
      expect(chatSendParams.message).toContain('task: Test task');
      expect(chatSendParams.message).toContain('label: test-worker');
      expect(chatSendParams.message).toContain('model: test-model');
      expect(chatSendParams.message).toContain('thinking: medium');
      expect(chatSendParams.message).toContain('mode: run');
      expect(chatSendParams.message).toContain('cleanup: keep');
      expect(chatSendParams.idempotencyKey).toBeDefined();
    });

    it('should fallback to another top-level root when agent:main:main is absent', async () => {
      let callCount = 0;
      mockGatewayRpcCall.mockImplementation(async (method: string) => {
        if (method === 'sessions.list') {
          callCount++;
          if (callCount === 1) {
            // Pre-spawn: only agent:foo:main exists
            return {
              sessions: [
                { id: 'sess-foo', key: 'agent:foo:main', agentName: 'foo', rootAgentId: 'foo' },
              ],
            };
          }
          // Post-spawn
          return {
            sessions: [
              { id: 'sess-foo', key: 'agent:foo:main', agentName: 'foo', rootAgentId: 'foo' },
              { id: 'sess-child', key: 'agent:foo:subagent:xyz789', agentName: 'foo', rootAgentId: 'foo' },
            ],
          };
        }
        if (method === 'chat.send') {
          return { ok: true };
        }
        return {};
      });

      const result = await spawnKanbanWorkerViaRpc({
        label: 'test-worker',
        task: 'Test task',
      });

      expect(result.parentSessionKey).toBe('agent:foo:main');
      expect(result.childSessionKey).toBe('agent:foo:subagent:xyz789');
      expect(result.sessionId).toBe('sess-child');
    });

    it('should degrade cleanly when discovery times out', async () => {
      mockGatewayRpcCall.mockImplementation(async (method: string) => {
        if (method === 'sessions.list') {
          // Always return same sessions (child never appears)
          return {
            sessions: [
              { id: 'sess-main', key: 'agent:main:main', agentName: 'main', rootAgentId: 'main' },
            ],
          };
        }
        if (method === 'chat.send') {
          return { ok: true };
        }
        return {};
      });

      const result = await spawnKanbanWorkerViaRpc({
        label: 'test-worker',
        task: 'Test task',
      });

      // Should still return parent info even if child not discovered
      expect(result.parentSessionKey).toBe('agent:main:main');
      expect(result.childSessionKey).toBeUndefined();
      expect(result.sessionId).toBeUndefined();
    }, 10000); // Increase timeout to allow discovery timeout to complete

    it('should build spawn message without thinking when thinking is off', async () => {
      let callCount = 0;
      mockGatewayRpcCall.mockImplementation(async (method: string) => {
        if (method === 'sessions.list') {
          callCount++;
          if (callCount === 1) {
            return {
              sessions: [
                { id: 'sess-main', key: 'agent:main:main', agentName: 'main', rootAgentId: 'main' },
              ],
            };
          }
          // Second call returns with child to exit discovery loop
          return {
            sessions: [
              { id: 'sess-main', key: 'agent:main:main', agentName: 'main', rootAgentId: 'main' },
              { id: 'sess-child', key: 'agent:main:subagent:abc123', agentName: 'main', rootAgentId: 'main' },
            ],
          };
        }
        if (method === 'chat.send') {
          return { ok: true };
        }
        return {};
      });

      await spawnKanbanWorkerViaRpc({
        label: 'test-worker',
        task: 'Test task',
        thinking: 'off',
      });

      const chatSendCall = mockGatewayRpcCall.mock.calls.find(call => call[0] === 'chat.send');
      const chatSendParams = chatSendCall![1] as Record<string, unknown>;
      expect(chatSendParams.message).not.toContain('thinking:');
    });

    it('should throw error when no top-level agent session exists', async () => {
      mockGatewayRpcCall.mockImplementation(async (method: string) => {
        if (method === 'sessions.list') {
          // Return only subagent sessions, no top-level roots
          return {
            sessions: [
              { id: 'sess-child', key: 'agent:main:subagent:abc123', agentName: 'main', rootAgentId: 'main' },
            ],
          };
        }
        return {};
      });

      await expect(
        spawnKanbanWorkerViaRpc({
          label: 'test-worker',
          task: 'Test task',
        })
      ).rejects.toThrow('No top-level agent session found');
    });

    it('should prefer agent:main:main over other roots', async () => {
      let callCount = 0;
      mockGatewayRpcCall.mockImplementation(async (method: string) => {
        if (method === 'sessions.list') {
          callCount++;
          if (callCount === 1) {
            // Pre-spawn: both agent:foo:main and agent:main:main exist
            return {
              sessions: [
                { id: 'sess-foo', key: 'agent:foo:main', agentName: 'foo', rootAgentId: 'foo' },
                { id: 'sess-main', key: 'agent:main:main', agentName: 'main', rootAgentId: 'main' },
              ],
            };
          }
          // Post-spawn
          return {
            sessions: [
              { id: 'sess-foo', key: 'agent:foo:main', agentName: 'foo', rootAgentId: 'foo' },
              { id: 'sess-main', key: 'agent:main:main', agentName: 'main', rootAgentId: 'main' },
              { id: 'sess-child', key: 'agent:main:subagent:abc123', agentName: 'main', rootAgentId: 'main' },
            ],
          };
        }
        if (method === 'chat.send') {
          return { ok: true };
        }
        return {};
      });

      const result = await spawnKanbanWorkerViaRpc({
        label: 'test-worker',
        task: 'Test task',
      });

      expect(result.parentSessionKey).toBe('agent:main:main');
    });
  });
});
