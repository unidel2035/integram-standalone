/**
 * Custom Quill Blot for embedding OSMMap in BlockDocumentEditor
 * Issue #6588: Блок карта в блоковом редакторе документов
 *
 * This blot creates a placeholder DOM node with data attributes.
 * The actual OSMMap Vue component is mounted by BlockDocumentEditor's
 * remountEmbeddedComponents() — same pattern as tables, mermaid, domain blocks.
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

// Helper function to generate unique IDs
const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

/**
 * MapBlot - Placeholder blot for OSMMap component
 */
class MapBlot extends BlockEmbed {
  static blotName = 'coda-map'
  static tagName = 'div'
  static className = 'coda-map-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    // Default values
    const center = value?.center || { lat: 55.7558, lng: 37.6173 }
    const zoom = value?.zoom || 10
    const markers = value?.markers || []
    const polygons = value?.polygons || []
    const curves = value?.curves || []
    const height = value?.height || 500
    const title = value?.title || ''
    const dataSource = value?.dataSource || null

    // Generate unique ID for this map
    const embedId = generateId('map')
    node.setAttribute('data-embed-id', embedId)

    // Store data as JSON in data-value attribute
    const mapData = { center, zoom, markers, polygons, curves, height, title, dataSource }
    node.setAttribute('data-value', JSON.stringify(mapData))

    // Build placeholder HTML (loading spinner, replaced by Vue component via remountEmbeddedComponents)
    const safeTitle = title ? title.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''

    const dbBadge = dataSource ? `<span class="map-db-badge" title="Данные из БД: ${(dataSource.database || '').replace(/</g, '&lt;')}"><i class="pi pi-database"></i> ${(dataSource.database || '').replace(/</g, '&lt;')}</span>` : ''

    // No leading whitespace — avoids text-node gap at top of block embed
    node.innerHTML = `<div class="map-block-wrapper">${(safeTitle || dbBadge) ? `<div class="map-block-header"><i class="pi pi-map"></i>${safeTitle ? `<span class="map-block-title">${safeTitle}</span>` : ''}${dbBadge}</div>` : ''}<div class="map-block-container" style="height:${height}px;position:relative;"><div class="map-placeholder-loading" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-color-secondary);"><i class="pi pi-spin pi-spinner" style="font-size:2rem;margin-right:8px;"></i><span>Загрузка карты…</span></div></div><div class="map-resize-handle"><div class="map-resize-grip"></div></div><div class="map-block-controls"><button class="map-control-btn config-btn" data-map-action="config" data-embed-id="${embedId}" title="Настроить карту"><i class="pi pi-cog"></i></button><button class="map-control-btn fullscreen-btn" data-map-action="fullscreen" data-embed-id="${embedId}" title="Полный экран"><i class="pi pi-window-maximize"></i></button></div></div>`

    return node
  }

  static value(node) {
    try {
      const dataValue = node.getAttribute('data-value')
      if (dataValue) {
        return JSON.parse(dataValue)
      }
    } catch (e) {
      console.warn('MapBlot: Failed to parse data-value:', e)
    }

    // Fallback defaults
    return {
      center: { lat: 55.7558, lng: 37.6173 },
      zoom: 10,
      markers: [],
      polygons: [],
      curves: [],
      height: 300,
      title: '',
      dataSource: null
    }
  }

  remove() {
    // Vue app cleanup happens in BlockDocumentEditor via mountedComponents
    super.remove()
  }
}

export { MapBlot }
