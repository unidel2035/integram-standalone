import { ref, computed } from 'vue'

const STORAGE_KEY = 'flow-editor-diagrams'

// Generate UUID v4
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export function useDiagramStorage() {
  const diagrams = ref([])
  const currentDiagramId = ref(null)

  // Load diagrams from Local Storage
  const loadDiagrams = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        diagrams.value = parsed.diagrams || []
        currentDiagramId.value = parsed.currentDiagramId || null

        // If no current diagram and diagrams exist, set first as current
        if (!currentDiagramId.value && diagrams.value.length > 0) {
          currentDiagramId.value = diagrams.value[0].id
        }
      } else {
        // Initialize with default diagram if no storage exists
        const defaultDiagram = createNewDiagram('Новая диаграмма')
        diagrams.value = [defaultDiagram]
        currentDiagramId.value = defaultDiagram.id
        saveDiagrams()
      }
    } catch (error) {
      console.error('Error loading diagrams from storage:', error)
      diagrams.value = []
      currentDiagramId.value = null
    }
  }

  // Save diagrams to Local Storage
  const saveDiagrams = () => {
    try {
      const data = {
        diagrams: diagrams.value,
        currentDiagramId: currentDiagramId.value
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Error saving diagrams to storage:', error)
    }
  }

  // Create new diagram object
  const createNewDiagram = (name = 'Без названия', parentId = null, linkedToNodeId = null) => {
    const now = new Date().toISOString()
    return {
      id: generateId(),
      name,
      parentId,
      linkedToNodeId,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: now,
      updatedAt: now
    }
  }

  // Get current diagram
  const currentDiagram = computed(() => {
    return diagrams.value.find(d => d.id === currentDiagramId.value) || null
  })

  // Get diagrams organized as a tree
  const diagramTree = computed(() => {
    const tree = []
    const diagramMap = new Map()

    // First pass: create map
    diagrams.value.forEach(diagram => {
      diagramMap.set(diagram.id, { ...diagram, children: [] })
    })

    // Second pass: build tree
    diagrams.value.forEach(diagram => {
      const node = diagramMap.get(diagram.id)
      if (diagram.parentId && diagramMap.has(diagram.parentId)) {
        diagramMap.get(diagram.parentId).children.push(node)
      } else {
        tree.push(node)
      }
    })

    return tree
  })

  // Create new diagram
  const createDiagram = (name = 'Новая диаграмма', parentId = null, linkedToNodeId = null) => {
    const newDiagram = createNewDiagram(name, parentId, linkedToNodeId)
    diagrams.value.push(newDiagram)
    currentDiagramId.value = newDiagram.id
    saveDiagrams()
    return newDiagram
  }

  // Update diagram
  const updateDiagram = (diagramId, updates) => {
    const index = diagrams.value.findIndex(d => d.id === diagramId)
    if (index !== -1) {
      diagrams.value[index] = {
        ...diagrams.value[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      saveDiagrams()
      return diagrams.value[index]
    }
    return null
  }

  // Update current diagram data (nodes, edges, viewport)
  const updateCurrentDiagram = (data) => {
    if (currentDiagramId.value) {
      updateDiagram(currentDiagramId.value, data)
    }
  }

  // Rename diagram
  const renameDiagram = (diagramId, newName) => {
    return updateDiagram(diagramId, { name: newName })
  }

  // Delete diagram
  const deleteDiagram = (diagramId) => {
    // Don't allow deleting the last diagram
    if (diagrams.value.length <= 1) {
      return false
    }

    // Also delete child diagrams
    const deleteRecursive = (id) => {
      const children = diagrams.value.filter(d => d.parentId === id)
      children.forEach(child => deleteRecursive(child.id))
      diagrams.value = diagrams.value.filter(d => d.id !== id)
    }

    deleteRecursive(diagramId)

    // If deleted diagram was current, switch to first available
    if (currentDiagramId.value === diagramId) {
      currentDiagramId.value = diagrams.value.length > 0 ? diagrams.value[0].id : null
    }

    saveDiagrams()
    return true
  }

  // Duplicate diagram
  const duplicateDiagram = (diagramId) => {
    const original = diagrams.value.find(d => d.id === diagramId)
    if (!original) return null

    const duplicate = createNewDiagram(
      `${original.name} (копия)`,
      original.parentId,
      null
    )
    duplicate.nodes = JSON.parse(JSON.stringify(original.nodes))
    duplicate.edges = JSON.parse(JSON.stringify(original.edges))
    duplicate.viewport = { ...original.viewport }

    diagrams.value.push(duplicate)
    currentDiagramId.value = duplicate.id
    saveDiagrams()
    return duplicate
  }

  // Set current diagram
  const setCurrentDiagram = (diagramId) => {
    if (diagrams.value.find(d => d.id === diagramId)) {
      currentDiagramId.value = diagramId
      saveDiagrams()
      return true
    }
    return false
  }

  // Search diagrams
  const searchDiagrams = (query) => {
    if (!query) return diagrams.value
    const lowerQuery = query.toLowerCase()
    return diagrams.value.filter(d =>
      d.name.toLowerCase().includes(lowerQuery)
    )
  }

  // Get child diagrams
  const getChildDiagrams = (parentId) => {
    return diagrams.value.filter(d => d.parentId === parentId)
  }

  // Export diagrams (for backup)
  const exportDiagrams = () => {
    return JSON.stringify({
      diagrams: diagrams.value,
      currentDiagramId: currentDiagramId.value,
      exportedAt: new Date().toISOString()
    }, null, 2)
  }

  // Import diagrams (from backup)
  const importDiagrams = (jsonString) => {
    try {
      const data = JSON.parse(jsonString)
      if (data.diagrams && Array.isArray(data.diagrams)) {
        diagrams.value = data.diagrams
        currentDiagramId.value = data.currentDiagramId || (data.diagrams[0]?.id || null)
        saveDiagrams()
        return true
      }
      return false
    } catch (error) {
      console.error('Error importing diagrams:', error)
      return false
    }
  }

  // Initialize
  loadDiagrams()

  return {
    // State
    diagrams,
    currentDiagramId,
    currentDiagram,
    diagramTree,

    // Methods
    createDiagram,
    updateDiagram,
    updateCurrentDiagram,
    renameDiagram,
    deleteDiagram,
    duplicateDiagram,
    setCurrentDiagram,
    searchDiagrams,
    getChildDiagrams,
    exportDiagrams,
    importDiagrams,
    saveDiagrams,
    loadDiagrams
  }
}
