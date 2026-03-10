/**
 * workspaceOntologyService — loads workspace structure from Integram ontology.
 *
 * Superclasses stored in СОД Концепты (type 2416):
 *   WorkspacePanel    — nav sections (overview, finance, deal, ip, agents)
 *   StartupDocument   — documents in DataRoom
 *   DealDocument      — deal-phase documents
 *   IPDocument        — IP / legal documents
 *   WorkspaceEvent    — event types for EventLog
 */

const BASE = '/api/workspace'

// ── Concepts ─────────────────────────────────────────────────────

export async function fetchConcepts(superclass) {
  const url = superclass ? `${BASE}/concepts?superclass=${encodeURIComponent(superclass)}` : `${BASE}/concepts`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`workspace/concepts: ${res.status}`)
  const { concepts } = await res.json()
  return concepts || []
}

// ── Build artifact tree from ontology ────────────────────────────
//
// Expected concept structure (meta field = JSON in Синонимы req):
// {
//   key: 'dashboard',
//   label: 'Дашборд',
//   superclass: 'WorkspacePanel',
//   meta: {
//     icon: 'pi pi-chart-bar',
//     type: 'dashboard',          // dashboard|doc|finmodel|chat|grants
//     section: 'overview',        // parent section key
//     roles: ['founder','investor','expert'],
//     required: true,
//     url: 'https://...',         // optional external link
//     downloadUrl: 'https://...'
//   }
// }

const SECTION_DEFS = {
  overview:  { label: 'Обзор',                             icon: 'pi pi-th-large',    roles: ['founder','investor','expert'] },
  dataroom:  { label: 'DataRoom',                          icon: 'pi pi-folder-open', roles: ['founder','investor','expert'] },
  finance:   { label: 'Финансы',                           icon: 'pi pi-chart-line',  roles: ['founder','investor'] },
  deal:      { label: 'Сделка',                            icon: 'pi pi-handshake',   roles: ['founder','investor'] },
  ip:        { label: 'Интеллектуальная собственность',    icon: 'pi pi-shield',      roles: ['founder','expert'] },
  agents:    { label: 'Агент',                             icon: 'pi pi-android',     roles: ['founder','expert'] },
}

export async function buildArtifactTree() {
  try {
    // Load all document types in parallel
    const [panels, startupDocs, dealDocs, ipDocs] = await Promise.all([
      fetchConcepts('WorkspacePanel'),
      fetchConcepts('StartupDocument'),
      fetchConcepts('DealDocument'),
      fetchConcepts('IPDocument'),
    ])
    const wsConcepts = [...panels, ...startupDocs, ...dealDocs, ...ipDocs]

    if (!wsConcepts.length) return null   // fallback to static

    // Group by section (meta.section)
    const bySection = {}
    for (const c of wsConcepts) {
      const sec = c.meta?.section || 'overview'
      if (!bySection[sec]) bySection[sec] = []
      bySection[sec].push({
        key:         c.key,
        label:       c.label,
        icon:        c.meta?.icon || 'pi pi-file',
        type:        c.meta?.type || 'doc',
        roles:       c.meta?.roles || null,
        required:    c.meta?.required || false,
        filled:      c.meta?.filled || false,
        url:         c.meta?.url || null,
        downloadUrl: c.meta?.downloadUrl || null,
        conceptId:   c.id,
      })
    }

    // Build sections array
    const sections = Object.entries(SECTION_DEFS)
      .filter(([key]) => bySection[key])
      .map(([key, def]) => ({
        key,
        ...def,
        items: bySection[key] || [],
      }))

    return sections.length ? sections : null
  } catch (err) {
    console.warn('[workspaceOntologyService] Failed to load from ontology:', err.message)
    return null
  }
}

// ── Events ────────────────────────────────────────────────────────

export async function logEvent({ type = 'info', entityType = '', entityId = '', text = '', data = {} }) {
  try {
    await fetch(`${BASE}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, entityType, entityId, text, data }),
    })
  } catch { /* non-critical */ }
}

export async function fetchEvents(entityId, limit = 30) {
  try {
    const url = entityId
      ? `${BASE}/events?entityId=${encodeURIComponent(entityId)}&limit=${limit}`
      : `${BASE}/events?limit=${limit}`
    const res = await fetch(url)
    if (!res.ok) return []
    const { events } = await res.json()
    return events || []
  } catch {
    return []
  }
}

// ── Company twin sync ─────────────────────────────────────────────

export async function syncCompanyTwin(twin, id = null) {
  try {
    const res = await fetch(`${BASE}/company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, twin }),
    })
    if (res.ok) {
      const { id: newId } = await res.json()
      return newId
    }
  } catch { /* non-critical */ }
  return null
}
