/**
 * Release Management Service
 *
 * Manages application releases including:
 * - Semantic versioning
 * - Changelog generation and parsing
 * - Release notes generation
 * - Deployment approval workflow
 * - Rollback mechanism
 * - Release analytics
 *
 * @see Issue #2496 - Release Management Agent
 */

import { marked } from 'marked'

/**
 * Parse CHANGELOG.md file to extract release information
 * @param {string} changelogContent - Raw CHANGELOG.md content
 * @returns {Array} Array of release objects
 */
export function parseChangelog(changelogContent) {
  const releases = []
  const lines = changelogContent.split('\n')

  let currentRelease = null
  let currentSection = null

  for (const line of lines) {
    // Match release header: ## [version] - date
    const releaseMatch = line.match(/^##\s+\[([^\]]+)\]\s*-\s*(.+)/)
    if (releaseMatch) {
      if (currentRelease) {
        releases.push(currentRelease)
      }

      currentRelease = {
        version: releaseMatch[1],
        date: releaseMatch[2].trim(),
        sections: {
          added: [],
          changed: [],
          deprecated: [],
          removed: [],
          fixed: [],
          security: [],
          performance: [],
          documentation: []
        }
      }
      currentSection = null
      continue
    }

    // Match section headers: ### Added, ### Changed, etc.
    const sectionMatch = line.match(/^###\s+(.+)/)
    if (sectionMatch && currentRelease) {
      const sectionName = sectionMatch[1].toLowerCase()
      if (currentRelease.sections.hasOwnProperty(sectionName)) {
        currentSection = sectionName
      }
      continue
    }

    // Match list items
    if (line.startsWith('- ') && currentRelease && currentSection) {
      currentRelease.sections[currentSection].push(line.substring(2).trim())
    }
  }

  // Add last release
  if (currentRelease) {
    releases.push(currentRelease)
  }

  return releases
}

/**
 * Compare two semantic versions
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0

    if (p1 < p2) return -1
    if (p1 > p2) return 1
  }

  return 0
}

/**
 * Increment semantic version
 * @param {string} version - Current version
 * @param {string} type - Increment type: major, minor, or patch
 * @returns {string} New version
 */
export function incrementVersion(version, type = 'minor') {
  const [major, minor, patch] = version.split('.').map(Number)

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      throw new Error(`Invalid increment type: ${type}`)
  }
}

/**
 * Generate release notes from changelog sections
 * @param {Object} release - Release object with sections
 * @returns {string} Formatted release notes in markdown
 */
export function generateReleaseNotes(release) {
  let notes = `# Release ${release.version}\n\n`
  notes += `**Released:** ${release.date}\n\n`

  const sectionTitles = {
    added: '➕ Added',
    changed: '🔄 Changed',
    deprecated: '⚠️ Deprecated',
    removed: '❌ Removed',
    fixed: '🐛 Fixed',
    security: '🔒 Security',
    performance: '⚡ Performance',
    documentation: '📚 Documentation'
  }

  for (const [key, title] of Object.entries(sectionTitles)) {
    const items = release.sections[key]
    if (items && items.length > 0) {
      notes += `## ${title}\n\n`
      for (const item of items) {
        notes += `- ${item}\n`
      }
      notes += '\n'
    }
  }

  return notes
}

/**
 * Extract highlights from release (most important changes)
 * @param {Object} release - Release object
 * @returns {Array} Array of highlight strings
 */
export function extractHighlights(release) {
  const highlights = []

  // Prioritize: security > added > fixed > changed
  const prioritySections = ['security', 'added', 'fixed', 'changed']

  for (const section of prioritySections) {
    const items = release.sections[section]
    if (items && items.length > 0) {
      // Take first 2 items from each high-priority section
      highlights.push(...items.slice(0, 2))

      // Limit to 5 total highlights
      if (highlights.length >= 5) {
        return highlights.slice(0, 5)
      }
    }
  }

  return highlights
}

/**
 * Calculate release statistics
 * @param {Array} releases - Array of release objects
 * @returns {Object} Statistics object
 */
export function calculateReleaseStats(releases) {
  const stats = {
    totalReleases: releases.length,
    majorReleases: 0,
    minorReleases: 0,
    patchReleases: 0,
    averageChangesPerRelease: 0,
    totalChanges: {
      added: 0,
      changed: 0,
      fixed: 0,
      deprecated: 0,
      removed: 0,
      security: 0,
      performance: 0,
      documentation: 0
    },
    releaseFrequency: {} // { year: count }
  }

  let totalChanges = 0

  for (const release of releases) {
    // Count release type
    const [major, minor, patch] = release.version.split('.').map(Number)
    if (patch > 0) {
      stats.patchReleases++
    } else if (minor > 0) {
      stats.minorReleases++
    } else {
      stats.majorReleases++
    }

    // Count changes by type
    for (const [section, items] of Object.entries(release.sections)) {
      if (stats.totalChanges.hasOwnProperty(section)) {
        const count = items.length
        stats.totalChanges[section] += count
        totalChanges += count
      }
    }

    // Count releases by year
    if (release.date) {
      const year = release.date.split('-')[0]
      stats.releaseFrequency[year] = (stats.releaseFrequency[year] || 0) + 1
    }
  }

  stats.averageChangesPerRelease = releases.length > 0
    ? Math.round(totalChanges / releases.length)
    : 0

  return stats
}

/**
 * Validate semantic version format
 * @param {string} version - Version string to validate
 * @returns {boolean} True if valid
 */
export function isValidSemanticVersion(version) {
  const regex = /^\d+\.\d+\.\d+$/
  return regex.test(version)
}

/**
 * Generate changelog entry for new release
 * @param {string} version - New version
 * @param {string} date - Release date (ISO format)
 * @param {Object} changes - Changes object with sections
 * @returns {string} Changelog entry markdown
 */
export function generateChangelogEntry(version, date, changes) {
  let entry = `## [${version}] - ${date}\n\n`

  const sectionTitles = {
    added: 'Added',
    changed: 'Changed',
    deprecated: 'Deprecated',
    removed: 'Removed',
    fixed: 'Fixed',
    security: 'Security',
    performance: 'Performance',
    documentation: 'Documentation'
  }

  for (const [key, title] of Object.entries(sectionTitles)) {
    const items = changes[key]
    if (items && items.length > 0) {
      entry += `### ${title}\n`
      for (const item of items) {
        entry += `- ${item}\n`
      }
      entry += '\n'
    }
  }

  return entry
}

/**
 * Parse git commit messages to extract conventional commits
 * @param {Array} commits - Array of commit objects {hash, message, author, date}
 * @returns {Object} Categorized changes
 */
export function parseConventionalCommits(commits) {
  const changes = {
    added: [],
    changed: [],
    fixed: [],
    deprecated: [],
    removed: [],
    security: [],
    performance: [],
    documentation: []
  }

  const typeMapping = {
    feat: 'added',
    fix: 'fixed',
    docs: 'documentation',
    perf: 'performance',
    refactor: 'changed',
    style: 'changed',
    test: 'changed',
    chore: 'changed',
    security: 'security'
  }

  for (const commit of commits) {
    const match = commit.message.match(/^(\w+)(?:\(([^)]+)\))?: (.+)/)
    if (match) {
      const [, type, scope, description] = match
      const category = typeMapping[type.toLowerCase()]

      if (category && changes.hasOwnProperty(category)) {
        const formattedMessage = scope
          ? `**${scope}**: ${description}`
          : description
        changes[category].push(formattedMessage)
      }
    }
  }

  return changes
}

