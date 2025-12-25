/**
 * Integram API Client
 * Provides a unified interface for Integram database operations
 */

import { useIntegramStore } from '@/stores/integramStore'

class IntegramApiClient {
  constructor() {
    this.store = null
  }

  /**
   * Initialize the client with the store
   */
  init() {
    if (!this.store) {
      this.store = useIntegramStore()
    }
  }

  /**
   * Get current database name
   */
  getDatabase() {
    this.init()
    return this.store?.database || ''
  }

  /**
   * Get dictionary (list of types/tables)
   */
  async getDictionary() {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.getDictionary()
  }

  /**
   * Get type metadata
   */
  async getTypeMetadata(typeId) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.getTypeMetadata(typeId)
  }

  /**
   * Get object count for a type
   */
  async getObjectCount(typeId) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.getObjectCount(typeId)
  }

  /**
   * Get object list
   */
  async getObjectList(typeId, params = {}) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.getObjectList(typeId, params)
  }

  /**
   * Get all objects for a type
   */
  async getAllObjects(typeId, options = {}) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.getAllObjects(typeId, options)
  }

  /**
   * Create a new type
   */
  async createType(typeData) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.createType(typeData)
  }

  /**
   * Clone table structure
   */
  async cloneTableStructure(sourceTypeId, newTableName) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.cloneTableStructure(sourceTypeId, newTableName)
  }

  /**
   * Delete type
   */
  async deleteType(typeId) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.deleteType(typeId)
  }

  /**
   * Create object
   */
  async createObject(typeId, objectData) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.createObject(typeId, objectData)
  }

  /**
   * Save/update object
   */
  async saveObject(objectId, typeId, objectData) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.saveObject(objectId, typeId, objectData)
  }

  /**
   * Delete object
   */
  async deleteObject(objectId) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.deleteObject(objectId)
  }

  /**
   * Get object edit data
   */
  async getObjectEditData(objectId) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.getObjectEditData(objectId)
  }

  /**
   * Set object requisites
   */
  async setObjectRequisites(objectId, requisites) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.setObjectRequisites(objectId, requisites)
  }

  /**
   * Add requisite to type
   */
  async addRequisite(typeId, requisiteTypeId) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.addRequisite(typeId, requisiteTypeId)
  }

  /**
   * Delete requisite
   */
  async deleteRequisite(requisiteId) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.deleteRequisite(requisiteId)
  }

  /**
   * Execute report
   */
  async executeReport(reportId, params = {}) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.executeReport(reportId, params)
  }

  /**
   * Execute smart query
   */
  async smartQuery(queryData) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.smartQuery(queryData)
  }

  /**
   * Execute natural language query
   */
  async naturalQuery(question, targetTable = null) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.naturalQuery(question, targetTable)
  }

  /**
   * Get reference options
   */
  async getRefReqs(requisiteId, objectId = 0, query = '', restrict = null) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.getRefReqs(requisiteId, objectId, query, restrict)
  }

  /**
   * Get table structure
   */
  async getTableStructure(typeId) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.getTableStructure(typeId)
  }

  /**
   * Get multiselect items
   */
  async getMultiselectItems(objectId, requisiteId) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.getMultiselectItems(objectId, requisiteId)
  }

  /**
   * Add multiselect item
   */
  async addMultiselectItem(objectId, requisiteId, value) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.addMultiselectItem(objectId, requisiteId, value)
  }

  /**
   * Remove multiselect item
   */
  async removeMultiselectItem(itemId) {
    this.init()
    if (!this.store) {
      throw new Error('Integram store not initialized')
    }
    return await this.store.removeMultiselectItem(itemId)
  }
}

// Export a singleton instance
export default new IntegramApiClient()
