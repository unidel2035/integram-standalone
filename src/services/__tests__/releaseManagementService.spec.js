/**
 * Unit tests for Release Management Service
 * @see Issue #2496 - Release Management Agent
 */

import { describe, it, expect } from 'vitest'
import {
  parseChangelog,
  compareVersions,
  incrementVersion,
  generateReleaseNotes,
  extractHighlights,
  calculateReleaseStats,
  isValidSemanticVersion,
  generateChangelogEntry,
  parseConventionalCommits,
  getLatestRelease,
  checkForUpdates
} from '../releaseManagementService'

describe('releaseManagementService', () => {
  describe('parseChangelog', () => {
    it('should parse changelog with single release', () => {
      const changelog = `# Changelog

## [1.0.0] - 2025-01-01

### Added
- Feature A
- Feature B

### Fixed
- Bug fix 1
`
      const releases = parseChangelog(changelog)

      expect(releases).toHaveLength(1)
      expect(releases[0].version).toBe('1.0.0')
      expect(releases[0].date).toBe('2025-01-01')
      expect(releases[0].sections.added).toEqual(['Feature A', 'Feature B'])
      expect(releases[0].sections.fixed).toEqual(['Bug fix 1'])
    })

    it('should parse changelog with multiple releases', () => {
      const changelog = `# Changelog

## [2.0.0] - 2025-02-01

### Added
- Feature C

## [1.0.0] - 2025-01-01

### Added
- Feature A
`
      const releases = parseChangelog(changelog)

      expect(releases).toHaveLength(2)
      expect(releases[0].version).toBe('2.0.0')
      expect(releases[1].version).toBe('1.0.0')
    })

    it('should handle empty sections', () => {
      const changelog = `# Changelog

## [1.0.0] - 2025-01-01

### Added

### Fixed
`
      const releases = parseChangelog(changelog)

      expect(releases).toHaveLength(1)
      expect(releases[0].sections.added).toEqual([])
      expect(releases[0].sections.fixed).toEqual([])
    })
  })

  describe('compareVersions', () => {
    it('should return -1 when v1 < v2', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
      expect(compareVersions('1.0.0', '1.1.0')).toBe(-1)
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
    })

    it('should return 0 when v1 === v2', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
      expect(compareVersions('2.5.3', '2.5.3')).toBe(0)
    })

    it('should return 1 when v1 > v2', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1)
      expect(compareVersions('1.1.0', '1.0.0')).toBe(1)
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1)
    })
  })

  describe('incrementVersion', () => {
    it('should increment patch version', () => {
      expect(incrementVersion('1.2.3', 'patch')).toBe('1.2.4')
    })

    it('should increment minor version and reset patch', () => {
      expect(incrementVersion('1.2.3', 'minor')).toBe('1.3.0')
    })

    it('should increment major version and reset minor and patch', () => {
      expect(incrementVersion('1.2.3', 'major')).toBe('2.0.0')
    })

    it('should throw error for invalid type', () => {
      expect(() => incrementVersion('1.0.0', 'invalid')).toThrow('Invalid increment type')
    })
  })

  describe('generateReleaseNotes', () => {
    it('should generate formatted release notes', () => {
      const release = {
        version: '1.0.0',
        date: '2025-01-01',
        sections: {
          added: ['Feature A', 'Feature B'],
          fixed: ['Bug 1'],
          changed: [],
          deprecated: [],
          removed: [],
          security: [],
          performance: [],
          documentation: []
        }
      }

      const notes = generateReleaseNotes(release)

      expect(notes).toContain('# Release 1.0.0')
      expect(notes).toContain('**Released:** 2025-01-01')
      expect(notes).toContain('## ➕ Added')
      expect(notes).toContain('- Feature A')
      expect(notes).toContain('- Feature B')
      expect(notes).toContain('## 🐛 Fixed')
      expect(notes).toContain('- Bug 1')
    })

    it('should not include empty sections', () => {
      const release = {
        version: '1.0.0',
        date: '2025-01-01',
        sections: {
          added: ['Feature A'],
          fixed: [],
          changed: [],
          deprecated: [],
          removed: [],
          security: [],
          performance: [],
          documentation: []
        }
      }

      const notes = generateReleaseNotes(release)

      expect(notes).toContain('## ➕ Added')
      expect(notes).not.toContain('## 🐛 Fixed')
    })
  })

  describe('extractHighlights', () => {
    it('should extract highlights with priority', () => {
      const release = {
        version: '1.0.0',
        date: '2025-01-01',
        sections: {
          added: ['Feature A', 'Feature B', 'Feature C'],
          fixed: ['Bug 1', 'Bug 2'],
          changed: ['Change 1'],
          security: ['Security fix'],
          deprecated: [],
          removed: [],
          performance: [],
          documentation: []
        }
      }

      const highlights = extractHighlights(release)

      expect(highlights).toHaveLength(5)
      // Security should be first
      expect(highlights[0]).toBe('Security fix')
      // Then added
      expect(highlights[1]).toBe('Feature A')
      expect(highlights[2]).toBe('Feature B')
    })

    it('should limit to 5 highlights', () => {
      const release = {
        version: '1.0.0',
        date: '2025-01-01',
        sections: {
          security: ['Sec 1', 'Sec 2', 'Sec 3'],
          added: ['A1', 'A2', 'A3', 'A4', 'A5'],
          fixed: [],
          changed: [],
          deprecated: [],
          removed: [],
          performance: [],
          documentation: []
        }
      }

      const highlights = extractHighlights(release)

      expect(highlights).toHaveLength(5)
    })
  })

  describe('calculateReleaseStats', () => {
    it('should calculate statistics correctly', () => {
      const releases = [
        {
          version: '2.0.0',
          date: '2025-01-15',
          sections: {
            added: ['A1', 'A2'],
            fixed: ['F1'],
            changed: [],
            deprecated: [],
            removed: [],
            security: [],
            performance: [],
            documentation: []
          }
        },
        {
          version: '1.1.0',
          date: '2025-01-01',
          sections: {
            added: ['A3'],
            fixed: ['F2', 'F3'],
            changed: ['C1'],
            deprecated: [],
            removed: [],
            security: [],
            performance: [],
            documentation: []
          }
        },
        {
          version: '1.0.1',
          date: '2024-12-20',
          sections: {
            fixed: ['F4'],
            added: [],
            changed: [],
            deprecated: [],
            removed: [],
            security: [],
            performance: [],
            documentation: []
          }
        }
      ]

      const stats = calculateReleaseStats(releases)

      expect(stats.totalReleases).toBe(3)
      expect(stats.majorReleases).toBe(1) // 2.0.0
      expect(stats.minorReleases).toBe(1) // 1.1.0
      expect(stats.patchReleases).toBe(1) // 1.0.1
      expect(stats.totalChanges.added).toBe(3)
      expect(stats.totalChanges.fixed).toBe(4)
      expect(stats.totalChanges.changed).toBe(1)
      expect(stats.averageChangesPerRelease).toBe(3) // (3+4+1)/3 = 8/3 ≈ 3
      expect(stats.releaseFrequency['2025']).toBe(2)
      expect(stats.releaseFrequency['2024']).toBe(1)
    })

    it('should handle empty releases array', () => {
      const stats = calculateReleaseStats([])

      expect(stats.totalReleases).toBe(0)
      expect(stats.averageChangesPerRelease).toBe(0)
    })
  })

  describe('isValidSemanticVersion', () => {
    it('should validate correct semantic versions', () => {
      expect(isValidSemanticVersion('1.0.0')).toBe(true)
      expect(isValidSemanticVersion('10.20.30')).toBe(true)
      expect(isValidSemanticVersion('0.0.0')).toBe(true)
    })

    it('should reject invalid versions', () => {
      expect(isValidSemanticVersion('1.0')).toBe(false)
      expect(isValidSemanticVersion('1')).toBe(false)
      expect(isValidSemanticVersion('v1.0.0')).toBe(false)
      expect(isValidSemanticVersion('1.0.0-beta')).toBe(false)
      expect(isValidSemanticVersion('abc')).toBe(false)
    })
  })

  describe('generateChangelogEntry', () => {
    it('should generate changelog entry', () => {
      const changes = {
        added: ['Feature A', 'Feature B'],
        fixed: ['Bug 1'],
        changed: [],
        deprecated: [],
        removed: [],
        security: [],
        performance: [],
        documentation: []
      }

      const entry = generateChangelogEntry('1.0.0', '2025-01-01', changes)

      expect(entry).toContain('## [1.0.0] - 2025-01-01')
      expect(entry).toContain('### Added')
      expect(entry).toContain('- Feature A')
      expect(entry).toContain('- Feature B')
      expect(entry).toContain('### Fixed')
      expect(entry).toContain('- Bug 1')
    })

    it('should not include empty sections', () => {
      const changes = {
        added: ['Feature A'],
        fixed: [],
        changed: [],
        deprecated: [],
        removed: [],
        security: [],
        performance: [],
        documentation: []
      }

      const entry = generateChangelogEntry('1.0.0', '2025-01-01', changes)

      expect(entry).toContain('### Added')
      expect(entry).not.toContain('### Fixed')
    })
  })

  describe('parseConventionalCommits', () => {
    it('should parse conventional commits correctly', () => {
      const commits = [
        { message: 'feat: add new feature', hash: 'abc123', author: 'John', date: '2025-01-01' },
        { message: 'fix: fix critical bug', hash: 'def456', author: 'Jane', date: '2025-01-02' },
        { message: 'docs: update README', hash: 'ghi789', author: 'Bob', date: '2025-01-03' },
        { message: 'perf(api): optimize query', hash: 'jkl012', author: 'Alice', date: '2025-01-04' }
      ]

      const changes = parseConventionalCommits(commits)

      expect(changes.added).toContain('add new feature')
      expect(changes.fixed).toContain('fix critical bug')
      expect(changes.documentation).toContain('update README')
      expect(changes.performance).toContain('**api**: optimize query')
    })

    it('should ignore non-conventional commits', () => {
      const commits = [
        { message: 'some random commit', hash: 'abc123', author: 'John', date: '2025-01-01' },
        { message: 'feat: add feature', hash: 'def456', author: 'Jane', date: '2025-01-02' }
      ]

      const changes = parseConventionalCommits(commits)

      expect(changes.added).toHaveLength(1)
      expect(changes.added).toContain('add feature')
    })
  })

  describe('getLatestRelease', () => {
    it('should return the latest release by version', () => {
      const releases = [
        { version: '1.0.0', date: '2025-01-01', sections: {} },
        { version: '2.0.0', date: '2025-02-01', sections: {} },
        { version: '1.5.0', date: '2025-01-15', sections: {} }
      ]

      const latest = getLatestRelease(releases)

      expect(latest.version).toBe('2.0.0')
    })

    it('should return null for empty array', () => {
      const latest = getLatestRelease([])
      expect(latest).toBeNull()
    })

    it('should handle single release', () => {
      const releases = [
        { version: '1.0.0', date: '2025-01-01', sections: {} }
      ]

      const latest = getLatestRelease(releases)

      expect(latest.version).toBe('1.0.0')
    })
  })

  describe('checkForUpdates', () => {
    it('should detect major update available', () => {
      const result = checkForUpdates('1.5.3', '2.0.0')

      expect(result.available).toBe(true)
      expect(result.type).toBe('major')
      expect(result.current).toBe('1.5.3')
      expect(result.latest).toBe('2.0.0')
    })

    it('should detect minor update available', () => {
      const result = checkForUpdates('1.5.3', '1.6.0')

      expect(result.available).toBe(true)
      expect(result.type).toBe('minor')
    })

    it('should detect patch update available', () => {
      const result = checkForUpdates('1.5.3', '1.5.4')

      expect(result.available).toBe(true)
      expect(result.type).toBe('patch')
    })

    it('should return no update when current is latest', () => {
      const result = checkForUpdates('1.5.3', '1.5.3')

      expect(result.available).toBe(false)
      expect(result.type).toBeNull()
    })

    it('should return no update when current is ahead', () => {
      const result = checkForUpdates('2.0.0', '1.5.3')

      expect(result.available).toBe(false)
      expect(result.type).toBeNull()
    })
  })
})