/**
 * Get latest version from releases array
 * @param {Array} releases - Array of release objects
 * @returns {Object|null} Latest release object
 */
export function getLatestRelease(releases) {
  if (!releases || releases.length === 0) {
    return null
  }

  return releases.reduce((latest, current) => {
    if (!latest) return current
    return compareVersions(current.version, latest.version) > 0 ? current : latest
  }, null)
}

/**
 * Check if new version is available compared to current
 * @param {string} currentVersion - Current version
 * @param {string} latestVersion - Latest available version
 * @returns {Object} Update info {available, type, current, latest}
 */
export function checkForUpdates(currentVersion, latestVersion) {
  const comparison = compareVersions(currentVersion, latestVersion)

  if (comparison >= 0) {
    return {
      available: false,
      type: null,
      current: currentVersion,
      latest: latestVersion
    }
  }

  const [currentMajor, currentMinor] = currentVersion.split('.').map(Number)
  const [latestMajor, latestMinor] = latestVersion.split('.').map(Number)

  let updateType = 'patch'
  if (latestMajor > currentMajor) {
    updateType = 'major'
  } else if (latestMinor > currentMinor) {
    updateType = 'minor'
  }

  return {
    available: true,
    type: updateType,
    current: currentVersion,
    latest: latestVersion
  }
}

export default {
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
}
