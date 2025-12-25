/**
 * ProcessVersionService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProcessVersionService, VersionStatus } from '../ProcessVersionService.js'

describe('ProcessVersionService', () => {
  let versionService
  let mockStorage

  beforeEach(() => {
    mockStorage = {}
    versionService = new ProcessVersionService({ storage: mockStorage })
  })

  describe('incrementVersion', () => {
    it('should increment major version', () => {
      const result = versionService.incrementVersion('1.2.3', 'major')
      expect(result).toBe('2.0.0')
    })

    it('should increment minor version', () => {
      const result = versionService.incrementVersion('1.2.3', 'minor')
      expect(result).toBe('1.3.0')
    })

    it('should increment patch version', () => {
      const result = versionService.incrementVersion('1.2.3', 'patch')
      expect(result).toBe('1.2.4')
    })

    it('should default to minor increment', () => {
      const result = versionService.incrementVersion('1.2.3')
      expect(result).toBe('1.3.0')
    })
  })

  describe('findAddedNodes', () => {
    it('should find nodes added in new version', () => {
      const oldDef = {
        nodes: [
          { id: 'node-1', type: 'task' },
          { id: 'node-2', type: 'task' }
        ]
      }

      const newDef = {
        nodes: [
          { id: 'node-1', type: 'task' },
          { id: 'node-2', type: 'task' },
          { id: 'node-3', type: 'task' } // Added
        ]
      }

      const result = versionService.findAddedNodes(oldDef, newDef)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('node-3')
    })

    it('should return empty array if no nodes added', () => {
      const oldDef = { nodes: [{ id: 'node-1' }] }
      const newDef = { nodes: [{ id: 'node-1' }] }

      const result = versionService.findAddedNodes(oldDef, newDef)
      expect(result).toHaveLength(0)
    })
  })

  describe('findRemovedNodes', () => {
    it('should find nodes removed in new version', () => {
      const oldDef = {
        nodes: [
          { id: 'node-1', type: 'task' },
          { id: 'node-2', type: 'task' }
        ]
      }

      const newDef = {
        nodes: [
          { id: 'node-1', type: 'task' }
          // node-2 removed
        ]
      }

      const result = versionService.findRemovedNodes(oldDef, newDef)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('node-2')
    })
  })

  describe('findModifiedNodes', () => {
    it('should find nodes that changed between versions', () => {
      const oldDef = {
        nodes: [
          { id: 'node-1', type: 'task', data: { label: 'Old Label' } }
        ]
      }

      const newDef = {
        nodes: [
          { id: 'node-1', type: 'task', data: { label: 'New Label' } }
        ]
      }

      const result = versionService.findModifiedNodes(oldDef, newDef)
      expect(result).toHaveLength(1)
      expect(result[0].nodeId).toBe('node-1')
      expect(result[0].old.data.label).toBe('Old Label')
      expect(result[0].new.data.label).toBe('New Label')
    })

    it('should not include unchanged nodes', () => {
      const oldDef = {
        nodes: [
          { id: 'node-1', type: 'task', data: { label: 'Same Label' } }
        ]
      }

      const newDef = {
        nodes: [
          { id: 'node-1', type: 'task', data: { label: 'Same Label' } }
        ]
      }

      const result = versionService.findModifiedNodes(oldDef, newDef)
      expect(result).toHaveLength(0)
    })
  })

  describe('findAddedEdges', () => {
    it('should find edges added in new version', () => {
      const oldDef = {
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2' }
        ]
      }

      const newDef = {
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2' },
          { id: 'edge-2', source: 'node-2', target: 'node-3' } // Added
        ]
      }

      const result = versionService.findAddedEdges(oldDef, newDef)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('edge-2')
    })
  })

  describe('findRemovedEdges', () => {
    it('should find edges removed in new version', () => {
      const oldDef = {
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2' },
          { id: 'edge-2', source: 'node-2', target: 'node-3' }
        ]
      }

      const newDef = {
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2' }
          // edge-2 removed
        ]
      }

      const result = versionService.findRemovedEdges(oldDef, newDef)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('edge-2')
    })
  })

  describe('findModifiedEdges', () => {
    it('should find edges that changed between versions', () => {
      const oldDef = {
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2', data: { condition: 'old' } }
        ]
      }

      const newDef = {
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2', data: { condition: 'new' } }
        ]
      }

      const result = versionService.findModifiedEdges(oldDef, newDef)
      expect(result).toHaveLength(1)
      expect(result[0].edgeId).toBe('edge-1')
      expect(result[0].old.data.condition).toBe('old')
      expect(result[0].new.data.condition).toBe('new')
    })
  })
})
